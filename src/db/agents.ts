import { db } from './client'

export interface Agent {
  id:          string
  name:        string
  api_key:     string
  trust_score: number
  tier:        'owner' | 'verified' | 'public'
  write_count: number
  flag_count:  number
}

/**
 * Look up an agent by their API key.
 * Returns null if the key doesn't exist.
 */
export async function getAgentByKey(apiKey: string): Promise<Agent | null> {
  const { data, error } = await db
    .from('agents')
    .select('*')
    .eq('api_key', apiKey)
    .single()

  if (error) return null
  return data as Agent
}

/**
 * Update last_seen timestamp when an agent makes a request.
 */
export async function touchAgent(agentId: string): Promise<void> {
  await db
    .from('agents')
    .update({ last_seen: new Date().toISOString() })
    .eq('id', agentId)
}

/**
 * Increment write count after a successful write.
 */
export async function recordWrite(agentId: string): Promise<void> {
  await db.rpc('increment_agent_writes', { agent_id: agentId })
}

/**
 * Can this agent write to the index?
 * Verified (0.6+) and Owner (0.95+) tiers can write.
 */
export function canWrite(agent: Agent): boolean {
  return agent.trust_score >= 0.6
}

/**
 * Is this the node operator?
 */
export function isOwner(agent: Agent): boolean {
  return agent.tier === 'owner'
}