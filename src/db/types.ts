// A single extracted fact
export interface Fact {
  claim: string
  type: 'text' | 'numeric' | 'boolean' | 'date'
  value?: string | number | boolean
  unit?: string
}

// A full entry as stored in the database
export interface Entry {
  id: string
  topic: string
  facts: Fact[]
  source_url: string
  fetched_at: string
  similarity?: number  // only present on search results
}

// What we need to write a new entry
export interface NewEntry {
  topic: string
  facts: Fact[]
  source_url: string
  embedding: number[]
}