import { Hono } from 'hono'
import { db } from '../db/client'
import { getAgentByKey } from '../db/agents'
import { requireAuth } from '../middleware/auth'
import crypto from 'crypto'

export const agentsRouter = new Hono()

/**
 * Register a new agent.
 * Returns an API key — store it safely, it won't be shown again.
 */
agentsRouter.post('/register', async (c) => {
  let body: { name?: string }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Request body must be JSON with a name field' }, 400)
  }

  const name = body.name?.trim()

  if (!name || name.length < 2) {
    return c.json({ error: 'name is required (min 2 characters)' }, 400)
  }

  if (name.length > 60) {
    return c.json({ error: 'name must be under 60 characters' }, 400)
  }

  // Generate a secure random API key
  const apiKey = 'awp-' + crypto.randomBytes(24).toString('hex')

  const { data, error } = await db
    .from('agents')
    .insert({
      name,
      api_key:     apiKey,
      trust_score: 0.3,
      tier:        'public',
    })
    .select('id, name, trust_score, tier, created_at')
    .single()

  if (error) {
    return c.json({ error: 'Registration failed: ' + error.message }, 500)
  }

  return c.json({
    message:     'Agent registered successfully',
    id:          data.id,
    name:        data.name,
    api_key:     apiKey,   // only shown once — agent must store this
    trust_score: data.trust_score,
    tier:        data.tier,
    warning:     'Store your api_key securely. It will not be shown again.',
    access:      {
      read:  'open — no key required for GET /query',
      write: 'requires trust_score >= 0.6 — currently read-only',
    },
  }, 201)
})

/**
 * Get current agent profile.
 * Requires auth — agents can check their own trust score and stats.
 */
agentsRouter.get('/me', requireAuth, async (c) => {
  const agent = c.get('agent')

  return c.json({
    id:          agent.id,
    name:        agent.name,
    trust_score: agent.trust_score,
    tier:        agent.tier,
    write_count: agent.write_count,
    flag_count:  agent.flag_count,
    access: {
      can_write: agent.trust_score >= 0.6,
      can_read:  true,
    },
  })
})