import { Link } from '@tanstack/react-router'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { errorMessage } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { CatalogSection } from '@/features/catalog/catalog-section'
import { NftImage } from '@/features/nft/nft-image'
import { cn } from '@/lib/utils'
import { useFeatured } from '@/queries/catalog'
import { usePageTitle } from '@/lib/use-page-title'

const SLIDES = [
  {
    id: 'futuro',
    eyebrow: 'Bem-vindo à Kurio',
    title: ['SEJA DONO DO FUTURO', 'DA ARTE DIGITAL'],
    mobileTitle: ['SEJA DONO DA', 'CULTURA DIGITAL'],
    text: 'Descubra NFTs selecionados de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
    image: { src: '/images/emerald-440.webp', srcSet: '/images/emerald-256.webp 256w, /images/emerald-440.webp 440w', alt: 'Emerald Ape #042: macaco de óculos redondos e jaqueta verde de colégio' },
    nftId: 'emerald-ape-042',
  },
  {
    id: 'raras',
    eyebrow: 'Edições limitadas',
    title: ['COLECIONE EDIÇÕES', 'RARAS E VERIFICADAS'],
    mobileTitle: ['EDIÇÕES RARAS', 'E VERIFICADAS'],
    text: 'Cada obra tem procedência registrada na rede, metadados imutáveis e direitos autorais que remuneram quem cria.',
    image: { src: '/images/baron-250.webp', srcSet: '/images/baron-128.webp 128w, /images/baron-250.webp 250w', alt: 'Neon Vessel #552: gorila de blazer creme e gola alta verde' },
    nftId: 'neon-vessel-552',
  },
  {
    id: 'cultura',
    eyebrow: 'Coleções em alta',
    title: ['SINTA O RITMO DA', 'CULTURA DA INTERNET'],
    mobileTitle: ['O RITMO DA', 'CULTURA DIGITAL'],
    text: 'Música, fotografia, arte 3D e colecionáveis de comunidades que estão moldando a rede agora.',
    image: { src: '/images/golden-250.webp', srcSet: '/images/golden-128.webp 128w, /images/golden-250.webp 250w', alt: 'Golden Beat #207: orangotango dourado com fones de ouvido verdes' },
    nftId: 'golden-beat-207',
  },
] as const

function Dots({ count, active, onSelect, className }: { count: number; active: number; onSelect: (i: number) => void; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)} role="group" aria-label="Escolher destaque">
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onSelect(i)}
          aria-label={`Destaque ${i + 1} de ${count}`}
          aria-current={i === active ? 'true' : undefined}
          className="flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn('block size-2 rounded-full border border-brand transition-colors', i === active ? 'bg-brand' : 'bg-brand/40')} />
        </button>
      ))}
    </div>
  )
}

function Hero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  return (
    <section aria-roledescription="carrossel" aria-label="Destaques" className="container-kurio hidden pt-8 pb-24 md:block">
      <div className="grid items-center gap-10 md:grid-cols-[1fr_minmax(300px,450px)]" aria-live="polite">
        <div className="flex flex-col gap-6 lg:pl-10">
          <p className="text-sm font-medium tracking-[0.12em]">{slide.eyebrow}</p>
          <h1 className="text-3xl leading-[1.6] font-bold tracking-[0.06em] lg:text-[44px]">
            {slide.title[0]}
            <br />
            {slide.title[1]}
          </h1>
          <p className="max-w-[560px] text-sm leading-[1.75] text-sand">{slide.text}</p>
          <div className="flex items-end justify-between gap-6">
            <Button asChild className="h-10 w-[140px] text-[15px]">
              <Link to="/mercado">EXPLORAR</Link>
            </Button>
            <Dots count={SLIDES.length} active={index} onSelect={setIndex} className="mr-[10%] -mb-12" />
          </div>
        </div>
        <Link to="/nft/$nftId" params={{ nftId: slide.nftId }} className="block overflow-hidden rounded-[24px]" aria-label={`Ver ${slide.image.alt.split(':')[0]}`}>
          <img
            src={slide.image.src}
            srcSet={slide.image.srcSet}
            sizes="(min-width: 1024px) 450px, 40vw"
            width={450}
            height={450}
            alt={slide.image.alt}
            fetchPriority="high"
            decoding="async"
            className="aspect-square w-full object-cover"
          />
        </Link>
      </div>
    </section>
  )
}

function MobileHero() {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]!
  return (
    <section aria-label="Destaques" className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#8b5d34] via-[#5b3a20] to-[#3a2414] p-4" aria-live="polite">
      <div className="grid grid-cols-[1fr_44%] items-center gap-3">
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium">{slide.eyebrow}</p>
          <h1 className="text-lg leading-snug font-bold tracking-wide">
            {slide.mobileTitle[0]}
            <br />
            {slide.mobileTitle[1]}
          </h1>
          <p className="text-[11px] leading-relaxed text-sand">{slide.text.split('.')[0]}.</p>
          <Link to="/mercado" className="inline-flex items-center gap-2 text-xs font-bold text-orange">
            EXPLORAR <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="relative">
          <img
            src={slide.image.src}
            srcSet={slide.image.srcSet}
            sizes="45vw"
            width={160}
            height={160}
            alt={slide.image.alt}
            fetchPriority={index === 0 ? 'high' : 'auto'}
            className="aspect-square w-full rounded-2xl object-cover"
          />
          <img src="/images/sage-128.webp" alt="" width={56} height={56} className="absolute -bottom-2 left-1 size-14 rounded-xl border-2 border-[#5b3a20] object-cover" />
        </div>
      </div>
      <Dots count={SLIDES.length} active={index} onSelect={setIndex} className="mt-1 justify-center" />
    </section>
  )
}

function Spotlight() {
  const featured = useFeatured()
  const nft = featured.data?.spotlight
  return (
    <section aria-labelledby="spotlight-title" className="bg-surface pt-6">
      <h2 id="spotlight-title" className="px-5 text-[22px] font-bold tracking-wide text-orange">
        NFT EM DESTAQUE
      </h2>
      <p className="mb-2 px-5 text-center text-lg font-bold tracking-wide">OFERTA LIMITADA</p>
      {nft ? (
        <Link to="/nft/$nftId" params={{ nftId: nft.id }} className="block overflow-hidden rounded-[18px]" aria-label={`Ver ${nft.name}`}>
          <img src={nft.image.src} alt={nft.image.alt} width={310} height={366} loading="lazy" className="h-[366px] w-full object-cover" />
        </Link>
      ) : featured.isError ? (
        <p className="px-5 pb-6 text-sm text-sand">{errorMessage(featured.error)}</p>
      ) : (
        <Skeleton className="h-[366px] w-full rounded-[18px]" />
      )}
    </section>
  )
}

function Promos() {
  const featured = useFeatured()
  const promos = featured.data?.promos
  return (
    <section aria-label="Coleções em destaque" className="container-kurio mt-24 grid gap-6 lg:grid-cols-2 lg:gap-8">
      {(promos ?? [null, null]).map((promo, i) =>
        promo ? (
          <article key={promo.id} className="grid grid-cols-[48%_1fr] overflow-hidden rounded-[18px] bg-surface">
            <NftImage image={promo.nft.image} sizes="290px" className="h-full rounded-[18px]" />
            <div className="flex flex-col items-end justify-center gap-3 p-4 text-right sm:p-6">
              <h2 className="text-base font-bold sm:text-lg">{promo.title}</h2>
              <p className="text-sm leading-relaxed text-sand">{promo.description}</p>
              <Button asChild className="mt-1 gap-2 font-medium">
                <Link to="/nft/$nftId" params={{ nftId: promo.nft.id }} aria-label={`Explorar ${promo.nft.name}`}>
                  Explorar <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </div>
          </article>
        ) : (
          <Skeleton key={i} className="h-[250px] rounded-[18px]" />
        ),
      )}
    </section>
  )
}

const POSTS = [
  { date: '12 de setembro', read: 'Leitura de 6 min', title: 'Como funciona a propriedade de NFTs', text: 'Aprenda a colecionar, negociar e verificar ativos digitais.', image: '/images/baron-250.webp' },
  { date: '13 de setembro', read: 'Leitura de 2 min', title: '10 artistas digitais para acompanhar', text: 'Conheça criadores que moldam a cultura digital.', image: '/images/emerald-256.webp' },
  { date: '15 de setembro', read: 'Leitura de 3 min', title: 'Raridade, atributos e procedência', text: 'Entenda raridade, procedência, direitos autorais e utilidade.', image: '/images/sage-250.webp' },
  { date: '15 de setembro', read: 'Leitura de 2 min', title: 'Como proteger sua carteira', text: 'Proteja sua carteira, seus ativos e sua identidade.', image: '/images/golden-250.webp' },
]

function Journal() {
  return (
    <section aria-labelledby="journal-title" className="container-kurio mt-24">
      <h2 id="journal-title" className="text-center text-2xl font-bold tracking-wide md:text-[28px]">
        Diário da Cunhagem
      </h2>
      <p className="mt-3 mb-10 text-center text-sm text-sand">Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.</p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {POSTS.map((post) => (
          <article key={post.title} className="relative flex flex-col overflow-hidden rounded-md bg-surface">
            <img src={post.image} alt="" width={268} height={195} loading="lazy" decoding="async" className="h-[195px] w-full object-cover object-top" />
            <div className="flex flex-1 flex-col gap-2 p-4">
              <p className="text-xs text-sand">
                {post.date} <span aria-hidden="true">|</span> {post.read}
              </p>
              <h3 className="text-base leading-snug font-bold">{post.title}</h3>
              <p className="text-xs leading-relaxed text-sand">{post.text}</p>
              <Link to="/aprenda" className="mt-auto text-xs font-bold text-orange after:absolute after:inset-0 hover:underline">
                Ler mais <span aria-hidden="true">→</span>
                <span className="sr-only">: {post.title}</span>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function HomePage() {
  usePageTitle(null)
  return (
    <div className="pt-4 md:pt-0">
      <Hero />
      <CatalogSection route="/" aside={<Spotlight />} mobileHero={<MobileHero />} />
      <Promos />
      <Journal />
    </div>
  )
}
