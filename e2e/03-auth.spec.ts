import { ANA, BRUNO, api, expect, isMobile, loginUI, mock, open, test } from './support'

test.describe('Conta e sessão', () => {
  test('cadastro com validação e conflito de e-mail @core', async ({ page }) => {
    await open(page, '/cadastro')
    await page.getByTestId('auth-submit').click()
    await expect(page.locator('#signup-username-error')).toBeVisible()
    await expect(page.locator('#signup-username')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#signup-username')).toBeFocused()

    await page.getByPlaceholder('Nome de usuário').fill('nova.colecionadora')
    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill(ANA.email)
    await page.locator('#signup-password').fill('Segura123')
    await page.locator('#signup-confirm').fill('Segura123')
    await page.getByTestId('auth-submit').click()
    // conflito retornado pela API
    await expect(page.locator('#signup-email-error')).toContainText('já está cadastrado')

    await page.getByPlaceholder('Digite seu e-mail', { exact: true }).fill('nova@kurio.dev')
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL('/')
    if (!isMobile(test.info())) await expect(page.getByTestId('user-menu')).toContainText('nova.colecionadora')
    // a sessão sobrevive ao refresh
    await page.reload()
    const session = await api<{ user: { email: string } }>(page, 'GET', '/auth/session')
    expect(session.data.user.email).toBe('nova@kurio.dev')
  })

  test('login com erro, sucesso e retorno ao fluxo anterior @core', async ({ page }) => {
    await open(page, '/conta/perfil')
    // rota privada → login preservando o destino
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fconta%2Fperfil/)
    await page.getByPlaceholder('contato@email.com').fill(ANA.email)
    await page.locator('#login-password').fill('senha-errada1')
    await page.getByTestId('auth-submit').click()
    await expect(page.getByTestId('auth-error')).toContainText('E-mail ou senha incorretos')
    await page.locator('#login-password').fill(ANA.password)
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL(/\/conta\/perfil/)
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
  })

  test('expiração de sessão durante a navegação leva ao login e retoma a rota', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/conta/carteiras')
    await expect(page.getByRole('heading', { name: 'Carteira principal' })).toBeVisible()
    await mock(page, '/sessions/expire', {})
    // a próxima chamada autenticada recebe 401 SESSION_EXPIRED
    await page.getByRole('link', { name: 'Atividade' }).first().click()
    await expect(page).toHaveURL(/\/entrar\?.*motivo=expirada/)
    await expect(page.getByText('Sua sessão expirou').first()).toBeVisible()
    await page.getByPlaceholder('contato@email.com').fill(ANA.email)
    await page.locator('#login-password').fill(ANA.password)
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL(/\/conta\/atividade/)
  })

  test('expiração natural da sessão (relógio controlado) durante o checkout preserva o contexto', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-15T12:00:00-03:00') })
    await open(page, '/', { scenario: 'short-session' })
    await loginUI(page, ANA, '/pagamento')
    await page.getByLabel(/Observação do colecionador/).fill('Entregar na carteira principal, por favor.')
    // sessão de 45 s: avança o relógio além do prazo
    await page.clock.fastForward('00:50')
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fpagamento&motivo=expirada/)
    await page.getByPlaceholder('contato@email.com').fill(ANA.email)
    await page.locator('#login-password').fill(ANA.password)
    await page.getByTestId('auth-submit').click()
    await expect(page).toHaveURL(/\/pagamento/)
    // rascunho do checkout restaurado
    await expect(page.getByLabel(/Observação do colecionador/)).toHaveValue('Entregar na carteira principal, por favor.')
  })

  test('logout e troca de usuário limpam dados privados', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/conta/favoritos')
    await expect(page.getByTestId('favorites-grid').getByTestId('nft-card')).toHaveCount(2)
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName(/17 itens/)

    await page.getByTestId('account-logout').click()
    await expect(page).toHaveURL('/')
    await expect(page.getByTestId('header-login')).toBeVisible()
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName('Carrinho vazio')
    expect(await page.evaluate(() => localStorage.getItem('kurio.session.v1'))).toBeNull()

    await loginUI(page, BRUNO, '/conta/favoritos')
    await expect(page.getByTestId('favorites-empty')).toBeVisible()
    await expect(page.getByTestId('header-cart')).toHaveAccessibleName('Carrinho vazio')
    // dados da Ana não são acessíveis com a sessão do Bruno
    const anaOrders = await api(page, 'GET', '/favorites')
    expect(anaOrders.data).toEqual({ nftIds: [], items: [] })
  })
})
