# Decisões de fundação

Registro das decisões iniciais, uma por vez, com o motivo. (Executar só depois de todas fechadas.)

## 1. Estrutura do repositório — FECHADA

- **1a. `back/` e `front/` independentes**, cada um com `package.json`, lockfile e Dockerfile próprios
  (contexto de build = a própria pasta). Sem workspace nem pacote `shared/`.
  - Motivo: Docker e leitura mais simples. O ganho de compartilhar schema é pequeno, porque o schema do
    formulário (texto `"1.553,13"`) e o da API (`amount_cents` inteiro) são diferentes de propósito.
- **1b. `data/` na raiz, idêntico ao pacote recebido**, montado read-only na API (`./data:/app/data:ro`).
  - Motivo: fonte única, o avaliador reconhece e pode comparar, e o mount garante a imutabilidade.
  - A cópia em `documentos/desafio_tecnico/data` será removida na E0.
- **1c. Entrega:** as decisões e pesquisas vão pro repositório em `docs/decisoes/`. O enunciado e as notas de
  planejamento ficam fora (`documentos/`, no `.gitignore`).

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

## 2. Contrato da API — FECHADA (opção A)

- **Fonte única gerada:** schemas Zod por rota no back (`fastify-type-provider-zod`) → OpenAPI
  (`@fastify/swagger`, Swagger UI em `/docs`) → `openapi.json` commitado → tipos gerados no front
  (`openapi-typescript`) + client fino (`openapi-fetch`). Script `gen:api`.
  - Motivo: mesmo princípio do sqlc (contrato como artefato, código gerado, nada de tipo à mão). Se o back
    mudar, o front para de compilar. E o Swagger UI permite explorar a API.
- **Regra de camada:** o Zod valida **forma** no controller (tipo, obrigatório, formato). A **regra de
  negócio** (DV do CNPJ, transição, duplicidade) fica no service/modules, testável sem HTTP.
- Fontes: [fastify-type-provider-zod](https://github.com/fastify/fastify-type-provider-zod) (org Fastify,
  Zod v4, `jsonSchemaTransform`), [openapi-typescript](https://github.com/openapi-ts/openapi-typescript),
  [openapi-fetch](https://openapi-ts.dev/openapi-fetch/).

## 3. Convenção de nomes — FECHADA (opção A)

**Regra:** o que sai do processo (JSON da API, query params, colunas do banco) é `snake_case`. O que
vive dentro do código TypeScript (domínio, services) é `camelCase`. A conversão é explícita e acontece
só nas duas bordas:

| Borda | Onde | Função |
| --- | --- | --- |
| Banco → domínio | `repository/postgres/*_storage.ts` | `mapX(row)` |
| Domínio → JSON | `handler/http/controller/*` | `toXResponse(entity)` |

- Query params também em `snake_case`: `?status=PENDING&supplier=aurora&due_from=2026-09-01&due_to=2026-09-30`.
- No front, os tipos gerados do OpenAPI já chegam em `snake_case` e são usados **direto**, sem remapear.

**Por quê:**
1. **O enunciado obriga `amount_cents`.** Uma API `camelCase` com essa única exceção seria inconsistente.
   Com `snake_case` em toda a API, o campo obrigatório vira a regra, não a exceção.
2. **Seed, banco e API falam a mesma língua.** Os JSON do seed já são `snake_case`, então o avaliador
   compara os dados de entrada e de saída campo a campo, sem tradução mental.
3. **Dentro do código, TypeScript idiomático.** `camelCase` é a convenção da linguagem e dos linters. Um
   domínio em `snake_case` seria o formato do banco vazando pra regra de negócio.
4. **É o modelo idiomático do Go**, meu padrão de referência. Em Go, o campo da struct é `CamelCase` e a tag é `json:"snake_case"`. Aqui a tag
   vira a função de borda, e o princípio é o mesmo: o formato externo é detalhe de serialização, não de domínio.
5. **Isolamento de mudança.** Renomear uma coluna mexe só no `mapX()`. Mudar o contrato público mexe só no
   `toXResponse()` e no schema. O domínio não se move em nenhum dos casos.
6. **Custo baixo e conhecido.** São 3 funções de resposta no projeto inteiro (solicitação, evento de auditoria
   e resumo do dashboard), todas puras e testáveis.
7. **Por que o front não remapeia:** ele só exibe o que recebe. Uma camada de conversão ali seria código sem
   ganho, e o tipo gerado já garante a forma.

## 4. Formato de erro e paginação — FECHADA (A + A)

### 4a. Erros no padrão RFC 9457 (Problem Details)

Toda resposta de erro sai com `Content-Type: application/problem+json`:

```json
{ "type": "about:blank", "title": "Conflict", "status": 409,
  "code": "DUPLICATE_INVOICE",
  "detail": "Já existe uma solicitação com este CNPJ e número de nota fiscal." }
```

- Membros da norma: `type` (sempre `about:blank`, que pela RFC significa "o status HTTP já diz tudo"),
  `title`, `status` e `detail`.
- Extensões (a RFC permite): `code` (código de máquina estável) e `errors` (lista `{ field, message }` para
  erro de validação por campo).
- Códigos iniciais: `VALIDATION_FAILED`, `INVALID_CREDENTIALS`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`,
  `DUPLICATE_INVOICE`, `INVALID_TRANSITION`, `INTERNAL`.
- Um único ponto de saída: o `setErrorHandler` do Fastify (um mapeador único de erro → HTTP). Erro não
  reconhecido → 500 com `code: INTERNAL` e `detail` genérico. A mensagem interna vai só pro log.

**Por quê:**
1. **É norma IETF, não invenção.** A RFC 9457 substitui a 7807. O avaliador reconhece o formato na hora, e
   ele tem a mesma quantidade de campos de um formato caseiro. Escolher a norma custa zero.
2. **`code` separa máquina de humano.** O front decide o comportamento pelo `code` (ex.: `DUPLICATE_INVOICE`
   marca o campo da nota), nunca pelo texto de `detail`. O texto pode mudar sem quebrar o front.
3. **`errors` por campo** permite ao formulário apontar exatamente o input inválido. A própria RFC mostra
   esse padrão de extensão para validação.
4. **Um formato só pra todo erro.** Validação do Zod, regra de domínio e erro inesperado saem iguais. O
   formato padrão do Fastify (`statusCode/error/message`) não carrega `code` nem erro por campo.
5. **Segurança:** um mapeador central garante que stack trace e mensagem de driver nunca chegam ao cliente.
- Fonte: [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html).

### 4b. Paginação por página

`GET /requests?page=1&page_size=20&...` → `{ data, page, page_size, total, total_pages }`

- `page` ≥ 1 (padrão 1). `page_size` padrão 20, **máximo 100**, validado no Zod. O service traduz para
  `LIMIT page_size OFFSET (page-1)*page_size`.
- **Ordenação estável:** `ORDER BY created_at DESC, id DESC`.
- **Total consistente:** a query da página e a do total rodam na **mesma transação `REPEATABLE READ READ ONLY`**
  (mesmo snapshot), com o mesmo `WHERE`.
- Página além da última → `data: []` com o `total` correto (não é erro).

**Por quê:**
1. **Casa com a UI.** A tela tem páginas numeradas. Com `page`, o cliente não consegue mandar um offset
   "quebrado" (ex.: 7 com página de 20). Quem faz a conta é o backend, uma vez só.
2. **O teto de 100** evita que um cliente peça a tabela inteira de uma vez.
3. **O desempate por `id`** é o que torna a paginação determinística. Com só `created_at`, duas linhas com o
   mesmo instante podem trocar de ordem entre requisições, duplicando ou sumindo entre páginas.
4. **Por que a transação e não `COUNT(*) OVER()`:** o `COUNT(*) OVER()` numa query só é elegante, mas numa
   página além da última volta zero linhas, e junto se perde o total. Duas queries no mesmo snapshot
   `REPEATABLE READ` dão o total certo sempre e mantêm cada query simples no PgTyped.
5. **Por que não cursor:** o keyset escala melhor, mas tira o "ir pra página 3" e o total. Com 16 linhas de
   seed, seria complexidade sem problema real pra resolver.
6. **Por que não `limit/offset` na API:** a semântica é a mesma (o SQL continua `LIMIT/OFFSET`). Só a borda
   da API fala a língua da tela.

## 5. Status HTTP — parte 1 FECHADA

Base: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html). Pesquisa completa com citações literais em
`PESQUISA_HTTP.md`.

### 5.1 Dado inválido: 400 para sintaxe, 422 para semântica
- **400** `VALIDATION_FAILED`: o corpo não é lido (JSON quebrado). A §15.5.1 cita "malformed request syntax,
  invalid request message framing".
- **422** `VALIDATION_FAILED` + `errors[]`: o corpo é lido mas viola a regra (campo ausente, CNPJ com DV errado,
  valor ≤ 0, rejeitar sem motivo, pagar sem referência). A §15.5.21 diz "the syntax … is correct, but it was
  unable to process the contained instructions".
- **Por quê:** é a distinção que a própria RFC faz, com os próprios exemplos. E não custa compatibilidade:
  pela §15, um cliente que não conhece o 422 o trata como 400.

### 5.2 Login: `POST /auth/login`
| Caso | Status | `code` |
| --- | --- | --- |
| Senha errada | 401 | `INVALID_CREDENTIALS` |
| Usuário inexistente | 401 | `INVALID_CREDENTIALS` (idêntico ao anterior) |
| Email ou senha ausentes | 422 | `VALIDATION_FAILED` |
| JSON inválido | 400 | `VALIDATION_FAILED` |

- **Por quê:** a requisição está bem formada, uma identidade foi informada e as credenciais
  não são válidas. A semântica é de falha de autenticação, e o 401 é o código dela. O 422 fica reservado para
  violação de regra no payload, não para tentativa de autenticação com credencial inválida.
- **Contraponto registrado:** uma leitura estrita da §15.5.2 diz que `/auth/login` não exige autenticação e que
  a senha viaja no corpo como dado. Escolhemos a semântica de "falha de autenticação". O 401 sai **sem**
  `WWW-Authenticate`, pelo mesmo motivo da 5.3.
- **Resposta idêntica** para "usuário não existe" e "senha errada", pra não revelar quais emails existem.
  Isso vale também para o **tempo de resposta**: quando o usuário não existe, o servidor verifica a senha contra
  um hash argon2 fictício, e os dois caminhos levam o mesmo tempo (anti-enumeração por timing, OWASP
  Authentication Cheat Sheet).
- O corpo segue a RFC 9457 da decisão 4 (`detail`, não `message`).

### 5.3 Rota protegida sem sessão válida: 401, sem `WWW-Authenticate` (desvio consciente da RFC)
- **401** `UNAUTHENTICATED`, corpo RFC 9457. **Nenhum header `WWW-Authenticate`.** Vale também para o 401 do login (5.2).
- O front trata pelo status + `code`: `UNAUTHENTICATED` → redireciona pra tela de login ("Sua sessão expirou");
  `INVALID_CREDENTIALS` → mensagem na tela de login.

**Por quê:**
1. **A situação é a do 401** ("lacks valid authentication credentials", §15.5.2), então o código continua 401.
2. **A §15.5.2 exige `WWW-Authenticate` (MUST), mas esse MUST existe para o framework de autenticação do HTTP
   (§11).** O header diz ao cliente *qual esquema usar* (o navegador abre a janela do Basic, um cliente OAuth manda
   `Bearer`). Ele só tem valor se o cliente entende o esquema.
3. **Login por formulário + cookie é autenticação de aplicação, fora desse framework.** O
   [registro IANA](https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml) não tem esquema para
   sessão por cookie. Qualquer valor que mandássemos seria um esquema inventado que nenhum cliente interpreta.
4. **Um header que ninguém interpreta é cumprimento de fachada:** satisfaz a sintaxe da RFC sem entregar a
   interoperabilidade que o MUST protege, e cria um pseudo-padrão ("GEX Session Authentication Scheme") que
   alguém vai ter que explicar daqui a seis meses. É tecnicamente defensável, mas arquiteturalmente desnecessário.
5. **O desafio não pede.** O enunciado fala em "sessão segura ou token" e em "status 4xx consistente", nada de
   `WWW-Authenticate`. O único consumidor do 401 é o nosso front, que decide pelo status e pelo `code`.
6. **Quem é tocado pelo desvio:** nenhum cliente real. É o comportamento de praticamente toda API web com sessão
   por cookie.
- **Histórico:** a primeira versão desta decisão mandava `WWW-Authenticate: Session realm="gex"` para cumprir o MUST
  à risca. Foi revista após a crítica de que isso criava um mini-protocolo sem valor. A diferença entre este
  desvio e "violar em silêncio" é estar escrito aqui, com o motivo.
- **Descartado:** Bearer token. Cumpre a RFC à risca, mas expõe o token ao JavaScript (a OWASP desaconselha
  por causa de XSS).

### 5.4 Solicitação de outra pessoa: 404
- REQUESTER pedindo uma solicitação que não é dele → **404** `NOT_FOUND`, igual a um ID inexistente.
- **Por quê:** a §15.5.4 autoriza literalmente ("MAY instead respond with a status code of 404"), e a §15.5.5
  define o 404 como "not willing to disclose that one exists". Isso impede enumerar IDs alheios.

## 5. Status HTTP — parte 2 FECHADA

### 5.5 Conflitos: todos 409
- Duplicidade (CNPJ + nota) → **409** `DUPLICATE_INVOICE`.
- Transição inválida (ex.: `PAID → APPROVED`) e perdedor de corrida concorrente → **409** `INVALID_TRANSITION`.
- O corpo informa o status atual (ex.: `"detail": "A solicitação está PAID; não pode ir para APPROVED."`).
- **Por quê:** a §15.5.10 define o 409 como "conflict with the current state of the target resource". Os três
  casos são isso: o estado atual (a nota já existe; o status já é outro) impede o pedido. A mesma seção diz que o
  servidor "SHOULD generate content that includes enough information for a user to recognize the source of the
  conflict", daí o status atual no `detail`. O enunciado também pede 409 para "duplicidade ou conflito de estado".
- Pro perdedor da corrida, a semântica é idêntica à de uma transição inválida (o estado mudou antes dele), então
  o código é o mesmo e o front trata os dois igual: mostra a mensagem e recarrega o detalhe.

### 5.6 Sucesso: 201 + Location / 200 / 204
| Rota | Status | Corpo |
| --- | --- | --- |
| `POST /requests` | **201** + `Location: /requests/{id}` | a solicitação criada |
| `POST /requests/:id/decision` | **200** | a solicitação atualizada |
| `POST /requests/:id/mark-paid` | **200** | a solicitação atualizada |
| `POST /auth/login` | **200** + `Set-Cookie` | dados do usuário (sem hash, sem token) |
| `POST /auth/logout` | **204** | — |
| `GET` (lista, detalhe, dashboard, `/auth/me`) | **200** | a representação |

- **Por quê:** a §15.3.2 define o 201 como "resulted in one or more new resources being created", com o recurso
  identificado pelo `Location`. Isso é exatamente a criação. A decisão e o pagamento não criam o recurso
  principal: mudam o estado de um que já existe (o evento de auditoria é efeito colateral). Então 200, e o corpo
  atualizado evita um `GET` extra. O logout não tem o que devolver, então 204.

### 5.7 Cache: `Cache-Control: no-store` em toda resposta da API
- **Por quê:** pela RFC 9111, `no-store` significa "a cache MUST NOT store any part of either the immediate
  request or the response". É dado financeiro autenticado e não pode ficar em navegador, proxy ou CDN. Isso também
  neutraliza o fato de o 404 ser "heuristically cacheable" (§15.5.5), já que nosso 404 às vezes esconde uma
  solicitação que existe. Não usamos ETag/304 aqui (o ganho não justifica).

### 5.8 ID que não é UUID: 404
- `GET /requests/abc` → **404** `NOT_FOUND`, igual a um UUID inexistente.
- **Por quê:** a URI é sintaticamente válida. Ela só não identifica recurso nenhum, e a §15.5.5 descreve isso:
  "did not find a current representation for the target resource". Os exemplos do 400 (§15.5.1) são de sintaxe da
  mensagem, não de identificador desconhecido. (Muitas APIs respondem 400 `"invalid id format"`. A escolha aqui é consciente.)

### Tabela consolidada
| Situação | Status | `code` |
| --- | --- | --- |
| JSON malformado | 400 | `VALIDATION_FAILED` |
| Conteúdo bem formado mas inválido | 422 | `VALIDATION_FAILED` + `errors[]` |
| Login com credencial inválida (usuário existindo ou não) | 401 (sem `WWW-Authenticate`, ver 5.3) | `INVALID_CREDENTIALS` |
| Sem sessão / sessão expirada | 401 (sem `WWW-Authenticate`, ver 5.3) | `UNAUTHENTICATED` |
| Papel sem permissão (REQUESTER decidindo/pagando) | 403 | `FORBIDDEN` |
| Solicitação de outra pessoa, inexistente ou ID não-UUID | 404 | `NOT_FOUND` |
| CNPJ + nota duplicados | 409 | `DUPLICATE_INVOICE` |
| Transição inválida / perdeu a corrida | 409 | `INVALID_TRANSITION` |
| Erro inesperado | 500 | `INTERNAL` (sem detalhe interno) |

## 6. Datas e tipos — FECHADA

Fontes: [Postgres, Date/Time Types](https://www.postgresql.org/docs/current/datatype-datetime.html) e
[Postgres wiki, Don't Do This](https://wiki.postgresql.org/wiki/Don%27t_Do_This).

### 6.0 Princípios (vindos da pesquisa)
- **`TEXT` + `CHECK`, nunca `char(n)`/`varchar(n)`.** A wiki diz "Don't use the type char(n). You probably want
  text" (preenche com espaços e compara de forma estranha). **Correção:** o CNPJ vira `TEXT` + `CHECK`,
  e não `CHAR(14)` (a regex final, com o CNPJ alfanumérico, está na decisão 11).
- **Dia é `DATE`, instante é `TIMESTAMPTZ`.** O `timestamptz` é guardado em UTC e representa um instante; o
  `date` é um dia do calendário, sem fuso. Vencimento = dia. Criação, atualização e pagamento = instante.
- **O "hoje" nunca vem do banco.** `CURRENT_DATE` e `now()::date` dependem do fuso da sessão. A aplicação calcula
  a data de referência (`APP_TODAY` ou a data atual em `America/Sao_Paulo`) e **passa como parâmetro**.
- **Intervalo semiaberto, nunca `BETWEEN`, com timestamp** (a wiki é explícita). "Pago no mês" =
  `paid_at >= $inicio_mes_sp AND paid_at < $inicio_mes_seguinte_sp`. Os limites são instantes calculados no fuso de
  SP, e a coluna fica sem função em volta, então o índice é usável.
- **Driver:** `types.setTypeParser(1082, v => v)` no `pg`, pra `DATE` chegar como string `YYYY-MM-DD` e nunca
  virar `Date` do JS (que desloca o dia pelo fuso).

### 6.1 Competência: `DATE` no dia 1 + `CHECK`
- `competence DATE NOT NULL CHECK (extract(day from competence) = 1)`. A API expõe `"2026-09"` (igual ao seed). O
  `mapX()` converte `2026-09-01` ↔ `2026-09`.
- **Por quê:** competência é um mês, e o Postgres não tem tipo "mês". A convenção clássica em contabilidade é o
  primeiro dia. O tipo impede um mês 13, ordena e permite aritmética de mês.

### 6.2 Pagamento: `paid_at TIMESTAMPTZ`, formulário com data e hora
- A API recebe `paid_at` em RFC 3339 **com offset obrigatório** (ex.: `2026-09-18T10:30:00-03:00`). O formulário
  pede data e hora, interpretadas em `America/Sao_Paulo`, pré-preenchidas com "agora".
- **Dois conceitos, sem coluna nova** (separar "quando foi registrado" de "quando foi pago"):
  - `audit_events.created_at` = **quando o financeiro registrou** (instante do sistema).
  - `requests.paid_at` = **quando foi pago** (fato de negócio, informado pela pessoa). O enunciado diz: "A data de
    pagamento é um dado próprio e não deve ser substituída pela data de criação."
  - No seed os dois coincidem (registrado na hora). No uso real podem divergir, e é por isso que existem os dois.
- **Por quê:** é fiel ao seed (que traz um instante) e o servidor não inventa horário nenhum.

### 6.3 Travas da data de pagamento
O `mark-paid` rejeita com **422** `VALIDATION_FAILED` (`errors: [{ field: "paid_at", … }]`) quando:
1. **Data futura:** `paid_at >= início do dia seguinte à data de referência, em SP` (respeita o `APP_TODAY`,
   com o relógio injetável no service).
2. **Antes da aprovação:** `paid_at <` o instante do evento `APPROVED` da auditoria, lido **na mesma transação**
   do pagamento.
- **Por quê:** o número "pago no mês" do dashboard depende dessa data. Uma data futura é impossível, e pagar antes
  de aprovar contradiz o fluxo que o portal impõe (`APPROVED → PAID`). O seed respeita as duas travas (todo
  pagamento é posterior à aprovação). O seed é inserido direto no banco, fora do service, então não passa por
  essas validações.

### 6.4 `updated_at` mantido pela query, explícito
- `UPDATE … SET status = $2, updated_at = now() …` na própria query (`.sql` do PgTyped). Sem trigger.
- **Por quê:** fica visível onde a mudança acontece. `now()` é o início da transação, então o `updated_at` da
  solicitação e o `created_at` do evento de auditoria da mesma transação são **idênticos**, o que é coerente.

## 7. Categoria, nota fiscal, busca e tamanhos — FECHADA

### 7.1 Categoria: conjunto fixo
Valores exatamente como no seed: `INFRAESTRUTURA`, `MARKETING`, `SERVIÇOS`, `SOFTWARE`.

**No back:**
- Banco: `category TEXT NOT NULL CHECK (category IN ('INFRAESTRUTURA','MARKETING','SERVIÇOS','SOFTWARE'))`.
  É a garantia final: nenhum caminho (seed, SQL manual, bug) grava categoria inválida.
- Domínio: uma constante única `CATEGORIES = [...] as const`, de onde sai o tipo `Category`.
- Contrato: `z.enum(CATEGORIES)` no schema da rota. O Zod rejeita valor fora da lista com 422, e o OpenAPI
  publica o campo como `enum` com os 4 valores.

**No front:**
- O tipo gerado do OpenAPI já chega como a união `'INFRAESTRUTURA' | 'MARKETING' | 'SERVIÇOS' | 'SOFTWARE'`, e o
  select do formulário é montado a partir dele. **O front não mantém uma lista própria.** Se o back mudar a lista,
  o front deixa de compilar onde usa um valor que não existe mais.
- O texto exibido pode ser amigável ("Serviços"), mas o valor enviado é sempre o do enum.

**Por quê:**
1. O seed tem exatamente 4 categorias, e o escopo não tem tela de cadastro de categoria.
2. **Uma tabela `categories` + FK seria generalização prematura:** flexibilidade (cadastrar sem migration) que
   ninguém no escopo usa, paga com mais uma tabela, mais um join, mais seed e mais testes. *"Premature optimization
   is the root of all evil"* (Knuth, 1974). A generalização prematura é prima dela.
3. **Texto livre destruiria o dado:** "Software", "software " e "SW" virariam três categorias.
4. **Custo de mudar depois:** adicionar uma categoria = uma migration que altera o `CHECK` + um valor na constante.
   Se o negócio passar a precisar cadastrar pela interface, aí sim vira tabela, com um motivo real.

> A frase completa do Knuth também sustenta o resto das decisões: *"We should forget about small efficiencies,
> say about 97% of the time: premature optimization is the root of all evil. Yet we should not pass up our
> opportunities in that critical 3%."* O `UNIQUE` no banco, o `UPDATE` condicional e o dinheiro em inteiro
> são esses 3%: pontos em que "deixar pra depois" vira bug de dado.

### 7.2 Número da nota: `trim` + maiúscula, garantido no banco
- O service normaliza (`trim().toUpperCase()`). O banco garante com
  `CHECK (invoice_number = upper(btrim(invoice_number)) AND invoice_number <> '')`.
- **Por quê:** o `UNIQUE (supplier_cnpj, invoice_number)` só protege contra duplicata se os dois lados estiverem
  na mesma forma canônica. Sem isso, `nf-2026-1001 ` escapa de `NF-2026-1001`. O `CHECK` garante a forma canônica
  mesmo se algum caminho esquecer de normalizar. O seed já está nessa forma, então nada é alterado.
- **Não** removemos hífen nem espaço interno. Isso poderia fundir números diferentes e mudaria como a pessoa lê
  a própria nota.
- Contexto: na NF-e real, a identidade é CNPJ + modelo + série + número (na chave de acesso). O desafio simplifica
  pra CNPJ + número em texto livre, e é isso que modelamos.

### 7.3 Busca por fornecedor: `ILIKE` + `unaccent`, curingas escapados
- `unaccent(supplier_name) ILIKE unaccent('%' || $termo_escapado || '%')`. A extensão `unaccent` (contrib do
  Postgres, presente na imagem oficial) é criada na primeira migration.
- `%`, `_` e `\` digitados são escapados antes. Sem isso, buscar `%` casaria tudo e `_` casaria qualquer letra.
- **Por quê:** "servicos" tem que achar "Aurora Serviços", porque quem digita num campo de busca não se preocupa
  com acento. Full-text (`tsvector`) seria over-engineering pra um nome de fornecedor. Sem índice por enquanto: com
  poucos dados, a varredura sequencial é mais rápida que qualquer índice (Knuth de novo).

### 7.4 Limites de tamanho: Zod + `CHECK` no banco
| Campo | Máximo |
| --- | --- |
| `supplier_name` | 200 |
| `invoice_number` | 50 |
| `description` | 1000 |
| `rejection_reason` | 500 |
| `payment_reference` | 100 |
- Colunas `TEXT` + `CHECK (char_length(x) BETWEEN 1 AND N)` (coerente com o "não use varchar(n)" da 6.0). Os mesmos
  limites vão no Zod.
- **Por quê:** o Zod dá a mensagem boa por campo (422 com `errors[]`), e o `CHECK` é a garantia final. Duas camadas
  com um papel diferente cada, não duplicação sem motivo.

## 8. Autenticação e sessão — FECHADA

Fontes: OWASP [Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html),
[CSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html),
[Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
[Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html);
[bug do Chromium 40202941](https://issues.chromium.org/issues/40202941).

### 8.1 Sessão opaca no Postgres (não JWT)
- No login: gera 32 bytes aleatórios (`crypto.randomBytes`, 256 bits; a OWASP pede ≥ 64) → envia no cookie em
  base64url → grava **só o SHA-256** na tabela `sessions (id_hash PK, user_id, created_at, last_seen_at, expires_at)`.
- A cada request: `SHA-256(cookie)` → busca por PK → confere os timeouts → carrega o usuário e o **papel atual do banco**.
- Logout: `DELETE` da linha + cookie expirado. Sessão expirada encontrada numa busca é apagada ali mesmo (sem cron).
- **Nova sessão a cada login**, o que evita session fixation (OWASP: "must be regenerated after authentication").
- **Por quê:**
  1. A OWASP exige invalidar no servidor: "must take active actions to invalidate the session on both sides, client
     and server". Um JWT stateless não consegue: no logout ele só apaga o cookie, e uma cópia do token continua
     válida até o `exp`.
  2. O papel vem do banco a cada request. Um JWT congelaria o papel até expirar.
  3. Guardar o **hash** (e não o ID) significa que um vazamento do banco não permite sequestrar sessões. Mesmo
     princípio do hash de senha.
  4. Custo: uma tabela e um lookup por chave primária por request. Desprezível.
- **`JWT_SECRET` do `.env.example` fica sem uso.** Documentado no README: o enunciado aceita "sessão segura ou
  token", e a sessão opaca foi escolhida pelos motivos acima.

### 8.2 Expiração: 30 min ociosa + 8 h absoluta
- Ociosa: expira 30 min após o último uso. O `last_seen_at` é atualizado **no máximo 1× por minuto**, pra não
  escrever no banco a cada request.
- Absoluta: `expires_at = login + 8 h`, sem renovação.
- **Por quê:** são os limites superiores da faixa da OWASP para aplicação de baixo risco (15–30 min ociosa, 4–8 h
  absoluta). Uma jornada de trabalho cabe numa sessão, e uma sessão esquecida aberta cai em 30 min.

### 8.3 CSRF: `SameSite=Strict` + header customizado
- Toda requisição que muda estado (POST) exige `X-Requested-With: gex-web`. Sem ele → **403** `FORBIDDEN`.
- **Por quê:** a OWASP diz que o SameSite "should be treated as a defense-in-depth layer". Pra API AJAX, ela
  indica header customizado: um site atacante não consegue enviá-lo sem preflight CORS, e **não habilitamos
  CORS** (front e API na mesma origem via nginx). A OWASP também diz que depender só de `Content-Type:
  application/json` não basta. Token CSRF (double-submit) daria mais peças pro mesmo ganho neste cenário
  same-origin.
- Vale também pro próprio `POST /auth/login` (protege contra login CSRF).

### 8.4 Cookie: `sid`; `HttpOnly; SameSite=Strict; Path=/`; `Secure` por env; sem `__Host-`
- `Secure` vem de `COOKIE_SECURE` (`false` no compose local em http, `true` em produção com HTTPS).
- **Sem o prefixo `__Host-`**: o Chrome rejeita cookies com esse prefixo em `http://localhost` (o Firefox aceita).
  Com o prefixo, o login do avaliador quebraria no Chrome.
- Nome genérico `sid` (a OWASP recomenda não revelar tecnologia pelo nome do cookie).
- **Trade-off documentado no README:** em produção, o certo é HTTPS + `Secure` + `__Host-sid`.

### 8.5 Senha
- argon2id (`@node-rs/argon2`) com o mínimo da OWASP: m = 19 MiB, t = 2, p = 1.
- Login com tempo constante: usuário inexistente → verificação contra um hash fictício (ver 5.2).

## 9. Boot, seed e testes — FECHADA

### 9.1 Boot: entrypoint da API
`entrypoint.sh` com `set -e`: `dbmate --wait up` → `node dist/seed.js` → `exec node dist/main.js`.
- **Por quê:** é o padrão clássico de entrypoint (migrate → exec server). O `set -e` garante a ordem:
  se a migration ou o seed falhar, a API não sobe (nada de subir com banco pela metade). O `exec` faz o Node virar o
  PID 1 e receber o SIGTERM do `docker compose down`. Serviços separados (migrate → seed → api) dariam dois
  containers a mais para a mesma garantia.

### 9.2 Seed idempotente (`ON CONFLICT DO NOTHING`, numa transação)
- **Por quê:** rodar de novo não duplica nada nem sobrescreve o que o avaliador fez no app. A transação garante tudo
  ou nada. Os números do dashboard batem com o `expected_results.json` **só no estado original**, e o README diz
  como voltar a ele: `docker compose down -v && docker compose up --build`. Resetar a cada boot apagaria o trabalho
  do avaliador num simples restart.

### 9.3 Banco de teste: database separado, criado por uma linha de SQL
- `docker/postgres/init/01-test-db.sql` com `CREATE DATABASE gex_finance_it;`. A imagem oficial do Postgres roda
  sozinha o que está em `/docker-entrypoint-initdb.d/` na primeira subida. **Zero código de setup.**
- O serviço de teste roda `dbmate up` no `gex_finance_it` e depois o `vitest`.
- Antes de cada teste de integração: `TRUNCATE … CASCADE` (um helper de uma linha). Os arquivos de integração
  rodam em série.
- **Sem `DATABASE_URL`, o teste FALHA, não pula.**
- **Por quê:**
  1. **O mesmo database quebra de forma concreta:** o teste do dashboard espera exatamente R$ 8.750,49. Uma
     solicitação criada por outro teste muda o número, e o teste falha aleatoriamente conforme a ordem. E o
     `TRUNCATE` apagaria os dados que o avaliador está usando.
  2. **Rollback por teste não serve:** o teste de concorrência precisa de commits reais em conexões separadas
     (é o `UNIQUE` e o `WHERE status` de verdade que estão sendo provados).
  3. **Testcontainers é over-engineering aqui:** exigiria o socket do Docker dentro do container de teste.
  4. **Falhar em vez de pular:** o teste de integração é obrigatório. Um `skip` silencioso seria um teste que
     "passa" sem ter rodado, o *fail silently*, que é proibido neste código.

### 9.4 Como rodar
- Avaliador (só Docker): `docker compose --profile test run --rm back-test` e `… front-test`.
- Local: `npm test` em `back/` e `front/` (com `DATABASE_URL` pro back).

### 9.5 Política de testes: cobertura por comportamento, não por porcentagem

**Não perseguimos 100% de cobertura, nem uma meta numérica.** A cobertura (Vitest + v8) é **medida e reportada**
como diagnóstico, para achar código que ficou sem teste, mas **não bloqueia o build**.

**Por quê:**
1. **Kent Beck** (criador do TDD): *"I get paid for code that works, not for tests, so my philosophy is to test as
   little as possible to reach a given level of confidence."* A régua é confiança, não quantidade.
2. **Martin Fowler** ([TestCoverage](https://martinfowler.com/bliki/TestCoverage.html)): *"If you make a certain
   level of coverage a target, people will try to attain it. The trouble is that high coverage numbers are too easy
   to reach with low quality testing."* E ainda: *"I would be suspicious of anything like 100% - it would smell of
   someone writing tests to make the coverage numbers happy, but not thinking about what they are doing."*
3. **Donald Knuth**, na frase completa: *"premature optimization is the root of all evil. Yet we should not pass up
   our opportunities in that critical 3%."* O esforço de teste vai **concentrado nos 3% críticos** (dinheiro,
   duplicidade, transição, concorrência, datas), não espalhado igualmente por getters, mapeamentos triviais e
   código gerado.
4. **Contexto honesto:** é um teste de capacidade com prazo curto. Optamos conscientemente pela simplicidade (um
   pouco a contragosto, porque a preferência seria testar mais). Isso é uma decisão de escopo, não de qualidade:
   tudo o que o enunciado exige é testado, e cada teste extra foi escolhido por proteger uma regra que, se quebrar,
   vira dado errado.

**O que é testado (e em que nível):**

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
| 11 | CNPJ: DV válido/inválido, com/sem máscara, sequências repetidas | unit | — risco |
| 12 | Bordas de data: vence **hoje** não está vencido; pagamento em 31/08 fora de "pago no mês"; `DATE` volta sem deslocar | unit + integração | — risco |
| 13 | Solicitação alheia → 404; login com usuário inexistente = mesma resposta que senha errada | HTTP | — segurança |
| 14 | Sem header anti-CSRF → 403; `paid_at` futuro / antes da aprovação → 422 | HTTP | — segurança/regra |
| 15 | Auditoria append-only: `UPDATE`/`DELETE` em `audit_events` falha | integração | — integridade |

**O que conscientemente NÃO é testado:** o código gerado pelo PgTyped e pelo `openapi-typescript` (é da ferramenta),
os `mapX`/`toXResponse` triviais (cobertos indiretamente pelos testes de integração e HTTP), a fiação do Fastify, o
Swagger e o estilo visual.

## 10. Organização do trabalho — FECHADA

1. **Fundação primeiro, sequencial:** projeto, compose, banco + seed conferido contra o `expected_results.json` e
   **o contrato congelado** (schemas Zod de todas as rotas + `openapi.json` gerado, com as rotas ainda sem implementação).
2. **Depois, back e front em paralelo**, em branches separadas. O front trabalha contra o contrato, com a API mockada
   via MSW. As duas frentes não têm nenhum arquivo em comum, então o merge é trivial.
3. **Portão antes de cada merge:** testes verdes + lint limpo + revisão do diff contra este documento.
4. **Repositório:** um commit por etapa (Conventional Commits).

**Por quê:** o contrato congelado é o que permite o paralelismo sem divergência de formato. A fundação define todo o
resto, então vem antes.

## 11. CNPJ numérico + alfanumérico — FECHADA

Fonte primária: Receita Federal, IN RFB nº 2.229/2024 e o documento
[Perguntas e Respostas — CNPJ alfanumérico](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf).

**Regra oficial:**
- Formato `AA.AAA.AAA/AAAA-DV`: as 12 primeiras posições aceitam `0–9` e `A–Z` (maiúsculas), e os 2 DVs são
  numéricos.
- Novos CNPJs são alfanuméricos **desde julho de 2026**. Os numéricos existentes continuam válidos, e os dois
  formatos coexistem.
- DV = módulo 11 sobre `código ASCII − 48` de cada caractere (`0`→0 … `9`→9, `A`→17, `B`→18 …), com os mesmos
  pesos de sempre (`5,4,3,2,9,8,7,6,5,4,3,2`, e depois `6,5,4,3,2,9,8,7,6,5,4,3,2`).
- Verificado: o exemplo oficial `12ABC34501DE` → DV `35` ✅. O seed `100000000001` → DV `45` ✅.

**Implementação:**
- `normalizeCnpj`: remove `.`, `/`, `-` e espaços, depois converte para maiúscula.
- `isValidCnpj`: 14 posições, `^[0-9A-Z]{12}[0-9]{2}$`, DV correto, e rejeita os 14 caracteres iguais
  (`00000000000000`, `11111111111111`… que passam no módulo 11 mas não são CNPJ).
- Banco: `supplier_cnpj TEXT NOT NULL CHECK (supplier_cnpj ~ '^[0-9A-Z]{12}[0-9]{2}$')` (substitui a regex
  numérica citada na 6.0).
- Front: a máscara `AA.AAA.AAA/AAAA-00` aceita letras e converte para maiúscula enquanto digita.

**Por quê:**
1. Um portal financeiro que só aceita dígitos **recusaria um fornecedor novo e legítimo** a partir de julho de 2026.
   Seria um bug de produção. A Receita é explícita: "Todos os sistemas públicos e privados deverão ser ajustados".
2. **Não é um segundo algoritmo, é um superconjunto:** para dígitos, `ASCII − 48` é o próprio dígito. CNPJs
   numéricos se comportam **exatamente** como o enunciado pede, e o custo é zero de complexidade extra.
3. **Desvio consciente do texto "armazene apenas os 14 dígitos"**, documentado no README com a fonte. Continuamos
   armazenando as 14 posições sem máscara, que é a intenção da regra. O enunciado foi escrito no vocabulário
   anterior à mudança.

## 12. Camada SQL: PgTyped (substitui o sqlc-gen-typescript) — FECHADA

**Como fica o fluxo** (o mesmo princípio do sqlc no Go: SQL escrito à mão em arquivo → gerador → função tipada commitada):
```sql
-- repository/postgres/queries/requests.sql
/* @name ApproveRequest */
UPDATE requests SET status = 'APPROVED', updated_at = now()
WHERE id = :id! AND status = 'PENDING'
RETURNING *;
```
→ `npm run gen:sql` gera `requests.queries.ts` ao lado → uso no storage: `approveRequest.run({ id }, client)`.

- `!` no parâmetro = obrigatório (não nulo). `"coluna!"` no resultado força não nulo quando o Postgres não consegue
  inferir (ex.: `COALESCE(SUM(x), 0) AS "total!"`).
- Geração com o **Postgres ao vivo**: `npm run gen:sql` sobe o postgres do compose → `dbmate up` → `pgtyped`. O
  código gerado é **commitado**, então o avaliador não precisa gerar nada.

**Por quê:**
1. **O sqlc-gen-typescript não é seguro pra apostar:** o README diz *"Here be dragons! This plugin is still in early
   access"*, o último release é v0.1.3 (jan/2024) e o último commit é de nov/2024. Quase 2 anos parado.
2. **O PgTyped é o padrão de mercado da abordagem SQL-first com codegen em TypeScript:** v2.4.3 (mar/2025), commits
   ativos até set/2026, ~3,3k estrelas, a mais adotada dessa categoria.
3. **É fiel ao estilo SQL-first do sqlc:** SQL em arquivo `.sql`, query com nome, código gerado e nunca editado à mão, sem ORM
   nem query builder.
4. **Os tipos vêm do próprio Postgres** (ele faz `PREPARE` da query e pergunta os tipos ao banco), o que é mais fiel
   que um parser externo.

**Trade-offs aceitos:**
- **Nulidade nem sempre inferida** (fraqueza conhecida): o Postgres não informa a nulidade de expressões. Mitigação:
  anotação explícita `!` no próprio SQL, onde fica visível.
- **Precisa do banco de pé pra gerar.** Mitigação: um script só (`gen:sql`), e o código gerado fica commitado.
- **Diferença de sintaxe em relação ao sqlc:** `/* @name X */` + `:param` no lugar de `-- name: X :one` + `$1`.

**Verificação na E0 (30 min):** as 4 queries representativas (filtro com parâmetro nulo, `UPDATE` condicional com
`RETURNING`, `INSERT` que viola o `UNIQUE` devolvendo o `23505` intacto, agregação com `FILTER`) + `run(params, client)`
dentro de uma transação. Se algo falhar, **para e discute**.

Contexto conceitual (SQL-first × query builder × ORM, e por que o TS costuma evitar SQL): `SQL_FIRST_VS_QUERY_BUILDERS.md`.

Fontes: [PgTyped](https://pgtyped.dev/), [adelsz/pgtyped](https://github.com/adelsz/pgtyped),
[sqlc-gen-typescript](https://github.com/sqlc-dev/sqlc-gen-typescript),
[PropelAuth: Libraries for writing raw SQL safely](https://www.propelauth.com/post/libraries-for-writing-raw-sql-safely).

## 13. Runtime: Node 24 LTS no Docker — FECHADA

- Imagem `node:24.21.0-alpine` com a **versão exata pinada** (mesma lógica do `postgres:16.4-alpine` que o desafio
  já traz) e `"engines": { "node": ">=24 <25" }` nos dois `package.json`.
- Calendário oficial ([nodejs/Release `schedule.json`](https://github.com/nodejs/Release/blob/main/schedule.json)),
  conferido em 25/09/2026:

| Versão | Status hoje | LTS desde | Manutenção | Fim |
| --- | --- | --- | --- | --- |
| 22 | LTS (manutenção) | 2024-10-29 | 2025-10-21 | 2027-04-30 |
| **24** | **Active LTS** (última: v24.21.0, 07/09/2026) | 2025-10-28 | 2026-10-20 | 2028-04-30 |
| 26 | **Current** | previsto 2026-10-28 | 2027-10-20 | 2029-04-30 |

**Por quê:** o Node 26 não é ruim, mas ainda é *Current*: pode receber mudanças até entrar em LTS
em 28/10/2026. Numa entrega avaliável, **previsibilidade** vale mais que novidade. O avaliador roda o mesmo runtime
estável que nós, e o pin da versão exata garante que `docker compose up --build` daqui a uma semana produz a mesma
imagem.

**Observação:** a máquina de desenvolvimento tem o Node 26.9.0. Os testes oficiais rodam no container
(`--profile test`), que é o que vale. Localmente, o `engines` só avisa.

## 14. Fechamento pré-E0: dinheiro, tempo, front, ferramental, logs e rate limit — FECHADA

Revisada contra os dados do desafio. Uma primeira versão propunha "máscara estilo banco" como o próprio parser. Isso quebrava o oráculo oficial
(`"10"` → 1000), foi corrigido e a revisão concordou.

### 14.1 Dinheiro: parser separado da máscara
- **O back não tem parser de BRL.** Recebe `amount_cents` e valida inteiro, `> 0`, `≤ Number.MAX_SAFE_INTEGER`.
  Front = representação humana. Back = representação canônica.
- **`parseBRLToCents(texto)`**: função pura do **front**, com uma gramática **exclusivamente brasileira**:
  - `R$` opcional, espaços opcionais;
  - parte inteira com dígitos simples (`1553`) **ou** milhar agrupado por `.` em grupos de 3 (`1.553`);
  - parte decimal opcional com `,` + 1 ou 2 dígitos.

| Entrada | Resultado |
| --- | --- |
| `1.553,13` / `0,01` / `10` / `R$ 2.000,00` | 155313 / 1 / 1000 / 200000 (os exemplos **oficiais** do `expected_results.json`) |
| `1,5` / `1,55` / `1.553` | 150 / 155 / 155300 |
| `1553.13`, `1,553.13`, `1,555`, `1.55`, `abc`, `0`, `-1` | ❌ rejeita (os dois últimos: valor deve ser > 0) |

- **`1.553` é aceito (= R$ 1.553,00):** dentro da gramática brasileira ele não é ambíguo. A ambiguidade só existiria
  se o formato americano fosse aceito, e ele é rejeitado. É a mesma regra que aceita o `"10"` oficial.
- **A UX da digitação é a máscara estilo banco:** cada dígito entra pela direita (`1` → `0,01`, `155313` → `1.553,13`).
  Duas entradas pro mesmo campo, uma função só:
  - teclado → motor da máscara → texto formatado (`"0,01"`) → `parseBRLToCents` → 1
  - colar (`"10"`, `"R$ 2.000,00"`) → `parseBRLToCents` → 1000 / 200000
- **Por quê:** o contrato fica previsível (um formato só, um parser só, testado contra o oráculo oficial). A máscara
  elimina a ambiguidade na digitação sem mudar o significado do texto colado.
- A **biblioteca** da máscara (react-imask, outra ou um componente próprio) é detalhe de implementação da E6. A
  decisão que importa é o comportamento acima.

### 14.2 Tempo: o servidor é a autoridade
- **`is_overdue` é calculado no backend** e vem em cada solicitação (lista e detalhe). O front nunca compara datas
  com o relógio do navegador.
- **`reference_date` é metadado da resposta, não campo repetido em cada objeto:**
  - lista: no envelope, `{ data, page, page_size, total, total_pages, reference_date }`;
  - dashboard: `{ …indicadores, reference_date }`, e os números se autodescrevem ("pago em set/2026");
  - `GET /auth/me`: `{ user, reference_date }`, o contexto da sessão, carregado na abertura. O formulário de
    pagamento usa esse valor pra sugerir e limitar a data.
- **Por quê:** o `APP_TODAY` existe só no servidor. Se o front calculasse com o próprio relógio, apareceria "vencida
  no dashboard, em dia no detalhe" (fuso do navegador, virada do dia, `APP_TODAY` diferente do relógio real).

### 14.3 Front: fechado
React Router · Mantine com datas em string `YYYY-MM-DD` (o `DateInput` trabalha com `string | null` desde a v8; versão final na §15) ·
biblioteca de máscara decidida na E6 (não bloqueia).

### 14.4 Ferramental: fechado
npm (já instalado, sem motivo pra trocar) · Prettier (o `gofmt` do TS) · ESLint + `typescript-eslint` com
`no-floating-promises` e `no-empty` · Vitest. **Sem virar projeto paralelo:** config padrão + essas regras.

### 14.5 Logs: política explícita + sanitização central de erro
- **O que o log de requisição carrega:** `request_id`, `user_id`, `method`, `route` (o padrão, ex.:
  `/requests/:id/mark-paid`, não a URL com query), `status`, `duration_ms`, e quando fizer sentido o `resource_id`.
- **O que nunca entra no log:** corpo da requisição ou da resposta, senha, cookie, `authorization`, SQL, parâmetros de
  SQL, `detail`/`where` do Postgres, dados financeiros completos (valor, CNPJ + nota).
- **Sanitizador central de erro:** o erro do `pg` carrega `detail` com valores reais (ex.: um `23505` traz
  `Key (supplier_cnpj, invoice_number)=(…)`). O serializador de erro do logger reduz qualquer erro de banco a
  `{ name, code }` (ex.: `23505`) antes de logar. O pino `redact` fica como segunda camada.
- **Por quê:** "não logar body" sozinho não garante a política, porque o dado vaza pelo erro. Com uma lista explícita
  a regra fica testável: um teste provoca um `23505` e verifica que o log não contém o CNPJ.

### 14.6 Rate limit no login: obrigação de segurança (E3)
- `@fastify/rate-limit` **≥ 11.2.0** (as versões anteriores têm bypass por rotação de IPv6,
  [GHSA-grpc-p53c-r64v](https://github.com/fastify/fastify-rate-limit/security/advisories/GHSA-grpc-p53c-r64v)).
  Hoje a última é a 11.2.0 (29/07/2026).
- **Dois baldes no `POST /auth/login`:** por **IP** (ataque a muitas contas a partir de um lugar) e por **email
  normalizado** (credential stuffing distribuído contra uma conta). O balde por email vale **também pra email que não
  existe**, senão a existência do balde revelaria contas. Estoura → **429** + `Retry-After`.
- **Atrás do nginx:** sem `trustProxy`, todo mundo teria o IP do nginx e o balde por IP viraria global (um atacante
  travaria o login de todos). Com `trustProxy` **no IP exato do nginx** (IP fixo do container `web` no compose), e
  **não** `true` nem contagem de saltos: a doc do Fastify avisa que "hop-count-only checks … are unsafe when the
  Fastify origin can be reached directly", e a API fica publicada na 3001 pro Swagger. Uma requisição direta na 3001
  não vem do IP do nginx, então o `X-Forwarded-For` dela é ignorado (anti-spoofing).
- O nginx **sobrescreve** o `X-Forwarded-For` com `$remote_addr`, sem anexar o que o cliente mandou.
- Estado em memória (instância única). Documentado: com várias réplicas, precisaria de Redis.
- **Por quê:** a OWASP recomenda proteção contra ataques automatizados com limite mais restritivo no login, combinando
  limite por conta e por origem ([Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html),
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
- O `Retry-After` é **MAY** na [RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html) (boa prática, não
  obrigação). Colocamos porque ajuda o cliente, e o plugin já o gera.
- O `type` continua `about:blank`, como definido na 4a: pela RFC 9457 ele significa "o status já diz tudo", e o
  `code` (extensão) dá a semântica de máquina. Não inventamos um URI de tipo que ninguém consegue resolver, pelo mesmo
  princípio da 5.3.

## 15. Versões das dependências — FECHADA

Levantadas em 25/09/2026 no registro do npm, com os `peerDependencies` de cada pacote conferidos entre si.

| Pacote | Versão | Observação |
| --- | --- | --- |
| **TypeScript** | **5.9.3** | **Não** a última (7.0.2). Ver abaixo |
| React / React DOM | 19.3.0 | |
| Mantine (`core`, `dates`, `notifications`, `hooks`) | **9.6.2** | Exige React ≥ 19.2 |
| React Router | 8.4.0 | Exige React ≥ 19.2.7 e Node ≥ 22.22 |
| Vite / `@vitejs/plugin-react` | 8.3.1 / 6.1.1 | |
| Vitest / `@vitest/coverage-v8` | 5.0.1 | Aceita Vite 8 e Node 24 |
| ESLint / `typescript-eslint` | 10.11.0 / 8.70.1 | |
| Prettier | 3.9.9 | |
| Testing Library (`react` / `user-event` / `jest-dom`) · MSW · jsdom | 16.3.3 / 14.6.7 / 7.0.1 · 2.15.0 · 30.1.1 | |
| TanStack Query · React Hook Form · `@hookform/resolvers` | 5.103.2 · 7.88.0 · 5.9.1 | |
| Fastify · Zod · `fastify-type-provider-zod` | 5.12.5 · 4.6.5 · 7.0.0 | |
| `@fastify/swagger` / `swagger-ui` / `cookie` / `rate-limit` | 9.9.0 / 6.1.1 / 11.1.2 / **11.2.0** | rate-limit ≥ 11.2.0 pela correção do IPv6 (§14.6) |
| pg · `@node-rs/argon2` · PgTyped (`cli` / `runtime`) | 8.23.0 · 2.2.1 · 2.4.3 / 2.4.2 | |
| openapi-typescript · openapi-fetch | 7.13.0 · 0.17.0 | |

**Regras:**
- **Versões exatas** no `package.json` (sem `^` nem `~`) + `package-lock.json` commitado. O avaliador instala
  exatamente o que foi testado.
- Atualização de dependência é uma decisão, não um efeito colateral de `npm install`.

**Por quê: TypeScript 5.9.3 e não 7.0.2**
1. O TypeScript 7 é o compilador reescrito em Go (tsgo) e **ainda não tem API programática**. As ferramentas que leem
   o código com o compilador dependem dessa API.
2. Os `peerDependencies` que decidem:

| Ferramenta | TypeScript aceito |
| --- | --- |
| `typescript-eslint` 8.70 (as regras com tipo, como `no-floating-promises`, §14.4) | `>=4.8.4 <6.1.0` |
| `@pgtyped/cli` 2.4.3 (§12) | `3.1 - 5` |
| `openapi-typescript` 7.13 (§2) | `^5.x` |

3. **A única faixa que satisfaz as três é a 5.x**, e a 5.9.3 é a última dela. A 6.0 serviria pro ESLint, mas quebraria o
   PgTyped e o openapi-typescript: o npm recusa conflito de peer (`ERESOLVE`), e forçar com `--legacy-peer-deps` seria
   esconder a incompatibilidade.
4. Mesmo raciocínio do Node 24 LTS (§13): numa entrega avaliável, previsibilidade vale mais que novidade.

**Por quê: Mantine 9 e não a v8 citada nas decisões anteriores**
1. As decisões iniciais citavam a v8, que era a referência na hora. A última estável hoje é a **9.6.2**.
2. **O motivo da escolha continua válido:** as datas em string `YYYY-MM-DD` entraram na v8 e foram mantidas na v9.
   As quebras da v9 (variáveis de CSS do variant `light`, `gutter` → `gap` no `Grid`, React ≥ 19.2) não afetam um
   projeto que começa do zero.
3. Começar um projeto novo na major anterior seria dívida desde o primeiro dia.
4. **Verificação na E0b:** conferir pelos tipos instalados que o `DateInput` da v9 recebe `string | null`.

Fontes: registro do npm (`registry.npmjs.org`, `peerDependencies` de cada pacote);
[typescript-eslint #12518: TypeScript 7.0.2 Support](https://github.com/typescript-eslint/typescript-eslint/issues/12518);
[Mantine 8.x → 9.x](https://mantine.dev/guides/8x-to-9x/); [Mantine v8.0.0](https://mantine.dev/changelog/8-0-0/).
