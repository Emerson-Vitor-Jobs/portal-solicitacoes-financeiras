# Tecnologias para o front (`projeto/front`)

| Área | Escolha | Motivo |
| --- | --- | --- |
| Base | Vite + React + TypeScript (SPA) | Leve; o build estático é simples de servir no Docker. |
| UI | Mantine (`@mantine/core`, `@mantine/dates`, `@mantine/notifications`) | Traz tabela, datepicker, notificações e formulários. |
| Formulário | React Hook Form + Zod | Validação por schema; os erros 422 da API voltam para o campo certo. |
| Dados do servidor | TanStack Query | Cuida de cache, loading e mutations. Contra envio duplo, uma trava síncrona (`useSubmitLock`, um `useRef`) barra o segundo clique antes do re-render, e o `isPending` deixa o botão em carregamento. |
| Testes | Vitest + Testing Library (+ user-event) + MSW | Mesmo runner do back; MSW mocka a API nos testes de componente. |

## Outras escolhas (detalhes em `DECISOES_FUNDACAO.md` §14)
- Rotas: React Router.
- Valor em reais: `parseBRLToCents` (gramática BR estrita, oráculo oficial) com máscara estilo banco na digitação,
  feita em componente próprio. `NumberInput` fica de fora porque trabalha com float.
- CNPJ: máscara alfanumérica (§11), com o `MaskInput` do Mantine.
- Datas: Mantine 9 (§15) com strings `YYYY-MM-DD`. `is_overdue` e `reference_date` vêm da API (§14.2).
