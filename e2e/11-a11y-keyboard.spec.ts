import { ANA, expect, loginUI, open, test } from './support'

test.describe('Acessibilidade: teclado, foco e formulários', () => {
  test('link de pular conteúdo e foco visível', async ({ page }) => {
    await open(page, '/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: 'Pular para o conteúdo' })
    await expect(skip).toBeFocused()
    await expect(skip).toBeVisible()
    const outline = await skip.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/#conteudo/)
  })

  test('diálogo de busca: foco preso, Escape fecha e devolve o foco @core', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'busca do cabeçalho é desktop; no mobile o campo fica na página')
    await open(page, '/')
    const trigger = page.getByRole('button', { name: 'Buscar NFTs' })
    await trigger.focus()
    await page.keyboard.press('Enter')
    const dialog = page.getByRole('dialog', { name: 'Buscar no mercado' })
    await expect(dialog).toBeVisible()
    await expect(page.getByLabel('Termo de busca')).toBeFocused()
    // Tab circula dentro do diálogo
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true)
    }
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(trigger).toBeFocused()
  })

  test('navegação do catálogo e compra só com teclado', async ({ page }) => {
    await open(page, '/mercado')
    const filter = page.getByRole('button', { name: /^Fotografia/ }).first()
    await filter.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/category=fotografia/)
    await expect(filter).toHaveAttribute('aria-pressed', 'true')
    const link = page.getByTestId('catalog-grid').getByRole('link', { name: 'Ivory Baron #088', exact: true })
    await link.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/nft\/ivory-baron-088/)
    await page.getByRole('radio', { name: /1\/10/ }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('radio', { name: /1\/10/ })).toHaveAttribute('aria-checked', 'true')
    await page.getByTestId('add-to-cart').focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(/Ivory Baron #088 \(edição 1\/10\) adicionado/)).toBeVisible()
  })

  test('erros de formulário associados aos campos e anunciados @core', async ({ page }) => {
    await open(page, '/entrar')
    await page.getByTestId('auth-submit').click()
    const email = page.getByPlaceholder('contato@email.com')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toBeFocused()
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBe('login-email-error')
    await expect(page.locator('#login-email-error')).toHaveAttribute('role', 'alert')
    await expect(page.locator('#login-email-error')).toContainText('Informe seu e-mail')
    // diálogo de login: Escape fecha e volta para o início
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL('/')
  })

  test('imagens relevantes têm texto alternativo e não há overflow horizontal @core', async ({ page }) => {
    await open(page, '/')
    await expect(page.getByTestId('catalog-grid')).toBeVisible()
    const missingAlt = await page.locator('img:not([alt])').count()
    expect(missingAlt).toBe(0)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('sem overflow horizontal em 390, 768 e 1440 px nas telas principais', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/')
    const paths = ['/', '/mercado', '/nft/emerald-ape-042', '/carrinho', '/pagamento', '/conta/perfil', '/conta/carteiras', '/conta/atividade']
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const p of paths) {
        await page.goto(p)
        await page.waitForLoadState('networkidle')
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
        expect(overflow, `${p} @ ${width}px`).toBeLessThanOrEqual(0)
      }
    }
  })
})
