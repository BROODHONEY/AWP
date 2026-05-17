import { db } from './client'
import type { Entry, NewEntry } from './types'

/**
 * Semantic search against the entries table.
 * Calls the search_entries Postgres function we created in Supabase.
 */
export async function searchEntries(
  embedding: number[],
  threshold = 0.75,
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
 */
export async function writeEntry(entry: NewEntry): Promise<Entry> {
  const { data, error } = await db
    .from('entries')
    .insert({
      topic:      entry.topic,
      facts:      entry.facts,
      source_url: entry.source_url,
      embedding:  entry.embedding,
    })
    .select()
    .single()

  if (error) throw new Error(`Write failed: ${error.message}`)
  return data as Entry
}

/**
 * Fetch one entry by ID.
 * Returns null if not found — callers should handle this gracefully.
 */
export async function getEntry(id: string): Promise<Entry | null> {
  const { data, error } = await db
    .from('entries')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as Entry
}