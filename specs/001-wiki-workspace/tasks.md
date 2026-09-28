---

description: "Task list for GerminaWiki Wiki Workspace"
---

# Tasks: Wiki Workspace

**Input**: Design documents from `specs/001-wiki-workspace/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/http.md](./contracts/http.md),
[quickstart.md](./quickstart.md)

**Organization**: Tasks are grouped by user story so each increment can be implemented and
validated independently after the foundational phase.

## Phase 1: Setup

**Purpose**: Inicializar a aplicação web e a estrutura definida no plano.

- [X] T001 Criar `package.json`, workspaces e scripts de desenvolvimento para `frontend/` e `backend/`.
- [X] T002 [P] Criar configurações TypeScript e lint/format nos arquivos `frontend/tsconfig.json`, `backend/tsconfig.json` e configurações raiz.
- [X] T003 [P] Criar estrutura inicial em `frontend/src/`, `frontend/tests/`, `backend/src/`, `backend/tests/` e `database/migrations/`.
- [X] T004 [P] Documentar comandos de instalação, execução e testes em `README.md` conforme `specs/001-wiki-workspace/quickstart.md`.
- [X] T005 Configurar variáveis de ambiente de desenvolvimento e validação de configuração em `backend/src/shared/config.ts`.

## Phase 2: Foundational

**Purpose**: Entregar as bases obrigatórias para todas as histórias.

- [X] T006 Definir tipos compartilhados de entidades, permissões e erros em `frontend/src/services/contracts.ts` e `backend/src/shared/contracts.ts` conforme `specs/001-wiki-workspace/contracts/http.md`.
- [X] T007 Criar migrações relacionais para User, Group, Page, PageVersion, PageReference, CommentThread e Comment em `database/migrations/001_wiki_workspace.sql`.
- [X] T008 Criar validação de entrada, erros comuns e serialização ISO 8601 em `backend/src/shared/validation.ts` e `backend/src/shared/errors.ts`.
- [X] T009 Implementar middleware de sessão e autorização no servidor em `backend/src/auth/session.ts` e `backend/src/auth/authorization.ts`; o papel administrativo MUST ser calculado no servidor.
- [X] T010 Implementar cliente HTTP com tratamento comum de `401`, `403`, `404`, `409` e `5xx` em `frontend/src/services/http-client.ts`.
- [ ] T011 [P] Criar testes unitários das regras de autorização, validação e erro em `backend/tests/unit/shared.test.ts`.
- [ ] T012 Criar testes de contrato para formato de erro e autenticação em `backend/tests/contract/common-contract.test.ts`.
- [X] T013 Configurar banco de teste e fixtures de usuário, grupos, páginas, versões e comentários em `backend/tests/fixtures/wiki-fixtures.ts`.

## Phase 3: User Story 1 - Acessar e encontrar conteúdo (P1)

**Goal**: Uma pessoa autenticada entra no workspace, navega pela árvore e encontra páginas por busca e grupo.

**Independent Test**: Usuário não autenticado é bloqueado; usuário autenticado abre a árvore, seleciona página, pesquisa e filtra por grupo, inclusive sem resultados.

- [ ] T014 [P] [US1] Criar testes de contrato para `POST /session/login`, `GET /me`, `GET /workspace/tree` e `GET /pages/search` em `backend/tests/contract/us1-navigation.contract.test.ts`.
- [ ] T015 [P] [US1] Criar teste e2e de bloqueio de rota privada e login em `frontend/tests/e2e/us1-auth-navigation.spec.ts`.
- [X] T016 [US1] Implementar endpoints de sessão e árvore autorizada em `backend/src/server.ts` e `backend/src/auth/session.ts`.
- [X] T017 [US1] Implementar consulta de busca por texto e grupo em `backend/src/server.ts` e `backend/src/pages/store.ts`; resultados MUST respeitar permissões e busca vazia MUST retornar estado sem filtro.
- [X] T018 [US1] Implementar shell, rotas privadas e redirecionamento de sessão expirada em `frontend/src/main.ts`.
- [X] T019 [US1] Implementar árvore hierárquica com estados vazio, carregando e erro em `frontend/src/main.ts`.
- [X] T020 [US1] Implementar busca, filtro por grupo e estado sem resultados em `frontend/src/main.ts`.
- [X] T021 [US1] Integrar seleção da árvore, resultados de busca e rota de página em `frontend/src/main.ts`.
- [ ] T022 [US1] Executar o fluxo independente de US1 e corrigir acessibilidade de teclado, foco e mensagens em `frontend/tests/e2e/us1-auth-navigation.spec.ts`.

## Phase 4: User Story 2 - Ler e relacionar páginas (P1)

**Goal**: Uma pessoa lê páginas formatadas, segue wikilinks e consulta backlinks com destinos indisponíveis tratados.

**Independent Test**: Abrir página com formatação, seguir link válido, consultar backlink e selecionar link inexistente sem quebrar a página.

- [ ] T023 [P] [US2] Criar testes de contrato para `GET /pages/{pageId}` e `GET /pages/{pageId}/backlinks` em `backend/tests/contract/us2-page-view.contract.test.ts`.
- [ ] T024 [P] [US2] Criar testes unitários de sanitização, wikilink circular e referência inexistente em `backend/tests/unit/page-reference.test.ts`.
- [X] T025 [US2] Implementar leitura segura e resolução de PageReference em `backend/src/server.ts` e `backend/src/pages/store.ts`.
- [X] T026 [US2] Implementar rotas de página e backlinks com respostas `403`/`404` seguras em `backend/src/server.ts`.
- [X] T027 [US2] Implementar renderização de leitura sem edição acidental em `frontend/src/main.ts`.
- [X] T028 [US2] Implementar wikilinks válidos, inexistentes e indisponíveis em `frontend/src/main.ts`.
- [X] T029 [US2] Implementar painel de backlinks selecionáveis em `frontend/src/main.ts`.
- [ ] T030 [US2] Executar o fluxo independente de US2 e validar leitura por teclado e mensagens de destino indisponível em `frontend/tests/e2e/us2-page-view.spec.ts`.

## Phase 5: User Story 3 - Gerenciar conta e editar conteúdo (P2)

**Goal**: Uma pessoa autorizada edita o perfil e páginas; conflitos preservam o conteúdo local e não sobrescrevem a publicação.

**Independent Test**: Alterar perfil, salvar página autorizada, tentar salvar versão obsoleta e confirmar bloqueio para pessoa sem permissão.

- [ ] T031 [P] [US3] Criar testes de contrato para `PATCH /me` e `PUT /pages/{pageId}`, incluindo `409 page_version_conflict`, em `backend/tests/contract/us3-profile-editor.contract.test.ts`.
- [ ] T032 [P] [US3] Criar teste de integração de concorrência que prove que `expectedVersion` obsoleto não altera PageVersion corrente em `backend/tests/integration/page-version-conflict.test.ts`.
- [X] T033 [US3] Implementar atualização de perfil com validação de nome em `backend/src/server.ts`.
- [X] T034 [US3] Implementar salvamento otimista de página em `backend/src/server.ts`; mismatch de versão MUST retornar `409` com conteúdo publicado seguro e sem publicar o payload recebido.
- [ ] T035 [US3] Implementar tela de perfil com estados de edição, validação, sucesso e erro em `frontend/src/features/profile/ProfilePage.tsx`.
- [X] T036 [US3] Implementar editor de página com estado local, versão esperada e salvamento em `frontend/src/main.ts`.
- [X] T037 [US3] Implementar tela de conflito que preserve texto local e permita revisão em `frontend/src/main.ts`.
- [X] T038 [US3] Integrar permissões para bloquear edição e tratar `401`, `403` e `409` em `frontend/src/main.ts`.
- [ ] T039 [US3] Executar o fluxo independente de US3 e validar recuperação de conteúdo, foco e mensagens de conflito em `frontend/tests/e2e/us3-profile-editor.spec.ts`.

## Phase 6: User Story 4 - Comentar e responder (P2)

**Goal**: Uma pessoa cria threads, abre âncoras e recebe respostas administrativas sem poder forjar privilégios.

**Independent Test**: Criar thread, abrir pela âncora, responder como administrador e confirmar recusa de resposta privilegiada para usuário comum.

- [ ] T040 [P] [US4] Criar testes de contrato para threads e respostas em `backend/tests/contract/us4-comments.contract.test.ts`.
- [ ] T041 [P] [US4] Criar teste de integração que prove que `isAdminReply` é calculado pelo servidor em `backend/tests/integration/admin-comment-reply.test.ts`.
- [X] T042 [US4] Implementar criação, listagem e ordenação de threads e comentários em `backend/src/server.ts`.
- [X] T043 [US4] Implementar rotas de threads e respostas com autorização administrativa em `backend/src/server.ts`.
- [X] T044 [US4] Implementar painel de criação de comentário e estados de erro em `frontend/src/main.ts`.
- [ ] T045 [US4] Implementar âncora clicável e foco no contexto associado em `frontend/src/features/comments/CommentAnchor.tsx`.
- [ ] T046 [US4] Implementar resposta administrativa identificada e bloqueio de usuário comum em `frontend/src/features/comments/AdminReply.tsx`.
- [ ] T047 [US4] Executar o fluxo independente de US4 e validar ordem do histórico, teclado e foco da âncora em `frontend/tests/e2e/us4-comments.spec.ts`.

## Phase 7: Polish and Cross-Cutting Concerns

- [ ] T048 [P] Executar auditoria de acessibilidade nos fluxos US1-US4 e corrigir foco, nomes acessíveis e estados em `frontend/src/components/` e `frontend/tests/a11y/`.
- [ ] T049 [P] Adicionar limites de tamanho, sanitização e mensagens seguras para conteúdo em `backend/src/shared/validation.ts` e `backend/src/pages/content-sanitizer.ts`.
- [ ] T050 [P] Adicionar logging estruturado de login recusado, falhas de autorização, falhas de salvamento e conflitos sem conteúdo privado em `backend/src/shared/observability.ts`.
- [ ] T051 [P] Adicionar índices e consulta de busca compatíveis com grupo, título e referências em `database/migrations/002_wiki_indexes.sql`.
- [ ] T052 Executar os cenários completos do [quickstart.md](./quickstart.md) em desktop e largura móvel e registrar resultados em `specs/001-wiki-workspace/validation-report.md`.
- [ ] T053 Revisar cada requisito FR-001 a FR-014 contra testes e atualizar `README.md` com o estado de implementação e comandos de validação.

## Dependencies and Execution Order

### Dependency Graph

```text
Setup (T001-T005)
  -> Foundational (T006-T013)
    -> US1 (T014-T022) -> US2 (T023-T030)
    -> US3 (T031-T039)
    -> US4 (T040-T047)
      -> Polish (T048-T053)
```

- US1 e US2 são a primeira fatia de MVP e podem ser desenvolvidas em sequência após Foundational.
- US3 e US4 dependem dos contratos e da leitura/shell, mas podem avançar em paralelo entre si depois de T013.
- Polish começa quando as quatro histórias passam seus testes independentes.

### Parallel Opportunities

- Após T005: T006, T007 e T008 podem começar em paralelo; T009-T013 dependem dos contratos e do banco conforme necessário.
- US1: T014 e T015 podem ocorrer em paralelo; T019 e T020 podem ocorrer em paralelo após T018.
- US2: T023 e T024 podem ocorrer em paralelo; T027 e T029 podem ocorrer em paralelo após T026.
- US3: T031 e T032 podem ocorrer em paralelo; T035, T036 e T037 podem ocorrer em paralelo após seus contratos.
- US4: T040 e T041 podem ocorrer em paralelo; T044, T045 e T046 podem ocorrer em paralelo após T043.
- Polish: T048-T051 podem ocorrer em paralelo antes de T052-T053.

## Implementation Strategy

1. **MVP**: concluir Setup, Foundational, US1 e US2 para entregar login, navegação, busca e leitura conectada.
2. **Colaboração segura**: adicionar US3 com perfil, edição autorizada e conflito de versão recuperável.
3. **Feedback colaborativo**: adicionar US4 com threads, âncoras e respostas administrativas.
4. **Qualidade de entrega**: executar Polish, quickstart completo e revisão FR-001 a FR-014.

### Task Format Validation

Todas as tarefas usam checkbox, ID sequencial, marcador `[P]` somente quando aplicável,
label de história nas fases US1-US4 e caminho de arquivo explícito.
