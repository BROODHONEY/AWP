import { HfInference } from '@huggingface/inference'
import type { Fact } from '../db/types'
import 'dotenv/config'

const hf = new HfInference(process.env.HF_API_KEY)

// Qwen2.5-72B-Instruct: free, widely available across HF providers,
// better at structured JSON output than Mistral-7B
const EXTRACTION_MODEL = 'Qwen/Qwen2.5-72B-Instruct'
const MODELS = [
  'Qwen/Qwen2.5-72B-Instruct',
  'meta-llama/Llama-3.1-8B-Instruct',
  'HuggingFaceH4/zephyr-7b-beta',
  'mistralai/Mistral-7B-Instruct-v0.2',  // v0.2 has better provider support than v0.3
]

export interface ExtractionResult {
  topic: string
  facts: Fact[]
  source_type: 'primary' | 'secondary' | 'aggregator'
  extraction_quality: number
  volatility_class: 'permanent' | 'slow' | 'medium' | 'fast'
}

const SYSTEM_PROMPT = `You are a structured knowledge extractor for the Agent Web Protocol (AWP).
Your job is to extract discrete, verifiable facts from webpage content.

Return ONLY a valid JSON object. No explanation, no markdown fences, no extra text before or after.

Required JSON shape:
{
  "topic": "concise label for the main subject of this page",
  "facts": [
    { "claim": "one discrete fact", "type": "text", "value": "optional actual value", "unit": "optional unit" }
  ],
  "source_type": "primary",
  "extraction_quality": 0.85,
  "volatility_class": "medium"
}

Rules:
- facts must be discrete verifiable claims, not prose summaries
- type must be one of: text, numeric, boolean, date
- source_type must be one of: primary, secondary, aggregator
- extraction_quality: your honest rating from 0.0 (unreadable) to 1.0 (perfect clean content)
- volatility_class: permanent (never changes), slow (years), medium (months), fast (days)`

/**
 * Sends stripped webpage text to a HuggingFace model and returns structured facts.
 */
export async function extractFacts(
  sourceUrl: string,
  strippedText: string
): Promise<ExtractionResult> {
  let lastError: Error = new Error('No models available')

  for (const model of MODELS) {
    try {
      console.log(`  Trying model: ${model}`)

      const response = await hf.chatCompletion({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Source URL: ${sourceUrl}\n\nContent:\n${strippedText.slice(0, 2000)}`,
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      })

      const rawText = response.choices[0]?.message?.content?.trim() ?? ''
      if (!rawText) throw new Error('Empty response')

      const parsed = safeParseJSON(rawText)
      if (!parsed) {
        console.error('Raw response:', rawText)
        throw new Error('Failed to parse JSON')
      }

      if (!parsed.topic || !Array.isArray(parsed.facts)) {
        throw new Error(`Missing required fields: ${JSON.stringify(parsed)}`)
      }

      console.log(`  Success with model: ${model}`)

      return {
        topic:              String(parsed.topic),
        facts:              parsed.facts as Fact[],
        source_type:        (parsed.source_type  as ExtractionResult['source_type'])        ?? 'secondary',
        extraction_quality: Number(parsed.extraction_quality ?? 0.5),
        volatility_class:   (parsed.volatility_class as ExtractionResult['volatility_class']) ?? 'medium',
      }

    } catch (err: any) {
      const body = err?.httpResponse?.body
      const msg  = typeof body === 'object' ? JSON.stringify(body) : String(body ?? err.message)
      console.warn(`  Model ${model} failed: ${msg}`)
      lastError = new Error(msg)
      // continue to next model
    }
  }

  throw lastError
}

/**
 * Tries to extract valid JSON from a string that might have noise around it.
 * Handles: clean JSON, text before/after JSON, markdown code fences.
 */
function safeParseJSON(text: string): Record<string, unknown> | null {
  // Attempt 1: direct parse — works when model behaves perfectly
  try { return JSON.parse(text) } catch { /* continue */ }

  // Attempt 2: find the outermost { } block
  const start = text.indexOf('{')
  const end   = text.lastIndexOf('}')
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)) } catch { /* continue */ }
  }

  // Attempt 3: strip ```json ... ``` or ``` ... ``` fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fence?.[1]) {
    try { return JSON.parse(fence[1].trim()) } catch { /* continue */ }
  }

  return null
}