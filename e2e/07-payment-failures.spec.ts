import { ANA, api, expect, loginUI, mock, open, test } from './support'

async function toReview(page: import('@playwright/test').Page) {
  await page.goto('/pagamento')
  await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
  await page.getByTestId('checkout-submit').click()
  const dialog = page.getByTestId('review-dialog')
  await expect(dialog.getByTestId('confirm-order')).toBeEnabled()
  return dialog
}

async function orderCount(page: import('@playwright/test').Page) {
  const res = await api<{ items: unknown[] }>(page, 'GET', '/orders')
  return res.data.items.length
}

test.describe('Falhas de pagamento e idempotência', () => {
  test('pagamento recusado preserva os itens e permite nova tentativa', async ({ page }) => {
    await open(page, '/', { scenario: 'payment-declined' })
    await loginUI(page, ANA, '/')
    const dialog = await toReview(page)
    await dialog.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-declined')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('order-declined')).toContainText('Nenhum valor foi cobrado')
    // a confirmação nunca aparece para pedido recusado
    await expect(page.getByTestId('receipt')).toHaveCount(0)
    const cart = await api<{ items: unknown[] }>(page, 'GET', '/cart')
    expect(cart.data.items).toHaveLength(3)
    await page.getByRole('link', { name: 'Tentar novamente' }).click()
    await expect(page).toHaveURL(/\/pagamento/)
  })

  test('cliques repetidos não duplicam o pedido', async ({ page }) => {
    await open(page, '/', { scenario: 'payment-manual' })
    await loginUI(page, ANA, '/')
    const dialog = await toReview(page)
    // dois cliques no mesmo tick, antes de a interface desabilitar o botão
    await dialog.getByTestId('confirm-order').evaluate((el: HTMLButtonElement) => {
      el.click()
      el.click()
      el.click()
    })
    await expect(page).toHaveURL(/\/pedidos\//)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    expect(await orderCount(page)).toBe(1)
  })

  test('timeout após criar o pedido recupera o mesmo pedido pela chave de idempotência', async ({ page }) => {
    test.setTimeout(90_000)
    await open(page, '/', { scenario: 'order-timeout' })
    await loginUI(page, ANA, '/')
    const dialog = await toReview(page)
    const posts: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/orders')) posts.push(r.headers()['idempotency-key'] ?? '')
    })
    await dialog.getByTestId('confirm-order').click()
    // a 1ª resposta não chega a tempo; o cliente avisa e reenvia com a mesma chave
    await expect(dialog.getByTestId('review-submitting')).toContainText('rede está lenta', { timeout: 10_000 })
    await expect(page).toHaveURL(/\/pedidos\//, { timeout: 40_000 })
    expect(posts.length).toBeGreaterThanOrEqual(2)
    expect(new Set(posts).size).toBe(1)
    expect(await orderCount(page)).toBe(1)
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 15_000 })
  })

  test('reusar a chave com outro conteúdo gera conflito', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/')
    await api(page, 'POST', '/wallets/wal_ana_primary/connect', { provider: 'metamask', network: 'ethereum' })
    const quote = await api<{ id: string }>(page, 'POST', '/checkout/quote', { network: 'ethereum' })
    const collector = {
      displayName: 'Ana Ribeiro', username: 'ana.kurio', profileName: 'ana.kurio', email: 'ana@kurio.dev',
      walletAddress: '0xA91F3c5D7e2B4a8C9f01D6E3b7A5c4F2e9D1E82C', secondaryAddress: '', referralCode: 'KURIO-ANA', ensName: 'ana', note: '',
    }
    const body = { quoteId: quote.data.id, walletId: 'wal_ana_primary', provider: 'metamask', network: 'ethereum', collector }
    const send = (b: unknown) =>
      page.evaluate(
        async ([payload]) => {
          const session = JSON.parse(localStorage.getItem('kurio.session.v1')!) as { token: string }
          const res = await fetch('/api/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.token}`, 'Idempotency-Key': 'teste-chave-fixa-01' },
            body: JSON.stringify(payload),
          })
          return { status: res.status, body: await res.json() }
        },
        [b] as const,
      )
    const first = await send(body)
    expect(first.status).toBe(201)
    const replay = await send(body)
    expect(replay.status).toBe(200)
    expect(replay.body.id).toBe(first.body.id)
    const conflict = await send({ ...body, collector: { ...collector, note: 'outro conteúdo' } })
    expect(conflict.status).toBe(409)
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_CONFLICT')
    await mock(page, '/state')
  })
})
