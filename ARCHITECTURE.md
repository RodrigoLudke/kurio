# Arquitetura — Kurio

## 1. Visão geral

```
            ┌──────────────────────── navegador ────────────────────────┐
 UI React ──┤ TanStack Router (rotas, search params, guardas)           │
            │ TanStack Query (cache por chave, mutations, otimismo)     │
            │      │                         ▲                          │
            │   Axios (src/api)        ponte realtime → cache           │
            │      │                    (src/realtime/sync.ts)          │
            │      ▼                         ▲                          │
            │  fetch/XHR ──► Service Worker ─┤ socket.io-client (ws)    │
            │                (MSW)           │       │                  │
            │                  │             │  WebSocketInterceptor    │
            │                  ▼             │  (MSW ws.link + binding) │
            │      handlers REST (src/mocks/handlers) ◄──┘              │
            │                  │   regras de negócio (src/mocks/domain) │
            │                  ▼                                        │
            │      banco simulado (src/mocks/db.ts, localStorage)       │
            └───────────────────────────────────────────────────────────┘
```

Os mocks vivem **somente na camada de rede**: componentes, hooks e o cliente Axios não conhecem fixtures nem têm caminhos alternativos. Trocar `VITE_ENABLE_MOCKS=false` remove o servidor simulado do bundle e a mesma aplicação fala com uma API real que implemente [os contratos](docs/CONTRATOS.md).

| Camada | Responsabilidade | Arquivos |
| --- | --- | --- |
| Contratos | Tipos de request/response/eventos/erros compartilhados | `src/api/contracts.ts` |
| Transporte | Axios com timeout, `Authorization`, `X-Cart-Id`, normalização de erros (`AppError`), detecção de sessão expirada | `src/api/client.ts`, `errors.ts`, `endpoints.ts`, `session-store.ts` |
| Estado remoto | Query keys, consultas, mutations, otimismo, invalidação | `src/queries/*` |
| Tempo real | Conexão, dedupe/versão, reconexão, ponte com o cache | `src/realtime/*` |
| Roteamento | Árvore de rotas, search params, `beforeLoad` de rotas privadas, code splitting | `src/router.tsx` |
| Domínio compartilhado | Aritmética ETH (bigint), validações, esquemas de formulário | `src/lib/eth.ts`, `validation.ts`, `schemas.ts` |
| UI | Páginas, features, componentes shadcn/ui adaptados | `src/pages`, `src/features`, `src/components` |
| Servidor simulado | Fixtures, banco, regras, handlers, Socket.IO, cenários, plano de controle | `src/mocks/*` |

## 2. Valores monetários

`src/lib/eth.ts` converte strings decimais para wei (`bigint`, 18 casas) e de volta. Soma, subtração, multiplicação por quantidade inteira e percentuais (basis points) são exatos; a formatação trunca sem arredondar para cima. O mesmo módulo é usado pela UI e pelo servidor simulado, então o que a tela mostra é exatamente o que a API calculou. O slider de preço usa centavos de ETH inteiros apenas para posicionar o controle; os filtros enviados à API são strings.

## 3. Roteamento e estado da URL

- Catálogo (`/` e `/mercado`): `q`, `category`, `network`, `min`, `max`, `sort`, `tab`, `page` vivem nos search params, com serialização própria sem JSON (`?category=arte-digital,musica&page=2`). `validateCatalogSearch` normaliza e descarta valores inválidos; padrões são omitidos.
- Toda mudança de busca/filtro/aba/ordenação remove `page` (volta para a 1ª); paginação preserva o resto. Cada mudança é uma entrada no histórico — voltar/avançar e refresh restauram o mesmo estado e a mesma consulta.
- A busca do mobile grava na URL com debounce de 400 ms.
- Rotas privadas (`/pagamento`, `/pedidos/:id`, `/conta/*`, `/explorador/:hash`) usam `beforeLoad` e redirecionam para `/entrar?redirect=<rota>`; o `redirect` só aceita caminhos internos.
- `/entrar` e `/cadastro` renderizam a página inicial ao fundo (inerte) com o diálogo do layout; no mobile, o diálogo ocupa a tela como no frame mobile.
- Rotas inexistentes → 404; seções fora do escopo (`/criadores`, `/aprenda`, `/ajuda`) mostram “ainda não disponível” sem simular sucesso.
- Páginas além do início são carregadas sob demanda (`lazyRouteComponent`).

## 4. Política de sessão

- Login/cadastro devolvem `{ token, expiresAt }`; o cliente guarda só isso (e o id do usuário) em `localStorage` (`kurio.session.v1`). Senhas nunca saem do formulário além da requisição; o banco simulado guarda hash SHA‑256 com salt.
- Após refresh, a sessão é revalidada com `GET /auth/session`.
- Expiração é detectada de duas formas: qualquer `401 SESSION_EXPIRED/UNAUTHENTICATED` referente ao token atual (interceptor do Axios) e um temporizador no `expiresAt` que revalida no servidor. Ao expirar: aviso acessível, limpeza dos dados privados e, se a rota é privada, ida para `/entrar?redirect=<rota atual>&motivo=expirada`.
- Contexto preservado: carrinho no servidor, rascunho do checkout em `sessionStorage` por usuário e tentativa de pedido em andamento em `localStorage` por usuário.
- Logout, expiração e troca de usuário (também entre abas, via evento `storage`) disparam `onSessionEnd`: cancelamento e remoção de todas as queries `['private', userId, …]`, do carrinho da conta, da sessão e do cache de mutations; o socket é encerrado (listeners removidos) e reaberto com o novo token. As chaves privadas sempre incluem o `userId`, então nunca há cache compartilhado entre usuários.

## 5. Estado do carrinho

- O carrinho é **do servidor**. Visitantes têm `guest_<uuid>` (gerado no cliente, enviado em `X-Cart-Id`); usuários têm `user:<id>`.
- Ao autenticar, `POST /cart/merge` mescla o carrinho do visitante no da conta respeitando disponibilidade e limite por pedido; ao sair, um novo id de visitante é gerado (os itens da conta não “vazam” para o visitante).
- Toda mutation devolve o carrinho recalculado (preços atuais, status por linha, cupom ainda válido, subtotal/desconto/taxa/total) e substitui o cache; em erro (ex.: 409 de disponibilidade) o carrinho é revalidado.
- Linhas guardam `acknowledgedUnitPrice`. Quando o preço muda, a linha fica `price_changed`, o resumo já usa o novo preço e o botão de finalizar fica bloqueado até o colecionador confirmar (“Entendi, manter itens”). `insufficient`/`sold_out` bloqueiam o checkout até o ajuste.
- O resumo do pagamento usa `GET /cart?network=<rede>` para mostrar a taxa da rede escolhida; a cotação final é sempre a da API.

## 6. Cache, retries e sincronização

| Dado | Chave | staleTime | Atualização |
| --- | --- | --- | --- |
| Catálogo | `['nfts','list', query]` | 30 s | `keepPreviousData` (lista anterior visível com indicador “Atualizando”), `nft.updated` corrige itens, reconexão invalida |
| Destaques / relacionados | `['nfts','featured']`, `['nfts','related',id]` | 60 s | `nft.updated` |
| Detalhe | `['nfts','detail',id]` | 30 s | `nft.updated` (só se a versão do cache for menor) |
| Sessão | `['session', token]` | 60 s | invalidada após editar perfil |
| Carrinho | `['cart', dono]` (+ `'network', rede`) | 15 s / 5 s | resposta das mutations; invalidado por `nft.updated` de item do carrinho, pedido confirmado e reconexão |
| Favoritos | `['private',uid,'favorites']` | 30 s | **otimista com rollback** + `invalidate` no `onSettled` |
| Perfil, carteiras, conexão | `['private',uid,…]` | 30 s / 10 s | resposta das mutations; `wallet.updated` |
| Pedidos | `['private',uid,'orders',(id)]` | 30 s | `order.updated`; polling de segurança enquanto pendente (8 s com socket conectado, 3 s sem) |

- **Respostas obsoletas**: cada combinação de parâmetros tem sua chave, e o `AbortSignal` do TanStack Query é repassado ao Axios — trocar de filtro cancela a requisição anterior; se ela ainda assim chegar, é gravada na chave antiga e nunca sobrescreve a tela atual (ver teste “respostas fora de ordem”).
- **Retries**: consultas repetem até 2× com backoff exponencial (800 ms → 4 s) somente em erro transitório (rede, timeout, 5xx/`retryable`); 4xx nunca é repetido. Mutations não repetem, exceto a criação de pedido, que repete até 3× **com a mesma chave de idempotência**.
- **Refetch em foco** habilitado (dados ficam corretos ao voltar para a aba).

## 7. Tempo real e reconciliação com REST

- `socket.io-client` é importado sob demanda depois que o transporte está pronto e o navegador fica ocioso (o tempo real não participa da primeira pintura; os dados iniciais vêm por REST).
- Eventos carregam `eventId`, `resource` e `version`. O cliente descarta duplicatas (mesmo `eventId`) e versões ≤ à última conhecida por recurso; além disso, a ponte com o cache só aplica um evento se a versão do dado em cache for menor — protege contra evento antigo chegando depois de um refetch REST mais novo. Pedidos `confirmed`/`declined` são terminais no servidor e no cliente.
- Reconexão: ao receber `connect` após uma queda, o cliente invalida catálogo, carrinho, pedidos e carteiras ativos — o REST é a fonte da verdade para o que foi perdido durante a queda. Um aviso aparece se a queda durar mais de 2 s.
- Isolamento: o servidor só entrega `order.updated`/`wallet.updated` às conexões cuja sessão (revalidada a cada entrega) pertence ao dono; o cliente ainda confere `order.userId` contra a sessão atual.
- Cenário do enunciado: NFT no carrinho muda → toast + região `aria-live`, linha marcada e resumo recalculado → no checkout, o diálogo de revisão marca a cotação como desatualizada e desabilita “Confirmar e pagar” até gerar outra; se o evento se perder, o servidor responde `409 QUOTE_STALE` com a nova cotação e as diferenças.

## 8. Checkout, idempotência e recuperação

1. Formulário com os campos do layout, pré-preenchido com perfil + carteira principal, validado no cliente (mesmas regras do servidor). “Usar outra carteira?” lista as carteiras cadastradas.
2. “Confirmar compra” abre a **revisão**: conecta a carteira no provedor/rede escolhidos (pode ser recusada → “Conectar novamente”) e pede `POST /checkout/quote` (revalida preço, disponibilidade, cupom e taxa).
3. “Confirmar e pagar” cria uma tentativa `{ idempotencyKey, body }` persistida antes do envio. Cliques repetidos e reenvios reaproveitam a mesma chave enquanto o conteúdo for o mesmo; uma nova cotação gera nova chave.
4. Timeout/queda: a mutation reenvia a mesma requisição; o servidor devolve o pedido já criado (`200`, `Idempotent-Replayed`). Se tudo falhar, o diálogo explica e oferece “Tentar novamente (mesmo pedido)”.
5. Com o pedido criado, a rota `/pedidos/:id` mostra pendente → confirmado/recusado (evento + polling). Refresh, queda do socket ou voltar a `/pagamento` recuperam o mesmo pedido. O recibo só aparece para `confirmed` e reproduz o snapshot do pedido.

## 9. Mocks (MSW)

- **REST**: `setupWorker` com handlers em `src/mocks/handlers/*`. Toda rota passa por `route()` (`src/mocks/runtime.ts`), que aplica antes do resolver o cenário ativo: offline (`HttpResponse.error()`), latência fixa/variável com semente, respostas fora de ordem e regras de falha (status, erro de rede, timeout, atraso). Exceções lançadas como `Response` viram respostas tipadas.
- **Socket.IO**: `ws.link()` do MSW + `@mswjs/socket.io-binding`, que codifica/decodifica os pacotes Engine.IO/Socket.IO para o `socket.io-client` real. Limitações do binding e como foram tratadas:
  - Sem namespaces/salas/broadcast: um registro próprio de conexões roteia eventos por usuário.
  - Handshake sintetizado pelo binding (sid fixo): o token é lido do pacote CONNECT (`40{auth}`) enviado pelo cliente.
  - Sem heartbeat: o servidor simulado envia ping (`2`) a cada 20 s para evitar `pingTimeout`.
  - O MSW remove o prefixo `/socket.io/` antes de comparar URLs; o `ws.link` usa uma regex que aceita ambos.
  - O `engine.io-client` captura o construtor global de `WebSocket` ao ser carregado; por isso `socket.io-client` é importado depois que o MSW instala o interceptador.
  - Apenas o transporte `websocket` (sem long-polling).
- **Consistência**: um único banco (`src/mocks/db.ts`) alimenta REST e eventos; toda alteração de preço/estoque passa por `updateNft`, que incrementa a versão, persiste e publica `nft.updated`. Pedidos são liquidados por um relógio interno (`processDueOrders`, também chamado a cada request), funcionando após refresh.
- **Persistência e reset**: banco e cenário em `localStorage` (`kurio.mock.*`); `reset` restaura as fixtures. Fixtures são geradas com PRNG de semente fixa (72 NFTs, 9 coleções, 3 redes, 4 edições, 2 usuários).
- **Portão de transporte**: o app renderiza imediatamente; o Axios e o socket aguardam o Service Worker assumir o controle (`whenTransportReady`). Não há resposta fictícia fora dos handlers.
- **Plano de controle** (`/api/__mock/*`): usado pelo painel e pelos testes para mudar o servidor; os efeitos chegam à UI pelos caminhos reais (REST e Socket.IO).
- O alias `tough-cookie → stub` (vite.config.ts) remove ~250 KB do MSW que só serviam para cookies simulados — a aplicação não usa cookies.

## 10. Performance e Lighthouse

Medianas de 3 execuções (build de produção, cenário padrão, perfil limpo): **desktop 99/100/100/100** em início e detalhe; **mobile 76 (início) e 77 (detalhe)** em Performance, com Accessibility, Best Practices e SEO em 100. Relatórios em `lighthouse/reports/`.

Causas do resultado mobile (perfil Moto G Power simulado: CPU 4× mais lenta, 1,6 Mbps, RTT 150 ms):

- **LCP 3,7–4,0 s**: o maior elemento é a imagem do primeiro card do catálogo, que só existe depois de (1) baixar e executar o JS, (2) registrar e ativar o Service Worker do MSW e (3) executar o handler no main thread. Num produto real a API responderia pela rede em paralelo ao boot (ou o HTML viria pré-renderizado); aqui o “servidor” é parte do JS. A imagem em si já chega cedo (preload no HTML).
- **TBT 290–420 ms**: avaliação do React (≈ 0,7 s em CPU 4×), do MSW + regras do servidor simulado (≈ 0,35 s) e da renderização da home (catálogo, filtros, destaques e rodapé).
- **FCP ≈ 2,7 s (simulado)**: com o app shell estático o FCP medido com throttling aplicado cai para ≈ 0,9 s, mas o modelo de simulação do Lighthouse (Lantern) ainda o encadeia aos scripts.

O que foi feito (sem simplificações específicas para a auditoria — imagens, fontes, mocks e tempo real carregam normalmente): stub de `tough-cookie` (−290 KB no bundle de mocks), servidor simulado importado estaticamente para baixar em paralelo, socket e toasts carregados depois da carga, rotas sob demanda, imagens WebP com `srcset`/`sizes`, `fetchpriority`/preload da imagem principal, fontes locais `woff2` subset latino com `font-display: swap` e fallback métrico, `min-height` no conteúdo principal (CLS do detalhe caiu de 0,225 para 0), skeletons com as dimensões finais e app shell no HTML. Próximos passos fora do escopo: SSR/pré-renderização da home, mover o servidor simulado para um Worker dedicado e reduzir o JS de Radix no primeiro paint.

## 11. Acessibilidade

- Navegação por teclado em tudo; foco visível com contorno laranja; link “Pular para o conteúdo”.
- Diálogos e drawers (Radix) prendem e devolvem o foco; Escape fecha (exceto enquanto um pedido está sendo enviado).
- Formulários: `label` associado, asterisco de obrigatório acompanhado de texto para leitores de tela, `aria-invalid` + `aria-describedby` para a mensagem de erro (`role="alert"`), foco no primeiro campo inválido.
- Feedback de mutations e tempo real em região `aria-live` global e toasts (o Toaster já é `aria-live`; mensagens não são lidas em duplicidade).
- Estados não dependem só de cor: filtros/abas usam `aria-pressed` e marcador, edições esgotadas são riscadas e anunciadas, linhas do carrinho trazem texto explicativo.
- Imagens com `alt` descritivo; decorativas com `alt=""`. Títulos de documento por rota.
- `prefers-reduced-motion` desliga o shimmer e transições.
- Teste automatizado de overflow horizontal em 390/768/1440 px nas telas principais.

Ajustes em relação ao layout: o texto “sand” e o laranja foram mantidos (contraste ≥ 4,5:1 sobre o fundo); os botões de ícone ganharam rótulos; a lista de interesse e as ações de card no hover também aparecem ao receber foco; o seletor de edição é um `radiogroup`.

## 12. Decisões de UX e desvios do Figma

- **Assets**: o arquivo do Figma não estava acessível no ambiente de desenvolvimento; as 4 ilustrações foram extraídas da exportação do layout (PNG de referência) na maior resolução disponível (440 px para o Emerald Ape, 250 px para as demais), com cantos limpos e convertidas para WebP com variações de 128 px. Recomenda-se substituí-las pelos exports originais do Figma (mesmos nomes em `public/images/`). Fonte: Roboto Mono via `@fontsource` (local).
- Os 72 NFTs reutilizam as 4 ilustrações (como o próprio layout faz).
- **Detalhe**: além de COMPRAR (adiciona e vai ao carrinho) e Favoritar, há um botão de ícone “Adicionar ao carrinho” no desktop, espelhando o frame mobile.
- **Pagamento**: “Confirmar compra” abre uma etapa de **revisão** (exigida pelo enunciado) antes do envio. No mobile, os dados do colecionador ficam num bloco recolhível, priorizando “Carteira conectada” e “Carteira e rede” como no frame.
- **Confirmação**: o card do layout é exibido como página (`/pedidos/:id`), o que permite acesso direto e recuperação após refresh. “Ver no Etherscan” abre um explorador **simulado** interno.
- **Login/Cadastro**: diálogo sobre a home no desktop e tela cheia no mobile; “Esqueceu a senha?” e login social informam que não estão disponíveis (sem simular sucesso). A newsletter do rodapé valida o e-mail e informa que as inscrições não estão abertas.
- **Conta**: “Atividade” lista os pedidos; “Ofertas”, “Arquivos baixados” e “Suporte” aparecem desabilitados (“em breve”). O frame de carteiras não tem par mobile; o layout empilha as colunas.
- O desconto zerado é exibido como “(-) 0.00” (o layout mostra “00.00”).
- O cabeçalho mostra o menu do usuário quando autenticado (o layout só tem o estado deslogado).
- O botão “Simulação” é uma ferramenta de demonstração/avaliação e pode ser escondido com `VITE_MOCK_PANEL=false`.

## 13. Limitações conhecidas

- O servidor simulado roda dentro de cada aba (estado em memória carregado do `localStorage` ao abrir). Use uma aba por vez: abas simultâneas não compartilham eventos e a última a gravar prevalece.
- Pagamento, conexão de carteira e explorador são simulados; não há integração com blockchain.
- A primeira visita precisa registrar o Service Worker; em navegadores sem Service Worker o MSW usa interceptação em memória.
- Baselines visuais são dependentes de SO/fonte; ver README.
