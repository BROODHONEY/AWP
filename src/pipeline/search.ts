import * as cheerio from 'cheerio'

// Use a real browser user-agent — bot agents get blocked or rate-limited
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Fetches a URL and strips the HTML down to clean plain text.
 * Removes scripts, styles, nav, header, footer, ads.
 */
export async function fetchAndStrip(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10000),
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const $ = cheerio.load(html)

  // Remove all noise elements
  $('script, style, nav, header, footer, aside, iframe').remove()
  $('[class*="cookie"], [class*="banner"], [class*="popup"], [id*="cookie"]').remove()
  $('[class*="ad-"], [class*="-ad"], [id*="ad-"]').remove()

  // Get text from body
  const raw = $('body').text()

  // Clean up whitespace
  const cleaned = raw
    .replace(/[ \t]+/g, ' ')          // collapse horizontal whitespace
    .replace(/\n{3,}/g, '\n\n')       // max two consecutive newlines
    .trim()

  // Truncate to ~4000 words — enough for extraction, not too much for the LLM
  return cleaned.split(' ').slice(0, 4000).join(' ')
}

/**
 * Given a search query, returns up to 5 candidate URLs using DuckDuckGo.
 * Falls back to a Wikipedia URL if DuckDuckGo returns nothing.
 */
export async function webSearch(query: string): Promise<string[]> {
  try {
    const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`

    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10000),
    })

    const html = await response.text()
    const $ = cheerio.load(html)

    const urls: string[] = []

    $('a.result__a').each((_, el) => {
      const href = $(el).attr('href') ?? ''

      if (href.includes('uddg=')) {
        try {
          const paramString = href.split('?')[1] ?? ''
          const params = new URLSearchParams(paramString)
          const realUrl = params.get('uddg')
          if (realUrl && realUrl.startsWith('http')) {
            urls.push(decodeURIComponent(realUrl))
          }
        } catch { /* skip */ }
      } else if (href.startsWith('http')) {
        urls.push(href)
      }
    })

    // Filter out DuckDuckGo internal URLs, ad redirects, and tracking URLs
    const cleaned = urls.filter(url => {
      if (url.includes('duckduckgo.com')) return false   // DDG internal
      if (url.includes('bing.com/aclick'))  return false  // Bing ads
      if (url.includes('y.js'))             return false  // DDG tracking
      return true
    })

    if (cleaned.length > 0) return cleaned.slice(0, 5)

  } catch (err) {
    console.warn('DuckDuckGo search failed:', err)
  }

  return []
}