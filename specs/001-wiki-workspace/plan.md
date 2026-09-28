# Implementation Plan: Wiki Workspace

**Branch**: `001-wiki-workspace` | **Date**: 2026-09-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-wiki-workspace/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Construir somente a experiência frontend do GerminaWiki. A autenticação, as páginas, a busca e
os demais dados são fornecidos pela API externa do repositório ms-germina-wiki; este
projeto não deve executar um backend ou banco de dados próprios.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 5.x no frontend

**Primary Dependencies**: Vite, TypeScript e chamadas HTTP à API externa
**Storage**: Nenhum armazenamento de domínio no frontend; a API externa é a fonte de verdade
**Testing**: Testes unitários, testes de contrato HTTP, testes de integração e testes
automatizados dos fluxos críticos no navegador

**Target Platform**: Navegadores modernos em desktop e largura móvel representativa; backend
executável em ambiente Linux ou equivalente de hospedagem

**Project Type**: Aplicação frontend web

**Performance Goals**: 95% das buscas válidas com resultados ou estado vazio em até 2 segundos
sob carga normal; navegação, leitura e abertura de comentários sem bloqueios perceptíveis

**Constraints**: O servidor é a autoridade de autenticação, autorização e versionamento;
conteúdo não confiável deve ser tratado com segurança; conflitos de salvamento não podem
sobrescrever versões publicadas; ações críticas devem ser acessíveis por teclado

**Scale/Scope**: Primeira versão para uma comunidade interna, com dezenas de grupos e
milhares de páginas; inclui os sete ownership areas da constituição e exclui edição offline
completa e colaboração em tempo real

## Constitution Check

*GATE: PASS antes da Fase 0. Reavaliar após a Fase 1.*

- Ownership explícito: PASS. Clara, JP e Mancini mantêm as áreas registradas na constituição.
- Contratos antes da integração: PASS. Os contratos de autenticação, páginas, busca,
  comentários e conflitos serão definidos em `contracts/`.
- Fluxos testáveis: PASS. Cada história possui cenários; o quickstart cobrirá os fluxos P1.
- Segurança e integridade: PASS. Autorização no servidor, conteúdo seguro e controle de versão
  são requisitos do design.
- Simplicidade e acessibilidade: PASS. A estrutura separa responsabilidades e exige teclado,
  estados visíveis e mensagens acionáveis.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
frontend/
├── src/
│   ├── app/              # shell, rotas e estados globais
│   ├── features/         # sidebar, busca, leitura, perfil, editor e comentários
│   ├── components/       # componentes compartilhados acessíveis
│   └── services/         # cliente HTTP e sessão
└── tests/
  ├── unit/
  ├── integration/
  └── e2e/

backend/
├── src/
│   ├── auth/             # sessão e autorização
│   ├── pages/            # páginas, versões, wikilinks e backlinks
│   ├── comments/         # threads, âncoras e respostas administrativas
│   ├── profiles/         # perfil e permissões
│   ├── search/           # busca e filtros
│   └── shared/           # validação, erros e persistência
└── tests/
  ├── unit/
  ├── contract/
  └── integration/

contracts/
└── http.md               # contrato externo consolidado da aplicação

database/
└── migrations/           # evolução do esquema relacional
```

**Structure Decision**: Estrutura web separada por frontend, com módulos orientados
às áreas de ownership e uma camada compartilhada para contratos e erros. Os testes ficam
próximos do sistema que validam; os contratos publicados da feature ficam em
`specs/001-wiki-workspace/contracts/` para orientar a implementação e a integração.

## Post-Design Constitution Check

*GATE: PASS após a Fase 1.*

- Ownership e escopo: PASS. O modelo separa os módulos por owner e o quickstart identifica
  validações que exigem integração entre eles.
- Contratos antes da integração: PASS. `contracts/http.md` define entradas, respostas,
  erros, autorização e o comportamento obrigatório de `409`.
- Fluxos testáveis: PASS. `quickstart.md` transforma as histórias P1/P2 em cenários
  reproduzíveis e referencia testes unitários, de contrato, integração e e2e.
- Segurança e integridade: PASS. O servidor calcula permissões, sanitiza conteúdo e rejeita
  salvamentos com versão obsoleta sem alterar a publicação atual.
- Simplicidade e acessibilidade: PASS. Não há camada extra sem responsabilidade; o quickstart
  inclui teclado, foco, estados e mensagens como gates de qualidade.

## Complexity Tracking

Não há violações da constituição que exijam justificativa. A separação frontend/backend é
necessária para manter autorização e integridade sob autoridade do servidor, enquanto os
módulos por ownership evitam duplicação de responsabilidade.
