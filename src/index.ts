import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { queryRouter } from './routes/query'
import { entryRouter } from './routes/entry'
import { agentsRouter } from './routes/agents'
import { flagRouter } from './routes/flag'
import 'dotenv/config'

const app = new Hono()

// ── Public routes ────────────────────────────────────────
app.route('/query',  queryRouter)
app.route('/entry',  entryRouter)
app.route('/agents', agentsRouter)
app.route('/flag', flagRouter)

// Health check
app.get('/health', (c) => c.json({
  status:    'ok',
  timestamp: new Date().toISOString(),
  node:      'awp-prototype-v0.1',
  layer:     2,
}))

// 404
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// ── Start ────────────────────────────────────────────────
const port = Number(process.env.PORT ?? 3000)

serve({ fetch: app.fetch, port }, () => {
  console.log(`\nAWP node running — Layer 2`)
  console.log(`  http://localhost:${port}/health`)
  console.log(`  http://localhost:${port}/query?q=...`)
  console.log(`  http://localhost:${port}/entry/:id`)
  console.log(`  http://localhost:${port}/agents/register`)
  console.log(`  http://localhost:${port}/agents/me\n`)
})