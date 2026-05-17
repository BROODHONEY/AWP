import { HfInference } from '@huggingface/inference'
import 'dotenv/config'

const hf = new HfInference(process.env.HF_API_KEY)

// BAAI/bge-small-en-v1.5 outputs 384-dimensional vectors
// Make sure your Supabase schema uses vector(384) not vector(1536)
const EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5'
export const EMBEDDING_DIMENSIONS = 384

/**
 * Converts a text string into a 384-dimensional embedding vector.
 * Used for both storing entries (embed the topic) and querying (embed the question).
 */
export async function embed(text: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: EMBEDDING_MODEL,
    inputs: text.trim(),
  })

  // HuggingFace can return number[] or number[][] depending on input type
  // Single string input returns number[] directly
  let vector: number[]

  if (Array.isArray(result) && Array.isArray(result[0])) {
    // Got number[][] — take the first row
    vector = result[0] as number[]
  } else {
    // Got number[] directly
    vector = result as number[]
  }

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}. ` +
      `Check that the model is ${EMBEDDING_MODEL}.`
    )
  }

  return vector
}