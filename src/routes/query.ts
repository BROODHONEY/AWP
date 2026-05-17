import { Hono } from 'hono'
import { embed } from '../pipeline/embed'
import { webSearch, fetchAndStrip } from '../pipeline/search'
import { extractFacts } from '../pipeline/extract'
import { searchEntries, writeEntry } from '../db/entries'

export const queryRouter = new Hono()

queryRouter.get('/', async (c) => {
  const q = c.req.query('q')

  if (!q || q.trim() === '') {
    return c.json({ error: 'q parameter is required. Usage: /query?q=your+question' }, 400)
  }

  try {
    // Step 1: embed the query
    const queryEmbedding = await embed(q)

    // Step 2: search the index
    const results = await searchEntries(queryEmbedding)

    // Step 3: cache hit — return immediately
    if (results.length > 0) {
      const best = results[0]
      return c.json({
        hit:        true,
        source:     'cache',
        topic:      best.topic,
        facts:      best.facts,
        source_url: best.source_url,
        fetched_at: best.fetched_at,
        similarity: best.similarity,
      })
    }

    // Step 4: cache miss — fall back to the web
    console.log(`Cache miss for: "${q}" — fetching from web...`)

    const urls = await webSearch(q)
    if (urls.length === 0) {
      return c.json({ error: `No sources found for query: "${q}"` }, 404)
    }

    const targetUrl = urls[0]
    console.log(`Fetching: ${targetUrl}`)

    const strippedText = await fetchAndStrip(targetUrl)

    console.log('Extracting facts...')
    const extracted = await extractFacts(targetUrl, strippedText)

    const topicEmbedding = await embed(extracted.topic)

    const entry = await writeEntry({
      topic:      extracted.topic,
      facts:      extracted.facts,
      source_url: targetUrl,
      embedding:  topicEmbedding,
    })

    console.log(`Wrote entry: "${extracted.topic}" (${extracted.facts.length} facts)`)

    return c.json({
      hit:        false,
      source:     'web',
      topic:      entry.topic,
      facts:      entry.facts,
      source_url: entry.source_url,
      fetched_at: entry.fetched_at,
    })

  } catch (err: any) {
    console.error('Query error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})