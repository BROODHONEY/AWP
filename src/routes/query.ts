import { Hono } from 'hono'
import { embed } from '../pipeline/embed'
import { webSearch, fetchAndStrip } from '../pipeline/search'
import { extractFacts } from '../pipeline/extract'
import { searchEntries, writeEntry, searchQueries, writeQuery, getEntry } from '../db/entries'
import { computeConfidence, isStale, confidenceLabel } from '../pipeline/confidence'

export const queryRouter = new Hono()

queryRouter.get('/', async (c) => {
  const q = c.req.query('q')

  if (!q || q.trim() === '') {
    return c.json({ error: 'q parameter is required. Usage: /query?q=your+question' }, 400)
  }

  try {

    // ── Step 1: Embed the query ──────────────────────────────────────
    const queryEmbedding = await embed(q)

    // ── Step 2: Search stored queries first ──────────────────────────
    // This catches "Who wrote 48 laws of power" matching a previous
    // query "What is the 48 laws of power" — same topic, different phrasing
    const matchedEntryId = await searchQueries(queryEmbedding)

    if (matchedEntryId) {
      const entry = await getEntry(matchedEntryId)

      if (entry) {
        const confidence = computeConfidence({
          source_url:         entry.source_url,
          fetched_at:         entry.fetched_at,
          extraction_quality: (entry as any).extraction_quality ?? null,
          volatility_class:   (entry as any).volatility_class   ?? null,
        })

        if (!isStale(confidence)) {
          console.log(`Query cache hit: "${q}" → entry "${entry.topic}" (confidence: ${confidence})`)

          // Store this query variant too — so future similar queries also match
          await writeQuery(entry.id, q, queryEmbedding)

          return c.json({
            hit:        true,
            source:     'cache',
            topic:      entry.topic,
            facts:      entry.facts,
            source_url: entry.source_url,
            fetched_at: entry.fetched_at,
            confidence: confidence,
            confidence_label: confidenceLabel(confidence),
          })
        }

        console.log(`Query matched but entry stale (confidence: ${confidence}) — re-fetching...`)
      }
    }

    // ── Step 3: Search by topic embedding ───────────────────────────
    const results = await searchEntries(queryEmbedding)

    if (results.length > 0) {
      const best = results[0]

      const confidence = computeConfidence({
        source_url:         best.source_url,
        fetched_at:         best.fetched_at,
        extraction_quality: (best as any).extraction_quality ?? null,
        volatility_class:   (best as any).volatility_class   ?? null,
      })

      console.log(`Topic cache hit: "${best.topic}" (similarity: ${best.similarity?.toFixed(3)}, confidence: ${confidence})`)

      if (!isStale(confidence)) {
        // Store this query so future variations also hit cache
        await writeQuery(best.id, q, queryEmbedding)

        return c.json({
            hit:        true,
            source:     'cache',
            topic:      best.topic,
            facts:      best.facts,
            source_url: best.source_url,
            fetched_at: best.fetched_at,
            confidence: confidence,
            confidence_label: confidenceLabel(confidence),
          })
      }

      console.log(`Entry stale (confidence: ${confidence}) — re-fetching from web...`)
    }

    // ── Step 4: Web fallback ─────────────────────────────────────────
    console.log(`Web fetch for: "${q}"`)

    const urls = await webSearch(q)
    if (urls.length === 0) {
      return c.json({ error: `No sources found for: "${q}"` }, 404)
    }

    const targetUrl = urls[0]
    console.log(`  Source: ${targetUrl}`)

    const strippedText = await fetchAndStrip(targetUrl)

    console.log('  Extracting facts...')
    const extracted = await extractFacts(targetUrl, strippedText)
    console.log(`  Topic: "${extracted.topic}" — ${extracted.facts.length} facts`)
    console.log(`  Quality: ${extracted.extraction_quality}, Volatility: ${extracted.volatility_class}`)

    const topicEmbedding = await embed(extracted.topic)

    const entry = await writeEntry({
      topic:              extracted.topic,
      facts:              extracted.facts,
      source_url:         targetUrl,
      embedding:          topicEmbedding,
      extraction_quality: extracted.extraction_quality,
      volatility_class:   extracted.volatility_class,
    })

    // Store the original query string so future similar questions hit cache
    await writeQuery(entry.id, q, queryEmbedding)

    const confidence = computeConfidence({
      source_url:         entry.source_url,
      fetched_at:         entry.fetched_at,
      extraction_quality: extracted.extraction_quality,
      volatility_class:   extracted.volatility_class,
    })

    console.log(`  Written: ${entry.id} (confidence: ${confidence})`)

    return c.json({
      hit:        false,
      source:     'web',
      topic:      entry.topic,
      facts:      entry.facts,
      source_url: entry.source_url,
      fetched_at: entry.fetched_at,
      confidence: confidence,
      confidence_label: confidenceLabel(confidence),
    })

  } catch (err: any) {
    console.error('Query error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})