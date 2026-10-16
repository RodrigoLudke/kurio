/**
 * Regras de negócio do servidor simulado: projeções de NFT, cálculo do
 * carrinho e da cotação, ciclo de vida dos pedidos e alterações de catálogo
 * que geram eventos em tempo real.
 */
import {
  CATEGORY_LABEL,
  NETWORK_LABEL,
  type Cart,
  type CartItem,
  type CartLineStatus,
  type Coupon,
  type Edition,
  type EditionType,
  type NetworkId,
  type NftDetail,
  type NftSummary,
  type NftUpdatedEvent,
  type Order,
  type OrderUpdatedEvent,
  type PriceSummary,
  type Profile,
  type Quote,
  type QuoteChange,
  type QuoteLine,
  type User,
  type Wallet,
} from '@/api/contracts'
import { addEth, compareEth, mulEth, percentOfEth, subEth, toWei, type EthString } from '@/lib/eth'
import { db, findNft, persist, type OrderRecord } from './db'
import {
  imageFor,
  NETWORK_FEES,
  NFT_COPY,
  REVIEW_POOL,
  type CartRecord,
  type CouponRecord,
  type EditionRecord,
  type NftRecord,
  type UserRecord,
  type WalletRecord,
} from './fixtures'
import { mockConfig, randomToken } from './runtime'
import { nextEventId, publish } from './realtime'

const MAX_PER_ORDER = 10

/* ------------------------------------------------------------------ */
/* Projeções                                                           */
/* ------------------------------------------------------------------ */

export function editionOf(nft: NftRecord, type: EditionType): EditionRecord | undefined {
  return nft.editions.find((e) => e.type === type)
}

export function priceOf(nft: NftRecord): EthString {
  return editionOf(nft, nft.defaultEdition)?.price ?? '0'
}

function toEdition(e: EditionRecord): Edition {
  return { ...e, maxPerOrder: Math.min(e.available, MAX_PER_ORDER) }
}

export function toSummary(nft: NftRecord): NftSummary {
  return {
    id: nft.id,
    tokenId: nft.tokenId,
    name: nft.name,
    image: imageFor(nft.art, nft.name),
    category: nft.category,
    collectionName: nft.collectionName,
    network: nft.network,
    price: priceOf(nft),
    compareAtPrice: nft.compareAtPrice,
    badge: nft.badge,
    rating: nft.rating,
    reviewCount: nft.reviewCount,
    listedAt: nft.listedAt,
    available: nft.editions.reduce((sum, e) => sum + e.available, 0),
    defaultEdition: nft.defaultEdition,
    version: nft.version,
  }
}

export function toDetail(nft: NftRecord): NftDetail {
  const summary = toSummary(nft)
  const network = NETWORK_LABEL[nft.network]
  const royalties = 5
  const image = summary.image
  return {
    ...summary,
    description: NFT_COPY.description(nft.name, 'Kurio Editions', network),
    longDescription: NFT_COPY.long(nft.name, 'Kurio Editions', network, nft.creator, royalties),
    attributes: nft.attributes,
    editions: nft.editions.map(toEdition),
    gallery: [
      image,
      { ...image, alt: `${nft.name}: detalhe do rosto` },
      { ...image, alt: `${nft.name}: detalhe dos acessórios` },
      { ...image, alt: `${nft.name}: visão em contexto da coleção ${CATEGORY_LABEL[nft.category]}` },
    ],
    creator: nft.creator,
    royaltiesPercent: royalties,
    contractAddress: '0x7A42c1D9e5B3f8A6C0d2E4F7a9B1c3D5e7F919E8',
    standard: 'ERC-721',
    reviews: REVIEW_POOL.map((r, i) => ({
      id: `${nft.id}-review-${i}`,
      author: r.author,
      comment: r.comment,
      rating: i === 2 ? 4 : 5,
      createdAt: new Date(Date.UTC(2026, 8, 12 + i * 3)).toISOString(),
    })),
  }
}

export function toUser(user: UserRecord): User {
  return { id: user.id, username: user.username, email: user.email, displayName: user.displayName, avatarUrl: user.avatarUrl }
}

export function toProfile(user: UserRecord): Profile {
  return { ...toUser(user), ensName: user.ensName, walletNickname: user.walletNickname, updatedAt: user.updatedAt }
}

export function toWallet(w: WalletRecord): Wallet {
  const { userId: _userId, ...rest } = w
  void _userId
  return rest
}

/* ------------------------------------------------------------------ */
/* Cupons                                                              */
/* ------------------------------------------------------------------ */

export type CouponCheck = { ok: true; coupon: CouponRecord } | { ok: false; code: 'COUPON_INVALID' | 'COUPON_EXPIRED' }

export function checkCoupon(code: string): CouponCheck {
  const coupon = db.state.coupons.find((c) => c.code === code.trim().toUpperCase())
  if (!coupon) return { ok: false, code: 'COUPON_INVALID' }
  if (coupon.expiresAt && Date.parse(coupon.expiresAt) < Date.now()) return { ok: false, code: 'COUPON_EXPIRED' }
  return { ok: true, coupon }
}

function toCoupon(c: CouponRecord): Coupon {
  return { code: c.code, description: c.description, kind: c.kind, value: c.value }
}

function discountFor(coupon: CouponRecord | null, subtotal: EthString): EthString {
  if (!coupon || toWei(subtotal) === 0n) return '0'
  const raw = coupon.kind === 'percent' ? percentOfEth(subtotal, Number(coupon.value)) : coupon.value
  return compareEth(raw, subtotal) > 0 ? subtotal : raw
}

/* ------------------------------------------------------------------ */
/* Carrinho                                                            */
/* ------------------------------------------------------------------ */

function lineStatus(quantity: number, edition: EditionRecord | undefined, acknowledged: EthString): CartLineStatus {
  if (!edition || edition.available === 0) return 'sold_out'
  if (quantity > edition.available) return 'insufficient'
  if (compareEth(edition.price, acknowledged) !== 0) return 'price_changed'
  return 'ok'
}

function summarize(lines: { lineTotal: EthString; status: CartLineStatus }[], couponRecord: CouponRecord | null, network: NetworkId): PriceSummary {
  const billable = lines.filter((l) => l.status !== 'sold_out')
  const subtotal = billable.length ? addEth(...billable.map((l) => l.lineTotal)) : '0'
  const discount = discountFor(couponRecord, subtotal)
  const networkFee = billable.length ? NETWORK_FEES[network] : '0'
  const total = addEth(subEth(subtotal, discount), networkFee)
  return { subtotal, discount, networkFee, total, network, feeEstimated: true }
}

export function activeCoupon(cart: CartRecord): CouponRecord | null {
  if (!cart.couponCode) return null
  const check = checkCoupon(cart.couponCode)
  return check.ok ? check.coupon : null
}

export function toCart(cart: CartRecord, network: NetworkId = 'ethereum'): Cart {
  const items: CartItem[] = []
  for (const line of cart.lines) {
    const nft = findNft(line.nftId)
    if (!nft) continue
    const edition = editionOf(nft, line.edition)
    const unitPrice = edition?.price ?? line.acknowledgedUnitPrice
    const status = lineStatus(line.quantity, edition, line.acknowledgedUnitPrice)
    const summary = toSummary(nft)
    items.push({
      id: `${line.nftId}:${line.edition}`,
      nftId: line.nftId,
      edition: line.edition,
      quantity: line.quantity,
      unitPrice,
      lineTotal: mulEth(unitPrice, line.quantity),
      acknowledgedUnitPrice: line.acknowledgedUnitPrice,
      available: edition?.available ?? 0,
      maxQuantity: Math.min(edition?.available ?? 0, MAX_PER_ORDER),
      status,
      nft: { name: summary.name, tokenId: summary.tokenId, image: summary.image, network: summary.network, version: summary.version },
    })
  }
  const coupon = activeCoupon(cart)
  return {
    id: cart.id,
    owner: cart.owner,
    items,
    coupon: coupon ? toCoupon(coupon) : null,
    summary: summarize(items, coupon, network),
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    hasIssues: items.some((i) => i.status !== 'ok'),
    version: cart.version,
    updatedAt: cart.updatedAt,
  }
}

export function touchCart(cart: CartRecord) {
  cart.version += 1
  cart.updatedAt = new Date().toISOString()
}

/** Mescla o carrinho do visitante no do usuário respeitando a disponibilidade. */
export function mergeCarts(target: CartRecord, source: CartRecord) {
  for (const line of source.lines) {
    const nft = findNft(line.nftId)
    const edition = nft ? editionOf(nft, line.edition) : undefined
    if (!edition) continue
    const existing = target.lines.find((l) => l.nftId === line.nftId && l.edition === line.edition)
    const limit = Math.min(edition.available, MAX_PER_ORDER)
    if (existing) {
      existing.quantity = Math.max(1, Math.min(existing.quantity + line.quantity, limit || existing.quantity))
      existing.acknowledgedUnitPrice = line.acknowledgedUnitPrice
    } else {
      target.lines.push({ ...line, quantity: Math.max(1, Math.min(line.quantity, limit || line.quantity)) })
    }
  }
  if (!target.couponCode && source.couponCode) target.couponCode = source.couponCode
  source.lines = []
  source.couponCode = null
  touchCart(source)
  touchCart(target)
}

/* ------------------------------------------------------------------ */
/* Cotação                                                             */
/* ------------------------------------------------------------------ */

export function buildQuote(cart: CartRecord, network: NetworkId): Quote {
  const view = toCart(cart, network)
  const lines: QuoteLine[] = view.items
    .filter((i) => i.status !== 'sold_out')
    .map((i) => ({
      nftId: i.nftId,
      edition: i.edition,
      name: i.nft.name,
      tokenId: i.nft.tokenId,
      image: i.nft.image,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
      lineTotal: i.lineTotal,
      nftVersion: i.nft.version,
    }))
  const now = Date.now()
  return {
    id: randomToken('qt'),
    cartVersion: cart.version,
    lines,
    coupon: view.coupon,
    ...view.summary,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
  }
}

/** Diferenças relevantes entre a cotação aceita e a cotação atual. */
export function diffQuotes(before: Quote, after: Quote): QuoteChange[] {
  const changes: QuoteChange[] = []
  const key = (l: QuoteLine) => `${l.nftId}:${l.edition}`
  const afterMap = new Map(after.lines.map((l) => [key(l), l]))
  for (const line of before.lines) {
    const next = afterMap.get(key(line))
    if (!next) {
      changes.push({ nftId: line.nftId, edition: line.edition, name: line.name, kind: 'removed', before: `${line.quantity}`, after: '0' })
      continue
    }
    if (compareEth(line.unitPrice, next.unitPrice) !== 0) {
      changes.push({ nftId: line.nftId, edition: line.edition, name: line.name, kind: 'price', before: line.unitPrice, after: next.unitPrice })
    }
    if (line.quantity !== next.quantity) {
      changes.push({ nftId: line.nftId, edition: line.edition, name: line.name, kind: 'availability', before: `${line.quantity}`, after: `${next.quantity}` })
    }
  }
  for (const line of after.lines) {
    if (!before.lines.some((l) => key(l) === key(line))) {
      changes.push({ nftId: line.nftId, edition: line.edition, name: line.name, kind: 'availability', before: '0', after: `${line.quantity}` })
    }
  }
  if ((before.coupon?.code ?? null) !== (after.coupon?.code ?? null) || compareEth(before.discount, after.discount) !== 0) {
    changes.push({ nftId: '', edition: '1/1', name: 'Cupom', kind: 'coupon', before: before.discount, after: after.discount })
  }
  if (compareEth(before.networkFee, after.networkFee) !== 0) {
    changes.push({ nftId: '', edition: '1/1', name: 'Taxa de rede', kind: 'fee', before: before.networkFee, after: after.networkFee })
  }
  return changes
}

/* ------------------------------------------------------------------ */
/* Alterações de catálogo (geram nft.updated)                           */
/* ------------------------------------------------------------------ */

export function updateNft(
  nft: NftRecord,
  change: { edition?: EditionType; price?: EthString; available?: number; compareAtPrice?: EthString | null },
): NftUpdatedEvent {
  const previousPrice = priceOf(nft)
  const target = editionOf(nft, change.edition ?? nft.defaultEdition)
  const changed = new Set<'price' | 'availability'>()
  if (target && change.price !== undefined && compareEth(change.price, target.price) !== 0) {
    target.price = change.price
    changed.add('price')
  }
  if (target && change.available !== undefined && change.available !== target.available) {
    target.available = Math.max(0, Math.floor(change.available))
    changed.add('availability')
  }
  if (change.compareAtPrice !== undefined) nft.compareAtPrice = change.compareAtPrice
  nft.version += 1
  persist()
  const summary = toSummary(nft)
  const event: NftUpdatedEvent = {
    eventId: nextEventId(),
    type: 'nft.updated',
    resource: { type: 'nft', id: nft.id },
    version: nft.version,
    occurredAt: new Date().toISOString(),
    data: {
      nftId: nft.id,
      name: nft.name,
      price: summary.price,
      previousPrice,
      compareAtPrice: nft.compareAtPrice,
      available: summary.available,
      editions: nft.editions.map((e) => ({ type: e.type, price: e.price, available: e.available, maxPerOrder: Math.min(e.available, MAX_PER_ORDER) })),
      changed: [...changed],
    },
  }
  publish(event)
  return event
}

/* ------------------------------------------------------------------ */
/* Pedidos                                                             */
/* ------------------------------------------------------------------ */

function fakeHash(seed: string) {
  let h1 = 0x811c9dc5
  let out = ''
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seed.length; i++) {
      h1 ^= seed.charCodeAt(i) + round
      h1 = Math.imul(h1, 0x01000193) >>> 0
    }
    out += h1.toString(16).padStart(8, '0')
  }
  return `0x${out}`
}

export function publishOrder(record: OrderRecord) {
  const event: OrderUpdatedEvent = {
    eventId: nextEventId(),
    type: 'order.updated',
    resource: { type: 'order', id: record.order.id },
    version: record.order.version,
    occurredAt: new Date().toISOString(),
    data: { order: record.order },
  }
  publish(event, { userId: record.order.userId })
}

export function resolveOrder(record: OrderRecord, outcome: 'confirmed' | 'declined', reason?: string) {
  const order = record.order
  if (order.status !== 'pending') return // estados terminais não mudam
  const now = new Date().toISOString()
  let finalOutcome = outcome
  let declineReason = reason ?? 'Pagamento recusado pela carteira (saldo insuficiente na simulação).'

  if (outcome === 'confirmed') {
    // revalida estoque no momento da liquidação
    const shortage = order.items.find((item) => {
      const edition = findNft(item.nftId) && editionOf(findNft(item.nftId)!, item.edition)
      return !edition || edition.available < item.quantity
    })
    if (shortage) {
      finalOutcome = 'declined'
      declineReason = `${shortage.name} (${shortage.edition}) esgotou durante o processamento do pagamento.`
    }
  }

  const next: Order = {
    ...order,
    status: finalOutcome,
    version: order.version + 1,
    updatedAt: now,
    confirmedAt: finalOutcome === 'confirmed' ? now : null,
    declineReason: finalOutcome === 'declined' ? declineReason : null,
    transactionHash: finalOutcome === 'confirmed' ? fakeHash(order.id) : null,
    explorerUrl: null,
  }
  if (next.transactionHash) next.explorerUrl = `/explorador/${next.transactionHash}?pedido=${order.id}`
  record.order = next
  record.resolveAt = null

  if (finalOutcome === 'confirmed') {
    // remove do carrinho apenas os itens e quantidades comprados
    const cart = db.state.carts[`user:${order.userId}`]
    if (cart) {
      for (const item of order.items) {
        const line = cart.lines.find((l) => l.nftId === item.nftId && l.edition === item.edition)
        if (!line) continue
        line.quantity -= item.quantity
      }
      cart.lines = cart.lines.filter((l) => l.quantity > 0)
      if (order.coupon && cart.couponCode === order.coupon.code) cart.couponCode = null
      touchCart(cart)
    }
    persist()
    publishOrder(record)
    for (const item of order.items) {
      const nft = findNft(item.nftId)
      const edition = nft && editionOf(nft, item.edition)
      if (nft && edition) updateNft(nft, { edition: item.edition, available: edition.available - item.quantity })
    }
  } else {
    persist()
    publishOrder(record)
  }
}

/** Resolve pedidos cujo prazo simulado venceu (chamado periodicamente e a cada request). */
export function processDueOrders() {
  const now = Date.now()
  for (const record of db.state.orders) {
    if (record.order.status === 'pending' && record.resolveAt !== null && record.resolveAt <= now) {
      const payment = mockConfig.get().payment
      resolveOrder(record, payment.mode === 'auto' ? payment.outcome : 'confirmed')
    }
  }
}

export function scheduleFor(): number | null {
  const payment = mockConfig.get().payment
  return payment.mode === 'auto' ? Date.now() + payment.delayMs : null
}

export function walletLabel(w: WalletRecord) {
  return w.nickname || (w.slot === 'primary' ? 'Principal' : 'Secundária')
}

