# Segurança

Como o portal protege credenciais, sessões e dados financeiros, o que fica fora deste escopo e como reportar um
problema. As referências (OWASP, RFCs) e os motivos de cada escolha estão em
[`docs/decisoes/DECISOES_FUNDACAO.md`](docs/decisoes/DECISOES_FUNDACAO.md) (§N).

## Reportar uma vulnerabilidade

Não abra uma issue pública. Escreva para **emerson@risilva.com**, com os passos para reproduzir e o impacto esperado.

> Este repositório é um desafio técnico. As credenciais do seed (`data/seed_users.json`, README) são fictícias,
> exclusivas do desafio, e não protegem nada real.

## Controles implementados

### Autenticação e sessão (§8)
| Controle | Implementação |
| --- | --- |
| Senha | argon2id com os parâmetros mínimos da OWASP (m = 19 MiB, t = 2, p = 1). A senha nunca é logada nem devolvida |
| Login sem enumeração de contas | mesma resposta (401 `INVALID_CREDENTIALS`) e mesmo custo para usuário inexistente e senha errada: sem usuário, a senha é verificada contra um hash argon2 fictício |
| Sessão | token opaco de 32 bytes aleatórios (256 bits); o banco guarda só o SHA-256 dele, então um vazamento do banco não permite sequestrar sessões |
| Revogação real | logout apaga a sessão no servidor; o papel do usuário é relido do banco a cada requisição, em vez de ficar congelado num token |
| Expiração | 30 min de inatividade e 8 h absolutas; sessão nova a cada login (evita *session fixation*) |
| Cookie | `sid`, `HttpOnly`, `SameSite=Strict`, `Path=/`; `Secure` controlado por `COOKIE_SECURE` (ver *Limitações*) |
| Nada no navegador | nenhum token em `localStorage`/`sessionStorage`: a sessão existe só no cookie `HttpOnly` |

### Autorização (§5)
- Os hooks `authenticate` → `requireRole` rodam sempre no backend, antes da validação e da busca do recurso. O service
  confere o papel de novo (defesa em profundidade).
- O REQUESTER só vê o que é dele: a lista é filtrada no SQL. Abrir a solicitação de outra pessoa responde 404, igual a
  um id inexistente, para não revelar quais ids existem (RFC 9110 §15.5.4).
- A interface esconde as ações que o perfil não pode fazer, mas isso é só UX: o back responde 403 de qualquer forma.

### CSRF (§8.3)
- `SameSite=Strict` no cookie e o header obrigatório `X-Requested-With: gex-web` em toda requisição que muda
  estado (incluindo o login). Um site de terceiro não consegue enviar esse header sem um *preflight* CORS, e a API não
  habilita CORS: front e API ficam na mesma origem, via nginx.

### Força bruta (§14.6)
- Rate limit no `POST /api/auth/login` com dois limites independentes: 5 tentativas por e-mail e 20 por IP, numa
  janela de 15 min (ajustáveis por `LOGIN_RATE_LIMIT_*`). O limite por e-mail vale também para e-mail inexistente, para
  não revelar contas. Quem estoura o limite recebe 429 com `Retry-After`.
- A API usa `@fastify/rate-limit` 11.2.0, porque as versões anteriores têm bypass por rotação de IPv6 (GHSA-grpc-p53c-r64v).
- Para obter o IP real sem spoofing, a API confia no `X-Forwarded-For` só quando a requisição vem do IP fixo do nginx,
  e o nginx sobrescreve o header em vez de anexar o que o cliente mandou.

### Entrada e dados (§2, §6, §7, §11)
- Na borda, todo corpo, query e parâmetro passa por um schema Zod, e o que é inválido responde 422 com o erro por
  campo. As regras de negócio (dígito do CNPJ, transições, travas de pagamento) ficam no service.
- O banco é a última linha: `CHECK` de formato e coerência, `UNIQUE (cnpj, nota)` e trigger append-only na auditoria
  impedem que qualquer caminho (bug, SQL manual) grave um estado impossível.
- O SQL é sempre parametrizado (PgTyped). A busca por fornecedor escapa `%`, `_` e `\`, então um termo digitado nunca
  vira curinga.
- Dinheiro fica em inteiro (centavos, `BIGINT`), sem arredondamento de float.

### Logs sem dado sensível (§14.5)
- Cada requisição gera uma linha com campos fixos: `request_id`, `user_id`, `method`, `route` (o padrão, sem query
  string), `status` e `duration_ms`.
- Nunca entram no log: corpo, senha, cookie, `Authorization`, SQL, parâmetros de SQL, valores, CNPJ ou nota.
- Erro de banco é reduzido a `{ name, code }`, porque o `detail` de um `23505` traria o CNPJ e a nota. Um teste provoca
  esse erro e confere que o log não contém nenhum dos dois. O `redact` do pino fica como segunda camada.
- Erros inesperados respondem 500 genérico, e a mensagem interna nunca chega ao cliente.

### Headers HTTP
| Header | Onde | Valor |
| --- | --- | --- |
| `Content-Security-Policy` | SPA | só a própria origem para script, estilo, fonte, imagem e conexão; `frame-ancestors 'none'`, `object-src 'none'` |
| `X-Content-Type-Options` | tudo | `nosniff` |
| `X-Frame-Options` | tudo | `DENY` |
| `Referrer-Policy` | tudo | `no-referrer` |
| `Permissions-Policy` | SPA | câmera, microfone e geolocalização desligados |
| `Cache-Control` | API | `no-store`: dado financeiro autenticado não fica em cache (RFC 9111) |
| `Server` | tudo | sem versão (`server_tokens off`) |

### Dependências
- Versões exatas no `package.json` e `package-lock.json` commitado, para o avaliador instalar exatamente o que foi
  testado.
- Imagens Docker com versão fixa (`node:24.21.0-alpine`, `nginx:1.30.5-alpine`, `postgres:16.4-alpine`,
  `dbmate:2.36.0`). A API roda como usuário `node`, não root.

## Limitações conhecidas (fora do escopo do desafio)

| Limitação | Por quê | Em produção |
| --- | --- | --- |
| Tráfego em HTTP, cookie sem `Secure` e sem o prefixo `__Host-` | o avaliador roda em `http://localhost`, e o Chrome rejeita `__Host-` em http | HTTPS no proxy, `COOKIE_SECURE=true` e cookie `__Host-sid` |
| Sem HSTS | só faz sentido com HTTPS | `Strict-Transport-Security` no proxy |
| Rate limit em memória | uma instância da API | armazenamento compartilhado (ex.: Redis) com várias réplicas |
| CSP com `style-src 'unsafe-inline'` | exigido pelos estilos inline do Mantine | nonce/hash de estilo, se a biblioteca permitir |
| Postgres exposto na 5432 e API na 3001 | conveniência de avaliação (Swagger, inspeção) | só a rede interna; a API atrás do proxy |
| Credenciais padrão no compose | reprodutibilidade do desafio | segredos fora do repositório (gerenciador de segredos) |
| Sem MFA, bloqueio de conta ou recuperação de senha | o enunciado pede explicitamente para não implementar cadastro nem recuperação | conforme a política da empresa |
