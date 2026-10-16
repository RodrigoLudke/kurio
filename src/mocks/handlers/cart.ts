import { HttpResponse } from 'msw'
import { EDITION_TYPES, NETWORKS, type NetworkId, type AddCartItemRequest, type ApplyCouponRequest, type EditionType, type MergeCartRequest, type UpdateCartItemRequest } from '@/api/contracts'
import { db, findNft, persist } from '../db'
import { checkCoupon, editionOf, mergeCarts, toCart, touchCart } from '../domain'
import { apiError, fail, readBody, requireUser, resolveCart, route, validationError } from '../runtime'

const MAX_PER_ORDER = 10

function parseItemId(raw: string): { nftId: string; edition: EditionType } {
  const index = raw.lastIndexOf(':')
  const nftId = raw.slice(0, index)
  const edition = raw.slice(index + 1) as EditionType
  if (index < 1 || !EDITION_TYPES.includes(edition)) fail(404, 'NOT_FOUND', 'Item do carrinho inexistente.')
  return { nftId, edition }
}

function limitFor(nftId: string, edition: EditionType) {
  const nft = findNft(nftId)
  if (!nft) fail(404, 'NFT_NOT_FOUND', 'NFT inexistente.')
  const record = editionOf(nft, edition)
  if (!record) fail(422, 'EDITION_UNAVAILABLE', 'Esta edição não existe para o NFT.')
  return { nft, record, limit: Math.min(record.available, MAX_PER_ORDER) }
}

export const cartHandlers = [
  route('get', '/cart', ({ request }) => {
    const cart = resolveCart(request)
    const network = new URL(request.url).searchParams.get('network') as NetworkId | null
    if (network && !NETWORKS.includes(network)) return validationError({ network: 'Rede inválida.' })
    persist()
    return HttpResponse.json(toCart(cart, network ?? 'ethereum'))
  }),

  route('post', '/cart/items', async ({ request }) => {
    const cart = resolveCart(request)
    const body = await readBody<AddCartItemRequest>(request)
    const nftId = typeof body.nftId === 'string' ? body.nftId : ''
    const edition = body.edition as EditionType
    const quantity = body.quantity
    const errors: Record<string, string> = {}
    if (!nftId) errors.nftId = 'Informe o NFT.'
    if (!EDITION_TYPES.includes(edition)) errors.edition = 'Selecione uma edição.'
    if (!Number.isInteger(quantity) || (quantity as number) < 1) errors.quantity = 'A quantidade deve ser um número inteiro maior que zero.'
    if (Object.keys(errors).length) return validationError(errors)
    const { record, limit } = limitFor(nftId, edition)
    if (record.available === 0) return apiError(409, 'EDITION_UNAVAILABLE', 'Esta edição está esgotada.')
    const existing = cart.lines.find((l) => l.nftId === nftId && l.edition === edition)
    const nextQuantity = (existing?.quantity ?? 0) + (quantity as number)
    if (nextQuantity > limit) {
      return apiError(409, 'AVAILABILITY_CONFLICT', `Disponível: até ${limit} unidade(s) desta edição por pedido.`, {
        details: { limit, inCart: existing?.quantity ?? 0 },
      })
    }
    db.mutate(() => {
      if (existing) {
        existing.quantity = nextQuantity
        existing.acknowledgedUnitPrice = record.price
      } else {
        cart.lines.push({ nftId, edition, quantity: quantity as number, acknowledgedUnitPrice: record.price })
      }
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart), { status: 201 })
  }),

  route<{ itemId: string }>('patch', '/cart/items/:itemId', async ({ request, params }) => {
    const cart = resolveCart(request)
    const { nftId, edition } = parseItemId(decodeURIComponent(String(params.itemId)))
    const line = cart.lines.find((l) => l.nftId === nftId && l.edition === edition)
    if (!line) fail(404, 'NOT_FOUND', 'Item do carrinho inexistente.')
    const body = await readBody<UpdateCartItemRequest>(request)
    const quantity = body.quantity
    if (!Number.isInteger(quantity) || (quantity as number) < 1) {
      return validationError({ quantity: 'A quantidade deve ser um número inteiro maior que zero.' })
    }
    const { limit } = limitFor(nftId, edition)
    if ((quantity as number) > limit) {
      return apiError(409, 'AVAILABILITY_CONFLICT', limit === 0 ? 'Esta edição esgotou.' : `Disponível: até ${limit} unidade(s) desta edição.`, {
        details: { limit },
      })
    }
    db.mutate(() => {
      line.quantity = quantity as number
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart))
  }),

  route<{ itemId: string }>('delete', '/cart/items/:itemId', ({ request, params }) => {
    const cart = resolveCart(request)
    const { nftId, edition } = parseItemId(decodeURIComponent(String(params.itemId)))
    db.mutate(() => {
      cart.lines = cart.lines.filter((l) => !(l.nftId === nftId && l.edition === edition))
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart))
  }),

  route('post', '/cart/coupon', async ({ request }) => {
    const cart = resolveCart(request)
    const body = await readBody<ApplyCouponRequest>(request)
    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : ''
    if (!code) return validationError({ code: 'Digite um código promocional.' })
    if (!cart.lines.length) return apiError(409, 'CART_EMPTY', 'Adicione NFTs ao carrinho antes de aplicar um cupom.')
    const check = checkCoupon(code)
    if (!check.ok) {
      const message = check.code === 'COUPON_EXPIRED' ? 'Este cupom expirou.' : 'Cupom inválido. Confira o código e tente novamente.'
      return apiError(422, check.code, message, { fieldErrors: { code: message } })
    }
    db.mutate(() => {
      cart.couponCode = check.coupon.code
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart))
  }),

  route('delete', '/cart/coupon', ({ request }) => {
    const cart = resolveCart(request)
    db.mutate(() => {
      cart.couponCode = null
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart))
  }),

  /** O colecionador confirma que viu as alterações de preço. */
  route('post', '/cart/acknowledge', ({ request }) => {
    const cart = resolveCart(request)
    db.mutate(() => {
      for (const line of cart.lines) {
        const nft = findNft(line.nftId)
        const edition = nft && editionOf(nft, line.edition)
        if (edition) line.acknowledgedUnitPrice = edition.price
      }
      touchCart(cart)
    })
    return HttpResponse.json(toCart(cart))
  }),

  /** Ao autenticar, mescla o carrinho do visitante no carrinho da conta. */
  route('post', '/cart/merge', async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readBody<MergeCartRequest>(request)
    const guestId = typeof body.guestCartId === 'string' ? body.guestCartId : ''
    const target = resolveCart(request)
    const source = db.state.carts[`guest:${guestId}`]
    if (source && source.owner === 'guest' && source.lines.length) {
      db.mutate(() => mergeCarts(target, source))
    }
    void user
    return HttpResponse.json(toCart(target))
  }),
]
