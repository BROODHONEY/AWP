// Volatility class → half-life in days
const HALF_LIVES: Record<string, number> = {
  permanent: Infinity,
  slow:      180,
  medium:    35,
  fast:      3,
}

// Source domain → authority score
// Extend this list as you see fit
const DOMAIN_AUTHORITY: Record<string, number> = {
  'gov':       0.97,
  'edu':       0.95,
  'wikipedia': 0.90,
  'arxiv':     0.93,
  'github':    0.82,
  'medium':    0.45,
  'reddit':    0.35,
}

/**
 * Compute source authority from a URL.
 * Uses domain heuristics — not perfect but good enough for Layer 2.
 */
export function sourceAuthority(url: string): number {
  try {
    const hostname = new URL(url).hostname.toLowerCase()

    // Check known high-authority patterns
    if (hostname.endsWith('.gov'))  return DOMAIN_AUTHORITY['gov']
    if (hostname.endsWith('.edu'))  return DOMAIN_AUTHORITY['edu']
    if (hostname.includes('wikipedia')) return DOMAIN_AUTHORITY['wikipedia']
    if (hostname.includes('arxiv'))     return DOMAIN_AUTHORITY['arxiv']
    if (hostname.includes('github'))    return DOMAIN_AUTHORITY['github']
    if (hostname.includes('medium'))    return DOMAIN_AUTHORITY['medium']
    if (hostname.includes('reddit'))    return DOMAIN_AUTHORITY['reddit']

    // Default for unknown domains
    return 0.60
  } catch {
    return 0.50
  }
}

/**
 * Compute freshness score using exponential decay.
 * 1.0 at write time, decays toward 0.0 based on half-life.
 * 'permanent' entries never decay.
 */
export function freshness(fetchedAt: string, volatilityClass: string): number {
  const halfLife = HALF_LIVES[volatilityClass] ?? 35

  if (halfLife === Infinity) return 1.0

  const ageMs   = Date.now() - new Date(fetchedAt).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  // Exponential decay: score = e^(-ln(2) * age / halfLife)
  // At age = 0: score = 1.0
  // At age = halfLife: score = 0.5
  // At age = 2×halfLife: score = 0.25
  return Math.exp(-Math.LN2 * ageDays / halfLife)
}

/**
 * Compute the full confidence score for an entry.
 * Called on every read — never stored, always fresh.
 */
export function computeConfidence(entry: {
  source_url:         string
  fetched_at:         string
  extraction_quality?: number | null
  volatility_class?:   string | null
}): number {
  const authority  = sourceAuthority(entry.source_url)
  const quality    = entry.extraction_quality ?? 0.75
  const decay      = freshness(entry.fetched_at, entry.volatility_class ?? 'medium')

  const score = authority * quality * decay

  // Round to 2 decimal places
  return Math.round(score * 100) / 100
}

/**
 * Should this entry be treated as stale?
 * Below 0.6 → treat as cache miss, re-fetch from web.
 */
export function isStale(score: number): boolean {
  return score < 0.6
}