# Data Model: Wiki Workspace

## User

- `id`: identificador único.
- `displayName`: nome exibido no perfil.
- `email`: identificador de login, não editável pela própria pessoa sem fluxo autorizado.
- `role`: papel de autorização, incluindo administrador quando aplicável.
- `status`: estado da conta.

**Rules**: somente campos autorizados podem ser alterados pela própria pessoa. O papel é
controlado pelo servidor e nunca aceito como autoridade vindo do cliente.

## Group

- `id`: identificador único.
- `name`: nome apresentado no filtro.
- `status`: grupo ativo ou arquivado.

**Relationships**: um grupo organiza várias páginas; uma página pertence ao máximo a um grupo
na primeira versão.

## Page

- `id`: identificador único.
- `title`: título apresentado na árvore e na leitura.
- `path`: posição hierárquica na árvore.
- `groupId`: grupo associado.
- `currentVersionId`: versão publicada atual.
- `permissions`: capacidades autorizadas para o usuário atual.
- `status`: publicada, arquivada ou indisponível.

**Rules**: título e caminho devem ser identificáveis dentro do mesmo nível; páginas
indisponíveis não devem vazar conteúdo; a leitura usa a versão publicada.

## PageVersion

- `id`: identificador único da versão.
- `pageId`: página relacionada.
- `content`: conteúdo estruturado da página.
- `version`: número monotônico esperado no salvamento.
- `authorId`: pessoa que publicou.
- `createdAt`: instante da publicação.

**State transitions**: rascunho local -> envio com versão esperada -> publicada, ou envio ->
conflito se a versão esperada diferir da versão corrente. Um conflito preserva o conteúdo local
e não altera a versão publicada.

## PageReference

- `sourcePageId`: página que contém o wikilink.
- `targetPageId`: página de destino quando resolvida.
- `targetLabel`: texto usado quando o destino não existe.
- `status`: resolvida, inexistente ou indisponível.

**Rules**: referências circulares são permitidas, mas a navegação deve evitar loop automático.
Destinos sem permissão são exibidos como indisponíveis.

## CommentThread

- `id`: identificador único.
- `pageId`: página associada.
- `anchor`: contexto selecionável do comentário, quando existir.
- `status`: aberta, resolvida ou arquivada.
- `createdBy`: pessoa que iniciou a thread.
- `createdAt`: instante de criação.

## Comment

- `id`: identificador único.
- `threadId`: thread relacionada.
- `authorId`: pessoa autora.
- `body`: texto do comentário.
- `isAdminReply`: indica resposta administrativa calculada pelo servidor.
- `createdAt`: instante de criação.

**Rules**: comentários aparecem em ordem de criação; `isAdminReply` não pode ser definido
pelo cliente; cada comentário pertence a uma única thread.

## SearchResult

- `pageId`: página encontrada.
- `title`: título exibível.
- `path`: caminho resumido.
- `group`: grupo exibível.
- `matchContext`: trecho seguro para explicar a correspondência.

**Rules**: resultados respeitam permissões do usuário atual e filtros ativos. Busca vazia não
é tratada como erro e deve informar o estado sem filtro.
