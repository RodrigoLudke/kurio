import { Link } from '@tanstack/react-router'
import { useId, useState, type FormEvent } from 'react'
import { FacebookIcon, InstagramIcon, LinkedinIcon, XTwitterIcon, YoutubeIcon } from '@/components/icons'
import { rules } from '@/lib/validation'
import { cn } from '@/lib/utils'

const FEATURES = [
  { letter: 'W', title: 'Segurança da carteira', text: 'Proteja sua carteira e colecione arte digital verificada com confiança.' },
  { letter: 'C', title: 'Criadores em destaque', text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.' },
  { letter: 'D', title: 'Alertas de lançamentos', text: 'Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado.' },
]

const SOCIAL = [
  { label: 'Facebook', href: 'https://www.facebook.com', Icon: FacebookIcon },
  { label: 'Instagram', href: 'https://www.instagram.com', Icon: InstagramIcon },
  { label: 'X (Twitter)', href: 'https://x.com', Icon: XTwitterIcon },
  { label: 'LinkedIn', href: 'https://www.linkedin.com', Icon: LinkedinIcon },
  { label: 'YouTube', href: 'https://www.youtube.com', Icon: YoutubeIcon },
]

export function WalletBrands({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border border-line-strong bg-band px-2 py-1 text-[9px] font-bold tracking-wide text-orange uppercase',
        className,
      )}
    >
      MetaMask <span aria-hidden="true">•</span> WalletConnect <span aria-hidden="true">•</span> Coinbase
    </span>
  )
}

function Newsletter() {
  const id = useId()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null)
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const error = rules.email(email)
    if (error) {
      setMessage({ tone: 'error', text: error })
      return
    }
    // fora do escopo: não simula sucesso
    setMessage({ tone: 'info', text: 'As inscrições na newsletter ainda não estão abertas nesta versão. Nenhum dado foi enviado.' })
  }
  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base leading-tight font-bold">
        Antecipe-se ao próximo lançamento
      </h2>
      <div className="flex overflow-hidden rounded-sm">
        <label htmlFor={`${id}-email`} className="sr-only">
          Seu e-mail
        </label>
        <input
          id={`${id}-email`}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="digite seu e-mail..."
          aria-invalid={message?.tone === 'error' || undefined}
          aria-describedby={message ? `${id}-msg` : undefined}
          className="h-10 min-w-0 flex-1 bg-band px-3 text-sm text-foreground placeholder:text-[#c9a874] focus-visible:outline-2 focus-visible:-outline-offset-2"
        />
        <button type="submit" className="h-10 bg-brand px-4 text-base font-bold text-kurio-bg hover:bg-brand-hover">
          Enviar
        </button>
      </div>
      {message ? (
        <p id={`${id}-msg`} role={message.tone === 'error' ? 'alert' : 'status'} className={cn('text-xs', message.tone === 'error' ? 'text-danger' : 'text-sand')}>
          {message.text}
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-sand">Receba lançamentos selecionados, histórias de criadores e novidades do mercado.</p>
      )}
    </form>
  )
}

export function Footer({ className }: { className?: string }) {
  return (
    <footer className={cn('mt-20 pb-6', className)}>
      <div className="container-kurio">
        <div className="bg-surface">
          <div className="grid gap-8 px-6 py-8 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.25fr] lg:gap-0 lg:px-12">
            {FEATURES.map((f) => (
              <div key={f.letter} className="flex flex-col gap-2 lg:border-r lg:border-brand lg:px-4 lg:first:pl-0">
                <span aria-hidden="true" className="mb-1 flex size-[74px] items-center justify-center rounded-full bg-brand text-2xl font-bold text-kurio-bg">
                  {f.letter}
                </span>
                <h2 className="text-base font-bold">{f.title}</h2>
                <p className="text-sm leading-relaxed text-sand">{f.text}</p>
              </div>
            ))}
            <div className="lg:pl-4">
              <Newsletter />
            </div>
          </div>
          <div className="grid gap-3 bg-band px-6 py-6 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:px-8">
            <span className="font-bold tracking-[0.12em]">KURIO</span>
            <span>Feito para colecionadores, criadores e cultura</span>
            <a href="mailto:contato@email.com" className="hover:text-orange">
              contato@email.com
            </a>
            <a href="tel:+551140028922" className="hover:text-orange">
              +55 11 4002 8922
            </a>
          </div>
          <div className="grid gap-8 px-6 py-8 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
            <nav aria-labelledby="footer-profile">
              <h2 id="footer-profile" className="mb-3 text-lg font-bold">
                Meu perfil
              </h2>
              <ul className="flex flex-col gap-2.5">
                <li><Link to="/conta/perfil" className="hover:text-orange">Meu perfil</Link></li>
                <li><Link to="/conta/atividade" className="hover:text-orange">Minha coleção</Link></li>
                <li><Link to="/conta/atividade" className="hover:text-orange">Atividade</Link></li>
                <li><Link to="/criadores" className="hover:text-orange">Estúdio do criador</Link></li>
                <li><Link to="/conta/favoritos" className="hover:text-orange">Lista de interesse</Link></li>
              </ul>
            </nav>
            <nav aria-labelledby="footer-help">
              <h2 id="footer-help" className="mb-3 text-lg font-bold">
                Central de ajuda
              </h2>
              <ul className="flex flex-col gap-2.5">
                {['Central de ajuda', 'Como comprar NFTs', 'Carteira e segurança', 'Política do mercado', 'Denunciar item'].map((label) => (
                  <li key={label}>
                    <Link to="/ajuda" className="hover:text-orange">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <nav aria-labelledby="footer-collections">
              <h2 id="footer-collections" className="mb-3 text-lg font-bold">
                Coleções
              </h2>
              <ul className="flex flex-col gap-2.5">
                {(
                  [
                    ['arte-digital', 'Arte digital'],
                    ['fotografia', 'Fotografia'],
                    ['musica', 'Música'],
                    ['arte-3d', 'Arte 3D'],
                    ['utilidade', 'Utilidade'],
                  ] as const
                ).map(([id, label]) => (
                  <li key={id}>
                    <Link to="/mercado" search={{ category: id }} className="hover:text-orange">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
            <div>
              <h2 className="mb-3 text-lg font-bold">Redes sociais</h2>
              <ul className="mb-8 flex gap-2">
                {SOCIAL.map(({ label, href, Icon }) => (
                  <li key={label}>
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex size-8 items-center justify-center rounded-sm border border-brand text-orange hover:bg-brand hover:text-kurio-bg"
                    >
                      <Icon className="size-4" />
                      <span className="sr-only">{label} (abre em nova aba)</span>
                    </a>
                  </li>
                ))}
              </ul>
              <h2 className="mb-2 text-lg font-bold">Carteiras compatíveis</h2>
              <WalletBrands />
            </div>
          </div>
        </div>
        <p className="mt-5 text-center text-sm">© 2026 Kurio. Propriedade digital para todos.</p>
      </div>
    </footer>
  )
}
