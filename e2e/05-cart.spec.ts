import { ANA, expect, isMobile, loginUI, open, test } from './support'

test.describe('Carrinho', () => {
  test('quantidades, remoção, cupom e persistência após refresh e login @core', async ({ page }) => {
    const mobile = isMobile(test.info())
    await open(page, '/nft/golden-beat-207')
    // visitante adiciona 2 unidades da edição 1/50
    await page.getByRole('button', { name: 'Aumentar quantidade de Golden Beat #207' }).first().click()
    if (mobile) await page.getByRole('button', { name: 'Adicionar ao carrinho' }).last().click()
    else await page.getByTestId('add-to-cart').click()
    await expect(page.getByText(/2× Golden Beat #207.*adicionado/)).toBeVisible()
    await page.goto('/mercado')
    await page.goto('/nft/golden-signal-160')
    if (mobile) await page.getByRole('button', { name: 'Adicionar ao carrinho' }).last().click()
    else await page.getByTestId('add-to-cart').click()
    await expect(page.getByText(/Golden Signal #160.*adicionado/)).toBeVisible()

    await page.goto('/carrinho')
    const summaryTotal = page.locator('[data-testid=summary-total]:visible')
    // 2 × 0.99 + 1 × 0.39 + taxa 0.016
    await expect(page.locator('[data-testid=summary-subtotal]:visible')).toHaveText('2.37 ETH')
    await expect(summaryTotal).toHaveText('2.386 ETH')

    // altera quantidade e remove
    await page.getByRole('button', { name: 'Aumentar quantidade de Golden Signal #160' }).first().click()
    await expect(page.locator('[data-testid=summary-subtotal]:visible')).toHaveText('2.76 ETH')
    await page.getByRole('button', { name: 'Remover Golden Signal #160 do carrinho' }).first().click()
    await expect(page.locator('[data-testid=summary-subtotal]:visible')).toHaveText('1.98 ETH')

    // cupom inválido, expirado e válido
    const input = page.locator('[data-testid=coupon-input]:visible')
    await input.fill('NAOEXISTE')
    await page.getByRole('button', { name: 'Aplicar' }).first().click()
    await expect(page.locator('[data-testid=coupon-error]:visible')).toContainText('Cupom inválido')
    await input.fill('GENESIS24')
    await page.getByRole('button', { name: 'Aplicar' }).first().click()
    await expect(page.locator('[data-testid=coupon-error]:visible')).toContainText('expirou')
    await input.fill('KURIO10')
    await page.getByRole('button', { name: 'Aplicar' }).first().click()
    await expect(page.locator('[data-testid=coupon-applied]:visible')).toContainText('KURIO10')
    await expect(page.locator('[data-testid=summary-discount]:visible')).toHaveText('(-) 0.198 ETH')
    await expect(summaryTotal).toHaveText('1.798 ETH')

    // refresh mantém carrinho e cupom
    await page.reload()
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('1.798 ETH')

    // remover cupom
    await page.getByRole('button', { name: 'Remover cupom KURIO10' }).first().click()
    await expect(page.locator('[data-testid=summary-total]:visible')).toHaveText('1.996 ETH')

    // ao entrar, os itens do visitante são mesclados ao carrinho da conta
    await loginUI(page, ANA, '/carrinho')
    const lines = mobile ? page.getByTestId('cart-line-mobile') : page.getByTestId('cart-line')
    await expect(lines).toHaveCount(4)
    await expect(lines.filter({ hasText: 'Golden Beat #207' })).toHaveCount(1)
    await page.reload()
    await expect(lines).toHaveCount(4)
  })

  test('respeita a disponibilidade por edição', async ({ page }) => {
    await open(page, '/nft/neon-vessel-552')
    await page.getByRole('button', { name: 'Aumentar quantidade de Neon Vessel #552' }).first().click()
    await page.getByTestId('add-to-cart').click()
    await expect(page.getByText(/Neon Vessel #552.*adicionado/)).toBeVisible()
    await page.goto('/carrinho')
    const plus = page.getByRole('button', { name: 'Aumentar quantidade de Neon Vessel #552' }).first()
    await expect(plus).toBeDisabled()
    // a API também recusa acima do limite
    const status = await page.evaluate(async () => {
      const cart = JSON.parse(localStorage.getItem('kurio.guest-cart.v1') ?? '""') as string
      const res = await fetch('/api/cart/items/neon-vessel-552%3A1%2F50', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Cart-Id': cart },
        body: JSON.stringify({ quantity: 5 }),
      })
      return { status: res.status, body: await res.json() }
    })
    expect(status.status).toBe(409)
    expect(status.body.error.code).toBe('AVAILABILITY_CONFLICT')
  })
})
