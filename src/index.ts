import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { queryRouter } from './routes/query'
import { getEntry } from './db/entries'
import 'dotenv/config'

const app = new Hono()

app.route('/query', queryRouter)

app.get('/entry/:id', async (c) => {
  const id = c.req.param('id')
  const entry = await getEntry(id)
  if (!entry) return c.json({ error: `Entry not found: ${id}` }, 404)
  return c.json(entry)
})

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  node: 'awp-prototype-v0.1',
}))

app.get('/debug', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'q required' }, 400)

  const { embed } = await import('./pipeline/embed')
  const { db } = await import('./db/client')

  const queryEmbedding = await embed(q)

  // Check queries table
  const { data: queryMatches } = await db.rpc('search_queries', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,   // threshold 0 = return everything ranked
    match_count: 5,
  })

  // Check entries table
  const { data: entryMatches } = await db.rpc('search_entries', {
    query_embedding: queryEmbedding,
    match_threshold: 0.0,   // threshold 0 = return everything ranked
    match_count: 5,
  })

  return c.json({
    query: q,
    query_matches: queryMatches?.map((r: any) => ({
      query_text: r.query_text,
      similarity: r.similarity,
    })),
    entry_matches: entryMatches?.map((r: any) => ({
      topic:      r.topic,
      similarity: r.similarity,
    })),
  })
})

app.notFound((c) => c.json({ error: 'Not found' }, 404))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, () => {
  console.log(`\nAWP node running`)
  console.log(`  http://localhost:${port}/health`)
  console.log(`  http://localhost:${port}/query?q=what+is+python`)
  console.log(`  http://localhost:${port}/entry/:id\n`)
})