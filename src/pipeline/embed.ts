import { HfInference } from '@huggingface/inference'
import 'dotenv/config'

const hf = new HfInference(process.env.HF_API_KEY)

const EMBEDDING_MODEL = 'BAAI/bge-small-en-v1.5'
export const EMBEDDING_DIMENSIONS = 384  // export so schema.sql reminder is in code

export async function embed(text: string): Promise<number[]> {
  const result = await hf.featureExtraction({
    model: EMBEDDING_MODEL,
    inputs: text.trim(),
  })

  if (!Array.isArray(result)) {
    throw new Error('Unexpected embedding response shape from HuggingFace')
  }

  // If the model returns a 2D array (batch of 1), flatten it
  const vector = Array.isArray(result[0]) ? (result[0] as number[]) : (result as number[])

  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${vector.length}. Wrong model?`
    )
  }

  return vector
}


export async function embedBatch(texts: string[]): Promise<number[][]> {
  const result = await hf.featureExtraction({
    model: EMBEDDING_MODEL,
    inputs: texts.map(t => t.trim()),
  })

  // When inputs is string[], result is number[][]
  // TODO: validate the shape and return it
  // Each inner array should be EMBEDDING_DIMENSIONS long
    if (!Array.isArray(result) || !Array.isArray(result[0])) {
    throw new Error('Unexpected embedding response shape from HuggingFace for batch')
  }
  
  return result as number[][]
}