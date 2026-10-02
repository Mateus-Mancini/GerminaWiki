# Quickstart: Wiki Workspace

Este guia valida os fluxos críticos da feature depois que a aplicação for implementada.
Os comandos exatos de instalação e execução devem ser adicionados no bootstrap do projeto.

## Pré-requisitos

- Runtime TypeScript/JavaScript definido pelo bootstrap.
- Banco relacional disponível com as migrações aplicadas.
- Usuários de teste: membro comum, editor autorizado, administrador e usuário não autenticado.
- Dataset com grupos, árvore de páginas, wikilinks válidos/inválidos, backlinks e uma thread.

## Cenário 1: acesso e navegação

1. Abrir uma rota privada sem sessão.
2. Confirmar redirecionamento ou bloqueio com ação de login.
3. Entrar como membro comum.
4. Expandir uma pasta e abrir uma página.
5. Pesquisar um título conhecido e aplicar o filtro de grupo.
6. Confirmar seleção na árvore, resultados compatíveis e estado sem resultados para um termo inexistente.

**Resultado esperado**: o conteúdo privado não aparece antes do login e a página correta é
encontrada por navegação e busca.

## Cenário 2: leitura conectada

1. Abrir uma página com formatação, wikilink válido e backlink.
2. Confirmar leitura sem controles de edição acidentais.
3. Seguir o wikilink válido.
4. Voltar e abrir o painel de backlinks.
5. Selecionar um wikilink inexistente.

**Resultado esperado**: formatação e relações são compreensíveis; destinos inexistentes são
informados sem quebrar a página de origem.

## Cenário 3: perfil e salvamento

1. Entrar como membro autorizado.
2. Alterar um campo permitido do perfil e confirmar o estado salvo.
3. Abrir uma página editável, alterar o conteúdo e salvar.
4. Em outra sessão, publicar uma alteração na mesma página.
5. Tentar salvar a primeira sessão usando a versão antiga.

**Resultado esperado**: o perfil e a página mostram confirmação; o segundo salvamento exibe
conflito, preserva o texto local e não apaga a versão publicada.

## Cenário 4: comentários e autorização

1. Criar uma thread associada a uma página ou contexto.
2. Selecionar a âncora e confirmar a abertura da thread.
3. Responder como administrador.
4. Tentar enviar resposta administrativa como membro comum.

**Resultado esperado**: o histórico preserva a thread e identifica a resposta administrativa;
a tentativa não autorizada é recusada sem criar resposta privilegiada.

## Verificações de qualidade

- Executar testes unitários para parsing seguro, permissões e transições de versão.
- Executar testes de contrato definidos em [contracts/http.md](contracts/http.md).
- Executar testes de integração para sessão, páginas, busca, comentários e HTTP 409.
- Executar testes e2e dos quatro cenários acima em desktop e largura móvel representativa.
- Verificar teclado, foco, mensagens de erro e ausência de conteúdo privado em cada cenário.
