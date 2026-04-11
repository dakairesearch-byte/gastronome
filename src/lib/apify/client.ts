// Direct fetch-based Apify API client (avoids apify-client proxy-agent bundling issues)
const APIFY_TOKEN = process.env.APIFY_API_TOKEN!
const APIFY_BASE = 'https://api.apify.com/v2'

// Apify REST API requires tilde-separated actor IDs in the URL path
function normalizeActorId(actorId: string): string {
  return actorId.replace('/', '~')
}

export async function runActor(actorId: string, input: Record<string, unknown>): Promise<{ defaultDatasetId: string }> {
  const normalized = normalizeActorId(actorId)
  const res = await fetch(`${APIFY_BASE}/acts/${normalized}/runs?token=${APIFY_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Apify actor ${actorId} failed to start: ${res.status} ${text}`)
  }
  const run = await res.json()
  const runId = run.data?.id
  if (!runId) throw new Error(`No run ID returned for ${actorId}`)

  // Poll until run finishes (max 4 min)
  const deadline = Date.now() + 240_000
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5000))
    const statusRes = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${APIFY_TOKEN}`)
    const statusData = await statusRes.json()
    const status = statusData.data?.status
    if (status === 'SUCCEEDED') {
      return { defaultDatasetId: statusData.data.defaultDatasetId }
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      throw new Error(`Apify actor ${actorId} run ${status}`)
    }
  }
  throw new Error(`Apify actor ${actorId} timed out after 4 minutes`)
}

export async function getDatasetItems(datasetId: string): Promise<any[]> {
  const res = await fetch(`${APIFY_BASE}/datasets/${datasetId}/items?token=${APIFY_TOKEN}`)
  if (!res.ok) {
    throw new Error(`Failed to fetch dataset ${datasetId}: ${res.status}`)
  }
  return res.json()
}
