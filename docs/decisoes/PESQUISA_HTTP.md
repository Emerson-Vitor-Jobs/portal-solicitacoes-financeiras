# Pesquisa: semântica HTTP aplicada ao desafio

Fontes primárias, lidas no texto integral: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
(HTTP Semantics) e [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111.html) (HTTP Caching). As citações
abaixo são literais.

## 0. Quais RFCs decidem o quê

| RFC | Assunto | Afeta este projeto? |
| --- | --- | --- |
| 9110 Semantics | Significado de métodos, status codes e headers, independente da versão | Sim: define os status codes e headers usados aqui |
| 9111 Caching | Quem pode guardar uma resposta e por quanto tempo | Sim: dado financeiro autenticado não pode ficar em cache |
| 9112 / 9113 / 9114 | HTTP/1.1, /2 e /3: como os bytes trafegam (TCP, multiplexação, QUIC) | Não na API. Um 409 significa o mesmo nas três versões; a versão é detalhe de deploy (nginx/CDN). |
| 8446 TLS 1.3 | Criptografia do HTTPS | Só no deploy, onde influencia o atributo `Secure` do cookie. |

A 9110 foi separada das RFCs de transporte para que a semântica (o que um status significa) não dependa do
transporte. Por isso a escolha de status code é 100% 9110.

## 1. As classes (RFC 9110 §15)

1xx informativo, 2xx sucesso, 3xx redirecionamento, 4xx erro do cliente, 5xx erro do servidor.
Um cliente que não conhece um código deve tratá-lo como o x00 da classe. Um 422 desconhecido vira 400 para ele,
então usar o código mais preciso não quebra ninguém.

## 2. Os códigos em disputa (texto literal)

**400 Bad Request (§15.5.1):** "the server cannot or will not process the request due to something that is
perceived to be a client error (e.g., malformed request syntax, invalid request message framing, or deceptive
request routing)."
Os exemplos da própria RFC são de sintaxe e enquadramento da mensagem.

**422 Unprocessable Content (§15.5.21):** "the server understands the content type of the request content
(hence a 415 … is inappropriate), and the syntax of the request content is correct, but it was unable to
process the contained instructions. For example, … well-formed (i.e., syntactically correct), but
semantically erroneous".
Ou seja, conteúdo bem formado, mas semanticamente inválido.

**401 Unauthorized (§15.5.2):** "the request has not been applied because it lacks valid authentication
credentials for the target resource. The server generating a 401 response **MUST send a WWW-Authenticate
header field** … containing at least one challenge applicable to the target resource."

**403 Forbidden (§15.5.4):** "the server understood the request but refuses to fulfill it. … If
authentication credentials were provided in the request, the server considers them insufficient to grant
access. The client SHOULD NOT automatically repeat the request with the same credentials. … An origin server
that wishes to 'hide' the current existence of a forbidden target resource **MAY instead respond with a status
code of 404**."

**404 Not Found (§15.5.5):** "did not find a current representation for the target resource **or is not
willing to disclose that one exists**. … A 404 response is **heuristically cacheable**".

**409 Conflict (§15.5.10):** "the request could not be completed due to a conflict with the current state of
the target resource. This code is used in situations where the user might be able to resolve the conflict and
resubmit the request. The server **SHOULD generate content that includes enough information for a user to
recognize the source of the conflict**."

**201 Created (§15.3.2):** "the request has been fulfilled and has resulted in one or more new resources being
created. The primary resource created by the request is identified by either a **Location header field** in the
response or, if no Location header field is received, by the target URI."

## 3. Idempotência (RFC 9110 §9.2.2)

"PUT, DELETE, and safe request methods are idempotent." POST não é. "A client SHOULD NOT automatically
retry a request with a non-idempotent method unless it has some means to know that the request semantics are
actually idempotent".

No desafio, todas as escritas são POST, então a proteção contra repetição (duplo clique, retry de rede) vem do
domínio. Repetir a criação bate no `UNIQUE (cnpj, nota)` e recebe 409; repetir a decisão bate no
`WHERE status = esperado` e também recebe 409. Nenhuma repetição produz efeito duplo.

## 4. A lacuna do 401 com cookie

O 401 exige `WWW-Authenticate` com um *challenge* de algum esquema. O
[registro IANA de esquemas](https://www.iana.org/assignments/http-authschemes/http-authschemes.xhtml) tem
Basic, Bearer, Digest, DPoP, Negotiate etc., mas nenhum esquema para sessão por cookie. O motivo é que login por
formulário com cookie é autenticação de aplicação, fora do framework de autenticação do HTTP (§11), que funciona
por `WWW-Authenticate` / `Authorization`.

Isso tem três consequências:

1. `POST /auth/login` com senha errada: o recurso `/auth/login` não exige autenticação, e a senha viaja no corpo
   como dado, e não como credencial HTTP. Pela letra da §15.5.2, o caso não é de 401, e sim de conteúdo que o
   servidor não conseguiu processar.
2. Rota protegida sem sessão: a situação é exatamente a do 401 ("lacks valid authentication credentials"), mas
   não há esquema registrado para pôr no header obrigatório.
3. Bearer (`Authorization: Bearer …`, RFC 6750) cumpriria o 401 à risca, mas obrigaria o token a ficar acessível
   ao JavaScript, e a OWASP recomenda não guardar token em `localStorage` por causa de XSS. A pureza de protocolo
   e a segurança no navegador puxam para lados opostos.

Conclusão adotada (revisada): 401 sem `WWW-Authenticate`, como desvio documentado. Inventar um esquema
(ex.: `Session realm="gex"`) cumpriria só a sintaxe do MUST, sem a interoperabilidade que ele protege. Detalhe e
motivos em `DECISOES_FUNDACAO.md` §5.3.

## 5. Cache (RFC 9111)

- `no-store`: "a cache MUST NOT store any part of either the immediate request or the response".
- `private`: um cache compartilhado não pode guardar a resposta, mas o do navegador pode.
- O 404 é heuristicamente cacheável. Um 404 usado para esconder uma solicitação poderia ficar em cache sem
  cabeçalho explícito.

Para uma API de dado financeiro autenticado, o correto é `Cache-Control: no-store` em todas as respostas.
