# Tecnologias para o front (`projeto/front`)

| Área | Escolha | Motivo |
| --- | --- | --- |
| Base | Vite + React + TypeScript (SPA) | Leve, build estático simples no Docker. |
| UI | Mantine (`@mantine/core`, `@mantine/dates`, `@mantine/notifications`) | Kit completo: tabela, datepicker, notificações, formulários. |
| Formulário | React Hook Form + Zod | Validação por schema (pode ser compartilhada com o back). |
| Dados do servidor | TanStack Query | Cache, loading e mutations; `isPending` trava o botão contra envio duplo. |
| Testes | Vitest + Testing Library (+ user-event) + MSW | Mesmo runner do back; MSW mocka a API nos testes de componente. |

## Pontos antes pendentes (fechados em `DECISOES_FUNDACAO.md` §14)
- **Rotas:** React Router.
- **Valor em reais:** `parseBRLToCents` (gramática BR estrita, oráculo oficial) + máscara estilo banco na digitação.
  Nada de `NumberInput` (float). Máscara: componente próprio (valor, estilo banco).
- **CNPJ:** máscara alfanumérica (§11). Máscara: `MaskInput` do Mantine.
- **Datas:** Mantine 9 (§15) com strings `YYYY-MM-DD`. `is_overdue` e `reference_date` vêm da API (§14.2).
