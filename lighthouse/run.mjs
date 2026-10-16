/**
 * Auditoria Lighthouse: build otimizado + cenário padrão dos mocks.
 *
 *   npm run build && npm run lighthouse
 *
 * Executa 3 medições por página e perfil (mobile/desktop), salva relatórios
 * HTML/JSON em lighthouse/reports/ e gera summary.json/summary.md com as
 * medianas por categoria, LCP, CLS, TBT, versões e ambiente.
 *
 * Variáveis: LH_BASE_URL (padrão: sobe `vite preview` na porta 4174),
 * CHROME_PATH (padrão: Chromium do Playwright).
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as chromeLauncher from 'chrome-launcher'
import lighthouse from 'lighthouse'
import { CATEGORIES, PAGES, PROFILES, RUNS, TARGETS } from './config.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const reportsDir = path.join(root, 'reports')
const PORT = 4174

async function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const { chromium } = await import('playwright')
  return chromium.executablePath()
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      /* ainda subindo */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Servidor não respondeu em ${url}`)
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

async function main() {
  let server
  let baseUrl = process.env.LH_BASE_URL
  if (!baseUrl) {
    baseUrl = `http://localhost:${PORT}`
    server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(root, '..'), stdio: 'ignore' })
    await waitFor(baseUrl)
  }
  await fs.rm(reportsDir, { recursive: true, force: true })
  await fs.mkdir(reportsDir, { recursive: true })

  const executable = await chromePath()
  const results = []
  let chromeVersion = ''
  let lighthouseVersion = ''

  try {
    for (const [profile, config] of Object.entries(PROFILES)) {
      for (const page of PAGES) {
        const runs = []
        for (let i = 1; i <= RUNS; i++) {
          // perfil limpo a cada medição: sem cache, storage ou Service Worker prévios
          const chrome = await chromeLauncher.launch({
            chromePath: executable,
            chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
          })
          try {
            const url = `${baseUrl}${page.path}`
            const result = await lighthouse(url, { port: chrome.port, output: ['html', 'json'], logLevel: 'error' }, config)
            const lhr = result.lhr
            lighthouseVersion = lhr.lighthouseVersion
            chromeVersion = lhr.environment.hostUserAgent
            const base = `${page.id}-${profile}-${i}`
            await fs.writeFile(path.join(reportsDir, `${base}.html`), result.report[0])
            await fs.writeFile(path.join(reportsDir, `${base}.json`), result.report[1])
            const run = {
              run: i,
              scores: Object.fromEntries(CATEGORIES.map((c) => [c, Math.round((lhr.categories[c]?.score ?? 0) * 100)])),
              lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
              cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(3)),
              tbtMs: Math.round(lhr.audits['total-blocking-time'].numericValue),
              fcpMs: Math.round(lhr.audits['first-contentful-paint'].numericValue),
              runWarnings: lhr.runWarnings,
            }
            runs.push(run)
            console.log(`${profile.padEnd(7)} ${page.id.padEnd(8)} #${i}`, run.scores, `LCP ${run.lcpMs}ms CLS ${run.cls} TBT ${run.tbtMs}ms`)
          } finally {
            await chrome.kill()
          }
        }
        results.push({
          profile,
          page: page.id,
          path: page.path,
          runs,
          median: {
            ...Object.fromEntries(CATEGORIES.map((c) => [c, median(runs.map((r) => r.scores[c]))])),
            lcpMs: median(runs.map((r) => r.lcpMs)),
            cls: median(runs.map((r) => r.cls)),
            tbtMs: median(runs.map((r) => r.tbtMs)),
          },
        })
      }
    }
  } finally {
    server?.kill()
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    tools: {
      lighthouse: lighthouseVersion,
      chrome: chromeVersion,
      node: process.version,
    },
    environment: {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      cpus: `${os.cpus().length}× ${os.cpus()[0]?.model ?? 'desconhecida'}`,
      memoryGb: Math.round(os.totalmem() / 1024 ** 3),
      conditions: 'Build de produção (vite build) servido por vite preview; cenário padrão dos mocks (MSW + Socket.IO); perfil de navegador limpo por medição; throttling simulado do Lighthouse.',
    },
    runsPerPage: RUNS,
    targets: TARGETS,
    results,
  }
  await fs.writeFile(path.join(reportsDir, 'summary.json'), JSON.stringify(summary, null, 2))

  const rows = results.map((r) => {
    const m = r.median
    const cell = (c) => `${m[c]}${m[c] < TARGETS[c] ? ' ⚠' : ''}`
    return `| ${r.page} | ${r.profile} | ${cell('performance')} | ${cell('accessibility')} | ${cell('best-practices')} | ${cell('seo')} | ${m.lcpMs} ms | ${m.cls} | ${m.tbtMs} ms |`
  })
  const md = [
    '# Lighthouse — medianas de 3 execuções',
    '',
    `Gerado em ${summary.generatedAt} · Lighthouse ${lighthouseVersion} · Node ${process.version}`,
    '',
    `Navegador: ${chromeVersion}`,
    '',
    `Ambiente: ${summary.environment.os}, ${summary.environment.cpus}, ${summary.environment.memoryGb} GB`,
    '',
    '| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...rows,
    '',
    '⚠ = abaixo da meta (Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, SEO ≥ 90).',
    '',
  ].join('\n')
  await fs.writeFile(path.join(reportsDir, 'summary.md'), md)
  console.log('\n' + md)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
