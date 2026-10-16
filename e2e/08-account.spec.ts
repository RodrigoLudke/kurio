import { ANA, expect, loginUI, open, test } from './support'

const PNG_1PX = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HgAGgwJ/lK3Q6wAAAABJRU5ErkJggg==', 'base64')

test.describe('Perfil, avatar, senha e carteiras', () => {
  test('edição de perfil com erros de validação e persistência', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/conta/perfil')
    const name = page.getByLabel(/Nome de exibição/)
    await expect(name).toHaveValue(ANA.name)

    // erro local
    await name.fill('A')
    await page.getByTestId('profile-save').click()
    await expect(page.locator('#pf-displayName-error')).toContainText('2 a 40 caracteres')
    await expect(name).toBeFocused()

    // erro da API: nome de usuário em uso por outra conta
    await name.fill('Ana R.')
    await page.getByLabel(/Nome de usuário/).fill('bruno.nft')
    await page.getByTestId('profile-save').click()
    await expect(page.locator('#pf-username-error')).toContainText('já está em uso')

    await page.getByLabel(/Nome de usuário/).fill('ana.kurio')
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-status')).toContainText('Perfil salvo')
    await page.reload()
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue('Ana R.')
    await expect(page.getByTestId('user-menu')).toContainText('Ana R.')
  })

  test('avatar: rejeita arquivo grande e aceita imagem válida', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/conta/perfil')
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
    const big = { name: 'grande.png', mimeType: 'image/png', buffer: Buffer.concat([PNG_1PX, Buffer.alloc(600 * 1024)]) }
    const small = { name: 'avatar.png', mimeType: 'image/png', buffer: PNG_1PX }

    await page.getByTestId('avatar-input').setInputFiles(big)
    await expect(page.getByTestId('avatar-error')).toContainText('512 KB')
    await page.getByTestId('avatar-input').setInputFiles(small)
    await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` }).first()).toBeVisible()
    await page.reload()
    await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` }).first()).toBeVisible()
    await page.getByRole('button', { name: 'Remover' }).click()
    await expect(page.getByRole('img', { name: `Avatar de ${ANA.name}` })).toHaveCount(0)
  })

  test('alteração de senha: senha atual errada, confirmação e novo login', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, ANA, '/conta/perfil')
    await page.getByLabel('Senha atual').fill('errada123')
    await page.getByLabel('Nova senha', { exact: true }).fill('NovaSenha2026')
    await page.getByLabel('Confirmar nova senha').fill('Diferente2026')
    await page.getByTestId('profile-save').click()
    await expect(page.locator('#pf-confirm-error')).toContainText('não coincidem')

    await page.getByLabel('Confirmar nova senha').fill('NovaSenha2026')
    await page.getByTestId('profile-save').click()
    await expect(page.locator('#pf-current-error')).toContainText('senha atual está incorreta')

    await page.getByLabel('Senha atual').fill(ANA.password)
    await page.getByTestId('profile-save').click()
    await expect(page.getByTestId('profile-status')).toContainText('Senha alterada')

    await page.getByTestId('account-logout').click()
    await loginUI(page, { ...ANA, password: 'NovaSenha2026' }, '/conta/perfil')
    await expect(page.getByLabel(/Nome de exibição/)).toHaveValue(ANA.name)
  })

  test('carteiras: validação, edição da principal e cadastro da secundária', async ({ page }) => {
    await open(page, '/')
    await loginUI(page, { email: 'bruno@kurio.dev', password: 'Kurio@2026', name: 'Bruno Costa', id: 'usr_bruno' }, '/conta/carteiras')
    const primary = page.getByTestId('wallet-form-primary')
    await primary.getByLabel(/Endereço da carteira/).fill('0x123')
    await page.getByTestId('wallet-save-primary').click()
    await expect(primary.locator('#primary-address-error')).toContainText('40 caracteres')
    await primary.getByLabel(/Endereço da carteira/).fill('0x3C7d9E1f5A2b8C4d6E0f1A3b5C7d9E2f4A6b8C0D')
    await primary.getByLabel(/Apelido da carteira/).fill('Principal quente')
    await page.getByTestId('wallet-save-primary').click()
    await expect(primary.getByText('Carteira salva.')).toBeVisible()

    await page.getByTestId('add-secondary').click()
    const secondary = page.getByTestId('wallet-form-secondary')
    await secondary.getByLabel('Igual à carteira principal').click()
    await expect(secondary.getByLabel(/Nome de exibição/)).toHaveValue('Bruno Costa')
    // mesmo endereço da principal → erro de validação da API
    await secondary.getByLabel(/Apelido da carteira/).fill('Reserva fria')
    await secondary.getByLabel(/Endereço da carteira/).fill('0x3C7d9E1f5A2b8C4d6E0f1A3b5C7d9E2f4A6b8C0D')
    await page.getByTestId('wallet-save-secondary').click()
    await expect(secondary.locator('#secondary-address-error')).toContainText('já está cadastrado')
    await secondary.getByLabel(/Endereço da carteira/).fill('0x9999999999999999999999999999999999999999')
    await page.getByTestId('wallet-save-secondary').click()
    await expect(secondary.getByText('Carteira salva.')).toBeVisible()

    await page.reload()
    await expect(page.getByTestId('wallet-form-secondary').getByLabel(/Apelido da carteira/)).toHaveValue('Reserva fria')
    await expect(page.getByTestId('wallet-form-primary').getByLabel(/Apelido da carteira/)).toHaveValue('Principal quente')
  })
})
