/**
 * Substituto mínimo de `tough-cookie` para o bundle de demonstração.
 *
 * O MSW usa tough-cookie (e, por tabela, `tldts`, ~250 KB minificados) apenas
 * para espelhar cookies de respostas simuladas. Esta aplicação não usa cookies
 * (a sessão trafega no cabeçalho Authorization), então o alias em
 * vite.config.ts troca a dependência por este stub sem alterar nenhuma
 * resposta ou regra de negócio. Ver ARCHITECTURE.md › Performance.
 */
export class Cookie {
  key = ''
  domain: string | null = null
  path: string | null = null
  static fromJSON(): Cookie | null {
    return null
  }
  toJSON() {
    return {}
  }
}

export class MemoryCookieStore {
  idx: Record<string, Record<string, Record<string, Cookie>>> = {}
}

export class CookieJar {
  constructor(_store?: MemoryCookieStore) {
    void _store
  }
  getCookiesSync(_url: string): Cookie[] {
    void _url
    return []
  }
  async setCookie(_cookie: string, _url: string): Promise<void> {
    void _cookie
    void _url
  }
}
