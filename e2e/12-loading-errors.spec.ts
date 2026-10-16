import { expect, mock, open, test } from './support'

test.describe('Carregamento, falhas e recuperação', () => {
  test('skeletons durante carregamento lento sem deslocar o layout @core', async ({ page }) => {
    await open(page, '/mercado', { scenario: 'slow' })
    await expect(page.getByTestId('catalog-loading')).toBeVisible()
    await expect(page.getByTestId('catalog-loading').getByTestId('nft-card-skeleton')).toHaveCount(9)
    const skeletonBox = await page.getByTestId('nft-card-skeleton').first().boundingBox()
    await expect(page.getByTestId('catalog-grid')).toBeVisible({ timeout: 15_000 })
    const cardBox = await page.getByTestId('nft-card').first().boundingBox()
    // o skeleton reserva as dimensões do conteúdo real
    expect(Math.abs((skeletonBox?.width ?? 0) - (cardBox?.width ?? 0))).toBeLessThan(2)
    expect(Math.abs((skeletonBox?.y ?? 0) - (cardBox?.y ?? 0))).toBeLessThan(2)

    await page.goto('/nft/emerald-ape-042')
    await expect(page.getByTestId('detail-loading')).toBeVisible()
    await expect(page.getByTestId('nft-name')).toBeVisible({ timeout: 15_000 })
  })

  test('skeleton respeita prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, '/mercado', { scenario: 'slow' })
    const animation = await page.getByTestId('nft-card-skeleton').first().locator('.skeleton').first().evaluate((el) => getComputedStyle(el).animationName)
    expect(animation).toBe('none')
  })

  test('falha HTTP 500 mostra erro e nova tentativa recupera @core', async ({ page }) => {
    await open(page, '/mercado', { scenario: 'server-error' })
    const error = page.getByTestId('catalog-error')
    await expect(error).toBeVisible({ timeout: 20_000 })
    await expect(error).toContainText('Não foi possível carregar o catálogo')
    await mock(page, '/scenario', { id: 'default' })
    await error.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('sem conexão com o servidor e retorno', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042', { scenario: 'offline' })
    await expect(page.getByTestId('detail-error')).toContainText('Sem conexão', { timeout: 20_000 })
    await mock(page, '/network', { offline: false })
    await page.getByRole('button', { name: 'Tentar novamente' }).click()
    await expect(page.getByTestId('nft-name')).toHaveText('Emerald Ape #042')
  })

  test('catálogo vazio no cenário dedicado', async ({ page }) => {
    await open(page, '/mercado', { scenario: 'empty-catalog' })
    await expect(page.getByTestId('catalog-empty')).toBeVisible()
  })
})
