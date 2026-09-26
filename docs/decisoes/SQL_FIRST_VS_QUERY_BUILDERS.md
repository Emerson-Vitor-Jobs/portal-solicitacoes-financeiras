# SQL-first vs. query builders vs. ORMs

Por que este projeto escreve SQL à mão (PgTyped) no ecossistema TypeScript, que em geral prefere não escrever.
Complementa a decisão 12 do `DECISOES_FUNDACAO.md`.

## O espectro: do SQL puro ao ORM

A mesma operação nos quatro estilos: aprovar uma solicitação pendente.

### 1. SQL cru numa string (`pg` puro)
```ts
const r = await client.query(
  "UPDATE requests SET status='APPROVED' WHERE id=$1 AND status='PENDING' RETURNING *", [id]);
r.rows[0] // tipo: any. O TypeScript não sabe nada.
```

### 2. SQL-first com codegen (sqlc no Go, PgTyped no TS): o estilo deste projeto
A query real do projeto (`back/src/repository/postgres/queries/requests.sql`), que serve para todas as transições:
```sql
/* @name UpdateRequestStatus */
UPDATE requests
SET status = :to!,
    rejection_reason = :rejectionReason,
    paid_at = :paidAt,
    payment_reference = :paymentReference,
    updated_at = now()
WHERE id = :id! AND status = :from!
RETURNING id;
```
```ts
const rows = await updateRequestStatus.run(
  { id, from: 'PENDING', to: 'APPROVED', rejectionReason: null, paidAt: null, paymentReference: null },
  client,
); // parâmetros e resultado tipados, gerados a partir do SQL
```
Você escreve SQL, e a ferramenta gera o código tipado.

### 3. Query builder (Kysely, Knex)
```ts
await db.updateTable('requests')
  .set({ status: 'APPROVED' })
  .where('id', '=', id)
  .where('status', '=', 'PENDING')
  .returningAll()
  .executeTakeFirst()
```
O SQL é montado com funções do TypeScript. O builder não esconde o SQL (cada método é quase uma palavra do SQL), mas
quem escreve a string final é a biblioteca. Os tipos vêm de uma interface que descreve as tabelas, e o TypeScript infere o
resultado em tempo de compilação, sem passo de geração por query.

### 4. ORM (Prisma, TypeORM)
```ts
await prisma.request.update({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED' } })
```
Você pensa em objetos, e o ORM decide qual SQL executar. Ele também cuida de relacionamentos, migrations e cache.

## Por que a comunidade TypeScript tende a não escrever SQL

1. Origem da comunidade. Muita gente chegou ao Node vinda do front-end, e o back-end Node cresceu na era do
   MongoDB e do Rails (ActiveRecord). A cultura dominante virou "o banco é um detalhe, eu penso em objetos".
2. O sistema de tipos do TS permite o que o do Go não permitia. O TypeScript consegue inferir, pelo encadeamento
   de `.where().select()`, o tipo exato do resultado, o que dá autocomplete e checagem sem gerar código. O Go, com
   um sistema de tipos mais simples e generics tardios, resolveu o mesmo problema com codegen (`go generate`,
   protobuf, sqlc). Os dois ecossistemas chegaram a soluções diferentes porque as linguagens permitem coisas
   diferentes.
3. Query dinâmica, o ponto forte real dos builders. A lista deste projeto tem 4 filtros opcionais:
   - no builder, sai natural: `if (status) q = q.where('status', '=', status)`;
   - no SQL-first, usa-se o truque `WHERE (:status::text IS NULL OR status = :status)`. Funciona, mas é menos
     elegante e às vezes pior para o planejador do Postgres, o que não importa com o volume deste desafio.
4. Um passo a menos no fluxo. O builder não pede para rodar o gerador; o PgTyped pede, e com o banco de pé.

## SQL-first no TypeScript hoje

O mercado tem se aproximado dele:
- O Prisma, o ORM mais popular, lançou em 2024 o TypedSQL: arquivos `.sql` escritos à mão com tipos gerados.
  É a mesma ideia do sqlc.
- O Drizzle e o Kysely crescem por terem cara de SQL em vez de escondê-lo.

A favor: SQL é a linguagem que o banco entende, e com SQL-first o que se lê é exatamente o que roda. Não há N+1
escondido gerado por ORM, e a query pode ser colada no `psql` e passar por um `EXPLAIN`. As regras críticas deste
desafio ficam explícitas no código:
- `UPDATE … WHERE status = …` (transição segura contra concorrência)
- `UNIQUE (supplier_cnpj, invoice_number)` (duplicidade)
- `FILTER (WHERE …)` (dashboard)
- `REPEATABLE READ` (paginação consistente)

Num sistema financeiro, em que concorrência e consistência são centrais, isso pesa a favor.

O preço: as queries dinâmicas ficam menos elegantes, e o fluxo ganha o passo de geração.
