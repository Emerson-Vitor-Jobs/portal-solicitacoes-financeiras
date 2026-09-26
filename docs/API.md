# API

A referência completa e interativa é o Swagger, em http://localhost:3000/api/docs (gerado das mesmas rotas que
validam as requisições; o JSON bruto fica em `/api/docs/json` e em [`back/openapi.json`](../back/openapi.json)).
Este guia mostra o essencial e um passeio com `curl` pelo fluxo completo.

## Convenções

- Base: `http://localhost:3000/api` (o nginx repassa para a API, na mesma origem do front).
- JSON em `snake_case`. Dinheiro sempre em centavos inteiros (`amount_cents`).
- Datas de negócio (`due_date`, filtros): `YYYY-MM-DD`. Competência: `YYYY-MM`. Instantes
  (`created_at`, `paid_at`…): RFC 3339. Na entrada, com offset obrigatório (`2026-09-25T14:30:00-03:00`); na saída,
  em UTC.
- Autenticação: cookie de sessão `sid` (HttpOnly), definido pelo login.
- Todo `POST` exige `X-Requested-With: gex-web` (proteção CSRF); sem ele, a resposta é 403.
- Erros: `application/problem+json` (RFC 9457), com `code` estável e, no 422, `errors[]` por campo:
  ```json
  { "type": "about:blank", "title": "Conflict", "status": 409, "code": "DUPLICATE_INVOICE",
    "detail": "Já existe uma solicitação com este CNPJ e número de nota fiscal." }
  ```
  A tabela completa de status e códigos está em [`ARCHITECTURE.md` §4](../ARCHITECTURE.md#4-tratamento-de-erros).

## Rotas

| Rota | Quem | Entrada | Sucesso |
| --- | --- | --- | --- |
| `POST /auth/login` | público (rate limit) | `{ email, password }` | 200 `{ user }` + cookie `sid` |
| `POST /auth/logout` | logado | — | 204 |
| `GET /auth/me` | logado | — | 200 `{ user, reference_date }` |
| `GET /requests` | logado¹ | `status`, `supplier`, `due_from`, `due_to`, `page`, `page_size` (≤ 100) | 200 `{ data, page, page_size, total, total_pages, reference_date }` |
| `POST /requests` | REQUESTER | `{ supplier_name, supplier_cnpj, invoice_number, amount_cents, competence, due_date, category, description? }` | 201 + `Location` + detalhe |
| `GET /requests/:id` | dono ou FINANCE | — | 200 detalhe com `history` e `is_overdue` |
| `POST /requests/:id/decision` | FINANCE | `{ "decision": "APPROVE" }` ou `{ "decision": "REJECT", "reason": "…" }` | 200 detalhe |
| `POST /requests/:id/mark-paid` | FINANCE | `{ paid_at, payment_reference }` | 200 detalhe |
| `GET /dashboard/summary` | logado¹ | — | 200 `{ pending_amount_cents, approved_amount_cents, paid_this_month_amount_cents, overdue_count, reference_date }` |
| `GET /health` | público | — | 200 `{ status: "ok" }` (ping no banco) |

¹ O REQUESTER vê só as próprias solicitações; o FINANCE vê todas.

`category` aceita `INFRAESTRUTURA`, `MARKETING`, `SERVIÇOS` ou `SOFTWARE`. `supplier_cnpj` aceita o CNPJ com ou sem
máscara, numérico ou alfanumérico, e é guardado com as 14 posições.

## Passeio com `curl`

```bash
API=http://localhost:3000/api
CSRF='X-Requested-With: gex-web'
JSON='Content-Type: application/json'

# 1. A solicitante entra (o cookie fica em ana.txt)
curl -s -c ana.txt -X POST $API/auth/login -H "$CSRF" -H "$JSON" \
  -d '{"email":"solicitante@gex.test","password":"GexRequester123!"}'

# 2. Cria uma solicitação (CNPJ com máscara; R$ 1.553,13 = 155313 centavos)
curl -s -b ana.txt -i -X POST $API/requests -H "$CSRF" -H "$JSON" -d '{
  "supplier_name": "Fornecedor Exemplo", "supplier_cnpj": "12.ABC.345/01DE-35",
  "invoice_number": "NF-EX-1", "amount_cents": 155313, "competence": "2026-09",
  "due_date": "2026-09-30", "category": "SOFTWARE"}'
#    → 201, com o header Location: /api/requests/<id>. Repetir o mesmo POST → 409 DUPLICATE_INVOICE

# 3. A solicitante tenta aprovar → 403
curl -s -b ana.txt -X POST $API/requests/<id>/decision -H "$CSRF" -H "$JSON" -d '{"decision":"APPROVE"}'

# 4. O financeiro entra, aprova e paga
curl -s -c fin.txt -X POST $API/auth/login -H "$CSRF" -H "$JSON" \
  -d '{"email":"financeiro@gex.test","password":"GexFinance123!"}'
curl -s -b fin.txt -X POST $API/requests/<id>/decision -H "$CSRF" -H "$JSON" -d '{"decision":"APPROVE"}'
curl -s -b fin.txt -X POST $API/requests/<id>/mark-paid -H "$CSRF" -H "$JSON" \
  -d "{\"paid_at\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"payment_reference\":\"PAG-EX-1\"}"
#    → 200, com history: PENDING (Ana) → APPROVED (Fernanda) → PAID (Fernanda, referência PAG-EX-1)

# 5. Painel e lista filtrada
curl -s -b fin.txt $API/dashboard/summary
curl -s -b fin.txt "$API/requests?status=PENDING&supplier=servicos&due_from=2026-09-01&due_to=2026-09-30"
```

Pra voltar ao estado original do seed depois: `docker compose down -v && docker compose up --build`.
