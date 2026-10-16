/**
 * Configuração versionada da auditoria Lighthouse.
 * Perfis: mobile (padrão do Lighthouse: Moto G Power, 4G lento simulado,
 * CPU 4x) e desktop (configuração oficial `desktop-config`).
 */
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

export const PAGES = [
  { id: 'inicio', path: '/' },
  { id: 'detalhe', path: '/nft/emerald-ape-042' },
]

export const RUNS = 3

export const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo']

export const TARGETS = { performance: 90, accessibility: 95, 'best-practices': 95, seo: 90 }

const mobileConfig = {
  extends: 'lighthouse:default',
  settings: { onlyCategories: CATEGORIES, formFactor: 'mobile', throttlingMethod: 'simulate', locale: 'pt-BR' },
}

export const PROFILES = {
  mobile: mobileConfig,
  desktop: { ...desktopConfig, settings: { ...desktopConfig.settings, onlyCategories: CATEGORIES, locale: 'pt-BR' } },
}
