# Testes

**280 testes** automatizados: 148 no back (116 unitários + 32 de integração no PostgreSQL real) e 132 no front.

```bash
docker compose --profile test run --rm back-test    # aplica as migrations no banco de teste e roda tudo
docker compose --profile test run --rm front-test
```

Localmente: em `back/`, `npm run test:unit` e `npm run test:integration` (precisa do Postgres do compose); em
`front/`, `npm test`.

## Estratégia: cobertura por comportamento, não por porcentagem

Não há meta de cobertura. O esforço vai concentrado nos pontos em que um erro vira **dado errado**: dinheiro,
duplicidade, transição, concorrência e datas. A régua é a confiança, não a quantidade (§9.5).

| Nível | Ferramenta | O que prova |
| --- | --- | --- |
| **Unitário (lógica pura)** | Vitest, tabelas de casos | `parseBRLToCents`, CNPJ (numérico e alfanumérico), regras de data, tabela de transições |
| **Unitário (service)** | Vitest + **fakes escritos à mão** que implementam a porta do repositório | regras de negócio sem banco: papéis, travas de pagamento, normalização, erros de domínio |
| **HTTP** | `app.inject()` do Fastify (sem abrir porta) | status, formato RFC 9457, CSRF, rate limit, sessão, headers |
| **Integração** | **PostgreSQL real** (`gex_finance_it`), `TRUNCATE` entre testes, em série | `UNIQUE` e compare-and-set **com conexões concorrentes de verdade**, filtros SQL, snapshot da paginação, trigger append-only, dashboard contra o oráculo oficial |
| **Componentes** | Testing Library + user-event + **MSW** | telas reais contra uma API falsa que exige o header anti-CSRF e responde no formato do contrato |
| **Contrato** | teste de igualdade no back + teste de tipos no front | o `openapi.json` commitado é exatamente o que as rotas geram; o front não compila se o contrato mudar |

**Por que o banco de teste é separado:** o teste do dashboard espera exatamente R$ 8.750,49. Uma solicitação criada
por outro teste mudaria o número, e o `TRUNCATE` apagaria os dados de quem usa o app. **Sem `DATABASE_URL`, a
integração falha em vez de pular**, pra nunca "passar" sem ter rodado.

## Os testes obrigatórios do enunciado

O número entre `#` aparece no nome do teste (`grep -rn "#3" back front`).

| # | Enunciado | Onde | Como |
| --- | --- | --- | --- |
| **#1** | conversão de valor brasileiro para centavos | `front/src/lib/money.test.ts` | tabela com os 4 exemplos oficiais de `data/expected_results.json` + gramática BR (aceita `1.553`, recusa `1553.13`) |
| **#2** | bloqueio de nota duplicada | `back/src/service/requests.test.ts`, `back/test/integration/requests.integration.test.ts` | a mesma nota escrita de outro jeito (`nf-1 ` × `NF-1`) → 409 e nenhum registro extra |
| **#3** | duas criações duplicadas simultâneas | `requests.integration.test.ts` | `Promise.all` de dois POSTs → exatamente 1 criado, 1 recebe 409, 1 linha no banco |
| **#4** | solicitante tentando aprovar ou rejeitar | `requests.test.ts`, `requests.integration.test.ts` | 403 e nada muda; o papel é checado antes de buscar o recurso (403 até para id inexistente) |
| **#5** | transições válidas e inválidas | `back/src/service/transitions.test.ts`, `requests.test.ts` | matriz 4×4 de status × destino |
| **#6** | ações simultâneas (concorrência de status) | `requests.integration.test.ts` | aprovar × rejeitar ao mesmo tempo → 1 vence, 1 recebe 409, 1 evento de decisão |
| **#7** | rejeição sem motivo | `back/src/handler/http/errors.test.ts`, `requests.test.ts`, integração | 422 no campo `reason`, e a solicitação continua PENDING |
| **#8** | cálculo do dashboard (pago no mês e vencidos) | `back/test/integration/dashboard.integration.test.ts` | **lê o `expected_results.json` como oráculo** e confere o FINANCE e os 2 solicitantes |
| **#9** | fluxo de integração com PostgreSQL real | `back/test/integration/flow.integration.test.ts` | criar → aprovar → pagar via HTTP, com o histórico de 3 eventos na ordem e `paid_at` próprio |
| **#10** | componentes do frontend | `front/src/components/MoneyInput.test.tsx`, `front/src/features/requests/*.test.tsx` | máscara estilo banco, colar, **dois cliques = 1 POST**, 409 no campo da nota, ações por papel × status |

## Além do obrigatório (os pontos de risco)

| # | Comportamento | Onde |
| --- | --- | --- |
| #11 | CNPJ: dígito verificador, máscara, minúscula, alfanumérico oficial (`12ABC34501DE35`), sequências repetidas | `back/src/modules/cnpj.test.ts`, `front/src/lib/cnpj.test.ts` |
| #12 | bordas de data: vencer **hoje** não é vencida; pagamento em 31/08 fica fora de setembro; 31/08 23:59:59 em SP (já 01/09 em UTC) fica fora; `DATE` volta sem deslocar; offset de SP com horário de verão | `back/src/modules/date.test.ts`, integração, `front/src/lib/date.test.ts` |
| #13 | solicitação alheia → 404; usuário inexistente = mesma resposta **e mesma verificação argon2** que senha errada | `auth.test.ts`, integração |
| #14 | sem header anti-CSRF → 403; `paid_at` futuro ou antes da aprovação → 422 (comparado no minuto) | `router/auth.test.ts`, `requests.test.ts`, integração |
| #15 | auditoria append-only: `UPDATE`/`DELETE` em `audit_events` falham no banco | `requests.integration.test.ts` |
| — | o log de um `23505` real não contém CNPJ, nota nem valor | `flow.integration.test.ts`, `logging.test.ts` |
| — | rate limit por e-mail e por IP → 429 com `Retry-After` | `back/src/handler/http/router/auth.test.ts` |
| — | sessão ociosa (30 min) e absoluta (8 h), com relógio injetado | `back/src/service/auth.test.ts` |
| — | página além da última → `data: []` com o total certo; `%` e `_` na busca são literais | `back/test/integration/list.integration.test.ts` |

## O que conscientemente não é testado

O código gerado (PgTyped, openapi-typescript), os mapeamentos triviais (cobertos indiretamente pela integração), a
fiação do Fastify e o estilo visual.
