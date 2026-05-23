import { Hono } from 'hono'
import { getEntry } from '../db/entries'
import { writeFlag, getFlagCount } from '../db/flags'
import { getAgentByKey } from '../db/agents'

export const flagRouter = new Hono()

/**
 * POST /flag/:id
 * 
 * Any agent can flag an entry — no auth required.
 * Anonymous flags are allowed but weighted less (future Layer 3 feature).
 * 
 * Body: { reason?: string }
 */
flagRouter.post('/:id', async (c) => {
  const entryId = c.req.param('id')

  // Verify entry exists
  const entry = await getEntry(entryId)
  if (!entry) {
    return c.json({ error: `Entry not found: ${entryId}` }, 404)
  }

  // Try to identify the agent — optional, anonymous flags allowed
  let agentId: string | null = null
  const apiKey = c.req.header('X-AWP-Key') 
    ?? c.req.header('Authorization')?.replace('Bearer ', '')

  if (apiKey) {
    const agent = await getAgentByKey(apiKey)
    if (agent) agentId = agent.id
  }

  // Parse optional reason
  let reason: string | undefined
  try {
    const body = await c.req.json()
    reason = body.reason?.trim().slice(0, 500)  // cap at 500 chars
  } catch {
    // No body is fine — reason is optional
  }

  // Write the flag
  const written = await writeFlag(entryId, agentId, reason)

  if (!written) {
    return c.json({
      error:   'Already flagged',
      message: 'This agent has already flagged this entry.',
    }, 409)
  }

  // Get updated flag count
  const flagCount = await getFlagCount(entryId)

  // Tell the caller what happened and whether the threshold was crossed
  const threshold  = 3
  const penalised  = flagCount >= threshold
  const refetchAt  = 7   // rough estimate of when it goes stale from flags alone

  return c.json({
    message:       'Entry flagged successfully',
    entry_id:      entryId,
    flag_count:    flagCount,
    threshold:     threshold,
    penalised:     penalised,
    status:        penalised
      ? `Confidence penalty active. Entry will be re-fetched at ${refetchAt} flags.`
      : `${threshold - flagCount} more flag(s) needed to trigger penalty.`,
  }, 201)
})