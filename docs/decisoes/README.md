# Decisões de arquitetura

Cada decisão registra as alternativas consideradas, o motivo da escolha e as
fontes (RFCs, OWASP, documentação oficial). O registro completo está em [`DECISOES_FUNDACAO.md`](DECISOES_FUNDACAO.md).

| § | Decisão | Escolha, em uma linha |
| --- | --- | --- |
| 1 | Estrutura do repositório | `back/` e `front/` independentes; `data/` intocado e montado só para leitura |
| 2 | Contrato da API | schemas Zod → OpenAPI → tipos gerados no front (fonte única, nada escrito à mão) |
| 3 | Convenção de nomes | `snake_case` na borda (JSON, banco), `camelCase` no domínio, conversão explícita |
| 4 | Erros e paginação | RFC 9457 com `code` estável; `page`/`page_size`, total no mesmo snapshot `REPEATABLE READ` |
| 5 | Status HTTP | 400 sintaxe / 422 semântica · 401 · 403 papel · 404 posse e inexistente · 409 conflito · 201 + `Location` · `no-store` |
| 6 | Datas e tipos | `DATE` para dia, `TIMESTAMPTZ` para instante, "hoje" vindo da aplicação, intervalo semiaberto, `TEXT` + `CHECK` |
| 7 | Categoria, nota, busca, tamanhos | categorias fixas; nota canônica garantida no banco; `unaccent` + curingas escapados; limites no Zod e no banco |
| 8 | Autenticação e sessão | sessão opaca no Postgres (hash SHA-256), 30 min / 8 h, `SameSite=Strict` + header anti-CSRF, argon2id |
| 9 | Boot, seed e testes | migrations → seed idempotente → servidor; banco de teste separado; cobertura por comportamento |
| 10 | Contrato antes da implementação | schemas e `openapi.json` definidos antes das rotas; front construído contra o contrato com MSW |
| 11 | CNPJ | numérico + alfanumérico (Receita Federal, jul/2026), mesmo algoritmo |
| 12 | Camada SQL | PgTyped: SQL em arquivo, tipos gerados pelo próprio Postgres, sem ORM |
| 13 | Runtime | Node 24 LTS com versão fixa na imagem |
| 14 | Dinheiro, tempo, logs, rate limit | parser BRL no front; `is_overdue`/`reference_date` do servidor; log sem dado sensível; rate limit por IP e e-mail |
| 15 | Versões | TypeScript 5.9 (única faixa aceita por todo o ferramental), Mantine 9, versões exatas |
| 16 | Padrões de arquitetura | camadas + Ports and Adapters no lado de saída, Unit of Work, Transaction Script; sem DDD/CQRS |
| 17 | Sistema visual | paleta e tipografia do EasyPay (CC BY 4.0) num tema único; ilustrações Open Doodles (CC0) |

Pesquisas de apoio: [`PESQUISA_HTTP.md`](PESQUISA_HTTP.md) (RFC 9110/9111 aplicadas às decisões de status e
cache) e [`SQL_FIRST_VS_QUERY_BUILDERS.md`](SQL_FIRST_VS_QUERY_BUILDERS.md) (por que SQL escrito à mão).

Stack de cada lado: [`TECNOLOGIAS_BACK.md`](TECNOLOGIAS_BACK.md) e [`TECNOLOGIAS_FRONT.md`](TECNOLOGIAS_FRONT.md).
