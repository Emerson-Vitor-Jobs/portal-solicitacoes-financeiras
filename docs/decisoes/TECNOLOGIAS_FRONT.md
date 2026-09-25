# Tecnologias para o front (`projeto/front`)

| Área | Escolha | Motivo |
| --- | --- | --- |
| Base | Vite + React + TypeScript (SPA) | Leve; o build estático é simples de servir no Docker. |
| UI | Mantine (`@mantine/core`, `@mantine/dates`, `@mantine/notifications`) | Traz tabela, datepicker, notificações e formulários. |
| Formulário | React Hook Form + Zod | Validação por schema (pode ser compartilhada com o back). |
| Dados do servidor | TanStack Query | Cuida de cache, loading e mutations; `isPending` trava o botão contra envio duplo. |
| Testes | Vitest + Testing Library (+ user-event) + MSW | Mesmo runner do back; MSW mocka a API nos testes de componente. |

## Pontos antes pendentes (fechados em `DECISOES_FUNDACAO.md` §14)
- Rotas: React Router.
- Valor em reais: `parseBRLToCents` (gramática BR estrita, oráculo oficial) com máscara estilo banco na digitação,
  feita em componente próprio. `NumberInput` fica de fora porque trabalha com float.
- CNPJ: máscara alfanumérica (§11), com o `MaskInput` do Mantine.
- Datas: Mantine 9 (§15) com strings `YYYY-MM-DD`. `is_overdue` e `reference_date` vêm da API (§14.2).
