import { db } from './client'
import type { Entry, NewEntry } from './types'

/**
 * Search the index by semantic similarity.
 * Calls the search_entries Postgres function we created in Supabase.
 *
 * @param embedding   - The query vector (from embed())
 * @param threshold   - Minimum similarity to count as a hit (0.82 is a good default)
 * @param limit       - Max entries to return
 */
export async function searchEntries(
  embedding: number[],
  threshold = 0.82,
  limit = 3
): Promise<Entry[]> {
  const { data, error } = await db.rpc('search_entries', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: limit,
  })

  if (error) throw new Error(`Search failed: ${error.message}`)
  return (data ?? []) as Entry[]
}

/**
 * Write a new entry to the index.
 * Called after a successful LLM extraction on a cache miss.
 */
export async function writeEntry(entry: NewEntry): Promise<Entry> {

  const { data, error } = await db.from('entries').insert({
    topic: entry.topic,
    facts: entry.facts,
    source_url: entry.source_url,
    embedding: entry.embedding,
  }).select().single()

  if (error) throw new Error(`Failed to write entry: ${error.message}`)
  return data as Entry
}



/**
 * Fetch a single entry by its UUID.
 * Used by the GET /entry/:id route.
 */
export async function getEntry(id: string): Promise<Entry | null> {

  const { data, error } = await db.from('entries').select('*').eq('id', id).single()

  if (error) throw new Error(`Failed to fetch entry: ${error.message}`)
  return data as Entry | null
}