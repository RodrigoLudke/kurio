/**
 * Aritmética de valores em ETH sem ponto flutuante.
 *
 * Valores trafegam como strings decimais ("1.19", "26.846") e são convertidos
 * para wei (bigint, 18 casas) para qualquer cálculo. Nenhum `number` é usado
 * para dinheiro — evita erros como 0.1 + 0.2 = 0.30000000000000004.
 *
 * O mesmo módulo é usado pela interface e pelo servidor simulado (MSW),
 * garantindo que os totais exibidos coincidam com a resposta da API.
 */

export type EthString = string

const DECIMALS = 18
const SCALE = 10n ** BigInt(DECIMALS)
const ETH_PATTERN = /^-?\d+(\.\d{1,18})?$/

export function isEthString(value: unknown): value is EthString {
  return typeof value === 'string' && ETH_PATTERN.test(value.trim())
}

/** Converte "1.19" em wei (bigint). Lança erro para entradas inválidas. */
export function toWei(value: EthString): bigint {
  const raw = value.trim()
  if (!ETH_PATTERN.test(raw)) throw new Error(`Valor ETH inválido: "${value}"`)
  const negative = raw.startsWith('-')
  const unsigned = negative ? raw.slice(1) : raw
  const [whole = '0', fraction = ''] = unsigned.split('.')
  const wei = BigInt(whole) * SCALE + BigInt(fraction.padEnd(DECIMALS, '0'))
  return negative ? -wei : wei
}

/** Converte wei em string decimal canônica, sem zeros à direita ("26.846"). */
export function fromWei(wei: bigint): EthString {
  const negative = wei < 0n
  const abs = negative ? -wei : wei
  const whole = abs / SCALE
  const fraction = (abs % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '')
  const body = fraction ? `${whole}.${fraction}` : whole.toString()
  return negative ? `-${body}` : body
}

export function addEth(...values: EthString[]): EthString {
  return fromWei(values.reduce((acc, v) => acc + toWei(v), 0n))
}

export function subEth(a: EthString, b: EthString): EthString {
  return fromWei(toWei(a) - toWei(b))
}

/** Multiplica por uma quantidade inteira. */
export function mulEth(value: EthString, quantity: number): EthString {
  if (!Number.isInteger(quantity)) throw new Error('Quantidade deve ser inteira')
  return fromWei(toWei(value) * BigInt(quantity))
}

/** Aplica um percentual em basis points (1000 = 10%), arredondando para baixo em wei. */
export function percentOfEth(value: EthString, basisPoints: number): EthString {
  return fromWei((toWei(value) * BigInt(basisPoints)) / 10_000n)
}

export function compareEth(a: EthString, b: EthString): -1 | 0 | 1 {
  const diff = toWei(a) - toWei(b)
  return diff === 0n ? 0 : diff > 0n ? 1 : -1
}

export function minEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) <= 0 ? a : b
}

export function maxEth(a: EthString, b: EthString): EthString {
  return compareEth(a, b) >= 0 ? a : b
}

export function isZeroEth(value: EthString): boolean {
  return toWei(value) === 0n
}

export interface FormatEthOptions {
  /** casas decimais mínimas exibidas (padrão 2) */
  minDecimals?: number
  /** casas decimais máximas exibidas (padrão 6) — o excedente é truncado, nunca arredondado para cima */
  maxDecimals?: number
  /** inclui o sufixo " ETH" (padrão true) */
  unit?: boolean
}

/** Formata para exibição: "1.19 ETH", "26.846 ETH", "0.016 ETH". Usa apenas operações de string. */
export function formatEth(value: EthString, options: FormatEthOptions = {}): string {
  const { minDecimals = 2, maxDecimals = 6, unit = true } = options
  const canonical = fromWei(toWei(value))
  const negative = canonical.startsWith('-')
  const unsigned = negative ? canonical.slice(1) : canonical
  const [whole = '0', fraction = ''] = unsigned.split('.')
  let digits = fraction.slice(0, maxDecimals).replace(/0+$/, '')
  if (digits.length < minDecimals) digits = digits.padEnd(minDecimals, '0')
  const body = digits ? `${whole}.${digits}` : whole
  return `${negative ? '-' : ''}${body}${unit ? ' ETH' : ''}`
}
