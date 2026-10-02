<!--
Sync Impact Report
- Version change: 1.0.0 -> 1.1.0 (MINOR: normative ownership table changed)
- Modified principles: I. Ownership and Scope (login-profile-ui reassigned to Clara);
  IV. Security and Data Integrity (conflict status clarified: HTTP 409 or 412)
- Reasons: Clara implemented login and profile in the workspace (PR #5), so the table records the
  actual owner; the pages API (ms-germina-wiki) answers a stale If-Match with 412 Precondition
  Failed, verified in production on 2026-10-01, and the editor (specs/002-page-editor) treats 409
  and 412 alike
- Added sections: none
- Removed sections: none
- Follow-up TODOs: confirm the original ratification date
-->

# GerminaWiki Constitution

## Core Principles

### I. Ownership and Scope Are Explicit
Every feature MUST have one accountable owner and a clearly bounded responsibility. The
current ownership map is: Clara owns app-shell-routing, sidebar-ui, and search-filter-ui;
JP owns page-view-ui and comments-ui; Clara also owns login-profile-ui; Mancini owns
editor-ui.
Ownership includes implementation, tests, integration support, and acceptance of the
feature's behavior. Changes crossing ownership boundaries MUST be coordinated with the
affected owners.

### II. Contracts Before Integration
Features MUST define their inputs, outputs, loading states, error states, and authorization
assumptions before integration. Shared data shapes, route behavior, editor save semantics,
and conflict responses MUST be documented or encoded in tested contracts. A feature is not
complete while its owner-only behavior works but its cross-feature contract is undefined.

### III. User Workflows Are Testable
Each user-facing feature MUST have tests for its primary workflow and its most important
failure path. Tests MUST cover, as applicable, authenticated versus unauthenticated access,
empty and loading states, invalid input, markdown or wikilink rendering, comments and
replies, and version conflicts. Integration tests MUST cover contracts between the shell,
navigation, page view, editor, profile, and comments features.

### IV. Security and Data Integrity Are Non-Negotiable
Authentication guards MUST protect private routes and server-authoritative permissions MUST
protect profile editing, page editing, and administrative replies. The client MUST NOT be
treated as the source of authorization truth. Editor saves MUST preserve version checks and
surface a recoverable conflict when the server reports a version conflict (HTTP 409, or 412
Precondition Failed for a stale `If-Match`); silent overwrites are
forbidden. User-provided content MUST be rendered and stored using the project's approved
safe mechanisms, including safe markdown and wikilink handling.

### V. Simple, Accessible, Observable Delivery
The implementation MUST use the smallest design that satisfies the workflow and MUST avoid
duplicating ownership logic across features. Interactive controls MUST be keyboard usable,
visibly identify their state, and expose actionable errors. Important transitions, failed
saves, authorization failures, and version conflicts MUST be diagnosable through the
project's established logging or error-reporting mechanism without exposing private content.

## Product Ownership

| Área | Dono | Responsabilidade |
| --- | --- | --- |
| app-shell-routing | Clara | Layout base, rotas e guard de autenticação no cliente |
| sidebar-ui | Clara | Árvore de pastas e arquivos em estilo Notion |
| search-filter-ui | Clara | Barra de busca e filtro por grupo |
| page-view-ui | JP | Renderização de markdown em leitura, wikilinks e painel de backlinks |
| login-profile-ui | Clara | Login e visualização/edição de perfil (reatribuído de Mancini na v1.1.0) |
| editor-ui | Mancini | Editor BlockNote, salvamento e tela de conflito de versão (HTTP 409/412) |
| comments-ui | JP | Threads, âncoras clicáveis e respostas de administrador |

The ownership table is normative. Any reassignment MUST be recorded in this constitution
or in an approved feature specification before implementation begins.

## Development Workflow

Feature work MUST proceed from a specification to an implementation plan and an actionable
task list when the change spans multiple components or owners. Pull requests MUST identify
the affected ownership areas, include focused validation, and document any intentional
contract changes. Integration work MUST be reviewed by every affected owner, and no feature
is complete until its acceptance criteria and relevant tests pass.

## Governance

This constitution is the highest-level project governance document and supersedes conflicting
local practices. Amendments MUST include a Sync Impact Report, explain the reason for the
change, update the version and last-amended date, and preserve or explicitly migrate affected
work. Versioning follows semantic rules: MAJOR for incompatible governance changes, MINOR
for new or materially expanded principles or sections, and PATCH for clarifications or
non-semantic corrections. Every feature review MUST verify ownership, contract, security,
test, accessibility, and observability compliance relevant to the change.

**Version**: 1.1.0 | **Ratified**: TODO(RATIFICATION_DATE): confirm original adoption date | **Last Amended**: 2026-10-01
