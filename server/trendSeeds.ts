export interface TrendSeed {
  readonly label: string
  readonly source: 'curated' | 'google-trends'
}

const SOURCE = 'https://trends.google.com/trending/rss?geo=US'
const MAX_TRENDS = 6
const TIMEOUT_MS = 3500

const CURATED: readonly TrendSeed[] = [
  { label: 'SIX SEVEN', source: 'curated' },
  { label: 'RIZZ CIRCUIT', source: 'curated' },
  { label: 'NPC STREAM', source: 'curated' },
  { label: 'COMMENT SECTION', source: 'curated' },
  { label: 'ALGORITHM SOUP', source: 'curated' },
]

const BLOCKED =
  /\b(trump|biden|war|shooting|killed|dead|death|died|murder|rape|abuse|cancer|meningitis|racist|lawsuit|election|polls|politics|israel|gaza|ukraine|flood|earthquake|hurricane|terror|porn|sex)\b/i

function decodeXml(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function normaliseTrendLabel(raw: string): string | null {
  const s = decodeXml(raw).replace(/\s+/g, ' ').trim()
  if (!s || s.length > 32) return null
  if (/https?:\/\/|www\.|<|>/.test(s)) return null
  if (BLOCKED.test(s)) return null
  const words = s.split(' ')
  if (words.length > 4) return null
  const title = s.toUpperCase()
  return title
}

export function parseTrendSeeds(xml: string): readonly TrendSeed[] {
  const out: TrendSeed[] = []
  const seen = new Set<string>()
  for (const match of xml.matchAll(/<title>(.*?)<\/title>/gis)) {
    const label = normaliseTrendLabel(match[1])
    if (!label || seen.has(label) || label === 'DAILY SEARCH TRENDS') continue
    seen.add(label)
    out.push({ label, source: 'google-trends' })
    if (out.length >= MAX_TRENDS) break
  }
  return out
}

export async function fetchTrendSeeds(fetcher: typeof fetch = fetch): Promise<readonly TrendSeed[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetcher(SOURCE, { signal: controller.signal, headers: { accept: 'application/rss+xml,text/xml' } })
    if (!res.ok) return CURATED
    const live = parseTrendSeeds(await res.text())
    const seen = new Set<string>()
    return [...CURATED, ...live].filter((t) => {
      if (seen.has(t.label)) return false
      seen.add(t.label)
      return true
    }).slice(0, MAX_TRENDS)
  } catch {
    return CURATED
  } finally {
    clearTimeout(timer)
  }
}

export const CURATED_TREND_SEEDS = CURATED
