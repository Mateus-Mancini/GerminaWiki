# Research: Wiki Workspace

## Decision: Separar frontend e backend por responsabilidade

**Rationale**: O cliente precisa oferecer navegação e feedback responsivos, mas autenticação,
permissões, conteúdo e versionamento devem permanecer sob autoridade do servidor. A separação
permite que Clara, JP e Mancini trabalhem em áreas delimitadas sem duplicar regras de segurança.

**Alternatives considered**: Uma aplicação somente cliente foi rejeitada porque não protege
permissões nem conflitos de versão. Um monólito sem módulos foi rejeitado porque mistura os
ownership areas e dificulta testes de contrato.

## Decision: Usar contratos HTTP versionados e orientados a recursos

**Rationale**: Login, páginas, busca, perfil e comentários precisam de fronteiras explícitas.
Contratos de recurso tornam loading, erros, autorização e HTTP 409 verificáveis sem acoplar a
especificação a um framework específico.

**Alternatives considered**: Compartilhar tipos internos diretamente entre telas foi rejeitado
porque esconderia os estados de erro e criaria acoplamento entre owners. Contratos somente
informais foram rejeitados porque não são suficientes para testes de integração.

## Decision: Persistência relacional com versionamento otimista

**Rationale**: Páginas, grupos, usuários, referências, versões e threads têm relações claras.
Uma versão corrente por página e uma revisão esperada no salvamento permitem detectar conflito
sem sobrescrever silenciosamente o conteúdo publicado.

**Alternatives considered**: Sobrescrita pelo último salvamento foi rejeitada por violar a
integridade exigida pela constituição. Armazenar tudo como documento sem relações foi rejeitado
porque dificulta backlinks, filtros por grupo e histórico de comentários.

## Decision: Sanitização no limite de leitura e validação no limite de escrita

**Rationale**: Conteúdo de markdown e wikilinks vem de usuários e deve ser validado antes de
persistir e sanitizado antes de renderizar. Isso mantém a experiência de leitura segura sem
confiar em marcação fornecida pelo cliente.

**Alternatives considered**: Renderizar HTML recebido diretamente foi rejeitado por risco de
injeção. Sanitizar somente no cliente foi rejeitado porque o cliente não é uma fronteira de
segurança.

## Decision: Testes em quatro níveis

**Rationale**: Testes unitários cobrem regras locais; contratos verificam os limites HTTP;
integrados verificam persistência e autorização; e2e comprovam os fluxos P1 e o conflito 409.
Essa combinação atende à constituição sem exigir a implementação completa para validar cada
owner area.

**Alternatives considered**: Apenas testes end-to-end foram rejeitados por serem lentos e
pouco diagnósticos. Apenas testes unitários foram rejeitados porque não validam integração,
permissões nem concorrência.
