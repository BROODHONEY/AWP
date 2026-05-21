import { db } from './client'
import type { Entry, NewEntry } from './types'

/**
 * Semantic search against the entries table.
 * Calls the search_entries Postgres function we created in Supabase.
 */
export async function searchEntries(
  embedding: number[],
  threshold = 0.60,
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
  // Upsert on source_url — if it exists, update it; if not, create it
  // This is atomic and prevents race condition duplicates
  const { data, error } = await db
    .from('entries')
    .upsert(
      {
        topic:              entry.topic,
        facts:              entry.facts,
        source_url:         entry.source_url,
        embedding:          entry.embedding,
        fetched_at:         new Date().toISOString(),
        extraction_quality: entry.extraction_quality ?? null,
        volatility_class:   entry.volatility_class   ?? null,
      },
      {
        onConflict: 'source_url',   // unique constraint we added earlier
        ignoreDuplicates: false,    // update if exists
      }
    )
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

/**
 * Store the query string that produced an entry.
 * Used to match future similar questions to existing entries.
 */
export async function writeQuery(
  entryId: string,
  queryText: string,
  embedding: number[]
): Promise<void> {
  // Check if this exact query text already exists for this entry
  // Prevents duplicate rows from repeated web fetches
  const { data: existing } = await db
    .from('queries')
    .select('id')
    .eq('entry_id', entryId)
    .eq('query_text', queryText)
    .limit(1)

  if (existing && existing.length > 0) {
    console.log(`  Query already stored, skipping duplicate: "${queryText.slice(0, 60)}"`)
    return
  }

  const { error } = await db
    .from('queries')
    .insert({ entry_id: entryId, query_text: queryText, embedding })

  if (error) {
    console.error('writeQuery FAILED:', error.message)
  } else {
    console.log(`  Query stored: "${queryText.slice(0, 60)}"`)
  }
}

/**
 * Search stored queries by semantic similarity.
 * Returns the entry_id of the best matching previous query.
 */
export async function searchQueries(
  embedding: number[],
  threshold = 0.60
): Promise<string | null> {
  const { data, error } = await db.rpc('search_queries', {
    query_embedding: embedding,
    match_threshold: threshold,
    match_count: 1,
  })

  if (error || !data || data.length === 0) return null
  return data[0].entry_id as string
}