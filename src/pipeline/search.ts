import * as cheerio from 'cheerio'

/**
 * Fetches a URL and strips the HTML down to clean plain text.
 * Removes: scripts, styles, navigation, headers, footers, ads.
 * Returns: the main content as a plain text string.
 */
export async function fetchAndStrip(url: string): Promise<string> {

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'AWP-Bot/0.1 (agent-web-protocol)',
    },
    signal: AbortSignal.timeout(10000),
  })

    
  const html = await response.text()
  const $ = cheerio.load(html)

  $('script, style, nav, header, footer, aside, iframe, .ad, #cookie-banner').remove()

  const text = $('body').text()
  const cleaned = text.trim().replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n')
  const truncated = cleaned.split(' ').slice(0, 4000).join(' ')

  // 8. Return the cleaned text
    return truncated
}

/**
 * Given a search query, returns a list of candidate URLs.
 * We use DuckDuckGo's HTML search — no API key needed.
 */
export async function webSearch(query: string): Promise<string[]> {

  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'AWP-Bot/0.1 (agent-web-protocol)',
      },
      signal: AbortSignal.timeout(10000),
    })


  const html = await response.text()
  const $ = cheerio.load(html)

  const urls: string[] = []
    $('a.result__a').each((_, el) => {
        const href = $(el).attr('href')
        if (href) {
        urls.push(href)
        }
    })

  const filtered = urls.filter(url => url.startsWith('http'))
  return filtered.slice(0, 5)

}