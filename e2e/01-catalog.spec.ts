import { expect, open, settledGrid, test } from './support'

test.describe('Catálogo: busca, filtros, ordenação, paginação e histórico', () => {
  test('filtros combinados, ordenação e paginação refletem URL e API e sobrevivem ao histórico', async ({ page }) => {
    await open(page, '/mercado')
    const grid = page.getByTestId('catalog-grid')
    await expect(grid.getByTestId('nft-card')).toHaveCount(9)
    await expect(page.getByTestId('catalog-status')).toContainText('72 NFTs encontrados')

    // filtro de coleção → URL e parâmetro enviado à API
    const categoryRequest = page.waitForRequest((r) => r.url().includes('/api/nfts?') && r.url().includes('category=musica'))
    await page.getByRole('button', { name: /^Música/ }).first().click()
    await categoryRequest
    await expect(page).toHaveURL(/category=musica/)
    await expect(page.getByRole('button', { name: /^Música/ }).first()).toHaveAttribute('aria-pressed', 'true')

    // segundo filtro (rede) combina com o primeiro
    const combined = page.waitForRequest((r) => r.url().includes('category=musica') && r.url().includes('network=polygon'))
    await page.getByRole('button', { name: /^Polygon/ }).first().click()
    await combined
    await expect(page).toHaveURL(/category=musica.*network=polygon|network=polygon.*category=musica/)
    await settledGrid(page)
    const cards = grid.getByTestId('nft-card')
    const filteredCount = await cards.count()
    expect(filteredCount).toBeGreaterThan(0)
    await expect(page.getByText('Golden Beat #207')).toBeVisible()

    // ordenação por preço
    await page.getByRole('combobox', { name: /Ordenar por/ }).click()
    const sortRequest = page.waitForRequest((r) => r.url().includes('sort=price_asc'))
    await page.getByRole('option', { name: 'Menor preço' }).click()
    await sortRequest
    await expect(page).toHaveURL(/sort=price_asc/)

    // remove filtros para ter várias páginas; troca de filtro reinicia a página
    await page.getByRole('button', { name: 'Limpar tudo' }).click()
    await expect(page).not.toHaveURL(/category=/)
    await page.getByRole('button', { name: 'Página 2' }).click()
    await expect(page).toHaveURL(/page=2/)
    await settledGrid(page)
    const page2First = (await grid.locator('h3').first().textContent()) ?? ''
    await page.getByRole('button', { name: /^Arte digital/ }).first().click()
    await expect(page).not.toHaveURL(/page=2/)

    // histórico: voltar restaura página 2 com o mesmo conteúdo
    await page.goBack()
    await expect(page).toHaveURL(/page=2/)
    await settledGrid(page)
    await expect(grid.locator('h3').first()).toHaveText(page2First)

    // refresh mantém o estado da URL
    await page.reload()
    await settledGrid(page)
    await expect(page.getByRole('button', { name: 'Página 2' })).toHaveAttribute('aria-current', 'page')
    await expect(grid.locator('h3').first()).toHaveText(page2First)
  })

  test('busca textual pelo diálogo do cabeçalho e resultado vazio', async ({ page }) => {
    await open(page, '/')
    await page.getByRole('button', { name: 'Buscar NFTs' }).click()
    await page.getByLabel('Termo de busca').fill('Golden')
    await page.getByRole('button', { name: 'Buscar', exact: true }).click()
    await expect(page).toHaveURL(/\/mercado\?q=Golden/)
    const cards = page.getByTestId('catalog-grid').getByTestId('nft-card')
    await expect(cards.first()).toContainText('Golden')

    await page.goto('/mercado?q=inexistente-xyz')
    await expect(page.getByTestId('catalog-empty')).toContainText('Nenhum NFT encontrado')
    await page.getByRole('button', { name: 'Limpar filtros' }).click()
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
  })

  test('respostas fora de ordem não sobrescrevem a seleção atual', async ({ page }) => {
    // cenário: a 1ª requisição do catálogo demora 1,6 s; a seguinte, 150 ms
    await open(page, '/mercado', { scenario: 'out-of-order' })
    await expect(page.getByTestId('catalog-grid').getByTestId('nft-card')).toHaveCount(9)
    await page.getByRole('button', { name: 'Em alta' }).click() // lenta
    await page.getByRole('button', { name: 'Novos lançamentos' }).click() // rápida
    await expect(page).toHaveURL(/tab=new/)
    await expect(page.getByRole('button', { name: 'Novos lançamentos' })).toHaveAttribute('aria-pressed', 'true')
    await page.waitForTimeout(2000) // a resposta antiga chega depois
    await settledGrid(page)
    const newIds = await page.evaluate(async () => {
      const res = await fetch('/api/nfts?tab=new&pageSize=9')
      const body = (await res.json()) as { items: { name: string }[] }
      return body.items.map((i) => i.name)
    })
    const shown = await page.getByTestId('catalog-grid').getByTestId('nft-card').locator('h3').allInnerTexts()
    expect(shown).toEqual(newIds)
  })
})
