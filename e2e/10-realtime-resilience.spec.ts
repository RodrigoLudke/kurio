import { ANA, api, expect, loginUI, mock, open, settledGrid, test } from './support'

test.describe('Tempo real: duplicatas, eventos antigos, desconexão e retomada', () => {
  test('eventos duplicados ou antigos não regridem o estado nem reaplicam efeitos', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/carrinho')
    await mock(page, '/nfts/emerald-ape-042', { price: '1.49' })
    const toast = page.getByText(/O preço de Emerald Ape #042 mudou de 1.19 ETH para 1.49 ETH/)
    await expect(toast).toHaveCount(1)
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('27.446 ETH')

    // duplicata (mesmo eventId) e evento antigo (versão anterior, preço anterior)
    await mock(page, '/realtime/replay', { mode: 'duplicate', type: 'nft.updated' })
    await mock(page, '/realtime/replay', { mode: 'stale', type: 'nft.updated' })
    await page.waitForTimeout(800)
    await expect(toast).toHaveCount(1)
    await expect(page.getByText(/mudou de 1.49 ETH para 1.19 ETH/)).toHaveCount(0)
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('27.446 ETH')

    // catálogo e detalhe também mantêm a versão mais nova
    await page.goto('/mercado')
    const grid = await settledGrid(page)
    await expect(grid.getByTestId('nft-card').first()).toContainText('1.49 ETH')
    await mock(page, '/realtime/replay', { mode: 'stale', type: 'nft.updated' })
    await page.waitForTimeout(500)
    await expect(grid.getByTestId('nft-card').first()).toContainText('1.49 ETH')
  })

  test('queda da conexão com pedido pendente: reconexão e refresh recuperam o mesmo pedido @core', async ({ page }) => {
    await open(page, '/', { scenario: 'payment-manual' })
    await loginUI(page, ANA, '/pagamento')
    const mobile = test.info().project.name.startsWith('mobile')
    if (mobile) await page.getByText('Dados do colecionador').click()
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
    await page.getByTestId('checkout-submit').click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const orderUrl = page.url()

    // refresh com o pedido pendente: estado recuperado, nenhuma nova compra
    await page.reload()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // voltar ao pagamento redireciona ao pedido em andamento
    await page.goto('/pagamento')
    await expect(page).toHaveURL(orderUrl)

    // servidor de tempo real cai; o pagamento é confirmado enquanto o socket está fora
    await mock(page, '/realtime/disconnect', { downMs: 4000 })
    const { pendingOrders } = await mock<{ pendingOrders: { id: string }[] }>(page, '/state')
    expect(pendingOrders).toHaveLength(1)
    await mock(page, `/orders/${pendingOrders[0]!.id}/resolve`, { outcome: 'confirmed' })

    // reconexão + reconciliação REST (ou polling de segurança) apresentam a confirmação
    await expect(page.getByTestId('receipt')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByTestId('realtime-status')).toHaveAttribute('data-status', 'connected', { timeout: 15_000 })
    const orders = await api<{ items: { status: string }[] }>(page, 'GET', '/orders')
    expect(orders.data.items).toHaveLength(1)
    expect(orders.data.items[0]!.status).toBe('confirmed')

    // estado terminal: um evento antigo não volta o pedido para pendente
    await mock(page, '/realtime/replay', { mode: 'stale', type: 'order.updated' })
    await page.waitForTimeout(500)
    await expect(page.getByTestId('receipt')).toBeVisible()
  })

  test('troca de usuário: pedido e eventos de outra sessão não vazam', async ({ page }) => {
    await open(page, '/', { scenario: 'payment-manual' })
    await loginUI(page, ANA, '/pagamento')
    await page.getByTestId('checkout-submit').click()
    await page.getByTestId('confirm-order').click()
    await expect(page.getByTestId('order-pending')).toBeVisible()
    const anaOrderUrl = new URL(page.url()).pathname
    const anaOrderId = anaOrderUrl.split('/').pop()!

    await page.goto('/conta/perfil')
    await page.getByTestId('account-logout').click()
    await loginUI(page, { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Costa', id: 'usr_bruno' }, '/conta/atividade')
    await expect(page.getByText('Nenhum pedido ainda.')).toBeVisible()

    // evento do pedido da Ana enquanto o Bruno está conectado: nada muda para ele
    await mock(page, `/orders/${anaOrderId}/resolve`, { outcome: 'confirmed' })
    await page.waitForTimeout(800)
    await expect(page.getByText('Nenhum pedido ainda.')).toBeVisible()

    // acesso direto ao pedido de outro usuário → 403 tratado
    await page.goto(anaOrderUrl)
    await expect(page.getByTestId('order-error')).toContainText('Acesso negado')
  })
})
