import type { Page } from '@playwright/test'
import { ANA, expect, loginUI, mock, open, test } from './support'

/** Dados estáveis: fixtures determinísticas, sem latência e imagens carregadas. */
async function stabilize(page: Page) {
  await mock(page, '/network', { latency: { mode: 'none' } })
  await page.evaluate(() => document.fonts.ready)
  // carrega imagens lazy para a captura de página inteira ser determinística
  await page.evaluate(() => document.querySelectorAll<HTMLImageElement>('img[loading=lazy]').forEach((img) => (img.loading = 'eager')))
  await page.waitForFunction(() => Array.from(document.images).every((img) => img.complete || !img.checkVisibility()))
  await page.waitForTimeout(300)
}

test.describe('Regressão visual @visual', () => {
  test('início', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await stabilize(page)
    await expect(page).toHaveScreenshot('inicio.png', { fullPage: true })
  })

  test('detalhe do NFT', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByTestId('nft-name')).toBeVisible()
    await expect(page.getByTestId('nft-card').first()).toBeVisible()
    await stabilize(page)
    await expect(page).toHaveScreenshot('detalhe.png', { fullPage: true })
  })

  test('carrinho', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/carrinho')
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('26.846 ETH')
    await stabilize(page)
    await expect(page).toHaveScreenshot('carrinho.png', { fullPage: true })
  })

  test('pagamento', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/pagamento')
    await expect(page.getByTestId('checkout-submit')).toBeEnabled()
    await stabilize(page)
    await expect(page).toHaveScreenshot('pagamento.png', { fullPage: true })
  })
})
