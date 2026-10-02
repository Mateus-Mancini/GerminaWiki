# HTTP Contracts: Wiki Workspace

Os contratos abaixo são a fronteira entre o frontend e o backend. Todos os endpoints privados
exigem uma sessão válida; o servidor decide autenticação, autorização e papel administrativo.
As respostas de erro têm formato comum:

```json
{
  "error": {
    "code": "stable_error_code",
    "message": "Mensagem segura e acionável",
    "details": {}
  }
}
```

## Session and profile

### `POST /session/login`

Request: `{ "email": "string", "password": "string" }`

Success `200`: `{ "user": User, "session": { "expiresAt": "datetime" } }`

Failure: `401` para credenciais inválidas; `429` para excesso de tentativas.

### `GET /me`

Success `200`: `{ "user": User, "permissions": ["string"] }`

Failure: `401` quando a sessão não existe ou expirou.

### `PATCH /me`

Request: `{ "displayName": "string" }` com somente campos editáveis.

Success `200`: `{ "user": User }`

Failure: `400` para validação; `401` para sessão expirada; `403` para campo não autorizado.

## Navigation and search

### `GET /workspace/tree`

Success `200`: `{ "nodes": TreeNode[] }`, respeitando as permissões da sessão.

### `GET /pages/search?q={query}&groupId={groupId}`

Success `200`: `{ "items": SearchResult[], "query": "string", "groupId": "string|null" }`

A consulta vazia retorna `200` com estado sem filtro. Resultados nunca incluem páginas sem
permissão.

## Pages and references

### `GET /pages/{pageId}`

Success `200`: `{ "page": Page, "version": PageVersion, "references": PageReference[] }`

Failure: `404` para página inexistente; `403` para página indisponível ao usuário.

### `GET /pages/{pageId}/backlinks`

Success `200`: `{ "items": PageReference[] }`

### `PUT /pages/{pageId}`

Request:

```json
{
  "expectedVersion": 7,
  "content": "structured page content",
  "title": "Optional updated title"
}
```

Success `200`: `{ "page": Page, "version": PageVersion }`

Failure: `400` para conteúdo inválido; `401` para sessão expirada; `403` sem permissão;
`404` para página inexistente; `409` quando `expectedVersion` não é a versão corrente.

Resposta `409`:

```json
{
  "error": {
    "code": "page_version_conflict",
    "message": "A página foi alterada por outra pessoa.",
    "details": {
      "currentVersion": 8,
      "publishedContent": "safe current content"
    }
  }
}
```

O backend não publica a versão enviada quando responde `409`.

## Comments

### `GET /pages/{pageId}/comment-threads`

Success `200`: `{ "threads": CommentThreadWithComments[] }`

### `POST /pages/{pageId}/comment-threads`

Request: `{ "anchor": Anchor|null, "body": "string" }`

Success `201`: `{ "thread": CommentThreadWithComments }`

Failure: `400` para âncora ou texto inválido; `401` para sessão expirada; `403` quando
comentários não são permitidos.

### `POST /comment-threads/{threadId}/comments`

Request: `{ "body": "string" }`

Success `201`: `{ "comment": Comment }`

O servidor calcula `isAdminReply`. Usuário comum nunca consegue forçar esse valor.

Failure: `400`, `401`, `403` ou `404` conforme validação, sessão, autorização ou thread.

## Common behavior

- `401` deve levar o frontend a recuperar o fluxo de login sem confirmar a operação original.
- `403` deve mostrar uma mensagem de permissão sem revelar dados protegidos.
- `409` é exclusivo de operações versionadas e deve preservar o conteúdo local no frontend.
- Campos de conteúdo exibidos pelo cliente são considerados não confiáveis até sanitização.
- Datas devem ser transportadas em formato ISO 8601; identificadores são opacos para o cliente.
