# Kurio — Marketplace de NFTs

Implementação do desafio frontend ([enunciado](docs/DESAFIO.md)): marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop, tablet e mobile — tudo funcionando sobre uma API REST e um servidor Socket.IO **simulados com MSW na camada de rede**.

| Responsabilidade | Tecnologia | Onde |
| --- | --- | --- |
| Interface | React 19 + TypeScript 6 | `src/` |
| Roteamento, search params e rotas privadas | TanStack Router | `src/router.tsx` |
| Estado remoto e cache | TanStack Query | `src/queries/` |
| Cliente HTTP | Axios | `src/api/client.ts`, `src/api/endpoints.ts` |
| Tempo real | `socket.io-client` | `src/realtime/` |
| Estilos / componentes | Tailwind CSS v4 + shadcn/ui (Radix) | `src/index.css`, `src/components/ui/` |
| Mocks REST + Socket.IO | MSW 2 + `@mswjs/socket.io-binding` | `src/mocks/` |
| E2E e regressão visual | Playwright | `e2e/` |
| Auditoria | Lighthouse | `lighthouse/` |

Documentação técnica: [ARCHITECTURE.md](ARCHITECTURE.md) · Contratos REST e eventos: [docs/CONTRATOS.md](docs/CONTRATOS.md)

---

## 1. Setup

Requisitos: **Node.js ≥ 20.19** (testado com 22.22) e npm.

```bash
npm ci                      # instala exatamente o lockfile
npx playwright install chromium   # navegador dos testes (uma vez)
npm run dev                 # http://localhost:5173 (mocks ativos)
```

Nenhum backend, serviço privado ou chave é necessário: a partir de um checkout limpo, o servidor simulado sobe no próprio navegador.

## 2. Variáveis de ambiente

Definidas em `.env` (versionado, valores de demonstração) e documentadas em `.env.example`:

| Variável | Padrão | Descrição |
| --- | --- | --- |
| `VITE_ENABLE_MOCKS` | `true` | Ativa o servidor simulado (MSW REST + Socket.IO). Com `false`, nenhum código de mock entra no bundle e a app aponta para uma API real. |
| `VITE_API_BASE_URL` | `/api` | Base das rotas REST usadas pelo Axios. |
| `VITE_REALTIME_URL` | `wss://realtime.kurio.mock` | URL do Socket.IO (interceptada pelo MSW quando os mocks estão ativos). |
| `VITE_MOCK_PANEL` | `true` | Mostra o botão **Simulação** (painel de cenários). |
| `VITE_HTTP_TIMEOUT_MS` | `8000` | Timeout das requisições HTTP. |

## 3. Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Desenvolvimento com mocks (Vite + HMR) |
| `npm run build` | Verifica tipos e gera o build de produção em `dist/` (com mocks, como no deploy) |
| `npm run preview` | Serve o build em `http://localhost:4173` |
| `npm run typecheck` | `tsc -b --noEmit` |
| `npm run lint` | ESLint (TypeScript + regras de hooks) |
| `npm run test:e2e` | Playwright (builda, sobe o preview e roda desktop + mobile) |
| `npm run test:e2e:update` | Regera as baselines visuais |
| `npm run test:e2e:report` | Abre o relatório HTML (`playwright-report/`) |
| `npm run lighthouse` | Auditoria Lighthouse (rode `npm run build` antes) |
| `npm run verify` | typecheck + lint + build + E2E |

## 4. Credenciais fictícias

| Usuário | E-mail | Senha | Estado inicial |
| --- | --- | --- | --- |
| Ana Ribeiro | `ana@kurio.dev` | `Kurio@2026` | 2 carteiras (Principal/MetaMask/Ethereum e Reserva/Coinbase/Polygon), 2 favoritos e carrinho com 3 NFTs (o mesmo do layout: total 26.846 ETH) |
| Bruno Costa | `bruno@kurio.dev` | `Kurio@2026` | 1 carteira (WalletConnect), sem favoritos, carrinho vazio |

Cupons: `KURIO10` (10%), `LANCAMENTO` (0,05 ETH), `GENESIS24` (**expirado**); qualquer outro código é inválido.

Senhas são guardadas apenas como hash SHA‑256 com salt no banco simulado; o cliente guarda só o token opaco da sessão.

## 5. Cenários de simulação e reset

O servidor simulado tem cenários determinísticos (dados com semente fixa, latências reprodutíveis). Há três formas de escolher:

1. **Painel “Simulação”** (canto inferior esquerdo; no mobile, aba lateral): troca cenário, latência, modo offline, dispara mudanças de preço/estoque, reenvia eventos, derruba o Socket.IO, expira sessões, confirma/recusa pedidos pendentes e **restaura tudo** (“Restaurar dados e cenário padrão”).
2. **URL de inicialização**: `?mock-scenario=<id>` e/ou `?mock-reset=1` em qualquer rota (os parâmetros são removidos da barra após aplicados). Ex.: `http://localhost:5173/mercado?mock-reset=1&mock-scenario=slow`.
3. **Plano de controle REST** (usado pelos testes): `POST /api/__mock/scenario { "id": "slow" }`, `POST /api/__mock/reset`, etc. — ver [docs/CONTRATOS.md](docs/CONTRATOS.md#plano-de-controle-dos-mocks).

| Cenário (`id`) | Efeito |
| --- | --- |
| `default` | Sucesso; latência variável 60–220 ms (semente fixa); pagamento confirmado em 2,5 s |
| `slow` | 2,5 s em toda requisição (skeletons) |
| `variable-latency` | 0,2–2,2 s com semente fixa |
| `out-of-order` | No catálogo, a 1ª requisição demora 1,6 s e a 2ª 150 ms (resposta antiga chega depois) |
| `offline` | Toda chamada REST falha como erro de rede |
| `server-error` | `GET /nfts` → 500 e `GET /nfts/:id` → 503 |
| `empty-catalog` | Catálogo sem resultados |
| `favorites-failure` | `PUT/DELETE /favorites/*` → 500 (rollback do otimista) |
| `short-session` | Sessões expiram em 45 s |
| `price-change-checkout` | 1,2 s após a cotação, o preço do 1º item sobe 0,10 ETH (evento `nft.updated`) |
| `sold-out-checkout` | 1,2 s após a cotação, a edição do 1º item esgota |
| `order-timeout` | O pedido é criado, mas a 1ª resposta só sai depois do timeout do cliente |
| `payment-declined` | Pagamentos são recusados |
| `payment-manual` | Pedidos ficam pendentes até confirmação/recusa pelo painel |
| `wallet-reject` | A carteira recusa a conexão |

O estado simulado (banco + cenário) persiste em `localStorage` para sustentar refresh; o reset restaura integralmente as fixtures.

## 6. Reproduzindo os fluxos de falha

| Fluxo | Como reproduzir |
| --- | --- |
| Busca/filtros/paginação + histórico | `/mercado`: combine coleção, rede, preço e ordenação; mude de página; use voltar/avançar e F5 |
| Respostas fora de ordem | cenário `out-of-order`; clique rápido em “Em alta” e depois “Novos lançamentos” — a lista final é sempre a da última aba |
| Skeletons e retry | cenário `slow` (skeletons); cenário `server-error` → “Tentar novamente” após voltar ao `default` |
| NFT inexistente | `/nft/qualquer-coisa` · rota inexistente: `/rota/qualquer` |
| Edição indisponível / limite | `/nft/sage-nomad-009` (1/1 esgotada) · `/nft/neon-vessel-552` (1/50 com 2 unidades) |
| Favorito com rollback | entre como Ana, cenário `favorites-failure`, clique em **Favoritar** |
| Cupom inválido/expirado | carrinho → `NAOEXISTE` / `GENESIS24` |
| Sessão expirada | logado em `/conta/carteiras`, painel → “Expirar sessão agora”, navegue para “Atividade” (ou use `short-session` no checkout) — você volta ao mesmo ponto após entrar |
| Preço muda com item no carrinho | Ana em `/carrinho`, painel → “Preço +0,10 ETH” em Emerald Ape → aviso, resumo atualizado e checkout bloqueado até confirmar |
| Cotação desatualizada no checkout | revise o pedido e, com o diálogo aberto, altere o preço no painel (ou cenário `price-change-checkout`) |
| Edição esgota durante a compra | cenário `sold-out-checkout` |
| Pagamento recusado | cenário `payment-declined` → itens preservados, “Tentar novamente” |
| Timeout com idempotência | cenário `order-timeout` → aviso de rede lenta, reenvio com a **mesma** chave e o **mesmo** pedido |
| Queda do Socket.IO com pedido pendente | cenário `payment-manual`, confirme a compra, painel → “Derrubar conexão (5 s)”, confirme o pedido pelo painel; recarregue a página quando quiser |
| Duplicata / evento antigo | painel → “Reenviar último evento” e “Enviar evento antigo”: nada regride |
| Carteira recusa / desconecta | cenário `wallet-reject`; ou, com carteira conectada no checkout, painel → “Desconectar” |

## 7. Testes E2E (Playwright)

```bash
npm run test:e2e            # build + preview + 65 testes (desktop-chromium completo, mobile-chromium @core/@visual)
npm run test:e2e:report     # relatório HTML; traces são mantidos para testes que falharem
```

- 13 arquivos cobrindo os 12 cenários do enunciado + regressão visual (início, detalhe, carrinho e pagamento) em desktop (1440×900) e mobile (Pixel 7, 390×844).
- Cada teste usa um contexto novo (storage vazio → fixtures limpas) e `?mock-reset=1`; o tempo é controlado com `page.clock` nos cenários de expiração; latência e eventos são disparados pelo plano de controle do MSW. Os testes de tempo real passam pelo `socket.io-client` e os de REST pelos handlers MSW.
- Baselines em `e2e/__screenshots__/` foram geradas em Linux (Chromium 141). Em outro SO, gere as suas com `npm run test:e2e:update` ou rode no container oficial `mcr.microsoft.com/playwright:v1.56.1-jammy` para comparar com as versionadas.
- Para rodar contra um servidor já ativo: `E2E_BASE_URL=http://localhost:5173 npx playwright test`.

## 8. Lighthouse

```bash
npm run build && npm run lighthouse
```

Três medições por página (início e detalhe) e perfil (mobile/desktop), com perfil de navegador limpo a cada execução. Relatórios HTML/JSON, `summary.json` e `summary.md` ficam em `lighthouse/reports/`; a configuração está versionada em `lighthouse/config.mjs`.

Medianas obtidas (Lighthouse 13.5, Chromium 141, Linux 2 vCPU):

| Página | Perfil | Performance | Accessibility | Best Practices | SEO | LCP | CLS | TBT |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Início | mobile | **76** | 100 | 100 | 100 | 3,9 s | 0 | 416 ms |
| Detalhe | mobile | **77** | 100 | 100 | 100 | 4,0 s | 0 | 291 ms |
| Início | desktop | 99 | 100 | 100 | 100 | 0,77 s | 0 | 10 ms |
| Detalhe | desktop | 99 | 100 | 100 | 100 | 0,86 s | 0 | 0 ms |

Performance mobile ficou abaixo de 90; a análise das causas e o que foi feito está em [ARCHITECTURE.md › Performance](ARCHITECTURE.md#10-performance-e-lighthouse).

## 9. Deploy

O build de produção já inclui os mocks (`VITE_ENABLE_MOCKS=true`), então o deploy é estático:

- **Vercel**: importe o repositório; `vercel.json` define build (`npm run build`), saída (`dist`), fallback SPA para acesso direto/refresh de qualquer rota e cache dos assets. O `mockServiceWorker.js` é servido da raiz sem cache.
- **Netlify / Cloudflare Pages**: build `npm run build`, diretório `dist`; `public/_redirects` faz o fallback SPA.

Depois do deploy, abra a URL pública: o Service Worker do MSW registra na primeira visita e o Socket.IO simulado conecta automaticamente.

## 10. Estrutura

```
src/
  api/            contratos tipados, cliente Axios, erros normalizados, sessão
  queries/        hooks TanStack Query (catálogo, carrinho, favoritos, conta, pedidos)
  realtime/       cliente Socket.IO (dedupe/versão) e ponte com o cache
  router.tsx      rotas, search params do catálogo e proteção de rotas privadas
  pages/          telas (início, mercado, detalhe, carrinho, pagamento, pedido, auth, conta)
  features/       catálogo, NFT, carrinho, checkout, painel de simulação
  components/     layout (header/footer/nav), formulário, ui (shadcn/ui)
  lib/            aritmética ETH, validação compartilhada, anúncios acessíveis
  mocks/          servidor simulado: fixtures, banco, regras, handlers REST, Socket.IO, cenários
e2e/              Playwright + baselines visuais
lighthouse/       configuração, script e relatórios
```
