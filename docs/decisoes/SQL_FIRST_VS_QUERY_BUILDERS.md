# SQL-first vs. query builders vs. ORMs

Por que este projeto escreve SQL à mão (PgTyped) num ecossistema, o TypeScript, que em geral prefere não
escrever. Complementa a decisão 12 do `DECISOES_FUNDACAO.md`.

## O espectro: do SQL puro ao ORM

A mesma operação nos quatro estilos: aprovar uma solicitação pendente.

### 1. SQL cru numa string (`pg` puro)
```ts
const r = await client.query(
  "UPDATE requests SET status='APPROVED' WHERE id=$1 AND status='PENDING' RETURNING *", [id]);
r.rows[0] // tipo: any. O TypeScript não sabe nada.
```

### 2. SQL-first com codegen (sqlc no Go, PgTyped no TS): o estilo deste projeto
```sql
/* @name ApproveRequest */
UPDATE requests SET status='APPROVED' WHERE id=:id! AND status='PENDING' RETURNING *;
```
```ts
await approveRequest.run({ id }, client) // tipado, gerado a partir do SQL
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
O SQL é montado com funções do TypeScript. Ele não esconde o SQL (cada método é quase uma palavra do SQL), mas
quem escreve a string final é a biblioteca. Os tipos vêm de uma interface que descreve as tabelas, e o TypeScript
infere o resultado em tempo de compilação, **sem passo de geração por query**.

### 4. ORM (Prisma, TypeORM)
```ts
await prisma.request.update({ where: { id, status: 'PENDING' }, data: { status: 'APPROVED' } })
```
Você pensa em objetos, não em SQL. O ORM decide o que executar, e também cuida de relacionamentos, migrations e
cache.

## Por que a comunidade TypeScript tende a não escrever SQL

1. **Origem da comunidade.** Muita gente chegou ao Node vinda do front-end, e o back-end Node cresceu na era do
   MongoDB e do Rails (ActiveRecord). A cultura dominante virou "o banco é um detalhe, eu penso em objetos".
2. **O sistema de tipos do TS permite o que o do Go não permitia.** O TypeScript consegue inferir, pelo encadeamento
   de `.where().select()`, o tipo exato do resultado. Isso dá autocomplete e checagem sem gerar código. O Go, com
   um sistema de tipos mais simples e generics tardios, resolveu o mesmo problema com codegen (`go generate`,
   protobuf, sqlc). **Os dois ecossistemas chegaram em lugares diferentes porque as linguagens permitem coisas
   diferentes.**
3. **Query dinâmica** (o ponto forte real dos builders). A lista deste projeto tem 4 filtros opcionais:
   - no builder: `if (status) q = q.where('status', '=', status)`, natural;
   - no SQL-first: o truque `WHERE (:status::text IS NULL OR status = :status)`. Funciona, mas é menos elegante e às
     vezes pior pro planejador do Postgres, o que é irrelevante com o volume deste desafio.
4. **Menos um passo no fluxo.** O builder não pede "rodar o gerador". O PgTyped pede, e ainda com o banco de pé.

## O padrão SQL-first está "errado" no TypeScript?

Não, e o mercado está voltando pra perto dele:
- O **Prisma**, o ORM mais popular, lançou em 2024 o **TypedSQL**: arquivos `.sql` escritos à mão com tipos gerados.
  É literalmente a ideia do sqlc, e é um sinal de que até quem usa ORM sente falta de SQL de verdade.
- O **Drizzle** e o **Kysely** crescem justamente por terem cara de SQL, em vez de escondê-lo.

**O argumento a favor:** SQL é a linguagem que o banco entende. Com SQL-first, o que se
lê é exatamente o que roda. Não existe "o ORM gerou um N+1 escondido". A query pode ser colada no `psql` e passar
por um `EXPLAIN`. E as regras críticas deste desafio ficam explícitas e visíveis no código:
- `UPDATE … WHERE status = …` (transição segura contra concorrência)
- `UNIQUE (supplier_cnpj, invoice_number)` (duplicidade)
- `FILTER (WHERE …)` (dashboard)
- `REPEATABLE READ` (paginação consistente)

Num sistema financeiro, onde concorrência e consistência são o coração, isso é uma vantagem de verdade.

**O preço (também vale citar):** as queries dinâmicas ficam menos elegantes, e o fluxo tem o passo de geração.

**Resumo:** no TypeScript, o SQL-first é minoria, mas é uma minoria respeitada e crescendo, e no domínio financeiro
ele tem argumento forte.
