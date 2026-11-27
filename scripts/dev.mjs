// Server lokal sederhana: file statis + folder /api (tanpa perlu Vercel CLI).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
if (existsSync(join(root, '.env'))) {
  for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[2].trim()) process.env[m[1]] ||= m[2].trim().replace(/^'(.*)'$/, '$1');
  }
}
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const PUBLIC = /^(index\.html|styles\.css|js\/[\w-]+\.js|shared\/[\w-]+\.js)$/;

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const api = path.match(/^\/api\/(config|action|health|auth)$/);
    if (api) {
      let body = '';
      for await (const chunk of req) { body += chunk; if (body.length > 1e4) throw new Error('Body terlalu besar'); }
      req.body = body;
      res.status = (c) => { res.statusCode = c; return res; };
      res.json = (o) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
      const mod = await import(`../api/${api[1]}.js`);
      return await mod.default(req, res);
    }
    const file = normalize(path === '/' ? 'index.html' : path.slice(1)).split(sep).join('/');
    if (!PUBLIC.test(file)) { res.statusCode = 404; return res.end('Tidak ditemukan'); }
    res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
    res.end(await readFile(join(root, file)));
  } catch (e) {
    console.error(e.message);
    res.statusCode = e.code === 'ENOENT' ? 404 : 500;
    res.end(e.code === 'ENOENT' ? 'Tidak ditemukan' : 'Server error (sudah npm install?)');
  }
}).listen(Number(process.env.PORT) || 3000, () => console.log(`Blocky Royale: http://localhost:${process.env.PORT || 3000}`));
