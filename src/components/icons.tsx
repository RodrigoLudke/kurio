import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

const base = (props: IconProps) => ({ width: 24, height: 24, viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false as const, ...props })

export function FacebookIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M14 8.5V6.8c0-.8.5-1.3 1.3-1.3H17V2.6h-2.4C12 2.6 10.8 4.2 10.8 6.6v1.9H8.5v2.9h2.3v10h3.2v-10h2.5l.4-2.9H14Z" />
    </svg>
  )
}

export function InstagramIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="none" stroke="currentColor" strokeWidth={1.8}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function XTwitterIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M22 5.9c-.7.3-1.5.5-2.3.6.8-.5 1.5-1.3 1.8-2.2-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.8a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5 0 2 1.4 3.7 3.3 4.1-.6.2-1.2.2-1.9.1.5 1.6 2 2.8 3.8 2.9A8.2 8.2 0 0 1 2 18.6 11.6 11.6 0 0 0 8.3 20.4c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.3Z" />
    </svg>
  )
}

export function LinkedinIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M4.2 8.6h3.4V20H4.2V8.6ZM5.9 3.2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm3.8 5.4h3.3v1.6c.5-.9 1.6-1.8 3.3-1.8 3.5 0 4.2 2.3 4.2 5.3V20h-3.4v-5.1c0-1.2 0-2.8-1.7-2.8s-2 1.3-2 2.7V20H9.7V8.6Z" />
    </svg>
  )
}

export function YoutubeIcon(props: IconProps) {
  return (
    <svg {...base(props)} fill="currentColor">
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8ZM10 15V9l5.2 3L10 15Z" />
    </svg>
  )
}

export function GoogleIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3Z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#FBBC05" d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9.1L6.4 14Z" />
      <path fill="#EA4335" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  )
}

export function ThankYouIcon(props: IconProps) {
  return (
    <svg width="72" height="88" viewBox="0 0 72 88" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" {...props}>
      <path d="M6 40 36 62l30-22v42H6V40Z" />
      <path d="m6 82 24-22M66 82 42 60" />
      <path d="M14 46V8h44v38" />
      <path d="M28 8V4h16v4" />
      <text x="36" y="26" textAnchor="middle" fontFamily="Roboto Mono, monospace" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">
        THANK
      </text>
      <text x="36" y="40" textAnchor="middle" fontFamily="Roboto Mono, monospace" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">
        YOU
      </text>
    </svg>
  )
}
