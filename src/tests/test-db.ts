import 'dotenv/config'
import { db } from './db/client'
import { writeEntry, searchEntries, getEntry } from './db/entries'
import { embed } from './pipeline/embed'

function decodeJWT(token: string) {
  // JWT is three base64 parts separated by dots
  // The second part is the payload
  try {
    const base64 = token.split('.')[1]
    // Node's Buffer can decode base64
    const decoded = Buffer.from(base64, 'base64url').toString('utf8')
    return JSON.parse(decoded)
  } catch {
    return null
  }
}

async function test() {
  console.log('── Credential check ──────────────────')
  const key = process.env.SUPABASE_SERVICE_KEY ?? ''
  console.log('Key length:', key.length)
  console.log('First char code:', key.charCodeAt(0), '(101=e is correct, 34=" is wrong)')
  
  const payload = decodeJWT(key)
  if (payload) {
    console.log('JWT role:', payload.role)      // must be "service_role"
    console.log('JWT ref:', payload.ref)        // your project ref
    console.log('Expires:', new Date(payload.exp * 1000).toISOString())
  } else {
    console.log('Could not decode JWT — key may be malformed')
  }
  console.log()

  console.log('── Connection test ───────────────────')
  const { data, error } = await db.from('entries').select('count')
  
  if (error) {
    console.error('FAILED:', error.message)
    console.error('Code:', error.code)
    console.error('Hint:', error.hint ?? 'none')
    process.exit(1)
  }
  
  console.log('Connected ✓\n')

  console.log('── Write test ────────────────────────')
  const testEmbedding = await embed('test topic')
  const written = await writeEntry({
    topic:      'AWP test entry',
    facts:      [{ claim: 'This is a test', type: 'text' }],
    source_url: 'https://example.com',
    embedding:  testEmbedding,
  })
  console.log('Written ID:', written.id, '✓\n')

  console.log('── Search test ───────────────────────')
  const results = await searchEntries(await embed('AWP test'), 0.5)
  console.log('Results found:', results.length, '✓\n')

  console.log('── GetEntry test ─────────────────────')
  const fetched = await getEntry(written.id)
  console.log('Fetched topic:', fetched?.topic, '✓\n')

  console.log('All tests passed ✓')
}

test().catch(err => {
  console.error('Error:', err.message)
  process.exit(1)
})