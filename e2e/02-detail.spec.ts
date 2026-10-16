import { expect, mock, open, test } from './support'

test.describe('Detalhe do NFT', () => {
  test('acesso direto, galeria e informações @core', async ({ page }) => {
    await open(page, '/nft/emerald-ape-042')
    await expect(page.getByRole('heading', { level: 1, name: 'Emerald Ape #042' })).toBeVisible()
    await expect(page.getByText('ID do token:').first()).toBeVisible()
    await expect(page.getByText('#0042').first()).toBeVisible()
    await expect(page.getByRole('radio', { name: /1\/50/ })).toHaveAttribute('aria-checked', 'true')
    await expect(page.getByRole('img', { name: /Emerald Ape #042: ilustração/ }).first()).toBeVisible()
  })

  test('NFT inexistente mostra 404 tratado @core', async ({ page }) => {
    await open(page, '/nft/nao-existe-123')
    await expect(page.getByTestId('nft-not-found')).toContainText('NFT não encontrado')
    await page.getByRole('link', { name: 'Explorar o mercado' }).click()
    await expect(page).toHaveURL(/\/mercado/)
  })

  test('rota inexistente mostra página 404', async ({ page }) => {
    await open(page, '/rota/que/nao/existe')
    await expect(page.getByRole('heading', { name: 'Página não encontrada' })).toBeVisible()
  })

  test('edição indisponível e limite de quantidade', async ({ page }) => {
    // Sage Nomad #009 (índice 1): edição 1/1 esgotada nas fixtures
    await open(page, '/nft/sage-nomad-009')
    const oneOfOne = page.getByTestId('edition-1/1')
    await expect(oneOfOne).toHaveAttribute('aria-disabled', 'true')
    await oneOfOne.click({ force: true }) // aria-disabled: anuncia e não seleciona
    await expect(page.getByRole('radio', { name: /1\/50/ })).toHaveAttribute('aria-checked', 'true')

    // Neon Vessel #552: 1/50 com apenas 2 unidades → limite 2
    await page.goto('/nft/neon-vessel-552')
    await expect(page.getByTestId('edition-status')).toContainText('Máx. 2 por pedido')
    const plus = page.getByRole('button', { name: 'Aumentar quantidade de Neon Vessel #552' }).first()
    await plus.click()
    await expect(plus).toBeDisabled()
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByTestId('edition-status')).toContainText('limite desta edição no carrinho')
    await expect(page.getByTestId('buy-button')).toBeDisabled()

    // a edição esgota no servidor → a interface reflete via Socket.IO
    await mock(page, '/nfts/neon-vessel-552', { edition: '1/10', available: 0 })
    await expect(page.getByTestId('edition-1/10')).toHaveAttribute('aria-disabled', 'true')
  })
})
