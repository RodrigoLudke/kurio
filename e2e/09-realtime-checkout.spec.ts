import { ANA, expect, loginUI, mock, open, test } from './support'

test.describe('Tempo real no checkout (Socket.IO)', () => {
  test('preço alterado durante a revisão bloqueia a confirmação até nova cotação @core', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/carrinho')
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('26.846 ETH')

    // 1-3) NFT no carrinho muda de preço → interface informa e atualiza o resumo
    await mock(page, '/nfts/emerald-ape-042', { price: '1.29' })
    await expect(page.getByText(/O preço de Emerald Ape #042 mudou de 1.19 ETH para 1.29 ETH/)).toBeVisible()
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('27.046 ETH')
    await expect(page.locator('[data-testid=line-status-price_changed]:visible').first()).toBeVisible()
    await expect(page.getByTestId('checkout-button')).toBeDisabled()
    await page.getByTestId('acknowledge-prices').click()
    await expect(page.getByTestId('checkout-button')).toBeEnabled()

    // 4) checkout: alteração durante a revisão invalida a cotação
    await page.getByTestId('checkout-button').click()
    await expect(page).toHaveURL(/\/pagamento/)
    await page.getByTestId('checkout-submit').click()
    const dialog = page.getByTestId('review-dialog')
    await expect(dialog.getByTestId('confirm-order')).toContainText('27.046 ETH')
    await mock(page, '/nfts/violet-nomad-314', { price: '1.49' })
    await expect(dialog.getByTestId('review-stale')).toContainText('Violet Nomad #314 foi atualizado')
    await expect(dialog.getByTestId('confirm-order')).toBeDisabled()
    await dialog.getByTestId('review-refresh-quote').click()
    // 6 × 0.10 a mais
    await expect(dialog.getByTestId('confirm-order')).toContainText('27.646 ETH')
    await expect(dialog.getByTestId('confirm-order')).toBeEnabled()
  })

  test('servidor recusa cotação desatualizada mesmo sem o evento (409 QUOTE_STALE)', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/pagamento')
    await page.getByTestId('checkout-submit').click()
    const dialog = page.getByTestId('review-dialog')
    await expect(dialog.getByTestId('confirm-order')).toBeEnabled()
    // derruba o socket para o evento não chegar e altera o preço no servidor
    await mock(page, '/realtime/disconnect', { downMs: 60_000 })
    await mock(page, '/nfts/ivory-baron-088', { price: '1.89' })
    await dialog.getByTestId('confirm-order').click()
    await expect(dialog.getByTestId('review-stale')).toContainText('Os valores mudaram')
    await expect(dialog.getByTestId('review-stale')).toContainText('Ivory Baron #088 (1/50): 1.79 ETH → 1.89 ETH')
    await dialog.getByTestId('review-refresh-quote').click()
    await expect(dialog.getByTestId('confirm-order')).toContainText('27.746 ETH')
  })

  test('edição esgotada durante a compra (cenário determinístico)', async ({ page }) => {
    await open(page, '/', { scenario: 'sold-out-checkout' })
    await loginUI(page, ANA, '/pagamento')
    await page.getByTestId('checkout-submit').click()
    const dialog = page.getByTestId('review-dialog')
    await expect(dialog.getByTestId('confirm-order')).toBeEnabled()
    // 1,2 s após a cotação o servidor esgota a edição do 1º item
    await expect(dialog.getByTestId('review-stale')).toContainText('disponibilidade', { timeout: 8000 })
    await dialog.getByTestId('review-refresh-quote').click()
    await expect(dialog.getByTestId('review-error')).toContainText('disponibilidade')
  })
})
