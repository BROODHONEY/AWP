import { webSearch, fetchAndStrip } from './pipeline/search'

async function test() {
  // 1. Search for something real
  const urls = await webSearch('Python 3.13 new features')
  console.log('Found URLs:', urls)

  // 2. Fetch and strip the first result
  const text = await fetchAndStrip(urls[0])
  console.log('Stripped text (first 500 chars):')
  console.log(text.slice(0, 500))

  // Think about: does the output look like something useful for an LLM?
  // Is there any noise left in it? How would you filter it more?
}

test()