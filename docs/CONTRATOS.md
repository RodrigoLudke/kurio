# Contratos REST e de tempo real

Os tipos estão em [`src/api/contracts.ts`](../src/api/contracts.ts) e são compartilhados por transporte (Axios), estado (TanStack Query), interface e servidor simulado (MSW) — uma divergência quebra o `typecheck`.

Convenções:

- Base: `VITE_API_BASE_URL` (`/api`). JSON em UTF‑8.
- Autenticação: `Authorization: Bearer <token>` (token opaco emitido no login/cadastro).
- Carrinho de visitante: `X-Cart-Id: guest_<uuid>` (gerado e guardado pelo cliente). Com sessão válida, o carrinho é o da conta.
- **Valores em ETH são strings decimais** (`"1.19"`, `"26.846"`), nunca `number`. Quantidades são inteiros.
- Recursos com `version` (NFT, carrinho, pedido) aumentam a versão a cada alteração.

## Erros

Todas as respostas de erro seguem:

```json
{ "error": { "code": "QUOTE_STALE", "message": "…", "fieldErrors": { "campo": "mensagem" }, "retryable": false, "details": {} } }
```

| HTTP | `code` | Quando |
| --- | --- | --- |
| 400 | `IDEMPOTENCY_KEY_REQUIRED`, `VALIDATION_ERROR` | Cabeçalho ausente/inválido |
| 401 | `UNAUTHENTICATED` | Sem token em rota privada |
| 401 | `SESSION_EXPIRED` | Token expirado, revogado ou desconhecido |
| 401 | `INVALID_CREDENTIALS` | Login inválido |
| 403 | `FORBIDDEN` | Recurso de outro usuário (ex.: pedido) |
| 403 | `WALLET_REJECTED` | Usuário recusou a conexão na carteira |
| 404 | `NOT_FOUND`, `NFT_NOT_FOUND`, `ORDER_NOT_FOUND`, `WALLET_NOT_FOUND` | Recurso inexistente |
| 409 | `EMAIL_TAKEN`, `USERNAME_TAKEN`, `WALLET_SLOT_TAKEN` | Conflito de cadastro |
| 409 | `AVAILABILITY_CONFLICT`, `EDITION_UNAVAILABLE`, `CART_HAS_ISSUES`, `CART_EMPTY` | Disponibilidade |
| 409 | `QUOTE_STALE`, `QUOTE_EXPIRED` | Cotação desatualizada (`details: { quote, changes[] }`) |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma chave com outro conteúdo |
| 409 | `WALLET_NOT_CONNECTED` | Carteira não conectada no provedor/rede do pedido |
| 413 / 415 | `PAYLOAD_TOO_LARGE` / `UNSUPPORTED_MEDIA` | Avatar inválido |
| 422 | `VALIDATION_ERROR`, `INVALID_PASSWORD`, `COUPON_INVALID`, `COUPON_EXPIRED` | Validação (com `fieldErrors`) |
| 500 / 503 / 504 | `INTERNAL` / `TRANSIENT` | Falha transitória (`retryable: true`) |
| — | (rede) | Sem resposta: o cliente normaliza como `NETWORK_ERROR` ou `TIMEOUT` |

No cliente, todo erro vira um `AppError` (`src/api/errors.ts`) com `kind` (`http`, `network`, `timeout`, `cancelled`), `status`, `code`, `fieldErrors` e `retryable`.

## Sessão e conta

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{ username, email, password, confirmPassword }` | `201 { user, session: { token, expiresAt } }` · 409 `EMAIL_TAKEN`/`USERNAME_TAKEN` · 422 |
| POST | `/auth/login` | `{ email, password }` | `200 { user, session }` · 401 `INVALID_CREDENTIALS` |
| GET | `/auth/session` | — | `200 { user, session: { expiresAt } }` · 401 `SESSION_EXPIRED` |
| POST | `/auth/logout` | — | `204` (revoga o token e as conexões de carteira) |

Expiração: TTL de 1 h (45 s no cenário `short-session`). Alterar a senha revoga as demais sessões do usuário.

## NFTs

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/nfts?q&category&network&minPrice&maxPrice&sort&tab&page&pageSize` | `CatalogResponse` |
| GET | `/nfts/featured` | `{ spotlight, promos[] }` |
| GET | `/nfts/:id` | `NftDetail` · 404 `NFT_NOT_FOUND` |
| GET | `/nfts/:id/related` | `{ items: NftSummary[] }` |

Parâmetros do catálogo: `category` e `network` aceitam listas separadas por vírgula (combinação E entre facetas, OU dentro da faceta); `minPrice`/`maxPrice` são strings ETH; `sort` ∈ `recent | price_asc | price_desc | name_asc`; `tab` ∈ `all | new | trending`; `pageSize` ≤ 48 (a UI usa 9). Parâmetros inválidos → 422. A resposta traz `items`, `page`, `total`, `totalPages`, `facets` (contagens calculadas com os demais filtros ativos, e faixa de preço global) e `appliedQuery` (eco do que foi aplicado).

`NftDetail.editions[]`: `{ type: '1/1' | '1/10' | '1/50' | 'aberta', price, available, supply, maxPerOrder }` — `available: 0` = edição indisponível; `maxPerOrder = min(available, 10)`.

## Favoritos (autenticado)

| Método | Rota | Resposta |
| --- | --- | --- |
| GET | `/favorites` | `{ nftIds, items: NftSummary[] }` |
| PUT | `/favorites/:nftId` | `{ nftIds }` (idempotente) |
| DELETE | `/favorites/:nftId` | `{ nftIds }` |

## Carrinho (visitante ou conta)

Todas as operações devolvem o `Cart` recalculado pelo servidor.

| Método | Rota | Corpo | Observações |
| --- | --- | --- | --- |
| GET | `/cart?network=` | — | `network` opcional muda a taxa do resumo (padrão `ethereum`) |
| POST | `/cart/items` | `{ nftId, edition, quantity }` | soma à linha existente · 409 `AVAILABILITY_CONFLICT` / `EDITION_UNAVAILABLE` |
| PATCH | `/cart/items/:nftId:edition` | `{ quantity }` | 409 acima do limite |
| DELETE | `/cart/items/:nftId:edition` | — | |
| POST | `/cart/coupon` | `{ code }` | 422 `COUPON_INVALID` / `COUPON_EXPIRED` |
| DELETE | `/cart/coupon` | — | |
| POST | `/cart/acknowledge` | — | colecionador confirma ter visto novos preços |
| POST | `/cart/merge` | `{ guestCartId }` | (autenticado) mescla o carrinho do visitante respeitando a disponibilidade |

`Cart.items[].status`: `ok` · `price_changed` (preço atual ≠ `acknowledgedUnitPrice`) · `insufficient` (quantidade > disponível) · `sold_out`. `summary`: `{ subtotal, discount, networkFee, total, network, feeEstimated }`.

## Cotação e pedidos (autenticado)

| Método | Rota | Corpo / cabeçalhos | Resposta |
| --- | --- | --- | --- |
| POST | `/checkout/quote` | `{ network }` | `201 Quote` (linhas, cupom, taxas, total, `expiresAt` em 10 min) · 409 `CART_EMPTY` / `CART_HAS_ISSUES` |
| POST | `/orders` | `Idempotency-Key: <8–128 chars>` · `{ quoteId, walletId, provider, network, collector }` | `201 Order` (novo, `pending`) · `200 Order` + `Idempotent-Replayed: true` (mesma chave e mesmo conteúdo) · 409 `IDEMPOTENCY_CONFLICT` / `QUOTE_STALE` / `QUOTE_EXPIRED` / `AVAILABILITY_CONFLICT` / `WALLET_NOT_CONNECTED` · 422 (`collector.*`) |
| GET | `/orders` | — | `{ items: Order[] }` do usuário |
| GET | `/orders/:id` | — | `Order` · 403 `FORBIDDEN` (de outro usuário) · 404 |

Ordem das validações em `POST /orders`: idempotência → dados do colecionador → carteira conectada → disponibilidade → cotação (expirada ou divergente; `details.changes[]` lista preço, quantidade, cupom e taxa). O pedido guarda um **snapshot** das linhas e valores da cotação aceita: alterações posteriores no catálogo não mudam o recibo.

Ciclo: `pending → confirmed | declined` (terminais). Na confirmação o servidor revalida o estoque (se faltar, recusa), decrementa a disponibilidade (emitindo `nft.updated`), remove do carrinho **apenas os itens e quantidades comprados** e gera `transactionHash`/`explorerUrl` simulados. Na recusa, nada muda no carrinho.

## Perfil e carteiras (autenticado)

| Método | Rota | Corpo | Resposta |
| --- | --- | --- | --- |
| GET | `/profile` | — | `Profile` |
| PATCH | `/profile` | `{ displayName, username, email, ensName, walletNickname }` | `Profile` · 422 (inclui e-mail/usuário em uso) |
| POST | `/profile/avatar` | `multipart/form-data` (`avatar`: PNG/JPG/WebP ≤ 512 KB) | `Profile` · 413 / 415 |
| DELETE | `/profile/avatar` | — | `Profile` |
| POST | `/profile/password` | `{ currentPassword, newPassword, confirmPassword }` | `{ ok: true }` · 422 `INVALID_PASSWORD` |
| GET | `/wallets` | — | `{ items: Wallet[] }` (principal primeiro) |
| POST | `/wallets` | `WalletInput + { slot: 'primary' \| 'secondary' }` | `201 Wallet` · 409 `WALLET_SLOT_TAKEN` · 422 |
| PUT | `/wallets/:id` | `WalletInput` | `Wallet` (invalida a conexão existente) |
| GET | `/wallets/:id/connection` | — | `{ connection \| null }` |
| POST | `/wallets/:id/connect` | `{ provider, network }` | `{ connection }` · 403 `WALLET_REJECTED` |
| POST | `/wallets/:id/disconnect` | — | `{ connection: null }` (+ evento `wallet.updated`) |

## Eventos Socket.IO

Transporte: `socket.io-client` com `transports: ['websocket']` em `VITE_REALTIME_URL`, `auth: { token }` no handshake (o servidor associa a conexão ao usuário; sem token = só eventos públicos).

Envelope comum:

```ts
{
  eventId: string            // identidade estável; duplicatas repetem o mesmo id
  type: 'nft.updated' | 'order.updated' | 'wallet.updated'
  resource: { type: 'nft' | 'order' | 'wallet', id: string }
  version: number            // versão do recurso após o evento
  occurredAt: string
  data: …
}
```

| Evento | Destino | `data` | Efeito no cliente |
| --- | --- | --- | --- |
| `nft.updated` | todos | `{ nftId, name, price, previousPrice, compareAtPrice, available, editions[], changed: ('price' \| 'availability')[] }` | corrige catálogo, destaques, relacionados e detalhe (se a versão em cache for menor); se o NFT está no carrinho, avisa e busca o carrinho recalculado; invalida a cotação aberta no checkout |
| `order.updated` | dono do pedido | `{ order }` | grava o pedido no cache do usuário (ignora outro `userId` ou versão ≤ atual); confirmado → revalida carrinho e catálogo |
| `wallet.updated` | dono da carteira | `{ walletId, userId, connection, reason }` | atualiza o estado de conexão; desconexão interrompe a revisão do checkout |
| `session.ready` | a conexão | `{ userId, serverTime }` | (diagnóstico) |

Regras do cliente (`src/realtime/client.ts`): descarta `eventId` já visto (janela de 500 ids) e versões ≤ à última conhecida por recurso; ao reconectar, invalida catálogo, carrinho, pedidos e carteiras ativos (reconciliação via REST); ao trocar de usuário/sair, encerra o socket, remove listeners e descarta versões de recursos privados.

## Plano de controle dos mocks

Somente quando os mocks estão ativos (não fazem parte da API do produto):

| Método | Rota | Corpo | Efeito |
| --- | --- | --- | --- |
| GET | `/api/__mock/state` | — | cenário, conexões, pedidos pendentes, últimos eventos |
| POST | `/api/__mock/reset` | `{ scenario? }` | restaura fixtures e cenário |
| POST | `/api/__mock/scenario` | `{ id }` | aplica um cenário |
| POST | `/api/__mock/network` | `{ latency?, offline? }` | `latency`: `{mode:'none'}` · `{mode:'fixed',ms}` · `{mode:'variable',minMs,maxMs,seed}` |
| POST / DELETE | `/api/__mock/failures` | `{ id, method?, path, effect, times? }` | injeta falhas (`status`, `network-error`, `timeout`, `delay`) |
| POST | `/api/__mock/nfts/:id` | `{ edition?, price?, available? }` | altera o NFT e emite `nft.updated` |
| POST | `/api/__mock/realtime/replay` | `{ mode: 'duplicate' \| 'stale', type? }` | reenvia o último evento ou um evento antigo |
| POST | `/api/__mock/realtime/disconnect` | `{ downMs }` | derruba as conexões e recusa novas por `downMs` |
| POST | `/api/__mock/sessions/expire` | `{ userId? }` | expira sessões |
| POST | `/api/__mock/orders/:id/resolve` | `{ outcome }` | confirma/recusa um pedido pendente |
| POST | `/api/__mock/wallets/:id/disconnect` | — | desconecta uma carteira (emite `wallet.updated`) |
