export interface Fact {
  claim: string
  type: 'text' | 'numeric' | 'boolean' | 'date'
  value?: string | number | boolean
  unit?: string
}
 
export interface Entry {
  id: string
  topic: string
  facts: Fact[]
  source_url: string
  fetched_at: string
  similarity?: number
}
 
export interface NewEntry {
  topic: string
  facts: Fact[]
  source_url: string
  embedding: number[]
}
 