# Tecnologias para o back (`projeto/back`)

Estilo de referência: meu padrão de backend em Go (Gin + pgx + sqlc + goose).
Objetivo: replicar o mesmo preciosismo em TypeScript — camadas claras, SQL escrito à mão,
sem ORM, sem framework de DI, erros nunca engolidos, testes em todas as camadas.

| Área | Escolha | Equivalente no padrão Go |
| --- | --- | --- |
| Runtime | Node.js + TypeScript (strict) | Go |
| HTTP | Fastify | Gin |
| Driver | `pg` (node-postgres) | `pgx/v5` |
| SQL tipado | **PgTyped** (`@pgtyped/cli` + `@pgtyped/runtime`, driver `pg`) — ver `DECISOES_FUNDACAO.md` §12 | sqlc |
| Migrations | dbmate (`-- migrate:up` / `-- migrate:down`) | goose |
| Validação de entrada | Zod | `ShouldBindJSON` + validação no service |
| Logs | pino (logger do Fastify) com `redact` | — |
| Testes | Vitest (unit com fakes à mão + integração com Postgres real) | `go test` + `-tags=integration` |

## Camadas (regras inegociáveis)

```
back/src/
├── types/                 entidades + schemas Zod dos inputs (DTOs)
├── repository/postgres/
│   ├── migrations/        *.sql do dbmate (schema de verdade)
│   ├── queries/           *.sql com /* @name X */ + *.queries.ts GERADO ao lado (nunca editar à mão)
│   └── *_storage.ts       classe que embrulha o gerado + mapX() row → types
├── service/               regra de negócio; interface do repositório declarada NO arquivo do service
├── handler/http/
│   ├── controller/        fino: valida input → chama service → mapeia erro
│   ├── router/            rotas + hooks (auth, requireRole)
│   └── errors.ts          único mapeador erro de domínio → status HTTP
├── modules/               blocos puros reutilizáveis (money, cnpj, date)
└── main.ts                composition root: injeção manual + mustGetEnv()
```

- **Controller não tem regra de negócio.** Só valida o input, chama o service e responde.
- **Service não importa nada de fora do domínio.** Recebe as dependências por interface declarada no
  próprio arquivo (o consumidor define a interface).
- **Repositório não conhece HTTP.** Só traduz a chamada pro Postgres.
- **Transação:** `pool.connect()` → `BEGIN` → `try { …; COMMIT } finally { ROLLBACK se não commitou; release() }`.
  As queries geradas pelo PgTyped recebem o `client` da transação em `X.run(params, client)` (equivalente ao `q.WithTx(tx)`).
- **Erros:** classes de domínio exportadas pelo service (`ConflictError`, `NotFoundError`,
  `InvalidTransitionError`, `ValidationError`, `ForbiddenError`), no lugar dos `var ErrX` sentinela.
  Um único mapeador em `handler/http/errors.ts` (equivalente a um `switch` com `errors.Is` no Go).
  O que não for reconhecido vira 500 com `"internal server error"`, sem vazar a mensagem.
- **Proibido engolir erro:** nenhum `catch` vazio, nenhuma promise solta. ESLint com
  `@typescript-eslint/no-floating-promises` e `no-empty` garante isso.
- **Config:** `mustGetEnv()` falha na subida se faltar variável obrigatória. Nada de dotenv mágico em produção.

## Testes

- **Unit (service):** fakes escritos à mão que implementam a interface do repositório (igual ao
  um mock escrito à mão em Go). Nada de `vi.mock` de módulo.
- **Módulos puros:** tabela de casos (`parseBRLToCents` com os exemplos do `expected_results.json`,
  dígitos do CNPJ, "vencido" em datas de borda).
- **Integração:** arquivos `*.integration.test.ts` num projeto Vitest separado, contra o Postgres real
  (equivalente ao `//go:build integration` + `setupPool(t)`). Cobre a duplicidade simultânea
  (`Promise.all` de 2 inserts → 1 cria, 1 recebe 409), as transições concorrentes e o dashboard com o seed.
- **HTTP:** `app.inject()` do Fastify, sem abrir porta (solicitante tentando aprovar → 403).

## Pontos antes pendentes (fechados)
- **Hash de senha:** argon2id (`@node-rs/argon2`), parâmetros mínimos da OWASP. Ver `DECISOES_FUNDACAO.md` §8.5.
- **Sessão:** ~~JWT em cookie~~ → **sessão opaca no Postgres** (revogação real no logout). Ver `DECISOES_FUNDACAO.md` §8.
- **Tipo do valor:** `BIGINT` + `CHECK (amount_cents > 0)`; o `mapX()` converte string → number com
  `Number.isSafeInteger`.
