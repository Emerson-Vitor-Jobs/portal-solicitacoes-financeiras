# Tecnologias para o back (`projeto/back`)

Referência de estilo: backends em Go com Gin + pgx + sqlc + goose (SQL à mão, camadas, sem ORM).
Objetivo: replicar o mesmo preciosismo em TypeScript, com camadas claras, SQL escrito à mão, sem ORM, sem
framework de DI, sem erro engolido e com testes em todas as camadas.

| Área | Escolha | Equivalente em Go |
| --- | --- | --- |
| Runtime | Node.js + TypeScript (strict) | Go |
| HTTP | Fastify | Gin |
| Driver | `pg` (node-postgres) | `pgx/v5` |
| SQL tipado | PgTyped (`@pgtyped/cli` + `@pgtyped/runtime`, driver `pg`); ver `DECISOES_FUNDACAO.md` §12 | sqlc |
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
├── app.ts                 composition root: injeção manual (buildApp)
└── main.ts                processo: lê a config, cria o pool, sobe o servidor, trata SIGTERM
```

- Controller não tem regra de negócio: só valida o input, chama o service e responde.
- Service não importa nada de fora do domínio. Recebe as dependências por interface declarada no
  próprio arquivo (o consumidor define a interface).
- Repositório não conhece HTTP; só traduz a chamada para o Postgres.
- Transação: `pool.connect()` → `BEGIN` → `try { …; COMMIT } finally { ROLLBACK se não commitou; release() }`.
  As queries geradas pelo PgTyped recebem o `client` da transação em `X.run(params, client)` (equivalente ao `q.WithTx(tx)`).
- Erros: classes de domínio exportadas pelo service (`ConflictError`, `NotFoundError`,
  `InvalidTransitionError`, `ValidationError`, `ForbiddenError`) fazem o papel dos `var ErrX` sentinela.
  Um único mapeador em `handler/http/errors.ts` as traduz (equivalente a um `switch` com `errors.Is` no Go).
  O que não for reconhecido vira 500 com `"internal server error"`, sem vazar a mensagem.
- Proibido engolir erro: nenhum `catch` vazio, nenhuma promise solta. O ESLint garante isso com
  `@typescript-eslint/no-floating-promises` e `no-empty`.
- Config: `mustGetEnv()` falha na subida se faltar variável obrigatória. Sem dotenv mágico em produção.

## Testes

- Unit (service): fakes escritos à mão que implementam a interface do repositório (como um mock escrito à mão
  em Go), sem `vi.mock` de módulo.
- Módulos puros: tabela de casos (`parseBRLToCents` com os exemplos do `expected_results.json`,
  dígitos do CNPJ, "vencido" em datas de borda).
- Integração: arquivos `*.integration.test.ts` num projeto Vitest separado, contra o Postgres real
  (equivalente ao `//go:build integration` + `setupPool(t)`). Cobre a duplicidade simultânea
  (`Promise.all` de 2 inserts → 1 cria, 1 recebe 409), as transições concorrentes e o dashboard com o seed.
- HTTP: `app.inject()` do Fastify, sem abrir porta (solicitante tentando aprovar → 403).

## Pontos antes pendentes (fechados)
- Hash de senha: argon2id (`@node-rs/argon2`), parâmetros mínimos da OWASP. Ver `DECISOES_FUNDACAO.md` §8.5.
- Sessão: sessão opaca no Postgres, que substituiu o JWT em cookie previsto antes por permitir revogação real no
  logout. Ver `DECISOES_FUNDACAO.md` §8.
- Tipo do valor: `BIGINT` + `CHECK (amount_cents > 0)`; o `mapX()` converte string → number com
  `Number.isSafeInteger`.
