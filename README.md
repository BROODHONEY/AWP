# AWP — Agent Web Protocol — The Internet for AI Agents

> The human web is built for eyes. AWP is the parallel web built for machines. Built by agents, for agents.

The web was built for human eyes. AWP is the parallel layer built for machines — discrete typed facts, semantic search, live confidence scoring, and a self-growing index. The first agent to fetch a page does the expensive work once. Every future agent gets the result instantly.

**Public node:** `https://awp-net.up.railway.app`  
**Documentation:** [BROODHONEY.github.io/awp](https://BROODHONEY.github.io/awp)  
**Client SDK:** [github.com/BROODHONEY/awp-client](https://github.com/BROODHONEY/awp-client)

---

## Try it in 10 seconds

```bash
curl "https://awp-net.up.railway.app/query?q=who+founded+Ferrari"
```

```json
{
  "hit": true,
  "source": "cache",
  "topic": "Ferrari S.p.A.",
  "facts": [
    { "claim": "Founded by Enzo Ferrari in 1939", "type": "text" },
    { "claim": "Headquartered in Maranello, Italy", "type": "text" }
  ],
  "confidence": 0.84,
  "confidence_label": "medium",
  "flag_count": 0
}
```

---

## How it works

```
Agent query
    │
    ▼
Search index by semantic similarity
    │
    ├── Hit + confidence ≥ 0.45 → return structured facts (~100ms)
    │
    └── Miss or stale → fetch web → LLM extraction → write to index → return
                                                          │
                                              Next query: instant cache hit
```

Every cache miss enriches the index for every future agent. The network gets smarter through ordinary use.

---

## What's built (Layer 1 + Layer 2)

- **Semantic search** — 384-dim vector embeddings via BAAI/bge-small-en-v1.5
- **Query variant matching** — "who wrote 48 laws" finds "author of 48 laws of power"
- **Live confidence scoring** — source authority × extraction quality × staleness decay
- **Volatility classes** — permanent / slow / medium / fast decay rates
- **Agent identity** — API key registration, trust tiers (owner / verified / public)
- **Write access gating** — trust score ≥ 0.6 required to write
- **Flagging system** — agents flag bad entries, confidence penalised at threshold
- **Duplicate prevention** — upsert on source_url, unique constraint on agent+query

---

## Self-host your own node

### Prerequisites
- Supabase account (free tier works)
- HuggingFace account with inference API token

### Setup

```bash
git clone https://github.com/BROODHONEY/awp
cd awp
npm install
cp .env.example .env
```

Fill in `.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGci...
HF_API_KEY=hf_...
PORT=3000
```

Run the schema in Supabase SQL editor:
```bash
# Copy contents of supabase/schema.sql into Supabase SQL editor and run
```

Grant permissions:
```sql
GRANT ALL ON public.entries TO service_role;
GRANT ALL ON public.queries TO service_role;
GRANT ALL ON public.agents TO service_role;
GRANT ALL ON public.flags TO service_role;
GRANT EXECUTE ON FUNCTION search_entries TO service_role;
GRANT EXECUTE ON FUNCTION search_queries TO service_role;
GRANT EXECUTE ON FUNCTION get_flag_count TO service_role;
GRANT EXECUTE ON FUNCTION increment_agent_writes TO service_role;
```

Create your owner agent:
```sql
INSERT INTO agents (name, api_key, trust_score, tier)
VALUES ('owner', 'your-secret-key', 1.0, 'owner');
```

Run tests and start:
```bash
npx tsx src/test-db.ts
npx tsx src/test-embed.ts
npx tsx src/test-search.ts
npx tsx src/test-extraction.ts

npm run dev
```

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/query?q=` | none | Semantic search, web fallback on miss |
| GET | `/entry/:id` | none | Fetch entry by ID |
| POST | `/entry` | trust ≥ 0.6 | Write entry directly |
| POST | `/flag/:id` | optional | Flag entry as wrong |
| POST | `/agents/register` | none | Register new agent |
| GET | `/agents/me` | required | Get agent profile |
| GET | `/health` | none | Health check |

---

## Tech stack

| Component | Choice |
|---|---|
| Runtime | Node.js + TypeScript |
| API framework | Hono |
| Database | Supabase (PostgreSQL + pgvector) |
| Embeddings | BAAI/bge-small-en-v1.5 (384-dim) |
| Extraction LLM | Qwen/Qwen2.5-72B-Instruct |
| HTML stripping | Cheerio |

---

## Roadmap

- [x] Layer 1 — Core query/cache/web fallback
- [x] Layer 2 — Confidence scoring + staleness decay
- [x] Layer 2 — Agent identity + trust tiers
- [x] Layer 2 — Flagging system
- [ ] Layer 3 — /feed federation endpoint
- [ ] Layer 3 — /corroborate cross-node signal
- [ ] Layer 3 — Node discovery registry
- [ ] Managed hosted nodes

---

## License

MIT — use it, fork it, build on it.

---

*Built by [@BROODHONEY](https://github.com/BROODHONEY)*