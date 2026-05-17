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

app.notFound((c) => c.json({ error: 'Not found' }, 404))

const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, () => {
  console.log(`\nAWP node running`)
  console.log(`  http://localhost:${port}/health`)
  console.log(`  http://localhost:${port}/query?q=what+is+python`)
  console.log(`  http://localhost:${port}/entry/:id\n`)
})