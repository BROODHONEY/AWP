import { embed } from './pipeline/embed'

async function test() {
  console.log('Testing embedding...')
  
  const vec = await embed('what is the Python programming language')
  
  console.log('Vector length:', vec.length)          // should be 384
  console.log('First 5 values:', vec.slice(0, 5))    // small floats
  console.log('Embed working ✓')
}

test().catch(console.error)