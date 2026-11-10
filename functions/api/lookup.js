// Cloudflare Pages Function: POST /api/lookup { query } -> { results }
import { lookup } from '../../src/lookup.js';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request.' }, 400);
  }
  try {
    return json(await lookup(body && body.query));
  } catch (e) {
    return json({ error: e.message }, /^Enter a/.test(e.message) ? 400 : 502);
  }
}
