import { delay, HttpResponse } from 'msw'
import { NETWORKS, type CollectorInfo, type CreateOrderRequest, type CreateQuoteRequest, type NetworkId, type Order, type QuoteStaleDetails } from '@/api/contracts'
import { addEth } from '@/lib/eth'
import { validateCollector } from '@/lib/schemas'
import { db, findNft, type OrderRecord } from '../db'
import { buildQuote, diffQuotes, editionOf, processDueOrders, publishOrder, scheduleFor, toCart, updateNft, walletLabel } from '../domain'
import { apiError, CLIENT_TIMEOUT_MS, fail, mockConfig, randomToken, readBody, requireUser, resolveCart, route, validationError } from '../runtime'

function str(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function fingerprint(body: CreateOrderRequest) {
  const c = body.collector
  return JSON.stringify([
    body.quoteId,
    body.walletId,
    body.provider,
    body.network,
    c.displayName,
    c.username,
    c.profileName,
    c.email,
    c.walletAddress,
    c.secondaryAddress,
    c.referralCode,
    c.ensName,
    c.note,
  ])
}

function collectorFrom(raw: Partial<CollectorInfo> | undefined): CollectorInfo {
  return {
    displayName: str(raw?.displayName).trim(),
    username: str(raw?.username).trim().toLowerCase(),
    profileName: str(raw?.profileName).trim(),
    email: str(raw?.email).trim().toLowerCase(),
    walletAddress: str(raw?.walletAddress).trim(),
    secondaryAddress: str(raw?.secondaryAddress).trim(),
    referralCode: str(raw?.referralCode).trim().toUpperCase(),
    ensName: str(raw?.ensName).trim().toLowerCase().replace(/\.eth$/, ''),
    note: str(raw?.note),
  }
}

/** Cenários "preço muda"/"edição esgota" após a cotação (eventos via Socket.IO). */
function scheduleCheckoutMutation(firstLine: { nftId: string; edition: string } | undefined) {
  const mode = mockConfig.get().checkoutMutation
  if (mode === 'none' || !firstLine || db.state.checkoutMutationDone) return
  db.mutate((s) => {
    s.checkoutMutationDone = true
  })
  setTimeout(() => {
    const nft = findNft(firstLine.nftId)
    const edition = nft && editionOf(nft, firstLine.edition as never)
    if (!nft || !edition) return
    if (mode === 'price') updateNft(nft, { edition: edition.type, price: addEth(edition.price, '0.1') })
    else updateNft(nft, { edition: edition.type, available: 0 })
  }, 1200)
}

export const orderHandlers = [
  route('post', '/checkout/quote', async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readBody<CreateQuoteRequest>(request)
    const network = body.network as NetworkId
    if (!NETWORKS.includes(network)) return validationError({ network: 'Selecione uma rede.' })
    const cart = resolveCart(request)
    const view = toCart(cart, network)
    if (!view.items.length) return apiError(409, 'CART_EMPTY', 'Seu carrinho está vazio.')
    if (view.items.some((i) => i.status === 'sold_out' || i.status === 'insufficient')) {
      return apiError(409, 'CART_HAS_ISSUES', 'Alguns itens não têm mais a disponibilidade solicitada. Ajuste o carrinho para continuar.')
    }
    const quote = buildQuote(cart, network)
    db.mutate((s) => {
      // mantém apenas cotações recentes deste usuário
      for (const [id, q] of Object.entries(s.quotes)) if (q.userId === user.id && Date.parse(q.quote.expiresAt) < Date.now()) delete s.quotes[id]
      s.quotes[quote.id] = { quote, userId: user.id, cartId: cart.id }
    })
    scheduleCheckoutMutation(quote.lines[0])
    return HttpResponse.json(quote, { status: 201 })
  }),

  route('post', '/orders', async ({ request }) => {
    const { user } = requireUser(request)
    const key = request.headers.get('Idempotency-Key')?.trim()
    if (!key || key.length < 8 || key.length > 128) {
      return apiError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Cabeçalho Idempotency-Key ausente ou inválido.')
    }
    const raw = await readBody<CreateOrderRequest>(request)
    const body: CreateOrderRequest = {
      quoteId: str(raw.quoteId),
      walletId: str(raw.walletId),
      provider: str(raw.provider) as CreateOrderRequest['provider'],
      network: str(raw.network) as NetworkId,
      collector: collectorFrom(raw.collector),
    }
    const print = fingerprint(body)

    // 1) idempotência: mesma tentativa recupera o mesmo pedido
    const previous = db.state.idempotency[key]
    if (previous) {
      if (previous.userId !== user.id || previous.fingerprint !== print) {
        return apiError(409, 'IDEMPOTENCY_CONFLICT', 'Esta chave de idempotência já foi usada com outro conteúdo.')
      }
      const record = db.state.orders.find((o) => o.order.id === previous.orderId)
      if (!record) fail(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
      processDueOrders()
      return HttpResponse.json(record.order, { status: 200, headers: { 'Idempotent-Replayed': 'true' } })
    }

    // 2) dados do colecionador
    const errors: Record<string, string> = Object.fromEntries(
      Object.entries(validateCollector(body.collector)).map(([k, v]) => [`collector.${k}`, v as string]),
    )
    if (!NETWORKS.includes(body.network)) errors.network = 'Selecione uma rede.'
    if (Object.keys(errors).length) return validationError(errors)

    // 3) carteira cadastrada e conectada
    const wallet = db.state.wallets.find((w) => w.id === body.walletId)
    if (!wallet || wallet.userId !== user.id) return apiError(404, 'WALLET_NOT_FOUND', 'Selecione uma carteira cadastrada.')
    const connection = db.state.connections[wallet.id]
    if (!connection || connection.provider !== body.provider || connection.network !== body.network) {
      return apiError(409, 'WALLET_NOT_CONNECTED', 'Conecte a carteira selecionada antes de confirmar a compra.')
    }

    // 4) revalidação de preço, disponibilidade, cupom e taxa
    const accepted = db.state.quotes[body.quoteId]
    const cart = resolveCart(request)
    const view = toCart(cart, body.network)
    if (view.items.some((i) => i.status === 'sold_out' || i.status === 'insufficient')) {
      return apiError(409, 'AVAILABILITY_CONFLICT', 'Um ou mais itens não têm mais a disponibilidade da cotação. Revise o carrinho.')
    }
    const fresh = buildQuote(cart, body.network)
    if (!accepted || accepted.userId !== user.id || Date.parse(accepted.quote.expiresAt) < Date.now()) {
      db.mutate((s) => {
        s.quotes[fresh.id] = { quote: fresh, userId: user.id, cartId: cart.id }
      })
      const details: QuoteStaleDetails = { quote: fresh, changes: [] }
      return apiError(409, 'QUOTE_EXPIRED', 'A cotação expirou. Revise os valores atualizados e confirme novamente.', { details })
    }
    const changes = diffQuotes(accepted.quote, fresh)
    if (changes.length) {
      db.mutate((s) => {
        s.quotes[fresh.id] = { quote: fresh, userId: user.id, cartId: cart.id }
      })
      const details: QuoteStaleDetails = { quote: fresh, changes }
      return apiError(409, 'QUOTE_STALE', 'Os valores mudaram desde a sua revisão. Confirme a nova cotação para continuar.', { details })
    }

    // 5) cria o pedido pendente
    const now = new Date().toISOString()
    const q = accepted.quote
    const order: Order = {
      id: randomToken('ord').slice(0, 20),
      number: `KUR-${String(db.state.orders.length + 1001)}`,
      userId: user.id,
      status: 'pending',
      version: 1,
      items: q.lines,
      subtotal: q.subtotal,
      discount: q.discount,
      networkFee: q.networkFee,
      total: q.total,
      coupon: q.coupon,
      network: body.network,
      wallet: { id: wallet.id, label: walletLabel(wallet), address: wallet.address, provider: body.provider },
      transactionHash: null,
      explorerUrl: null,
      declineReason: null,
      createdAt: now,
      updatedAt: now,
      confirmedAt: null,
    }
    const record: OrderRecord = { order, idempotencyKey: key, resolveAt: scheduleFor() }
    const timeoutOnce = mockConfig.get().orderTimeoutOnce
    db.mutate((s) => {
      s.orders.push(record)
      s.idempotency[key] = { key, userId: user.id, fingerprint: print, orderId: order.id, delivered: !timeoutOnce }
      delete s.quotes[q.id]
    })
    publishOrder(record)

    if (timeoutOnce) {
      // o pedido foi criado, mas a resposta só sai depois do timeout do cliente
      await delay(CLIENT_TIMEOUT_MS + 3000)
      db.mutate((s) => {
        const idem = s.idempotency[key]
        if (idem) idem.delivered = true
      })
    }
    return HttpResponse.json(record.order, { status: 201 })
  }),

  route('get', '/orders', ({ request }) => {
    const { user } = requireUser(request)
    processDueOrders()
    const items = db.state.orders
      .filter((o) => o.order.userId === user.id)
      .map((o) => o.order)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return HttpResponse.json({ items })
  }),

  route<{ id: string }>('get', '/orders/:id', ({ request, params }) => {
    const { user } = requireUser(request)
    processDueOrders()
    const record = db.state.orders.find((o) => o.order.id === params.id)
    if (!record) fail(404, 'ORDER_NOT_FOUND', 'Pedido não encontrado.')
    if (record.order.userId !== user.id) fail(403, 'FORBIDDEN', 'Você não tem permissão para ver este pedido.')
    return HttpResponse.json(record.order)
  }),
]
