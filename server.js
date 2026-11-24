/**
 * Optional Zero-Dependency Node.js Proxy Server (Node 18+)
 * Menjaga GEMINI_API_KEY tetap aman di sisi server (tidak terekspos ke browser).
 *
 * Jalankan:
 *   set GEMINI_API_KEY=AIzaSy...  (Windows CMD)
 *   $env:GEMINI_API_KEY="AIzaSy..." (PowerShell)
 *   node server.js
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');

// Muat .env secara sederhana bila ada
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!(key in process.env)) {
      process.env[key] = val;
    }
  }
}

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.GEMINI_API_KEY || '';
const API_BASE_URL = (process.env.GEMINI_API_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');

const STATIC_FILES = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/index.html': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'application/javascript; charset=utf-8' },
};

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    const MAX_BYTES = 20 * 1024 * 1024; // 20 MB (untuk gambar referensi base64)
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BYTES) {
        reject(new Error('Payload terlalu besar (maksimal 20 MB)'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Body JSON tidak valid'));
      }
    });
    req.on('error', reject);
  });
}

async function proxyGoogleJson(res, targetUrl, method = 'GET', bodyObj = null) {
  if (!API_KEY) {
    return sendJson(res, 500, {
      error: { message: 'GEMINI_API_KEY belum diatur di environment server (.env).' },
    });
  }

  const headers = { 'x-goog-api-key': API_KEY };
  const options = { method, headers };
  if (bodyObj !== null) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(bodyObj);
  }

  const upstream = await fetch(targetUrl, options);
  const text = await upstream.text();
  res.writeHead(upstream.status, {
    'Content-Type': upstream.headers.get('content-type') || 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const { pathname } = urlObj;

    // 1. Static assets
    if (req.method === 'GET' && STATIC_FILES[pathname]) {
      const entry = STATIC_FILES[pathname];
      const filePath = path.join(__dirname, entry.file);
      const content = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': entry.type });
      res.end(content);
      return;
    }

    // 2. Health check
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        proxy: true,
        hasApiKey: Boolean(API_KEY),
        baseUrl: API_BASE_URL,
      });
    }

    // 3. Google Veo generate (:predictLongRunning)
    if (req.method === 'POST' && pathname === '/api/veo/generate') {
      const body = await readJsonBody(req);
      const model = body.model || 'veo-3.1-generate-001';
      const target = `${API_BASE_URL}/models/${encodeURIComponent(model)}:predictLongRunning`;
      return await proxyGoogleJson(res, target, 'POST', {
        instances: body.instances,
        parameters: body.parameters,
      });
    }

    // 4. Google Veo status polling
    if (req.method === 'GET' && pathname === '/api/veo/status') {
      const opName = urlObj.searchParams.get('name');
      if (!opName) return sendJson(res, 400, { error: { message: 'Parameter "name" wajib diisi.' } });
      const cleanName = opName.replace(/^\/+/, '');
      return await proxyGoogleJson(res, `${API_BASE_URL}/${cleanName}`, 'GET');
    }

    // 5. Gemini Omni Interactions generate
    if (req.method === 'POST' && pathname === '/api/interactions/generate') {
      const body = await readJsonBody(req);
      return await proxyGoogleJson(res, `${API_BASE_URL}/interactions`, 'POST', body);
    }

    // 6. Gemini Omni Interactions status
    if (req.method === 'GET' && pathname === '/api/interactions/status') {
      const id = urlObj.searchParams.get('id');
      if (!id) return sendJson(res, 400, { error: { message: 'Parameter "id" wajib diisi.' } });
      return await proxyGoogleJson(res, `${API_BASE_URL}/interactions/${encodeURIComponent(id)}`, 'GET');
    }

    // 7. Secure media download proxy (only allows Google APIs host)
    if (req.method === 'GET' && pathname === '/api/download') {
      if (!API_KEY) {
        return sendJson(res, 500, { error: { message: 'GEMINI_API_KEY belum diatur.' } });
      }
      const rawUri = urlObj.searchParams.get('uri');
      if (!rawUri) return sendJson(res, 400, { error: { message: 'Parameter "uri" wajib diisi.' } });

      const parsedMedia = new URL(rawUri);
      if (!parsedMedia.hostname.endsWith('.googleapis.com')) {
        return sendJson(res, 403, { error: { message: 'Host media tidak diizinkan.' } });
      }

      const downloadUrl = rawUri.includes('alt=media')
        ? rawUri
        : `${rawUri}${rawUri.includes('?') ? '&' : '?'}alt=media`;

      const upstream = await fetch(downloadUrl, {
        headers: { 'x-goog-api-key': API_KEY },
      });
      if (!upstream.ok) {
        const errText = await upstream.text();
        return sendJson(res, upstream.status, { error: { message: errText } });
      }

      const arrayBuf = await upstream.arrayBuffer();
      res.writeHead(200, {
        'Content-Type': upstream.headers.get('content-type') || 'video/mp4',
        'Cache-Control': 'no-store',
      });
      res.end(Buffer.from(arrayBuf));
      return;
    }

    sendJson(res, 404, { error: { message: 'Endpoint tidak ditemukan.' } });
  } catch (err) {
    sendJson(res, 500, { error: { message: err.message || 'Internal Server Error' } });
  }
});

server.listen(PORT, () => {
  console.log(`Veo Studio berjalan di http://localhost:${PORT}`);
  console.log(`Status GEMINI_API_KEY: ${API_KEY ? 'TERDETEKSI' : 'BELUM DIATUR (atur di .env)'}`);
});
