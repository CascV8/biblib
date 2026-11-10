// Local development server: serves public/ and the /api/lookup endpoint.
// In production the same lookup code runs as a Cloudflare Pages Function (functions/api/lookup.js).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { lookup } from './src/lookup.js';

const PORT = process.env.PORT || 3000;
const root = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));

app.post('/api/lookup', async (req, res) => {
  try {
    res.json(await lookup(req.body && req.body.query));
  } catch (e) {
    res.status(/^Enter a/.test(e.message) ? 400 : 502).json({ error: e.message });
  }
});

app.listen(PORT, () => console.log(`Biblib running at http://localhost:${PORT}`));
