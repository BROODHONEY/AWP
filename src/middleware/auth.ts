import { createMiddleware } from 'hono/factory'
import { getAgentByKey, touchAgent } from '../db/agents'
import type { Agent } from '../db/agents'

// Extend Hono context to carry the agent
type AuthVariables = {
  agent: Agent
}

/**
 * Middleware that requires a valid API key.
 * Attaches the agent to context so route handlers can use it.
 * 
 * Usage: app.post('/entry', requireAuth, handler)
 */
export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    // Accept key from Authorization header or X-AWP-Key header
    const authHeader = c.req.header('Authorization')
    const awpHeader  = c.req.header('X-AWP-Key')

    let apiKey: string | null = null

    if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.slice(7).trim()
    } else if (awpHeader) {
      apiKey = awpHeader.trim()
    }

    if (!apiKey) {
      return c.json({
        error:   'Authentication required',
        message: 'Include your API key as: Authorization: Bearer YOUR_KEY or X-AWP-Key: YOUR_KEY',
      }, 401)
    }

    const agent = await getAgentByKey(apiKey)

    if (!agent) {
      return c.json({
        error:   'Invalid API key',
        message: 'This key does not exist. Register your agent at POST /agents/register',
      }, 401)
    }

    // Update last seen — fire and forget
    touchAgent(agent.id).catch(() => {})

    // Attach agent to context for route handlers
    c.set('agent', agent)
    await next()
  }
)

/**
 * Middleware that requires write permission (trust >= 0.6).
 * Must be used after requireAuth.
 */
export const requireWriteAccess = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const agent = c.get('agent')

    if (!agent) {
      return c.json({ error: 'Auth middleware not applied' }, 500)
    }

    if (agent.trust_score < 0.6) {
      return c.json({
        error:        'Insufficient trust score',
        message:      `Your trust score is ${agent.trust_score}. Write access requires 0.6+.`,
        trust_score:  agent.trust_score,
        tier:         agent.tier,
        how_to_earn:  'Trust increases as your writes get corroborated. Keep writing accurate data.',
      }, 403)
    }

    await next()
  }
)