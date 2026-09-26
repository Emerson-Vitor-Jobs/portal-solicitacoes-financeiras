# Decisões de arquitetura

Cada seção registra uma decisão do projeto, o motivo dela, as alternativas consideradas e as fontes usadas. Os
números das seções são estáveis, porque o README, o `docker-compose.yml` e os outros documentos apontam para eles.

## 1. Estrutura do repositório

### 1a. `back/` e `front/` independentes

Cada lado tem `package.json`, lockfile e Dockerfile próprios, e o contexto de build é a própria pasta. Não há
workspace nem pacote `shared/`. Isso deixa o Docker e a leitura mais simples, e o ganho de compartilhar schema seria
pequeno: o schema do formulário (texto `"1.553,13"`) e o da API (`amount_cents` inteiro) são diferentes de propósito.

### 1b. `data/` na raiz, idêntico ao pacote recebido

A pasta é montada somente leitura na API (`./data:/app/data:ro`). Fica uma fonte única, igual ao material original,
que quem roda o projeto pode comparar arquivo a arquivo, e o mount impede que o seed a altere.

### 1c. Documentação versionada

As decisões e pesquisas ficam no repositório, em `docs/decisoes/`. O enunciado e as notas de trabalho ficam fora
(`documentos/`, no `.gitignore`).

```
projeto/
├── docker-compose.yml
├── .env.example
├── README.md
├── data/            (seed, intocado)
├── docs/decisoes/
├── back/
└── front/
```

## 2. Contrato da API

O contrato tem uma fonte única, e o resto é gerado a partir dela. Cada rota do back declara schemas Zod
(`fastify-type-provider-zod`). O `@fastify/swagger` monta o OpenAPI a partir deles, com o Swagger UI em `/api/docs`.
O script `gen:openapi` do back grava `back/openapi.json`, que é commitado, e o script `gen:api` do front gera os tipos
com `openapi-typescript`. O front chama a API por um client fino, o `openapi-fetch`.

É o mesmo princípio do sqlc: o contrato é um artefato, o código sai dele e nenhum tipo é escrito à mão. Se o back
mudar, o front para de compilar. O Swagger UI serve para explorar a API.

A divisão entre camadas é esta: o Zod valida a forma no controller (tipo, obrigatório, formato), e a regra de negócio
(DV do CNPJ, transição, duplicidade) fica no service e em `modules/`, testável sem HTTP.

Fontes: [fastify-type-provider-zod](https://github.com/fastify/fastify-type-provider-zod) (org Fastify, Zod v4,
`jsonSchemaTransform`), [openapi-typescript](https://github.com/openapi-ts/openapi-typescript),
[openapi-fetch](https://openapi-ts.dev/openapi-fetch/).

## 3. Convenção de nomes

O que sai do processo (JSON da API, query params, colunas do banco) é `snake_case`. O que vive dentro do código
TypeScript (domínio, services) é `camelCase`. A conversão é explícita e acontece só nas duas bordas:

| Borda | Onde | Função |
| --- | --- | --- |
| Banco → domínio | `repository/postgres/*_storage.ts` | `mapX(row)` |
| Domínio → JSON | `handler/http/controller/*` | `toXResponse(entity)` |

Os query params seguem a mesma regra:
`?status=PENDING&supplier=aurora&due_from=2026-09-01&due_to=2026-09-30`. No front, os tipos gerados do OpenAPI já
chegam em `snake_case` e são usados direto, sem remapear.

O primeiro motivo é o enunciado, que obriga o campo `amount_cents`. Uma API em `camelCase` com essa única exceção
ficaria inconsistente; com `snake_case` em toda a API, o campo obrigatório segue a regra geral. Além disso, os JSON do
seed já são `snake_case`, então seed, banco e API usam os mesmos nomes e os dados de entrada e saída se comparam
campo a campo.

Dentro do código vale o TypeScript idiomático. `camelCase` é a convenção da linguagem e dos linters, e um domínio em
`snake_case` seria o formato do banco vazando para a regra de negócio. Em Go o modelo é o mesmo: o campo da struct é
`CamelCase` e a tag é `json:"snake_case"`. Aqui a tag vira a função de borda, e o formato externo continua sendo
detalhe de serialização, fora do domínio.

Isso isola as mudanças. Renomear uma coluna mexe só no `mapX()`; mudar o contrato público mexe só no `toXResponse()`
e no schema; o domínio não muda em nenhum dos dois casos. O custo é baixo: são cinco funções de resposta no projeto
(usuário, item da lista, detalhe da solicitação, evento do histórico e resumo do dashboard), todas puras e testáveis.

O front não remapeia porque só exibe o que recebe. Uma camada de conversão ali seria código sem ganho, e o tipo gerado
já garante a forma.

## 4. Formato de erro e paginação

### 4a. Erros no padrão RFC 9457 (Problem Details)

Toda resposta de erro sai com `Content-Type: application/problem+json`:

```json
{ "type": "about:blank", "title": "Conflict", "status": 409,
  "code": "DUPLICATE_INVOICE",
  "detail": "Já existe uma solicitação com este CNPJ e número de nota fiscal." }
```

Os membros da norma usados são `type` (sempre `about:blank`, que pela RFC significa que o status HTTP já diz tudo),
`title`, `status` e `detail`. A RFC permite extensões, e usamos duas: `code`, um código de máquina estável, e
`errors`, uma lista `{ field, message }` para erro de validação por campo.

Os códigos existentes são `VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
`DUPLICATE_INVOICE`, `INVALID_TRANSITION`, `TOO_MANY_REQUESTS` e `INTERNAL` (lista em `back/src/types/common.ts`).

Há um único ponto de saída, o `setErrorHandler` do Fastify em `back/src/handler/http/errors.ts`, que mapeia cada erro
para o HTTP. Erro não reconhecido vira 500 com `code: INTERNAL` e `detail` genérico ("Erro interno."); a mensagem
interna vai só para o log.

A RFC 9457 é norma IETF e substitui a 7807. O formato é conhecido, e tem tantos campos quanto teria um formato
próprio, então adotá-lo não custa nada. O `code` separa máquina de humano: o front decide o comportamento pelo `code`
(por exemplo, `DUPLICATE_INVOICE` marca o campo da nota), nunca pelo texto de `detail`, que pode mudar sem quebrar o
front. O `errors` por campo deixa o formulário apontar exatamente o input inválido, e a própria RFC mostra esse padrão
de extensão para validação.

Com um formato só, validação do Zod, regra de domínio e erro inesperado saem iguais. O formato padrão do Fastify
(`statusCode/error/message`) não carrega `code` nem erro por campo. O mapeador central também garante que stack trace
e mensagem de driver nunca chegam ao cliente.

Fonte: [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html).

### 4b. Paginação por página

`GET /api/requests?page=1&page_size=20&...` → `{ data, page, page_size, total, total_pages, reference_date }`

`page` é ≥ 1, com padrão 1. `page_size` tem padrão 20 e máximo 100, validados no Zod. O service traduz para
`LIMIT page_size OFFSET (page-1)*page_size`. A ordenação é `ORDER BY created_at DESC, id DESC`. A query da página e a
do total rodam na mesma transação `REPEATABLE READ READ ONLY` (mesmo snapshot), com o mesmo `WHERE`. Uma página além
da última devolve `data: []` com o `total` correto, sem erro. O `reference_date` é a data de referência usada para
calcular `is_overdue` (§6.0).

A paginação por página casa com a UI, que tem páginas numeradas. Com `page`, o cliente não consegue mandar um offset
quebrado (7 com página de 20, por exemplo); a conta fica no backend, em um lugar só. O teto de 100 impede que um
cliente peça a tabela inteira de uma vez.

O desempate por `id` torna a paginação determinística. Ordenando só por `created_at`, duas linhas com o mesmo instante
podem trocar de ordem entre requisições e aparecer duplicadas ou sumir entre páginas.

Consideramos `COUNT(*) OVER()`, que resolve tudo numa query só, mas numa página além da última não volta nenhuma
linha e o total se perde junto. Duas queries no mesmo snapshot `REPEATABLE READ` dão sempre o total certo e mantêm
cada query simples no PgTyped.

Paginação por cursor (keyset) escala melhor, mas tira o "ir para a página 3" e o total, e com 16 linhas de seed não
há problema de escala a resolver. Também não usamos `limit/offset` na API: a semântica seria a mesma (o SQL continua
`LIMIT/OFFSET`), e só a borda muda, para usar o vocabulário da tela.

## 5. Status HTTP

Base: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html). A pesquisa completa, com citações literais, está em
`PESQUISA_HTTP.md`.

### 5.1 Dado inválido: 400 para sintaxe, 422 para semântica

- **400** `VALIDATION_FAILED`: o corpo não pode ser lido (JSON quebrado ou corpo vazio com
  `Content-Type: application/json`). A §15.5.1 cita "malformed request syntax, invalid request message framing".
- **422** `VALIDATION_FAILED` + `errors[]`: o corpo é lido, mas viola uma regra (campo ausente, CNPJ com DV errado,
  valor ≤ 0, rejeitar sem motivo, pagar sem referência). A §15.5.21 diz "the syntax … is correct, but it was unable to
  process the contained instructions".
- **415** `VALIDATION_FAILED`: o corpo chega com um `Content-Type` que não é JSON. O Fastify recusa com
  `FST_ERR_CTP_INVALID_MEDIA_TYPE`, e o mapeador responde 415 Unsupported Media Type com `detail` "Envie
  application/json.", sem `errors[]`.

A própria RFC faz a distinção entre 400 e 422, com esses exemplos, e ela não custa compatibilidade: pela §15, um
cliente que não conhece o 422 o trata como 400.

### 5.2 Login: `POST /api/auth/login`

| Caso | Status | `code` |
| --- | --- | --- |
| Senha errada | 401 | `INVALID_CREDENTIALS` |
| Usuário inexistente | 401 | `INVALID_CREDENTIALS` (idêntico ao anterior) |
| Email ou senha ausentes | 422 | `VALIDATION_FAILED` |
| JSON inválido | 400 | `VALIDATION_FAILED` |
| Excesso de tentativas | 429 + `Retry-After` | `TOO_MANY_REQUESTS` (§14.6, §14.7) |

A requisição está bem formada, uma identidade foi informada e as credenciais não são válidas. Isso é falha de
autenticação, cujo código é o 401; o 422 fica para violação de regra no payload.

Existe uma leitura estrita da §15.5.2 segundo a qual `/auth/login` não exige autenticação e a senha viaja no corpo
como dado comum. Preferimos a semântica de falha de autenticação. O 401 sai sem `WWW-Authenticate`, pelo mesmo motivo
da 5.3.

A resposta é idêntica para usuário inexistente e senha errada, para não revelar quais emails existem. Isso vale também
para o tempo de resposta: quando o usuário não existe, o servidor verifica a senha contra um hash argon2 fictício, e
os dois caminhos levam o mesmo tempo (anti-enumeração por timing, OWASP Authentication Cheat Sheet). O corpo segue a
RFC 9457 da decisão 4 (`detail`, não `message`).

### 5.3 Rota protegida sem sessão válida: 401, sem `WWW-Authenticate` (desvio consciente da RFC)

A resposta é **401** `UNAUTHENTICATED`, com corpo RFC 9457 e sem o header `WWW-Authenticate`. Vale também para o 401
do login (5.2). O front decide pelo status e pelo `code`: `UNAUTHENTICATED` redireciona para a tela de login ("Sua
sessão expirou"), e `INVALID_CREDENTIALS` mostra a mensagem na própria tela de login.

A situação é a do 401 ("lacks valid authentication credentials", §15.5.2), então o código continua 401. A mesma seção
exige `WWW-Authenticate` (MUST), mas esse MUST pertence ao framework de autenticação do HTTP (§11). O header diz ao
cliente qual esquema usar: o navegador abre a janela do Basic, um cliente OAuth manda `Bearer`. Ele só tem valor
quando o cliente entende o esquema.

Login por formulário com cookie é autenticação de aplicação, fora desse framework. O
[registro IANA](https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml) não tem esquema para sessão
por cookie, então qualquer valor que mandássemos seria um esquema inventado que nenhum cliente interpreta.

Consideramos mandar `WWW-Authenticate: Session realm="gex"` para cumprir o MUST ao pé da letra, e descartamos. O
header satisfaria a sintaxe da RFC sem entregar a interoperabilidade que o MUST protege, e criaria um pseudo-padrão
(um "esquema Session" próprio) que teria de ser documentado e explicado sem que nenhum cliente o usasse. O enunciado
fala em "sessão segura ou token" e em "status 4xx consistente", sem mencionar `WWW-Authenticate`, e o único
consumidor do 401 é o nosso front, que decide pelo status e pelo `code`. O desvio não afeta nenhum cliente real;
praticamente toda API web com sessão por cookie se comporta assim. Ele fica registrado aqui, com o motivo.

Também descartamos Bearer token. Ele cumpre a RFC à risca, mas expõe o token ao JavaScript, o que a OWASP
desaconselha por causa de XSS.

### 5.4 Solicitação de outra pessoa: 404

Um REQUESTER que pede uma solicitação que não é dele recebe **404** `NOT_FOUND`, igual a um ID inexistente. A §15.5.4
autoriza isso literalmente ("MAY instead respond with a status code of 404"), e a §15.5.5 define o 404 como "not
willing to disclose that one exists". Assim ninguém enumera IDs alheios.

### 5.5 Conflitos: todos 409

- Duplicidade (CNPJ + nota): **409** `DUPLICATE_INVOICE`.
- Transição inválida (por exemplo, `PAID → APPROVED`) e perdedor de corrida concorrente: **409**
  `INVALID_TRANSITION`.

O corpo informa o status atual, por exemplo `"detail": "A solicitação está PAID; não pode ir para APPROVED."`.

A §15.5.10 define o 409 como "conflict with the current state of the target resource". Nos três casos o estado atual
(a nota já existe, o status já é outro) impede o pedido. A mesma seção diz que o servidor "SHOULD generate content
that includes enough information for a user to recognize the source of the conflict", daí o status atual no `detail`.
O enunciado também pede 409 para "duplicidade ou conflito de estado".

Para o perdedor da corrida, a semântica é a mesma de uma transição inválida, porque o estado mudou antes dele. O
código é o mesmo, e o front trata os dois casos igual: mostra a mensagem e recarrega o detalhe.

### 5.6 Sucesso: 201 + Location / 200 / 204

| Rota | Status | Corpo |
| --- | --- | --- |
| `POST /api/requests` | **201** + `Location: /api/requests/{id}` | a solicitação criada |
| `POST /api/requests/:id/decision` | **200** | a solicitação atualizada |
| `POST /api/requests/:id/mark-paid` | **200** | a solicitação atualizada |
| `POST /api/auth/login` | **200** + `Set-Cookie` | dados do usuário (sem hash, sem token) |
| `POST /api/auth/logout` | **204** | vazio |
| `GET` (lista, detalhe, `/api/dashboard/summary`, `/api/auth/me`) | **200** | a representação |

A §15.3.2 define o 201 como "resulted in one or more new resources being created", com o recurso identificado pelo
`Location`, que é o caso da criação. A decisão e o pagamento mudam o estado de um recurso que já existe (o evento de
auditoria é efeito colateral), então respondem 200 com o corpo atualizado, o que evita um `GET` extra. O logout não tem
o que devolver e responde 204.

### 5.7 Cache: `Cache-Control: no-store` em toda resposta da API

Pela RFC 9111, `no-store` significa "a cache MUST NOT store any part of either the immediate request or the
response". É dado financeiro autenticado, que não deve ficar em navegador, proxy ou CDN. O header também neutraliza o
fato de o 404 ser "heuristically cacheable" (§15.5.5), já que o nosso 404 às vezes esconde uma solicitação que existe.
Não usamos ETag/304, porque o ganho não justifica.

### 5.8 ID que não é UUID: 404

`GET /api/requests/abc` responde **404** `NOT_FOUND`, igual a um UUID inexistente. A URI é sintaticamente válida, mas
não identifica recurso nenhum, e é esse o caso que a §15.5.5 descreve: "did not find a current representation for the
target resource". Os exemplos do 400 (§15.5.1) tratam da sintaxe da mensagem, não de identificador desconhecido. Muitas
APIs respondem 400 `"invalid id format"`; aqui o 404 é escolha deliberada, e vale também para `decision` e
`mark-paid`.

### Tabela consolidada

| Situação | Status | `code` |
| --- | --- | --- |
| JSON malformado ou corpo JSON vazio | 400 | `VALIDATION_FAILED` |
| `Content-Type` que não é JSON | 415 | `VALIDATION_FAILED` |
| Conteúdo bem formado mas inválido | 422 | `VALIDATION_FAILED` + `errors[]` |
| Login com credencial inválida (usuário existindo ou não) | 401 (sem `WWW-Authenticate`, ver 5.3) | `INVALID_CREDENTIALS` |
| Sem sessão / sessão expirada | 401 (sem `WWW-Authenticate`, ver 5.3) | `UNAUTHENTICATED` |
| Papel sem permissão (REQUESTER decidindo/pagando) ou POST sem o header anti-CSRF (8.3) | 403 | `FORBIDDEN` |
| Solicitação de outra pessoa, inexistente ou ID não-UUID | 404 | `NOT_FOUND` |
| CNPJ + nota duplicados | 409 | `DUPLICATE_INVOICE` |
| Transição inválida / perdeu a corrida | 409 | `INVALID_TRANSITION` |
| Excesso de tentativas de login | 429 + `Retry-After` | `TOO_MANY_REQUESTS` |
| Erro inesperado | 500 | `INTERNAL` (sem detalhe interno) |

## 6. Datas e tipos

Fontes: [Postgres, Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) e
[Postgres wiki, Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).

### 6.0 Princípios

Texto é `TEXT` + `CHECK`, nunca `char(n)`/`varchar(n)`. A wiki diz "Don't use the type char(n). You probably want
text", porque ele preenche com espaços e compara de forma estranha. Por isso o CNPJ é `TEXT` + `CHECK` em vez de
`CHAR(14)`; a regex, que aceita o CNPJ alfanumérico, está na decisão 11.

Dia é `DATE` e instante é `TIMESTAMPTZ`. O `timestamptz` é guardado em UTC e representa um instante; o `date` é um dia
do calendário, sem fuso. O vencimento é um dia. Criação, atualização e pagamento são instantes.

O "hoje" nunca vem do banco, porque `CURRENT_DATE` e `now()::date` dependem do fuso da sessão. A aplicação calcula a
data de referência (`APP_TODAY` ou, sem ele, a data atual em `America/Sao_Paulo`) e a passa como parâmetro.

Com timestamp, o intervalo é semiaberto, nunca `BETWEEN` (a wiki é explícita nisso). "Pago no mês" é
`paid_at >= $inicio_mes_sp AND paid_at < $inicio_mes_seguinte_sp`. Os limites são instantes calculados no fuso de SP,
e a coluna fica sem função em volta, então um índice sobre ela continua usável.

No driver, `pg.types.setTypeParser(pg.types.builtins.DATE, v => v)` (OID 1082) faz o `DATE` chegar como string
`YYYY-MM-DD`. Ele nunca vira `Date` do JS, que deslocaria o dia pelo fuso.

### 6.1 Competência: `DATE` no dia 1 + `CHECK`

A coluna é `competence DATE NOT NULL CHECK (extract(day FROM competence) = 1)`. A API expõe `"2026-09"`, igual ao
seed, e a borda do repositório converte `2026-09-01` ↔ `2026-09` (`toCompetenceDate` / `fromCompetenceDate`, em
`repository/postgres/map.ts`).

Competência é um mês, e o Postgres não tem tipo "mês". A convenção clássica em contabilidade é guardar o primeiro dia.
O tipo impede um mês 13, ordena corretamente e permite aritmética de mês.

### 6.2 Pagamento: `paid_at TIMESTAMPTZ`, formulário com data e hora

A API recebe `paid_at` em RFC 3339 com offset obrigatório (por exemplo, `2026-09-18T10:30:00-03:00`). O formulário
pede data e hora, interpretadas em `America/Sao_Paulo` e pré-preenchidas com o momento atual.

São dois conceitos diferentes, sem coluna nova. `audit_events.created_at` é quando o financeiro registrou o pagamento
(instante do sistema). `requests.paid_at` é quando o pagamento foi feito, um fato de negócio informado pela pessoa. O
enunciado diz: "A data de pagamento é um dado próprio e não deve ser substituída pela data de criação." No seed os dois
coincidem (registrado na hora); no uso real podem divergir, e por isso existem os dois.

Isso é fiel ao seed, que traz um instante, e o servidor não inventa horário nenhum.

### 6.3 Travas da data de pagamento

O `mark-paid` rejeita com **422** `VALIDATION_FAILED` (`errors: [{ field: "paid_at", … }]`) em dois casos.

1. Data futura: `paid_at` maior que o instante atual do relógio real. O relógio é injetado no service, para os
   testes.
2. Antes da aprovação: `paid_at` anterior ao instante do evento `APPROVED` da auditoria, lido na mesma transação do
   pagamento. Essa comparação é feita no minuto: o instante da aprovação é truncado para o minuto antes de comparar.

O "futuro" usa o relógio real, e não o `APP_TODAY`. O enunciado usa o `APP_TODAY` como data de referência para regras
de calendário (vencido, pago no mês), para tornar os resultados reproduzíveis, e não pede que o relógio dos eventos
seja falsificado. A aprovação grava um instante real. Se o limite do futuro fosse o fim do dia de referência, com
`APP_TODAY=2026-09-18` e uma aprovação feita de fato em 25/09 o pagamento precisaria ser ao mesmo tempo ≤ 18/09 e
≥ 25/09, um intervalo vazio, e o fluxo principal ficaria impossível. Para o instante de um pagamento, "futuro" é um
fato do relógio real; as regras de calendário continuam seguindo o `APP_TODAY`.

A comparação com a aprovação é no minuto porque essa é a precisão que o formulário oferece (data + hora HH:mm). Sem o
truncamento, aprovar às 14:51:37 e pagar em seguida com a hora pré-preenchida (14:51, ou seja, 14:51:00) seria
recusado, porque 14:51:00 é anterior a 14:51:37. Com o truncamento, o pagamento no mesmo minuto da aprovação é aceito,
e um pagamento no minuto anterior ao da aprovação continua recusado.

No formulário, data e hora vêm pré-preenchidas com o momento atual real em SP, e o seletor de data não passa do dia de
hoje real. Isso é só ajuda de interface; quem garante a regra é o servidor.

As travas existem porque o valor "pago no mês" do dashboard depende dessa data. Uma data futura é impossível, e pagar
antes de aprovar contradiz o fluxo que o portal impõe (`APPROVED → PAID`). O seed respeita as duas travas (todo
pagamento é posterior à aprovação), embora seja inserido direto no banco, sem passar pelo service nem por essas
validações.

### 6.4 `updated_at` mantido pela query, explícito

O `UPDATE … SET status = :to, …, updated_at = now() …` fica na própria query (`.sql` do PgTyped), sem trigger. Assim
fica visível onde a mudança acontece. `now()` devolve o início da transação, então o `updated_at` da solicitação e o
`created_at` do evento de auditoria gravado na mesma transação são idênticos.

## 7. Categoria, nota fiscal, busca e tamanhos

### 7.1 Categoria: conjunto fixo

Os valores são exatamente os do seed: `INFRAESTRUTURA`, `MARKETING`, `SERVIÇOS`, `SOFTWARE`.

No back, o banco tem `category TEXT NOT NULL CHECK (category IN ('INFRAESTRUTURA', 'MARKETING', 'SERVIÇOS',
'SOFTWARE'))`. É a garantia final: nenhum caminho (seed, SQL manual, bug) grava categoria inválida. No domínio há uma
constante única, `CATEGORIES = [...] as const`, de onde sai o tipo `Category`. No contrato, o schema da rota usa
`z.enum(CATEGORIES)`: o Zod rejeita valor fora da lista com 422, e o OpenAPI publica o campo como `enum` com os 4
valores.

No front, o tipo gerado do OpenAPI já chega como a união `'INFRAESTRUTURA' | 'MARKETING' | 'SERVIÇOS' | 'SOFTWARE'`,
e o select do formulário é montado a partir dele. O front não mantém lista própria: se o back mudar a lista, o front
deixa de compilar onde usa um valor que não existe mais. O texto exibido pode ser amigável ("Serviços"), mas o valor
enviado é sempre o do enum.

O seed tem exatamente 4 categorias, e o escopo não tem tela de cadastro de categoria. Uma tabela `categories` com FK
seria generalização prematura: daria uma flexibilidade (cadastrar sem migration) que ninguém no escopo usa, paga com
mais uma tabela, mais um join, mais seed e mais testes. Texto livre seria pior, porque "Software", "software " e "SW"
virariam três categorias. Adicionar uma categoria depois custa uma migration que altera o `CHECK` e um valor na
constante. Se o negócio passar a precisar cadastrar pela interface, aí a tabela passa a ter motivo.

A frase completa de Knuth (1974) orienta esta e várias outras decisões: *"We should forget about small efficiencies,
say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our opportunities
in that critical 3%."* A generalização prematura é parente próxima da otimização prematura. O `UNIQUE` no banco, o
`UPDATE` condicional e o dinheiro em inteiro ficam nos 3%: são pontos em que deixar para depois vira bug de dado.

### 7.2 Número da nota: `trim` + maiúscula, garantido no banco

O service normaliza com `trim().toUpperCase()`, e o banco garante com
`CHECK (invoice_number = upper(btrim(invoice_number)) AND invoice_number <> '' AND char_length(invoice_number) <= 50)`.

O `UNIQUE (supplier_cnpj, invoice_number)` só protege contra duplicata se os dois lados estiverem na mesma forma
canônica. Sem isso, `nf-2026-1001 ` escaparia de `NF-2026-1001`. O `CHECK` garante a forma canônica mesmo que algum
caminho esqueça de normalizar. O seed já está nessa forma, então nada nele é alterado.

Hífen e espaço interno não são removidos. Removê-los poderia fundir números diferentes e mudaria a forma como a pessoa
lê a própria nota.

Na NF-e real, a identidade é CNPJ + modelo + série + número (na chave de acesso). O desafio simplifica para CNPJ +
número em texto livre, e é assim que modelamos.

### 7.3 Busca por fornecedor: `ILIKE` + `unaccent`, curingas escapados

A condição é `unaccent(supplier_name) ILIKE unaccent('%' || $termo_escapado || '%')`. A extensão `unaccent` (contrib
do Postgres, presente na imagem oficial) é criada na primeira migration (`00001_extensions.sql`). Antes da query, `%`,
`_` e `\` digitados são escapados (`escapeLike`, em `requests_storage.ts`); sem isso, buscar `%` casaria tudo e `_`
casaria qualquer caractere.

"servicos" tem que achar "Aurora Serviços", porque quem digita num campo de busca não se preocupa com acento.
Full-text (`tsvector`) seria exagero para um nome de fornecedor. Não há índice por enquanto: com poucos dados, a
varredura sequencial é mais rápida que qualquer índice, e vale o mesmo raciocínio de Knuth da 7.1.

### 7.4 Limites de tamanho: Zod + `CHECK` no banco

| Campo | Máximo |
| --- | --- |
| `supplier_name` | 200 |
| `invoice_number` | 50 |
| `description` | 1000 |
| `rejection_reason` | 500 |
| `payment_reference` | 100 |

As colunas são `TEXT` com `CHECK (btrim(x) <> '' AND char_length(x) <= N)`, coerente com o "não use varchar(n)" da
6.0; nas colunas opcionais o `CHECK` aceita `NULL`. Os mesmos limites estão no Zod, que também faz `trim` e exige ao
menos um caractere.

O Zod dá a mensagem boa por campo (422 com `errors[]`), e o `CHECK` é a garantia final. Cada camada tem um papel.

## 8. Autenticação e sessão

Fontes: OWASP [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html);
[bug do Chromium 40202941](https://issues.chromium.org/issues/40202941).

### 8.1 Sessão opaca no Postgres (não JWT)

No login, o servidor gera 32 bytes aleatórios (`crypto.randomBytes`, 256 bits; a OWASP pede ≥ 64), envia o valor no
cookie em base64url e grava só o SHA-256 dele na tabela
`sessions (id_hash PK, user_id, created_at, last_seen_at, expires_at)`. A cada request, calcula `SHA-256(cookie)`,
busca pela PK, confere os timeouts e carrega o usuário e o papel atual do banco. No logout, apaga a linha e expira o
cookie. Uma sessão expirada encontrada numa busca é apagada ali mesmo, sem cron. Cada login cria uma sessão nova, o que
evita session fixation (OWASP: "must be regenerated after authentication").

A OWASP exige invalidar a sessão no servidor: "must take active actions to invalidate the session on both sides,
client and server". Um JWT stateless não consegue isso. No logout ele só apaga o cookie, e uma cópia do token continua
válida até o `exp`. Com a sessão no banco, o papel também vem do banco a cada request, enquanto um JWT congelaria o
papel até expirar. Como o banco guarda o hash, e não o ID, um vazamento do banco não permite sequestrar sessões (o
mesmo princípio do hash de senha). O custo é uma tabela e um lookup por chave primária por request.

O `JWT_SECRET` do `.env.example` fica sem uso, e o README registra isso: o enunciado aceita "sessão segura ou token",
e a sessão opaca foi escolhida pelos motivos acima.

### 8.2 Expiração: 30 min ociosa + 8 h absoluta

A sessão expira 30 min após o último uso. O `last_seen_at` é atualizado no máximo uma vez por minuto, para não
escrever no banco a cada request. O limite absoluto é `expires_at = login + 8 h`, sem renovação.

São os limites superiores da faixa da OWASP para aplicação de baixo risco (15 a 30 min ociosa, 4 a 8 h absoluta). Uma
jornada de trabalho cabe numa sessão, e uma sessão esquecida aberta cai em 30 min.

### 8.3 CSRF: `SameSite=Strict` + header customizado

Toda requisição que muda estado (qualquer método fora de `GET`, `HEAD` e `OPTIONS`) exige
`X-Requested-With: gex-web`. Sem ele, a resposta é **403** `FORBIDDEN`. Vale também para o próprio
`POST /api/auth/login`, o que protege contra login CSRF.

A OWASP diz que o SameSite "should be treated as a defense-in-depth layer". Para API chamada por AJAX, ela indica
header customizado: um site atacante não consegue enviá-lo sem preflight CORS, e o CORS não está habilitado (front e
API ficam na mesma origem, via nginx). A OWASP também diz que depender só de `Content-Type: application/json` não
basta. Um token CSRF (double-submit) traria mais peças para o mesmo ganho neste cenário same-origin.

### 8.4 Cookie: `sid`; `HttpOnly; SameSite=Strict; Path=/`; `Secure` por env; sem `__Host-`

O `Secure` vem de `COOKIE_SECURE`: `false` no compose local em http, `true` em produção com HTTPS. O cookie não usa o
prefixo `__Host-`, porque o Chrome rejeita cookies com esse prefixo em `http://localhost` (o Firefox aceita), e com ele
o login local quebraria no Chrome. O nome é o genérico `sid`, já que a OWASP recomenda não revelar a tecnologia pelo
nome do cookie.

O trade-off está documentado no README: em produção, o certo é HTTPS + `Secure` + `__Host-sid`.

### 8.5 Senha

A senha usa argon2id (`@node-rs/argon2`) com o mínimo da OWASP: m = 19 MiB, t = 2, p = 1. O login tem tempo
constante: para usuário inexistente, a verificação roda contra um hash fictício (ver 5.2).

## 9. Boot, seed e testes

### 9.1 Boot: entrypoint da API

O `entrypoint.sh` roda com `set -e`: `dbmate --wait up` → `node dist/seed.js` → `exec node dist/main.js`.

É o padrão clássico de entrypoint (migrar, depois `exec` do servidor). O `set -e` garante a ordem: se a migration ou o
seed falhar, a API não sobe, e ela nunca roda com o banco pela metade. O `exec` faz o Node virar o PID 1 e receber o
SIGTERM do `docker compose down`. Serviços separados (migrate → seed → api) dariam dois containers a mais para a
mesma garantia.

### 9.2 Seed idempotente (`ON CONFLICT DO NOTHING`, numa transação)

Rodar o seed de novo não duplica nada nem sobrescreve o que foi feito no app, e a transação garante tudo ou nada. Os
números do dashboard batem com o `expected_results.json` só no estado original, e o README diz como voltar a ele:
`docker compose down -v && docker compose up --build`. Resetar a cada boot apagaria o que foi feito no app num simples
restart.

### 9.3 Banco de teste: database separado, criado por uma linha de SQL

O arquivo `docker/postgres/init/01-test-db.sql` contém `CREATE DATABASE gex_finance_it;`. A imagem oficial do Postgres
roda sozinha o que está em `/docker-entrypoint-initdb.d/` na primeira inicialização do volume, sem código de setup. O
serviço de teste roda `dbmate up` no `gex_finance_it` e depois o `vitest`. Antes de cada teste de integração, um helper
de uma linha faz `TRUNCATE … CASCADE`, e os arquivos de integração rodam em série. Sem `DATABASE_URL`, o teste falha
em vez de ser pulado, e o helper também se recusa a rodar num banco cujo nome não termine em `_it`.

Usar o mesmo database da aplicação quebraria de forma concreta. O teste do dashboard espera exatamente R$ 8.750,49;
uma solicitação criada por outro teste muda o número, e o teste falharia aleatoriamente conforme a ordem. Além disso,
o `TRUNCATE` apagaria os dados que alguém estivesse usando no app.

Rollback por teste não serve, porque o teste de concorrência precisa de commits reais em conexões separadas: o que se
prova ali é o `UNIQUE` e o `WHERE status` de verdade. Testcontainers seria exagero, porque exigiria o socket do Docker
dentro do container de teste.

O teste falha em vez de ser pulado porque o teste de integração é obrigatório. Um `skip` faria o teste passar sem ter
rodado.

### 9.4 Como rodar

- Só com Docker: `docker compose --profile test run --rm back-test` e `… front-test`.
- Local: `npm test` em `back/` e `front/` (com `DATABASE_URL` apontando para o `gex_finance_it` no back; o
  `npm run test:integration` do back cuida disso).

### 9.4.1 Detalhes do compose

`APP_TODAY` tem padrão `2026-09-18` no compose, escrito `${APP_TODAY-2026-09-18}` (sem `:`). Sem `.env`, os resultados
são reproduzíveis já no primeiro `up` e o dashboard bate com o esperado. Com `APP_TODAY=` (vazia), a API usa a data
atual em `America/Sao_Paulo`, como o enunciado pede quando a variável não está definida.

O dbmate (lib/pq) exige TLS por padrão, e o Postgres local não tem. O entrypoint acrescenta `sslmode=disable` à URL
usada só pelo dbmate, e só quando a URL não define `sslmode` (`back/docker/dbmate_url.sh`). É o mesmo comportamento do
driver `pg` da API, e o `DATABASE_URL` do `.env.example` original continua funcionando sem alteração.

As migrations são numeradas em sequência (`00001_…sql`), com `-- migrate:up` / `-- migrate:down`, e o dbmate roda com
`--no-dump-schema`, sem gerar `schema.sql`, porque o schema de verdade são as próprias migrations.

A rede interna é fixa, `172.29.254.0/24`, com o nginx (serviço `web`) em `172.29.254.10`. É o único IP em que a API
confia para o `X-Forwarded-For` (`TRUST_PROXY`, §14.6). Um `X-Forwarded-For` forjado é ignorado nos dois caminhos: o
nginx sobrescreve o header com `$remote_addr`, e uma chamada direta na porta 3001 não vem do IP confiável.

O Node trata o SIGTERM (e o SIGINT), fechando o servidor e o pool. Como PID 1 no container, sem handler ele
ignoraria o sinal, e o `docker compose down` esperaria o timeout.

O compose fixa `name: gex`, para que o nome dos volumes não dependa do nome da pasta clonada.

### 9.5 Política de testes: cobertura por comportamento, não por porcentagem

Não há meta de cobertura. A cobertura (Vitest + v8) é medida e reportada como diagnóstico, para achar código que
ficou sem teste, e não bloqueia o build.

Kent Beck, criador do TDD, resume o critério: *"I get paid for code that works, not for tests, so my philosophy is to
test as little as possible to reach a given level of confidence."* A medida é a confiança. Martin Fowler
([TestCoverage](https://martinfowler.com/bliki/TestCoverage.html)) explica o problema da meta: *"If you make a certain
level of coverage a target, people will try to attain it. The trouble is that high coverage numbers are too easy to
reach with low quality testing."* E ainda: *"I would be suspicious of anything like 100% - it would smell of someone
writing tests to make the coverage numbers happy, but not thinking about what they are doing."*

Pelo mesmo raciocínio de Knuth citado na 7.1, o esforço de teste se concentra nos 3% críticos (dinheiro, duplicidade,
transição, concorrência, datas), e não se espalha por getters, mapeamentos triviais e código gerado. Tudo o que o
enunciado exige é testado, e cada teste além disso protege uma regra que, se quebrar, produz dado errado.

O que é testado, e em que nível:

| # | Comportamento | Nível | Exigido pelo enunciado? |
| --- | --- | --- | --- |
| 1 | `parseBRLToCents` (front): exemplos do `expected_results.json` + gramática da §14.1 | unit front (tabela) | ✅ |
| 2 | Nota duplicada → 409, nenhum registro extra | integração (Postgres real) | ✅ |
| 3 | Duas criações duplicadas **simultâneas** → 1 criada, 1 recebe 409, 1 linha no banco | integração | ✅ |
| 4 | REQUESTER tentando aprovar/rejeitar → 403 | HTTP (`app.inject`) | ✅ |
| 5 | Transições: a matriz inteira 4×4 (válidas e inválidas) | unit | ✅ |
| 6 | Decisões concorrentes (aprovar × rejeitar ao mesmo tempo) → 1 vence, 1 recebe 409, **1** evento de auditoria | integração | ✅ (concorrência) |
| 7 | Rejeição sem motivo → 422 | unit + HTTP | ✅ |
| 8 | Dashboard (FINANCE + os 2 solicitantes) **contra o `expected_results.json` oficial** como oráculo | integração | ✅ |
| 9 | Fluxo completo criar → aprovar → pagar com trilha de auditoria | integração (HTTP + Postgres real) | ✅ |
| 10 | Componentes: input de valor, formulário (anti-duplo-envio, mensagem de 409), ações por perfil/estado | front (Testing Library + MSW) | ✅ (≥ 1) |
| 11 | CNPJ: DV válido/inválido, com/sem máscara, sequências repetidas | unit | Não (risco) |
| 12 | Bordas de data: vence **hoje** não está vencido; pagamento em 31/08 fora de "pago no mês"; `DATE` volta sem deslocar | unit + integração | Não (risco) |
| 13 | Solicitação alheia → 404; login com usuário inexistente = mesma resposta que senha errada | HTTP | Não (segurança) |
| 14 | Sem header anti-CSRF → 403; `paid_at` futuro / antes da aprovação → 422 | HTTP | Não (segurança/regra) |
| 15 | Auditoria append-only: `UPDATE`/`DELETE` em `audit_events` falha | integração | Não (integridade) |

Ficam fora dos testes, de propósito: o código gerado pelo PgTyped e pelo `openapi-typescript` (é responsabilidade da
ferramenta), os `mapX`/`toXResponse` triviais (cobertos indiretamente pelos testes de integração e HTTP), a fiação do
Fastify, o Swagger e o estilo visual.

## 10. Contrato antes da implementação

Os schemas Zod de todas as rotas e o `openapi.json` gerado a partir deles foram definidos antes de as rotas terem
implementação. Com o contrato pronto, o front pôde ser construído contra ele, com a API mockada via MSW, sem esperar o
back. O contrato continua sendo a fonte dos tipos do front: cada mudança nele gera um novo `openapi.json`
(`npm run gen:openapi` no back) e os tipos do front são regenerados a partir dele (`npm run gen:api`, com o
openapi-typescript).

## 11. CNPJ numérico e alfanumérico

A fonte primária é a Receita Federal: a IN RFB nº 2.229/2024 e o documento
[Perguntas e Respostas — CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf).

A regra oficial:
- Formato `AA.AAA.AAA/AAAA-DV`: as 12 primeiras posições aceitam `0–9` e `A–Z` (maiúsculas), e os 2 DVs são
  numéricos.
- Novos CNPJs são alfanuméricos desde julho de 2026. Os numéricos existentes continuam válidos, e os dois
  formatos coexistem.
- DV = módulo 11 sobre `código ASCII − 48` de cada caractere (`0`→0 … `9`→9, `A`→17, `B`→18 …), com os mesmos
  pesos de sempre (`5,4,3,2,9,8,7,6,5,4,3,2`, e depois `6,5,4,3,2,9,8,7,6,5,4,3,2`).
- Conferido: o exemplo oficial `12ABC34501DE` dá DV `35`, e o CNPJ do seed `100000000001` dá DV `45`.

Na implementação, `normalizeCnpj` remove `.`, `/`, `-` e espaços e converte para maiúscula. `isValidCnpj` exige
14 posições no formato `^[0-9A-Z]{12}[0-9]{2}$`, DV correto, e rejeita os 14 caracteres iguais. Dos 14 caracteres
iguais, só `00000000000000` passa no módulo 11 (os demais já falham no DV); a regra existe para barrar esse caso e
deixar explícito que sequência repetida não é CNPJ. No banco, a coluna é
`supplier_cnpj TEXT NOT NULL CHECK (supplier_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')`. No front, o `MaskInput` usa a
máscara `**.***.***/****-99` (12 posições alfanuméricas e 2 dígitos), aceita letras e converte para maiúscula
enquanto o usuário digita.

Um portal financeiro que só aceita dígitos recusaria um fornecedor novo e legítimo a partir de julho de 2026, o que
seria um bug de produção. A Receita é explícita: "Todos os sistemas públicos e privados deverão ser ajustados". O
algoritmo novo é um superconjunto do antigo, porque para dígitos `ASCII − 48` é o próprio dígito, então CNPJs
numéricos se comportam exatamente como o enunciado pede, sem complexidade extra.

Isso é um desvio consciente do texto "armazene apenas os 14 dígitos", documentado no README com a fonte.
Continuamos armazenando as 14 posições sem máscara, que é a intenção da regra; o enunciado foi escrito no vocabulário
anterior à mudança.

## 12. Camada SQL: PgTyped

O PgTyped ocupa o lugar que seria do sqlc-gen-typescript e segue o mesmo princípio do sqlc no Go: SQL escrito à mão
em arquivo, um gerador, e uma função tipada commitada. Um exemplo real:

```sql
-- repository/postgres/queries/requests.sql
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

`npm run gen:sql` gera `requests.queries.ts` ao lado do `.sql`, e o storage usa a função gerada:

```ts
// repository/postgres/requests_storage.ts
const rows = await updateRequestStatus.run(
  { id, from, to, rejectionReason, paidAt, paymentReference },
  this.client,
);
return rows.length === 1;
```

O `!` no parâmetro marca obrigatório (não nulo). No resultado, `"coluna!"` força não nulo quando o Postgres não
consegue inferir, como em `COALESCE(SUM(x), 0) AS "total!"`. A geração precisa do Postgres ao vivo: o script sobe o
postgres do compose, roda `dbmate up` e depois o `pgtyped`. O código gerado fica commitado, então quem clona o
repositório não precisa gerar nada.

Não usamos o sqlc-gen-typescript porque ele é uma aposta arriscada: o README diz *"Here be dragons! This plugin is
still in early access"*, o último release é v0.1.3 (jan/2024) e o último commit é de nov/2024, quase 2 anos parado.
O PgTyped é o padrão de mercado da abordagem SQL-first com codegen em TypeScript: v2.4.3 (mar/2025), commits ativos
até set/2026, cerca de 3,3k estrelas, a mais adotada dessa categoria. Ele é fiel ao estilo do sqlc (SQL em arquivo
`.sql`, query com nome, código gerado e nunca editado à mão, sem ORM nem query builder), e os tipos vêm do próprio
Postgres: ele faz `PREPARE` da query e pergunta os tipos ao banco, o que é mais fiel que um parser externo.

Os trade-offs aceitos:
- A nulidade nem sempre é inferida, uma fraqueza conhecida: o Postgres não informa a nulidade de expressões. A
  mitigação é a anotação `!` no próprio SQL, onde fica visível.
- A geração precisa do banco de pé. A mitigação é um script só (`gen:sql`) e o código gerado commitado.
- A sintaxe difere da do sqlc: `/* @name X */` e `:param` no lugar de `-- name: X :one` e `$1`.

### Validação do PgTyped

A validação foi feita num banco descartável, com quatro queries representativas, em tempo de execução:

| Critério | Resultado |
| --- | --- |
| Filtro opcional com parâmetro nulo (`:status::text IS NULL OR status = :status`) | Tipado como `string \| null \| void`; `null` = sem filtro |
| `UPDATE … WHERE status = <esperado> RETURNING …` (compare-and-set) | 1ª vez 1 linha, 2ª vez 0 linhas. Com duas conexões concorrentes, só uma vence |
| `INSERT` violando `UNIQUE` | Erro chega intacto: `code = 23505`, `constraint` e `detail` com os valores (daí o sanitizador da §14.5) |
| Agregação com `FILTER` + override `"coluna!"` | Resultado não nulo, `SUM`/`COUNT` como string |
| `run(params, client)` com o client de uma transação | `COMMIT` e `ROLLBACK` reais respeitados |
| Tipos: `BIGINT` → `string`, `TIMESTAMPTZ` → `Date`, nulos corretos | OK |

Houve uma armadilha: por padrão o PgTyped tipa `DATE` como `Date`, mas o driver devolve string
(`setTypeParser(1082)`, §6.0), então o tipo gerado estaria errado. O `pgtyped.json` tem
`typesOverrides: { "date": { "parameter": "string", "return": "string" } }`, e o typecheck confirmou o tipo certo.

No fluxo real, `npm run gen:sql` (`back/scripts/gen-sql.sh`) sobe o postgres do compose, aplica as migrations com a
imagem do dbmate (`back/scripts/migrate.sh`) e roda o PgTyped. A query mais simples (`health.sql` → `Ping`) passa por
esse fluxo e é usada no `GET /api/health`.

O contexto conceitual (SQL-first × query builder × ORM, e por que o TS costuma evitar SQL) está em
`SQL_FIRST_VS_QUERY_BUILDERS.md`.

Fontes: [PgTyped](https://pgtyped.dev/), [adelsz/pgtyped](https://github.com/adelsz/pgtyped),
[sqlc-gen-typescript](https://github.com/sqlc-dev/sqlc-gen-typescript),
[PropelAuth: Libraries for writing raw SQL safely](https://www.propelauth.com/post/libraries-for-writing-raw-sql-safely).

## 13. Runtime: Node 24 LTS no Docker

A imagem é `node:24.21.0-alpine`, com a versão exata pinada (a mesma lógica do `postgres:16.4-alpine` que o desafio
já traz), e os dois `package.json` declaram `"engines": { "node": ">=24 <25" }`. O calendário oficial
([nodejs/Release `schedule.json`](https://github.com/nodejs/Release/blob/main/schedule.json)), conferido em
25/09/2026:

| Versão | Status hoje | LTS desde | Manutenção | Fim |
| --- | --- | --- | --- | --- |
| 22 | LTS (manutenção) | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| 24 | Active LTS (última: v24.21.0, 07/09/2026) | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| 26 | Current | previsto 2026-10-28 | 2027-10-20 | 2029-04-30 |

O Node 26 ainda é *Current* e pode receber mudanças até entrar em LTS em 28/10/2026. Num projeto que precisa rodar
igual em outra máquina, previsibilidade vale mais que novidade. Quem roda o projeto usa o mesmo runtime estável que
nós, e o pin da versão exata garante que `docker compose up --build` daqui a uma semana produz a mesma imagem. Os
testes rodam no container (`--profile test`), com o Node 24; fora dele, o `engines` só avisa.

## 14. Dinheiro, tempo, front, ferramental, logs e rate limit

### 14.1 Dinheiro: parser separado da máscara

O back não tem parser de BRL. Ele recebe `amount_cents` e valida inteiro, `> 0` e `≤ Number.MAX_SAFE_INTEGER`. O
front cuida da representação humana, e o back, da canônica.

`parseBRLToCents(texto)` é uma função pura do front, com uma gramática exclusivamente brasileira: `R$` opcional,
espaços opcionais, parte inteira com dígitos simples (`1553`) ou milhar agrupado por `.` em grupos de 3 (`1.553`), e
parte decimal opcional com `,` seguida de 1 ou 2 dígitos.

| Entrada | Resultado |
| --- | --- |
| `1.553,13` / `0,01` / `10` / `R$ 2.000,00` | 155313 / 1 / 1000 / 200000 (os exemplos oficiais do `expected_results.json`) |
| `1,5` / `1,55` / `1.553` | 150 / 155 / 155300 |
| `1553.13`, `1,553.13`, `1,555`, `1.55`, `abc`, `0`, `-1` | rejeita (os dois últimos porque o valor deve ser > 0) |

`1.553` é aceito como R$ 1.553,00. Dentro da gramática brasileira ele não é ambíguo; a ambiguidade só existiria se o
formato americano fosse aceito, e ele é rejeitado. É a mesma regra que aceita o `"10"` oficial.

A digitação usa a máscara estilo banco: cada dígito entra pela direita (`1` → `0,01`, `155313` → `1.553,13`). A
máscara não é o parser. Se fosse, o `"10"` colado seria lido como dígitos digitados e viraria R$ 0,10 (10 centavos)
em vez de R$ 10,00, contrariando o `data/expected_results.json`. Por isso o campo tem duas entradas e uma função só:

- teclado → motor da máscara → texto formatado (`"0,01"`) → `parseBRLToCents` → 1
- colar (`"10"`, `"R$ 2.000,00"`) → `parseBRLToCents` → 1000 / 200000

O contrato fica previsível: um formato, um parser, testado contra os exemplos oficiais. A máscara elimina a
ambiguidade na digitação sem mudar o significado do texto colado. A implementação da máscara é detalhe do front
(§14.3); o que fica decidido é o comportamento acima.

### 14.2 Tempo: o servidor é a autoridade

`is_overdue` é calculado no backend e vem em cada solicitação, na lista e no detalhe. O front nunca compara datas com
o relógio do navegador.

`reference_date` vai uma vez, como metadado da resposta, em vez de se repetir em cada objeto:
- lista: no envelope, `{ data, page, page_size, total, total_pages, reference_date }`;
- dashboard: `{ …indicadores, reference_date }`, e os números se autodescrevem ("pago em set/2026");
- `GET /auth/me`: `{ user, reference_date }`, o contexto da sessão, carregado na abertura. O formulário de
  pagamento usa esse valor para sugerir e limitar a data.

O `APP_TODAY` existe só no servidor. Se o front calculasse com o próprio relógio, uma solicitação poderia aparecer
vencida no dashboard e em dia no detalhe, por causa do fuso do navegador, da virada do dia ou de um `APP_TODAY`
diferente do relógio real.

### 14.3 Front

React Router e Mantine, com datas em string `YYYY-MM-DD` (o `DateInput` trabalha com `string | null` desde a v8;
versão final na §15). A máscara é detalhe de implementação: o CNPJ usa o `MaskInput` do próprio Mantine, e o valor,
um componente próprio (`MoneyInput`).

### 14.4 Ferramental

npm (já instalado, sem motivo para trocar), Prettier (o `gofmt` do TS), ESLint com `typescript-eslint` e Vitest. O
ESLint usa o preset `recommendedTypeChecked`, que inclui `no-floating-promises`, junto com o `no-empty` do
`js.configs.recommended`; o front declara as duas regras explicitamente, e o back acrescenta
`switch-exhaustiveness-check`. Fora isso, configuração padrão, sem virar projeto paralelo.

### 14.5 Logs: política explícita e sanitização central de erro

O log de requisição carrega `request_id`, `user_id`, `method`, `route` (o padrão da rota, ex.:
`/requests/:id/mark-paid`, e não a URL com query), `status`, `duration_ms` e, quando a rota tem `:id`, o
`resource_id`.

Nunca entram no log: corpo da requisição ou da resposta, senha, cookie, `authorization`, SQL, parâmetros de SQL,
`detail`/`where` do Postgres, dados financeiros completos (valor, CNPJ + nota).

O erro do `pg` carrega `detail` com valores reais: um `23505` traz `Key (supplier_cnpj, invoice_number)=(…)`. Por
isso o serializador de erro do logger (`serializeError`) reduz qualquer erro a `{ name, code }` (ex.: `23505`) antes
de logar, e o `redact` do pino fica como segunda camada. Só "não logar body" não garante a política, porque o dado
vaza pelo erro. Com uma lista explícita a regra fica testável: um teste de integração provoca um `23505` e verifica
que o log não contém o CNPJ, a nota nem o valor.

### 14.6 Rate limit no login: obrigação de segurança

Usamos `@fastify/rate-limit` ≥ 11.2.0, porque as versões anteriores têm bypass por rotação de IPv6
([GHSA-grpc-p53c-r64v](https://github.com/fastify/fastify-rate-limit/security/advisories/GHSA-grpc-p53c-r64v)).
Hoje a última é a 11.2.0 (29/07/2026).

O `POST /auth/login` tem dois baldes: um por IP, contra ataque a muitas contas a partir de um lugar, e um por email
normalizado, contra credential stuffing distribuído contra uma conta. Os padrões são 20 tentativas por IP e 5 por
email numa janela de 15 minutos, configuráveis por variável de ambiente. O balde por email vale também para email que
não existe, senão a existência do balde revelaria contas. Quando um balde estoura, a resposta é 429 com
`Retry-After`.

Atrás do nginx, sem `trustProxy`, todo mundo teria o IP do nginx e o balde por IP viraria global: um atacante
travaria o login de todos. Por isso o `trustProxy` aponta para o IP exato do nginx (`TRUST_PROXY: 172.29.254.10`, o
IP fixo do container `web` no compose), e não é `true` nem contagem de saltos. A doc do Fastify avisa que
"hop-count-only checks … are unsafe when the Fastify origin can be reached directly", e a API fica publicada na 3001
para o Swagger. Uma requisição direta na 3001 não vem do IP do nginx, então o `X-Forwarded-For` dela é ignorado. O
nginx sobrescreve o `X-Forwarded-For` com `$remote_addr`, sem anexar o que o cliente mandou.

O estado fica em memória, o que basta para uma instância única; com várias réplicas, precisaria de Redis.

A OWASP recomenda proteção contra ataques automatizados com limite mais restritivo no login, combinando limite por
conta e por origem ([Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[Bot Management](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html)).

### 14.7 O 429 no nosso formato

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json
Retry-After: 42
```
```json
{ "type": "about:blank", "title": "Too Many Requests", "status": 429,
  "code": "TOO_MANY_REQUESTS", "detail": "Muitas tentativas de login. Tente novamente em instantes." }
```

O `Retry-After` é MAY na [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html), ou seja, opcional. Colocamos
porque ajuda o cliente e o dado já existe: o plugin informa o tempo restante do balde (`ttlInSeconds`), e o hook de
login o escreve no cabeçalho.

O `type` continua `about:blank`, como definido na 4a: pela RFC 9457 ele significa "o status já diz tudo", e o
`code` (extensão) dá a semântica de máquina. Não inventamos um URI de tipo que ninguém consegue resolver, pelo mesmo
princípio da 5.3.

## 15. Versões das dependências

Levantadas em 25/09/2026 no registro do npm, com os `peerDependencies` de cada pacote conferidos entre si.

| Pacote | Versão | Observação |
| --- | --- | --- |
| TypeScript | 5.9.3 | Não é a última (7.0.2); ver abaixo |
| React / React DOM | 19.3.0 | |
| Mantine (`core`, `dates`, `notifications`, `hooks`) | 9.6.2 | Exige React ≥ 19.2 |
| React Router | 8.4.0 | Exige React ≥ 19.2.7 e Node ≥ 22.22 |
| Vite / `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | |
| Vitest / `@vitest/coverage-v8` | 5.0.1 | Aceita Vite 8 e Node 24 |
| ESLint / `typescript-eslint` | 10.11.0 / 8.70.1 | |
| Prettier | 3.9.9 | |
| Testing Library (`react` / `user-event` / `jest-dom`) · MSW · jsdom | 16.3.3 / 14.6.7 / 7.0.1 · 2.15.0 · 30.1.1 | |
| TanStack Query · React Hook Form · `@hookform/resolvers` | 5.103.2 · 7.88.0 · 5.9.1 | |
| Fastify · Zod · `fastify-type-provider-zod` | 5.12.5 · 4.6.5 · 7.0.0 | |
| `@fastify/swagger` / `swagger-ui` / `cookie` / `rate-limit` | 9.9.0 / 6.1.1 / 11.1.2 / 11.2.0 | rate-limit ≥ 11.2.0 pela correção do IPv6 (§14.6) |
| pg · `@node-rs/argon2` · PgTyped (`cli` / `runtime`) | 8.23.0 · 2.2.1 · 2.4.3 / 2.4.2 | |
| openapi-typescript · openapi-fetch | 7.13.0 · 0.17.0 | |

As versões são exatas no `package.json` (sem `^` nem `~`), com o `package-lock.json` commitado, para que a
instalação traga exatamente o que foi testado. Atualizar uma dependência é decisão explícita e nunca acontece como
efeito colateral de `npm install`.

O TypeScript fica na 5.9.3, e não na 7.0.2, porque o TypeScript 7 é o compilador reescrito em Go (tsgo) e ainda não
tem API programática. As ferramentas que leem o código com o compilador dependem dessa API, e os `peerDependencies`
delas decidem a versão:

| Ferramenta | TypeScript aceito |
| --- | --- |
| `typescript-eslint` 8.70 (as regras com tipo, como `no-floating-promises`, §14.4) | `>=4.8.4 <6.1.0` |
| `@pgtyped/cli` 2.4.3 (§12) | `3.1 - 5` |
| `openapi-typescript` 7.13 (§2) | `^5.x` |

A única faixa que satisfaz as três é a 5.x, e a 5.9.3 é a última dela. A 6.0 serviria para o ESLint, mas quebraria o
PgTyped e o openapi-typescript: o npm recusa conflito de peer (`ERESOLVE`), e forçar com `--legacy-peer-deps` seria
esconder a incompatibilidade. É o mesmo raciocínio do Node 24 LTS (§13): previsibilidade vale mais que novidade.

O Mantine fica na 9.6.2, a última estável. O motivo da escolha (§14.3) continua valendo: as datas em string
`YYYY-MM-DD` entraram na v8 e foram mantidas na v9, e o `DateInput` da v9 recebe `string | null`, conferido nos tipos
instalados. As quebras da v9 (variáveis de CSS do variant `light`, `gutter` → `gap` no `Grid`, React ≥ 19.2) não
afetam um projeto que começa do zero, e começar um projeto novo na major anterior seria dívida desde o primeiro dia.

Fontes: registro do npm (`registry.npmjs.org`, `peerDependencies` de cada pacote);
[typescript-eslint #12518: TypeScript 7.0.2 Support](https://github.com/typescript-eslint/typescript-eslint/issues/12518);
[Mantine 8.x → 9.x](https://mantine.dev/guides/8x-to-9x/); [Mantine v8.0.0](https://mantine.dev/changelog/8-0-0/).

## 16. Padrões de arquitetura

A arquitetura é em camadas, com Ports and Adapters pragmático: há porta formal no lado de saída (persistência). No
lado de entrada, a camada `handler/` é o adaptador que decide *quando e como* o código dispara, e chama o service
direto. Dentro das camadas entram os padrões do *Patterns of Enterprise Application Architecture* (Fowler).

O critério das escolhas abaixo é o que o projeto pede. O enunciado diz: *"Valorizamos uma solução pequena, correta e
fácil de entender. Decisões simples e bem executadas valem mais que funcionalidades extras."* O escopo é pequeno e
conhecido: 1 gatilho (HTTP), 3 entidades (usuário, solicitação, evento de auditoria) e 1 banco. Cada padrão entra só
se resolve um problema que esse escopo tem.

### 16.1 Ports and Adapters: onde entra e onde não entra

| Lado | Hexagonal completo | Este projeto |
| --- | --- | --- |
| Saída (driven: banco) | porta + adaptador | Sim. O service declara no próprio arquivo a interface de que precisa (a porta, ex.: `RequestRepository`); o `*_storage.ts` com PgTyped a implementa (o adaptador); o `app.ts` (`buildApp`) liga um no outro |
| Entrada (driving: HTTP) | porta de entrada (interface de caso de uso) chamada por vários adaptadores | Não. O controller (adaptador HTTP) chama o service concreto |
| Modelo | entidade de domínio separada do DTO, com mapeamento nas duas direções | tipos de domínio em `types/`, com conversão só nas bordas (§3) |
| Organização | pastas `ports/`, `adapters/`, `domain/` | camadas `handler/`, `service/`, `repository/` |

A porta existe no lado de saída porque as regras críticas precisam ser testáveis sem banco: transições, travas de
pagamento (§6.3), normalização (§7.2). Com a porta, o teste do service usa um fake escrito à mão, e o teste de
integração usa o adaptador real (§9.5); sem ela, todo teste de regra dependeria do Postgres. A porta também mantém a
regra de negócio longe da tecnologia: o service não importa Postgres, PgTyped nem Fastify, o que o deixa fácil de ler
e de explicar, requisito explícito do enunciado. A interface nasce do consumidor (o service), pequena e com só o que
ele usa.

No lado de entrada não há porta porque existe um único gatilho, o HTTP. A porta de entrada se paga quando vários
adaptadores (HTTP, fila, cron, CLI) chamam o mesmo caso de uso, e aqui não haveria um segundo adaptador para plugar.
Também não haveria ganho de teste: o service é testado direto, e o HTTP com `app.inject()`. Se o escopo ganhar um
segundo gatilho, a porta de entrada nasce junto com ele, já com motivo real; o nome `handler/http/` já deixa espaço
para um `handler/cron/`.

Não separamos entidade de domínio e DTO porque, com 3 entidades e as regras concentradas nos services, dobrar os
tipos e os mapeadores (domínio ↔ persistência ↔ contrato) seria código sem problema para resolver. As duas bordas que
importam já estão isoladas pelo `mapX()` e pelo `toXResponse()` (§3).

As pastas seguem camadas, e não `ports/`/`adapters/`, porque a camada diz o papel do código (quem dispara, quem
decide, quem persiste), que é o que se procura ao ler. As portas vivem junto do consumidor, no service.

### 16.2 Os outros padrões, onde aparecem e por quê

| Padrão | Onde | Por quê |
| --- | --- | --- |
| Layered Architecture (controller → service → repository) | a estrutura de pastas | Cada camada tem uma responsabilidade só: gatilho, regra, persistência |
| Composition Root + injeção manual (Seemann) | `app.ts` (`buildApp`) | Todo o grafo de dependências visível num lugar, sem container de DI |
| Repository (Fowler) | `*_storage.ts` | O service pede dados de negócio e não escreve SQL |
| Unit of Work (Fowler), pela porta `inTransaction(fn)` | `RequestRepository.inTransaction` | O service decide *o que* é atômico (UPDATE + auditoria); o adaptador decide *como* (BEGIN/COMMIT/ROLLBACK). A atomicidade fica na regra sem o service importar o banco |
| Transaction Script (Fowler) | cada caso de uso do service | O domínio é um fluxo com poucas regras. Um Domain Model rico (DDD, agregados) seria exagero para esse escopo |
| Data Mapper / DTO (Fowler) | `mapX()` (linha → domínio) / `toXResponse()` (domínio → JSON) | Isola do domínio o formato do banco e o contrato público (§3) |
| Máquina de estados por tabela de transições | transições de status | Uma tabela com as transições permitidas é a regra inteira num lugar só. O State pattern (GoF), com uma classe por estado, seria peso sem ganho com 4 estados |
| Controle de concorrência otimista (compare-and-set) | `UPDATE … WHERE id = :id! AND status = :from!` | Atômico no banco. 0 linhas afetadas significa que alguém mudou antes, e a resposta é 409 (§5.5) |
| Factory | `buildServer(deps)` em `handler/http/server.ts` | Monta a instância do Fastify (plugins, Swagger, rotas) a partir das dependências recebidas, sem abrir porta. O `buildApp` a chama com os adaptadores reais, e os testes HTTP a chamam com fakes; só o `main.ts` faz o `listen` |
| Fake (test double, Meszaros) | testes de service | Implementa a porta de verdade, sem `vi.mock` |

### 16.3 O que não usamos, de propósito

ORM / Active Record (§12) · container de DI · CQRS · Event Sourcing · DDD tático (agregados, value objects por toda
parte) · hexagonal completo com porta de entrada. Todos resolvem problemas de escala, de domínio complexo ou de
múltiplos gatilhos. O escopo deste projeto (1 gatilho, 3 entidades, 1 banco) não tem esses problemas, e o
enunciado pede explicitamente uma solução pequena e fácil de entender.

## 17. Sistema visual do front

A referência é o [EasyPay: E-Wallet Digital Payment App](https://www.figma.com/community/file/1146678238901785717/easypay-e-wallet-digital-payment-app),
de Nickelfox, na Figma Community (licença CC BY 4.0, com crédito no README), lido pelas variáveis e telas do arquivo.

O EasyPay é um app de celular, e o portal é web de desktop, com tabela, filtros e formulários. Aplicamos o sistema
visual (paleta, tipografia, hierarquia, estilo de cards e botões) e mantivemos os layouts próprios do portal. A
identidade mora em `front/src/theme.ts` (tema do Mantine, paleta e variáveis de CSS); os componentes consomem o tema.

| Elemento | No portal |
| --- | --- |
| Cor de ação | preto `#0B0A0A` nos botões principais; secundário com contorno. O item ativo do menu fica em amarelo pastel com borda preta |
| Marca | creme `#F9EFE5`: faixa do topo, fundo do login, bloco do valor no detalhe, banner de boas-vindas do painel |
| Superfícies | fundo `#F8F8F8`, conteúdo em cards brancos com a borda fina padrão do Mantine |
| Contorno | topo, menu lateral, banner e botões de atalho com borda preta de 2px e sombra sólida deslocada |
| Destaque | o "Total pendente" do painel em card escuro (o equivalente do card de saldo) |
| Status | pastéis do Figma com texto escuro (`autoContrast`): Pendente `#FFF2CF`, Aprovada `#BCE2FE`, Paga `#D6FFDC`, Rejeitada `#FCB3C5` |
| Alerta | "Vencida" e "Rejeitar" em vermelho escuro `#B42318` (contraste AA com branco), o único alerta forte |
| Tipografia | IBM Plex Sans (500/600) nos títulos, Roboto (400/500) no corpo, via `@fontsource` (empacotadas no build, sem depender de internet) |
| Texto de apoio | `#595F67` (passa AA sobre branco), no lugar do cinza claro padrão |

As ilustrações do Figma são do pacote "Indian Doodle" (Varun Trivedi / IconScout), e não as usamos. A licença
gratuita do IconScout proíbe redistribuir os arquivos, e quem clona o repositório recebe tudo o que está nele. No
lugar delas usamos [Open Doodles](https://www.opendoodles.com/about), de Pablo Stanley, no mesmo estilo de traço
preto e com licença CC0 (uso, edição e redistribuição livres). O rosa original foi trocado pelas cores da paleta.
Ficam em `front/src/assets/doodles/`, com um `LICENSE.md`, e aparecem no login e no estado vazio da lista. O painel
usa uma cena do [Humaaans](https://www.humaaans.com) (também de Pablo Stanley, CC0, o estilo que popularizou o
"Corporate Memphis"), recolorida para a paleta, num banner de boas-vindas com atalhos; fica em
`front/src/assets/humaaans/`, também com `LICENSE.md`. O unDraw foi descartado pelo mesmo motivo do IconScout: a
licença dele proíbe redistribuir as ilustrações em pacote.

Além da cor, a UX tem alguns cuidados:
- O painel explica cada número numa linha ("Aguardando aprovação ou rejeição"…).
- O detalhe destaca o valor e o vencimento no topo, como o total de um recibo.
- O formulário tem dicas nos campos que geram dúvida (CNPJ alfanumérico, valor digitado da direita para a esquerda,
  competência).
- Nomes de fornecedor aparecem em negrito como link, e não só pela cor (WCAG 1.4.1).
- A tabela não corta nem quebra colunas: sem espaço, ganha rolagem horizontal.
- O estado vazio tem ilustração, título e o motivo.

O enunciado dá 20% do peso a "frontend e experiência de uso". Concentrar a identidade no tema manteve a mudança só
visual: nenhuma regra, rota ou contrato mudou, e os testes continuaram passando.
