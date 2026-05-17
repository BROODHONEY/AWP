import { HfInference } from '@huggingface/inference'
import type { Fact } from '../db/types'
import 'dotenv/config'

const hf = new HfInference(process.env.HF_API_KEY)

const EXTRACTION_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3'

export interface ExtractionResult {
  topic: string
  facts: Fact[]
  source_type: 'primary' | 'secondary' | 'aggregator'
  extraction_quality: number
  volatility_class: 'permanent' | 'slow' | 'medium' | 'fast'
}

// Mistral uses a specific prompt format: [INST] ... [/INST]
// This matters — using the wrong format gives bad results
function buildPrompt(sourceUrl: string, strippedText: string): string {
  return `[INST] You are a structured knowledge extractor. Extract facts from the webpage content below.

Return ONLY a valid JSON object. No explanation, no markdown fences, no preamble. Just the JSON.

Required shape:
{
  "topic": "concise label for the main subject",
  "facts": [
    { "claim": "one discrete fact", "type": "text|numeric|boolean|date", "value": "optional", "unit": "optional" }
  ],
  "source_type": "primary|secondary|aggregator",
  "extraction_quality": 0.85,
  "volatility_class": "permanent|slow|medium|fast"
}

Rules:
- facts must be discrete verifiable claims, not prose summaries
- extraction_quality: 0.0 = unreadable, 1.0 = perfect
- volatility_class: permanent=never changes, slow=years, medium=months, fast=days

Source URL: ${sourceUrl}

Content:
${strippedText.slice(0, 2000)}
[/INST]`
}

/**
 * Sends stripped webpage text to a HuggingFace model and returns structured facts.
 * More defensive than the Claude version — open models need careful JSON parsing.
 */
export async function extractFacts(
  sourceUrl: string,
  strippedText: string
): Promise<ExtractionResult> {
  const prompt = buildPrompt(sourceUrl, strippedText)

  const response = await hf.textGeneration({
    model: EXTRACTION_MODEL,
    inputs: prompt,
    parameters: {
      max_new_tokens: 800,
      temperature: 0.1,      // low temperature = more predictable output
      return_full_text: false, // only return the generated part, not the prompt
    },
  })

  const rawText = response.generated_text.trim()

  // Parse the JSON — open models sometimes wrap it in fences or add text
  const parsed = safeParseJSON(rawText)

  if (!parsed) {
    throw new Error(
      `Failed to parse JSON from model response.\nRaw response:\n${rawText}`
    )
  }

  // Validate required fields exist
  if (!parsed.topic || !Array.isArray(parsed.facts)) {
    throw new Error(
      `Model returned JSON but missing required fields.\nParsed: ${JSON.stringify(parsed)}`
    )
  }

  // Fill in defaults for optional fields so downstream code doesn't break
  return {
    topic: parsed.topic as string,
    facts: parsed.facts as Fact[],
    source_type: (parsed.source_type as 'primary' | 'secondary' | 'aggregator') ?? 'secondary',
    extraction_quality: (parsed.extraction_quality as number) ?? 0.5,
    volatility_class: (parsed.volatility_class as 'permanent' | 'slow' | 'medium' | 'fast') ?? 'medium',
  }
}

/**
 * Tries to extract valid JSON from a string that might have extra noise around it.
 * Open models sometimes add "Here is the JSON:" or wrap in ```json fences.
 */
function safeParseJSON(text: string): Record<string, unknown> | null {
  // Attempt 1: parse directly — works if model was well-behaved
  try {
    return JSON.parse(text)
  } catch {
    // continue to next attempt
  }

  // Attempt 2: find the first { and last } and parse what's between them
  // Handles cases where model adds text before or after the JSON
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')

  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      // continue
    }
  }

  // Attempt 3: strip markdown fences if present
  // Sometimes models return ```json\n{...}\n``` or ```\n{...}\n```
  const jsonFenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (jsonFenceMatch && jsonFenceMatch[1]) {
    try {
      return JSON.parse(jsonFenceMatch[1].trim())
    } catch {
      // continue
    }
  }

  return null
}