const maxScore = 120000;
const githubOrigin = 'https://weiyu168.github.io';
const rankQuery = 'SELECT name, score FROM racers ORDER BY score DESC, achieved_at ASC, name_key ASC LIMIT 8';
const updateQuery = `
  INSERT INTO racers (name_key, name, score, achieved_at) VALUES (?1, ?2, ?3, ?4)
  ON CONFLICT(name_key) DO UPDATE SET name=excluded.name, score=excluded.score, achieved_at=excluded.achieved_at
  WHERE excluded.score > racers.score
`;

async function readEntry(request) {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const bytes = new Uint8Array(512);
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (size + value.length > bytes.length) {
        await reader.cancel();
        return null;
      }
      bytes.set(value, size);
      size += value.length;
    }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)));
    if (typeof data?.name !== 'string' || !Number.isInteger(data.score) || data.score < 0 || data.score > maxScore) return null;
    const name = data.name.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!name || name.length > 24 || /\p{C}/u.test(name)) return null;
    return { name, key: name.normalize('NFKC').toLowerCase(), score: data.score };
  } catch {
    return null;
  }
}

export async function onRequest({ request, env }) {
  const origin = request.headers.get('Origin');
  const headers = new Headers({ 'Cache-Control': 'no-store', Vary: 'Origin' });
  if (origin === githubOrigin) headers.set('Access-Control-Allow-Origin', origin);
  const json = (body, status = 200) => Response.json(body, { status, headers });
  if (request.method === 'OPTIONS' && origin === githubOrigin) {
    headers.set('Access-Control-Allow-Methods', 'GET, POST');
    headers.set('Access-Control-Allow-Headers', 'Content-Type');
    headers.set('Access-Control-Max-Age', '86400');
    return new Response(null, { status: 204, headers });
  }
  if (!env.LEADERBOARD) return json({ error: 'leaderboard_unavailable' }, 503);
  const query = env.LEADERBOARD.prepare(rankQuery);
  if (request.method === 'GET') {
    const { results } = await query.all();
    return json({ entries: results });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (origin && origin !== githubOrigin && origin !== new URL(request.url).origin) return json({ error: 'origin_not_allowed' }, 403);
  const entry = await readEntry(request);
  if (!entry) return json({ error: 'invalid_entry' }, 400);

  const [write, board] = await env.LEADERBOARD.batch([
    env.LEADERBOARD.prepare(updateQuery).bind(entry.key, entry.name, entry.score, Date.now()),
    query,
  ]);
  return json({ improved: write.meta.changes > 0, entries: board.results });
}
