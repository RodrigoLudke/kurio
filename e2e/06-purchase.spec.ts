import { ANA, api, expect, isMobile, loginUI, open, test } from './support'

test.describe('Compra completa', () => {
  test('do catálogo ao recibo confirmado @core', async ({ page }) => {
    const mobile = isMobile(test.info())
    await open(page, '/')
    await loginUI(page, ANA, '/')
    // esvazia o carrinho semeado para comprar apenas o item escolhido
    const cart = await api<{ items: { id: string }[] }>(page, 'GET', '/cart')
    for (const item of cart.data.items) await api(page, 'DELETE', `/cart/items/${encodeURIComponent(item.id)}`)
    await page.reload()

    await page.getByRole('link', { name: 'Golden Beat #207', exact: true }).first().click()
    await expect(page).toHaveURL(/\/nft\/golden-beat-207/)
    await page.getByRole('button', { name: mobile ? 'Comprar NFT' : 'COMPRAR' }).click()
    await expect(page).toHaveURL(/\/carrinho/)
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('1.006 ETH')

    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/pagamento/)
    // no mobile os dados do colecionador ficam recolhidos
    if (mobile) await page.getByText('Dados do colecionador').click()
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
    await page.getByTestId('checkout-submit').click()

    const dialog = page.getByTestId('review-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByTestId('review-quote')).toContainText('Golden Beat #207')
    await expect(dialog.getByTestId('confirm-order')).toBeEnabled()
    await expect(dialog.getByTestId('confirm-order')).toContainText('1.006 ETH')
    await dialog.getByTestId('confirm-order').click()

    await expect(page).toHaveURL(/\/pedidos\//)
    await expect(page.getByTestId('order-pending')).toBeVisible()
    // confirmação chega por order.updated (Socket.IO)
    const receipt = page.getByTestId('receipt')
    await expect(receipt).toBeVisible({ timeout: 15_000 })
    await expect(receipt).toContainText('Seus NFTs agora estão na sua carteira')
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH')
    await expect(page.getByTestId('tx-hash')).toContainText('0x')

    // o carrinho perdeu apenas o item comprado
    const after = await api<{ items: unknown[] }>(page, 'GET', '/cart')
    expect(after.data.items).toHaveLength(0)

    // o recibo é um snapshot: mudanças no catálogo não o alteram
    await page.evaluate(() =>
      fetch('/api/__mock/nfts/golden-beat-207', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: '5.55' }) }),
    )
    await page.reload()
    await expect(page.getByTestId('receipt-total')).toHaveText('1.006 ETH')

    // explorador simulado
    await page.getByRole('link', { name: /Ver no Etherscan/ }).click()
    await expect(page.getByRole('heading', { name: 'Detalhes da transação' })).toBeVisible()
    await expect(page.getByText('Sucesso')).toBeVisible()
  })
})
