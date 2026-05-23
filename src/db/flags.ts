import { db } from './client'

/**
 * Record a flag against an entry.
 * Returns true if flag was written, false if this agent already flagged it.
 */
export async function writeFlag(
  entryId:  string,
  agentId:  string | null,
  reason?:  string
): Promise<boolean> {
  const { error } = await db
    .from('flags')
    .insert({
      entry_id: entryId,
      agent_id: agentId,
      reason:   reason ?? null,
    })

  if (error) {
    // unique_agent_flag constraint fires when agent already flagged this entry
    if (error.code === '23505') return false
    throw new Error(`Flag write failed: ${error.message}`)
  }

  return true
}

/**
 * Get the total flag count for an entry.
 */
export async function getFlagCount(entryId: string): Promise<number> {
  const { data, error } = await db.rpc('get_flag_count', {
    target_entry_id: entryId,
  })

  if (error) return 0
  return data as number
}

/**
 * Get all flags for an entry — useful for debugging.
 */
export async function getFlags(entryId: string) {
  const { data, error } = await db
    .from('flags')
    .select('id, reason, created_at, agent_id')
    .eq('entry_id', entryId)
    .order('created_at', { ascending: false })

  if (error) return []
  return data
}