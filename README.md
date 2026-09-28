# GerminaWiki

Frontend de disciplinas do Ensino Médio. Execute `npm install` e `npm run dev`.

## Integração com API

Configure `VITE_API_BASE_URL` com a URL base do backend (padrão: `http://localhost:3000`) e
use o botão **Conectar à API** na interface. A integração usa `POST /session/login`,
`GET /pages/search`, `GET /pages/{id}` e `POST /pages/{id}/comment-threads`.

As disciplinas e seus materiais introdutórios são mantidos no frontend. Quando a API contém
uma página com título igual ao da matéria, o frontend exibe seu conteúdo e publica
contribuições como comentários dessa página. Se não houver página correspondente, as
contribuições ficam salvas no navegador. O backend disponível não oferece criação de páginas.
