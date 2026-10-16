import { ANA, expect, isMobile, loginUI, mock, open, test } from './support'

test.describe('Favoritos', () => {
  test('favoritar é otimista e persiste para o usuário autenticado @core', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/nft/violet-nomad-314')
    const toggle = isMobile(test.info())
      ? page.getByRole('button', { name: /Violet Nomad #314.*lista de interesse/ })
      : page.getByTestId('favorite-toggle')
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    const saved = page.waitForResponse((r) => r.url().includes('/api/favorites/violet-nomad-314') && r.request().method() === 'PUT')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true') // otimista
    expect((await saved).status()).toBe(200)
    await page.reload()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await page.goto('/conta/favoritos')
    await expect(page.getByTestId('favorites-grid')).toContainText('Violet Nomad #314')
  })

  test('visitante é levado ao login ao favoritar', async ({ page }) => {
    await open(page, '/nft/violet-nomad-314')
    await page.getByTestId('favorite-toggle').click()
    await expect(page).toHaveURL(/\/entrar\?redirect=%2Fnft%2Fviolet-nomad-314/)
  })

  test('falha na mutation faz rollback e informa; nova tentativa recupera', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/nft/violet-nomad-314')
    await mock(page, '/scenario', { id: 'favorites-failure' })
    const button = page.getByTestId('favorite-toggle')
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await button.click()
    // otimista: muda na hora...
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    // ...e volta quando o servidor recusa
    await expect(button).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/Não foi possível salvar o favorito.*restaurado/)).toBeVisible()

    await mock(page, '/scenario', { id: 'default' })
    const saved = page.waitForResponse((r) => r.url().includes('/api/favorites/') && r.request().method() === 'PUT')
    await button.click()
    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await saved
    await page.reload()
    await expect(page.getByTestId('favorite-toggle')).toHaveAttribute('aria-pressed', 'true')
  })
})
