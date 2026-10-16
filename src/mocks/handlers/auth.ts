import { HttpResponse } from 'msw'
import type { AuthResponse, LoginRequest, RegisterRequest } from '@/api/contracts'
import { validateLogin, validateRegister } from '@/lib/schemas'
import { db } from '../db'
import { toUser } from '../domain'
import type { UserRecord } from '../fixtures'
import { dropSession } from '../realtime'
import { apiError, bearer, mockConfig, randomToken, readBody, requireUser, route, sha256, validationError } from '../runtime'

function str(v: unknown) {
  return typeof v === 'string' ? v : ''
}

function openSession(user: UserRecord): AuthResponse {
  const now = Date.now()
  const session = {
    token: randomToken('ses'),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + mockConfig.get().sessionTtlSeconds * 1000).toISOString(),
    revoked: false,
  }
  db.mutate((s) => {
    // mantém só sessões recentes para o armazenamento local não crescer
    s.sessions = [...s.sessions.filter((x) => !x.revoked && Date.parse(x.expiresAt) > now).slice(-20), session]
  })
  return { user: toUser(user), session: { token: session.token, expiresAt: session.expiresAt } }
}

export const authHandlers = [
  route('post', '/auth/login', async ({ request }) => {
    const body = await readBody<LoginRequest>(request)
    const input: LoginRequest = { email: str(body.email).trim().toLowerCase(), password: str(body.password) }
    const errors = validateLogin(input)
    if (Object.keys(errors).length) return validationError(errors)
    const user = db.state.users.find((u) => u.email === input.email)
    const hash = user ? await sha256(`${user.passwordSalt}:${input.password}`) : null
    if (!user || hash !== user.passwordHash) {
      return apiError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.', {
        fieldErrors: { password: 'E-mail ou senha incorretos.' },
      })
    }
    return HttpResponse.json(openSession(user))
  }),

  route('post', '/auth/register', async ({ request }) => {
    const body = await readBody<RegisterRequest>(request)
    const input: RegisterRequest = {
      username: str(body.username).trim().toLowerCase(),
      email: str(body.email).trim().toLowerCase(),
      password: str(body.password),
      confirmPassword: str(body.confirmPassword),
    }
    const errors = validateRegister(input)
    if (Object.keys(errors).length) return validationError(errors)
    if (db.state.users.some((u) => u.email === input.email)) {
      return apiError(409, 'EMAIL_TAKEN', 'Já existe uma conta com este e-mail.', {
        fieldErrors: { email: 'Este e-mail já está cadastrado. Entre ou use outro e-mail.' },
      })
    }
    if (db.state.users.some((u) => u.username === input.username)) {
      return apiError(409, 'USERNAME_TAKEN', 'Este nome de usuário já está em uso.', {
        fieldErrors: { username: 'Este nome de usuário já está em uso.' },
      })
    }
    const salt = randomToken('salt')
    const now = new Date().toISOString()
    const user: UserRecord = {
      id: randomToken('usr'),
      username: input.username,
      email: input.email,
      displayName: input.username,
      ensName: '',
      walletNickname: '',
      avatarUrl: null,
      passwordSalt: salt,
      passwordHash: await sha256(`${salt}:${input.password}`),
      createdAt: now,
      updatedAt: now,
    }
    db.mutate((s) => {
      s.users.push(user)
      s.favorites[user.id] = []
    })
    return HttpResponse.json(openSession(user), { status: 201 })
  }),

  route('get', '/auth/session', ({ request }) => {
    const { user, session } = requireUser(request)
    return HttpResponse.json({ user: toUser(user), session: { expiresAt: session.expiresAt } })
  }),

  route('post', '/auth/logout', ({ request }) => {
    const token = bearer(request)
    if (token) {
      db.mutate((s) => {
        const session = s.sessions.find((x) => x.token === token)
        if (session) session.revoked = true
        // conexões de carteira pertencem à sessão
        for (const [walletId, connection] of Object.entries(s.connections)) {
          const owner = s.sessions.find((x) => x.token === token)?.userId
          if (connection.userId === owner) delete s.connections[walletId]
        }
      })
      dropSession(token)
    }
    return new HttpResponse(null, { status: 204 })
  }),
]
