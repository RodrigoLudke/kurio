import { HttpResponse } from 'msw'
import type {
  ChangePasswordRequest,
  ConnectWalletRequest,
  CreateWalletRequest,
  FavoritesResponse,
  UpdateProfileRequest,
  WalletInput,
  WalletUpdatedEvent,
} from '@/api/contracts'
import { validatePasswordChange, validateProfile, validateWallet } from '@/lib/schemas'
import { rules } from '@/lib/validation'
import { db, findNft, walletsOf } from '../db'
import { toProfile, toSummary, toWallet } from '../domain'
import type { WalletRecord } from '../fixtures'
import { nextEventId, publish } from '../realtime'
import { apiError, fail, mockConfig, randomToken, readBody, requireUser, route, sha256, validationError } from '../runtime'

const MAX_AVATAR_BYTES = 512 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp']

function str(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function walletInput(body: Partial<WalletInput>): WalletInput {
  return {
    displayName: str(body.displayName).trim(),
    nickname: str(body.nickname).trim(),
    network: str(body.network) as WalletInput['network'],
    profileName: str(body.profileName).trim(),
    address: str(body.address).trim(),
    secondaryAddress: str(body.secondaryAddress).trim(),
    provider: str(body.provider) as WalletInput['provider'],
    referralCode: str(body.referralCode).trim().toUpperCase(),
    email: str(body.email).trim().toLowerCase(),
    ensName: str(body.ensName).trim().toLowerCase().replace(/\.eth$/, ''),
  }
}

function toBase64(buffer: ArrayBuffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

export const accountHandlers = [
  /* ---------------------------- Perfil ---------------------------- */
  route('get', '/profile', ({ request }) => {
    const { user } = requireUser(request)
    return HttpResponse.json(toProfile(user))
  }),

  route('patch', '/profile', async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readBody<UpdateProfileRequest>(request)
    const input: UpdateProfileRequest = {
      displayName: str(body.displayName).trim(),
      username: str(body.username).trim().toLowerCase(),
      email: str(body.email).trim().toLowerCase(),
      ensName: str(body.ensName).trim().toLowerCase().replace(/\.eth$/, ''),
      walletNickname: str(body.walletNickname).trim(),
    }
    const errors = validateProfile(input)
    if (db.state.users.some((u) => u.id !== user.id && u.email === input.email)) errors.email = 'Este e-mail já está em uso por outra conta.'
    if (db.state.users.some((u) => u.id !== user.id && u.username === input.username)) errors.username = 'Este nome de usuário já está em uso.'
    if (Object.keys(errors).length) return validationError(errors)
    db.mutate(() => {
      Object.assign(user, input, { updatedAt: new Date().toISOString() })
    })
    return HttpResponse.json(toProfile(user))
  }),

  route('post', '/profile/avatar', async ({ request }) => {
    const { user } = requireUser(request)
    const file = await request
      .formData()
      .then((form) => form.get('avatar'))
      .catch(() => null)
    if (!(file instanceof File)) return validationError({ avatar: 'Selecione uma imagem.' })
    if (!AVATAR_TYPES.includes(file.type)) {
      return apiError(415, 'UNSUPPORTED_MEDIA', 'Formato não suportado.', { fieldErrors: { avatar: 'Use uma imagem PNG, JPG ou WebP.' } })
    }
    if (file.size > MAX_AVATAR_BYTES) {
      return apiError(413, 'PAYLOAD_TOO_LARGE', 'Imagem muito grande.', { fieldErrors: { avatar: 'A imagem deve ter no máximo 512 KB.' } })
    }
    const dataUrl = `data:${file.type};base64,${toBase64(await file.arrayBuffer())}`
    db.mutate(() => {
      user.avatarUrl = dataUrl
      user.updatedAt = new Date().toISOString()
    })
    return HttpResponse.json(toProfile(user))
  }),

  route('delete', '/profile/avatar', ({ request }) => {
    const { user } = requireUser(request)
    db.mutate(() => {
      user.avatarUrl = null
      user.updatedAt = new Date().toISOString()
    })
    return HttpResponse.json(toProfile(user))
  }),

  route('post', '/profile/password', async ({ request }) => {
    const { user, session } = requireUser(request)
    const body = await readBody<ChangePasswordRequest>(request)
    const input: ChangePasswordRequest = {
      currentPassword: str(body.currentPassword),
      newPassword: str(body.newPassword),
      confirmPassword: str(body.confirmPassword),
    }
    const errors = validatePasswordChange(input)
    if (Object.keys(errors).length) return validationError(errors)
    if ((await sha256(`${user.passwordSalt}:${input.currentPassword}`)) !== user.passwordHash) {
      return apiError(422, 'INVALID_PASSWORD', 'A senha atual está incorreta.', { fieldErrors: { currentPassword: 'A senha atual está incorreta.' } })
    }
    const salt = randomToken('salt')
    const hash = await sha256(`${salt}:${input.newPassword}`)
    db.mutate((s) => {
      user.passwordSalt = salt
      user.passwordHash = hash
      user.updatedAt = new Date().toISOString()
      // encerra as outras sessões do usuário, mantém a atual
      for (const other of s.sessions) if (other.userId === user.id && other.token !== session.token) other.revoked = true
    })
    return HttpResponse.json({ ok: true })
  }),

  /* --------------------------- Favoritos -------------------------- */
  route('get', '/favorites', ({ request }) => {
    const { user } = requireUser(request)
    const ids = db.state.favorites[user.id] ?? []
    const body: FavoritesResponse = {
      nftIds: ids,
      items: ids.map((id) => findNft(id)).filter((n) => !!n).map(toSummary),
    }
    return HttpResponse.json(body)
  }),

  route<{ nftId: string }>('put', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireUser(request)
    const nftId = String(params.nftId)
    if (!findNft(nftId)) fail(404, 'NFT_NOT_FOUND', 'NFT inexistente.')
    const ids = db.mutate((s) => {
      const list = s.favorites[user.id] ?? []
      if (!list.includes(nftId)) list.unshift(nftId)
      s.favorites[user.id] = list
      return list
    })
    return HttpResponse.json({ nftIds: ids })
  }),

  route<{ nftId: string }>('delete', '/favorites/:nftId', ({ request, params }) => {
    const { user } = requireUser(request)
    const nftId = String(params.nftId)
    const ids = db.mutate((s) => {
      s.favorites[user.id] = (s.favorites[user.id] ?? []).filter((id) => id !== nftId)
      return s.favorites[user.id]!
    })
    return HttpResponse.json({ nftIds: ids })
  }),

  /* --------------------------- Carteiras -------------------------- */
  route('get', '/wallets', ({ request }) => {
    const { user } = requireUser(request)
    const items = walletsOf(user.id)
      .sort((a, b) => (a.slot === b.slot ? 0 : a.slot === 'primary' ? -1 : 1))
      .map(toWallet)
    return HttpResponse.json({ items })
  }),

  route('post', '/wallets', async ({ request }) => {
    const { user } = requireUser(request)
    const body = await readBody<CreateWalletRequest>(request)
    const slot = body.slot === 'secondary' ? 'secondary' : body.slot === 'primary' ? 'primary' : null
    const input = walletInput(body)
    const errors: Record<string, string> = { ...validateWallet(input) }
    if (!slot) errors.slot = 'Tipo de carteira inválido.'
    if (Object.keys(errors).length) return validationError(errors)
    if (walletsOf(user.id).some((w) => w.slot === slot)) {
      return apiError(409, 'WALLET_SLOT_TAKEN', slot === 'primary' ? 'Você já possui uma carteira principal.' : 'Você já possui uma carteira secundária.')
    }
    if (walletsOf(user.id).some((w) => w.address.toLowerCase() === input.address.toLowerCase())) {
      return validationError({ address: 'Este endereço já está cadastrado em outra carteira.' })
    }
    const record: WalletRecord = { ...input, id: randomToken('wal'), userId: user.id, slot: slot!, updatedAt: new Date().toISOString() }
    db.mutate((s) => s.wallets.push(record))
    return HttpResponse.json(toWallet(record), { status: 201 })
  }),

  route<{ id: string }>('put', '/wallets/:id', async ({ request, params }) => {
    const { user } = requireUser(request)
    const wallet = db.state.wallets.find((w) => w.id === params.id)
    if (!wallet) fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    if (wallet.userId !== user.id) fail(403, 'FORBIDDEN', 'Você não tem permissão para alterar esta carteira.')
    const input = walletInput(await readBody<WalletInput>(request))
    const errors = validateWallet(input)
    if (walletsOf(user.id).some((w) => w.id !== wallet.id && w.address.toLowerCase() === input.address.toLowerCase())) {
      errors.address = 'Este endereço já está cadastrado em outra carteira.'
    }
    if (Object.keys(errors).length) return validationError(errors)
    db.mutate((s) => {
      Object.assign(wallet, input, { updatedAt: new Date().toISOString() })
      delete s.connections[wallet.id] // dados mudaram: exige nova conexão
    })
    return HttpResponse.json(toWallet(wallet))
  }),

  route<{ id: string }>('get', '/wallets/:id/connection', ({ request, params }) => {
    const { user } = requireUser(request)
    const wallet = db.state.wallets.find((w) => w.id === params.id)
    if (!wallet || wallet.userId !== user.id) fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    const c = db.state.connections[wallet.id]
    return HttpResponse.json({
      connection: c ? { walletId: c.walletId, provider: c.provider, network: c.network, status: 'connected', connectedAt: c.connectedAt } : null,
    })
  }),

  route<{ id: string }>('post', '/wallets/:id/connect', async ({ request, params }) => {
    const { user } = requireUser(request)
    const wallet = db.state.wallets.find((w) => w.id === params.id)
    if (!wallet || wallet.userId !== user.id) fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    const body = await readBody<ConnectWalletRequest>(request)
    const errors: Record<string, string> = {}
    const networkError = rules.network(str(body.network))
    const providerError = rules.provider(str(body.provider))
    if (networkError) errors.network = networkError
    if (providerError) errors.provider = providerError
    if (Object.keys(errors).length) return validationError(errors)
    if (mockConfig.get().walletRejects) {
      return apiError(403, 'WALLET_REJECTED', 'A conexão foi recusada na carteira. Aprove a solicitação para continuar.')
    }
    const connection = {
      walletId: wallet.id,
      userId: user.id,
      provider: body.provider!,
      network: body.network!,
      connectedAt: new Date().toISOString(),
    }
    db.mutate((s) => {
      s.connections[wallet.id] = connection
    })
    const { userId: _u, ...publicConnection } = connection
    void _u
    return HttpResponse.json({ connection: { ...publicConnection, status: 'connected' } })
  }),

  route<{ id: string }>('post', '/wallets/:id/disconnect', ({ request, params }) => {
    const { user } = requireUser(request)
    const wallet = db.state.wallets.find((w) => w.id === params.id)
    if (!wallet || wallet.userId !== user.id) fail(404, 'WALLET_NOT_FOUND', 'Carteira não encontrada.')
    disconnectWallet(wallet.id, 'disconnected')
    return HttpResponse.json({ connection: null })
  }),
]

export function disconnectWallet(walletId: string, reason: 'disconnected') {
  const connection = db.state.connections[walletId]
  if (!connection) return false
  db.mutate((s) => {
    delete s.connections[walletId]
  })
  const event: WalletUpdatedEvent = {
    eventId: nextEventId(),
    type: 'wallet.updated',
    resource: { type: 'wallet', id: walletId },
    version: Date.now(),
    occurredAt: new Date().toISOString(),
    data: { walletId, userId: connection.userId, connection: null, reason },
  }
  publish(event, { userId: connection.userId })
  return true
}
