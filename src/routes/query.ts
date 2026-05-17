import { Hono } from 'hono'
import { embed } from '../pipeline/embed'
import { webSearch, fetchAndStrip } from '../pipeline/search'
import { extractFacts } from '../pipeline/extract'
import { searchEntries, writeEntry } from '../db/entries'

export const queryRouter = new Hono()

queryRouter.get('/', async (c) => {

  try{

    const q = c.req.query('q')
    if (!q) {
      return c.json({ error: 'q parameter is required' }, 400)
    }

    // 2. Embed the query
    const queryEmbedding = await embed(q)

    // 3. Search the index
    const results = await searchEntries(queryEmbedding)

    if (results.length > 0) {
      const topResult = results[0]
      return c.json({
        hit: true,
        source: 'cache',
        topic: topResult.topic,
        facts: topResult.facts,
        source_url: topResult.source_url,
        fetched_at: topResult.fetched_at,
      })
    }
    
    const urls = await webSearch(q)
    if (urls.length === 0) {
      return c.json({ error: 'No sources found for query' }, 404)
    }

    const text = await fetchAndStrip(urls[0])
    
    const extracted = await extractFacts(urls[0], text)

    const topicEmbedding = await embed(extracted.topic)

    const entry = await writeEntry({
      topic: extracted.topic,
      facts: extracted.facts,
      source_url: urls[0],
      embedding: topicEmbedding,
    })

    return c.json({
      hit: false,
      source: 'web',
      topic: entry.topic,
      facts: entry.facts,
      source_url: entry.source_url,
      fetched_at: entry.fetched_at,
    })

  } catch (error: any) {
    return c.json({ error: error.message }, 500)
  }
})