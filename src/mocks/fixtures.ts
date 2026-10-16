/**
 * Fixtures determinísticas do servidor simulado.
 *
 * - 72 NFTs com variedade de categorias, redes, preços e edições (suficiente
 *   para filtros combinados e várias páginas);
 * - 2 usuários com carteiras, favoritos e carrinho;
 * - cupons válido, de valor fixo e expirado.
 *
 * Toda a geração usa um PRNG com semente fixa: o mesmo cenário sempre produz
 * os mesmos dados (pré-requisito para regressão visual estável).
 */
import {
  CATEGORIES,
  type CategoryId,
  type EditionType,
  type ImageAsset,
  type NetworkId,
  type WalletProvider,
} from '@/api/contracts'
import { mulEth, percentOfEth, type EthString } from '@/lib/eth'

/* ------------------------------------------------------------------ */
/* Registros internos do "banco"                                       */
/* ------------------------------------------------------------------ */

export interface EditionRecord {
  type: EditionType
  price: EthString
  available: number
  supply: number | null
}

export interface NftRecord {
  id: string
  tokenId: string
  name: string
  art: ArtKey
  category: CategoryId
  collectionName: string
  network: NetworkId
  compareAtPrice: EthString | null
  badge: 'raro' | 'novo' | null
  rating: number
  reviewCount: number
  listedAt: string
  trendingScore: number
  defaultEdition: EditionType
  editions: EditionRecord[]
  attributes: string[]
  creator: string
  version: number
}

export interface UserRecord {
  id: string
  username: string
  email: string
  displayName: string
  ensName: string
  walletNickname: string
  avatarUrl: string | null
  passwordSalt: string
  /** SHA-256(salt:senha) em hex — senhas nunca são guardadas em claro */
  passwordHash: string
  createdAt: string
  updatedAt: string
}

export interface WalletRecord {
  id: string
  userId: string
  slot: 'primary' | 'secondary'
  displayName: string
  nickname: string
  network: NetworkId
  profileName: string
  address: string
  secondaryAddress: string
  provider: WalletProvider
  referralCode: string
  email: string
  ensName: string
  updatedAt: string
}

export interface CartLineRecord {
  nftId: string
  edition: EditionType
  quantity: number
  acknowledgedUnitPrice: EthString
}

export interface CartRecord {
  id: string
  owner: 'guest' | 'user'
  userId: string | null
  lines: CartLineRecord[]
  couponCode: string | null
  version: number
  updatedAt: string
}

export interface CouponRecord {
  code: string
  description: string
  kind: 'percent' | 'fixed'
  /** basis points (percent) ou ETH (fixed) */
  value: string
  expiresAt: string | null
}

/* ------------------------------------------------------------------ */
/* Arte                                                                */
/* ------------------------------------------------------------------ */

export type ArtKey = 'emerald' | 'sage' | 'baron' | 'golden'

const ART: Record<ArtKey, { sizes: number[]; description: string }> = {
  emerald: { sizes: [128, 256, 440], description: 'macaco de pelagem castanha com óculos redondos e jaqueta verde de colégio' },
  sage: { sizes: [128, 250], description: 'gorila grisalho com chapéu bucket verde e moletom lilás' },
  baron: { sizes: [128, 250], description: 'gorila de pelagem escura com blazer creme e gola alta verde' },
  golden: { sizes: [128, 250], description: 'orangotango dourado com fones de ouvido verdes e jaqueta clara' },
}

export function imageFor(art: ArtKey, name: string): ImageAsset {
  const { sizes, description } = ART[art]
  const largest = sizes[sizes.length - 1] ?? 250
  return {
    src: `/images/${art}-${largest}.webp`,
    srcSet: sizes.map((s) => `/images/${art}-${s}.webp ${s}w`).join(', '),
    width: largest,
    height: largest,
    alt: `${name}: ilustração de ${description}`,
  }
}

/* ------------------------------------------------------------------ */
/* PRNG determinístico                                                 */
/* ------------------------------------------------------------------ */

export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ------------------------------------------------------------------ */
/* NFTs                                                                */
/* ------------------------------------------------------------------ */

interface Seed {
  name: string
  art: ArtKey
  price: EthString
  compareAt?: EthString
  badge?: 'raro' | 'novo'
  category?: CategoryId
  network?: NetworkId
}

/** Os 9 primeiros reproduzem a primeira página do layout. */
const HEAD: Seed[] = [
  { name: 'Emerald Ape #042', art: 'emerald', price: '1.19', category: 'arte-digital', network: 'ethereum' },
  { name: 'Sage Nomad #009', art: 'sage', price: '1.69', category: 'arte-digital', network: 'ethereum' },
  { name: 'Neon Vessel #552', art: 'baron', price: '1.99', compareAt: '2.29', badge: 'raro', category: 'colecionaveis', network: 'ethereum' },
  { name: 'Cosmic Bloom #118', art: 'sage', price: '1.29', category: 'generativa', network: 'polygon' },
  { name: 'Violet Nomad #314', art: 'sage', price: '1.39', category: 'arte-digital', network: 'ethereum' },
  { name: 'Ivory Baron #088', art: 'baron', price: '1.79', category: 'fotografia', network: 'ethereum' },
  { name: 'Golden Beat #207', art: 'golden', price: '0.99', category: 'musica', network: 'polygon' },
  { name: 'Golden Frequency #071', art: 'golden', price: '0.59', category: 'musica', network: 'solana' },
  { name: 'Golden Signal #160', art: 'golden', price: '0.39', category: 'musica', network: 'solana' },
]

const NAME_POOL: Record<ArtKey, string[]> = {
  emerald: ['Bronze Scholar', 'Amber Racer', 'Jade Captain', 'Copper Drift', 'Mocha Pilot', 'Cedar Dreamer', 'Hazel Rebel', 'Walnut Sage', 'Emerald Echo', 'Chestnut Flux', 'Pine Courier', 'Topaz Ranger', 'Cocoa Comet', 'Malachite Kid', 'Umber Knight'],
  sage: ['Lilac Wanderer', 'Misty Hiker', 'Plum Voyager', 'Lavender Monk', 'Fog Pilgrim', 'Orchid Drifter', 'Heather Scout', 'Mauve Rambler', 'Slate Dreamer', 'Iris Nomad', 'Amethyst Trail', 'Silver Bloom', 'Thistle Roamer', 'Dusk Hiker', 'Wisteria Way'],
  baron: ['Onyx Curator', 'Midnight Tailor', 'Obsidian Poet', 'Velvet Duke', 'Ebony Critic', 'Charcoal Count', 'Raven Banker', 'Ink Marquis', 'Shadow Patron', 'Noir Archivist', 'Coal Diplomat', 'Graphite Lord', 'Sable Collector', 'Jet Ambassador', 'Basalt Regent'],
  golden: ['Saffron Echo', 'Honey Rhythm', 'Sunlit Tempo', 'Marigold Groove', 'Citrine Pulse', 'Amber Chorus', 'Mango Melody', 'Ochre Cadence', 'Butter Bass', 'Gilded Loop', 'Apricot Synth', 'Canary Verse', 'Tangerine Hook', 'Brass Harmony', 'Solar Riff'],
}

const ATTRIBUTE_POOL: Record<ArtKey, string[]> = {
  emerald: ['Óculos', 'Esmeralda', 'Jaqueta varsity', 'Corrente dourada'],
  sage: ['Chapéu bucket', 'Moletom', 'Pelagem prateada', 'Olhar sereno'],
  baron: ['Blazer', 'Gola alta', 'Brinco', 'Pelagem ônix'],
  golden: ['Fones', 'Pelagem dourada', 'Jaqueta bomber', 'Aura musical'],
}

const CREATORS = ['Nova Sato', 'Lia Moreau', 'Kai Ventura', 'Rafa Okoye', 'Mina Duarte']
const COLLECTIONS: Record<ArtKey, string> = {
  emerald: 'Kurio Apes',
  sage: 'Nomad Society',
  baron: 'Velvet Barons',
  golden: 'Golden Frequencies',
}

function pad(n: number, size: number) {
  return String(n).padStart(size, '0')
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/#/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildEditions(price: EthString, rand: () => number, index: number): { editions: EditionRecord[]; defaultEdition: EditionType } {
  // índices fixos garantem casos de borda reproduzíveis
  const oneOfOneSold = index % 4 === 1 // 1/1 esgotada em 1 a cada 4
  const openUnavailable = index % 5 === 2 // edição aberta indisponível em 1 a cada 5
  const lowStock = index === 2 || index % 11 === 7 // 1/50 com estoque baixo
  const editions: EditionRecord[] = [
    { type: '1/1', price: mulEth(price, 4), available: oneOfOneSold ? 0 : 1, supply: 1 },
    { type: '1/10', price: percentOfEth(price, 18_000), available: 3 + Math.floor(rand() * 7), supply: 10 },
    { type: '1/50', price, available: lowStock ? 2 : 12 + Math.floor(rand() * 30), supply: 50 },
    { type: 'aberta', price: percentOfEth(price, 6_000), available: openUnavailable ? 0 : 999, supply: null },
  ]
  return { editions, defaultEdition: '1/50' }
}

function roundPrice(raw: number): EthString {
  // gera valores com 2 casas a partir de inteiros (sem float na string final)
  const cents = Math.max(2, Math.round(raw * 100))
  return `${Math.floor(cents / 100)}.${pad(cents % 100, 2)}`
}

export function buildNfts(): NftRecord[] {
  const rand = mulberry32(20261015)
  const records: NftRecord[] = []
  const seeds: Seed[] = [...HEAD]
  const arts: ArtKey[] = ['emerald', 'sage', 'baron', 'golden']
  let poolIndex = 0
  while (seeds.length < 72) {
    const art = arts[seeds.length % arts.length]!
    const base = NAME_POOL[art][poolIndex % NAME_POOL[art].length]!
    if (seeds.length % arts.length === arts.length - 1) poolIndex++
    const number = pad(Math.floor(rand() * 900) + 10, 3)
    const priceBucket = rand()
    const price =
      priceBucket < 0.15 ? roundPrice(0.02 + rand() * 0.3) : priceBucket < 0.85 ? roundPrice(0.3 + rand() * 2.7) : roundPrice(3 + rand() * 9.3)
    const hasCompare = rand() < 0.12
    seeds.push({
      name: `${base} #${number}`,
      art,
      price,
      compareAt: hasCompare ? roundPrice(Number(price) * 1.2) : undefined,
      badge: rand() < 0.1 ? 'raro' : undefined,
    })
  }

  const start = Date.UTC(2026, 9, 10, 15, 0, 0)
  seeds.forEach((seed, index) => {
    const category = seed.category ?? CATEGORIES[Math.floor(rand() * CATEGORIES.length)]!
    const network: NetworkId = seed.network ?? (['ethereum', 'ethereum', 'polygon', 'solana'] as const)[Math.floor(rand() * 4)]!
    const { editions, defaultEdition } = buildEditions(seed.price, rand, index)
    const tokenNumber = seed.name.split('#')[1] ?? pad(index, 3)
    const attrs = [...ATTRIBUTE_POOL[seed.art]].sort(() => rand() - 0.5).slice(0, 2)
    records.push({
      id: slugify(seed.name),
      tokenId: `#${pad(Number(tokenNumber), 4)}`,
      name: seed.name,
      art: seed.art,
      category,
      collectionName: COLLECTIONS[seed.art],
      network,
      compareAtPrice: seed.compareAt ?? null,
      badge: seed.badge ?? (index >= 60 ? 'novo' : null),
      rating: 4 + Math.round(rand() * 10) / 10,
      reviewCount: 3 + Math.floor(rand() * 40),
      listedAt: new Date(start - index * 3_600_000 * 7).toISOString(),
      trendingScore: Math.floor(rand() * 1000),
      defaultEdition,
      editions,
      attributes: [...attrs, seed.badge === 'raro' ? 'Raro' : 'Edição limitada'],
      creator: CREATORS[index % CREATORS.length]!,
      version: 1,
    })
  })
  // ajustes do layout de referência
  const emerald = records[0]!
  emerald.rating = 4.8
  emerald.reviewCount = 19
  emerald.attributes = ['Óculos', 'Esmeralda', 'Raro']
  emerald.creator = 'Nova Sato'
  return records
}

/* ------------------------------------------------------------------ */
/* Usuários, carteiras, cupons                                         */
/* ------------------------------------------------------------------ */

export const DEMO_PASSWORD = 'Kurio@2026'

export function buildUsers(): UserRecord[] {
  const created = '2026-06-01T12:00:00.000Z'
  return [
    {
      id: 'usr_ana',
      username: 'ana.kurio',
      email: 'ana@kurio.dev',
      displayName: 'Ana Ribeiro',
      ensName: 'ana',
      walletNickname: 'Cofre principal',
      avatarUrl: null,
      passwordSalt: 's4lt-ana-01',
      passwordHash: '53e438c6d571de2db7e2ff9938c468b749acdea9edbc0727cf06f3c42e1e2ba3',
      createdAt: created,
      updatedAt: created,
    },
    {
      id: 'usr_bruno',
      username: 'bruno.nft',
      email: 'bruno@kurio.dev',
      displayName: 'Bruno Costa',
      ensName: 'bruno',
      walletNickname: 'Carteira quente',
      avatarUrl: null,
      passwordSalt: 's4lt-bruno-02',
      passwordHash: '870a8f8e4dc8850a1b536c7c2db4df68ed7e449893cde16d00b4c65cb089f078',
      createdAt: created,
      updatedAt: created,
    },
  ]
}

export function buildWallets(): WalletRecord[] {
  const updated = '2026-06-01T12:00:00.000Z'
  return [
    {
      id: 'wal_ana_primary',
      userId: 'usr_ana',
      slot: 'primary',
      displayName: 'Ana Ribeiro',
      nickname: 'Principal',
      network: 'ethereum',
      profileName: 'ana.kurio',
      address: '0xA91F3c5D7e2B4a8C9f01D6E3b7A5c4F2e9D1E82C',
      secondaryAddress: '',
      provider: 'metamask',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'ana',
      updatedAt: updated,
    },
    {
      id: 'wal_ana_secondary',
      userId: 'usr_ana',
      slot: 'secondary',
      displayName: 'Ana Ribeiro',
      nickname: 'Reserva',
      network: 'polygon',
      profileName: 'ana.kurio',
      address: '0x5B2e8F4a1C9D3b7E6f0A2c4D8e1F3a5B7c9D0E11',
      secondaryAddress: 'nova.kurio.eth',
      provider: 'coinbase',
      referralCode: 'KURIO-ANA',
      email: 'ana@kurio.dev',
      ensName: 'nova.kurio',
      updatedAt: updated,
    },
    {
      id: 'wal_bruno_primary',
      userId: 'usr_bruno',
      slot: 'primary',
      displayName: 'Bruno Costa',
      nickname: 'Principal',
      network: 'ethereum',
      profileName: 'bruno.nft',
      address: '0x3C7d9E1f5A2b8C4d6E0f1A3b5C7d9E2f4A6b8C0D',
      secondaryAddress: '',
      provider: 'walletconnect',
      referralCode: 'KURIO-BRUNO',
      email: 'bruno@kurio.dev',
      ensName: 'bruno',
      updatedAt: updated,
    },
  ]
}

export function buildCoupons(): CouponRecord[] {
  return [
    { code: 'KURIO10', description: '10% de desconto no lançamento', kind: 'percent', value: '1000', expiresAt: null },
    { code: 'LANCAMENTO', description: '0.05 ETH de desconto no lançamento', kind: 'fixed', value: '0.05', expiresAt: null },
    { code: 'GENESIS24', description: 'Cupom da coleção gênesis', kind: 'percent', value: '1500', expiresAt: '2025-12-31T23:59:59.000Z' },
  ]
}

export const NETWORK_FEES: Record<NetworkId, EthString> = {
  ethereum: '0.016',
  polygon: '0.002',
  solana: '0.001',
}

export const NFT_COPY = {
  description: (_name: string, collection: string, network: string) =>
    `Um colecionável digital finalizado à mão da coleção ${collection}, verificado na ${network}, com arte desbloqueável e acesso para colecionadores.`,
  long: (name: string, collection: string, network: string, creator: string, royalties: number) => [
    `${name} é uma obra digital finalizada à mão da coleção ${collection}. Cada atributo fica armazenado nos metadados do token e verificado na ${network}. A obra explora identidade, movimento e luz em um mundo digital sem fronteiras.`,
    `A propriedade inclui a arte em alta resolução, lançamentos exclusivos para colecionadores e um registro permanente de procedência registrada na rede. ${creator} recebe ${royalties}% de direitos autorais nas vendas secundárias, apoiando novos trabalhos e lançamentos da comunidade.`,
  ],
}

export const REVIEW_POOL = [
  { author: 'lia.eth', comment: 'Acabamento impecável e metadados completos. Chegou na carteira em segundos.' },
  { author: 'kai.nft', comment: 'A paleta é ainda mais bonita em alta resolução. Vale cada edição.' },
  { author: 'rafa.collects', comment: 'Ótima procedência e comunidade ativa em torno da coleção.' },
  { author: 'mina.art', comment: 'Arte desbloqueável muito bem cuidada. Recomendo a edição 1/10.' },
]
