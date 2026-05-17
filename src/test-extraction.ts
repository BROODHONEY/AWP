import { fetchAndStrip } from './pipeline/search'
import { extractFacts } from './pipeline/extract'

async function test() {
  const url = 'https://en.wikipedia.org/wiki/Python_(programming_language)'

  console.log('1. Fetching and stripping...')
  const text = await fetchAndStrip(url)
  console.log(`   Got ${text.split(' ').length} words of clean text`)
  console.log(`   Preview: ${text.slice(0, 150)}...`)

  console.log('\n2. Extracting facts (this takes 10–30s on first call)...')
  const result = await extractFacts(url, text)

  console.log('\n✓ Extraction complete')
  console.log('  Topic:', result.topic)
  console.log('  Facts:', result.facts.length)
  console.log('  Quality:', result.extraction_quality)
  console.log('  Volatility:', result.volatility_class)
  console.log('\n  Facts list:')
  result.facts.forEach((f, i) => console.log(`    ${i + 1}. ${f.claim}`))
}

test().catch(console.error)