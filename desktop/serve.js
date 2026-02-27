#!/usr/bin/env node
/**
 * NowAIKit Web Server
 *
 * Zero-dependency Node.js server that:
 * 1. Serves the built renderer/dist/ static files
 * 2. Proxies /api/ai/* requests to AI providers (bypasses CORS)
 *
 * Usage:
 *   node serve.js              # default port 4175
 *   PORT=3000 node serve.js    # custom port
 *   npm run serve              # via package.json script
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '4175', 10);
const STATIC_DIR = path.join(__dirname, 'renderer', 'dist');

// ─── MIME types ──────────────────────────────────────────────────────────────

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':  'font/ttf',
  '.map':  'application/json',
};

// ─── AI provider proxy config ────────────────────────────────────────────────

const AI_PROXIES = {
  '/api/ai/anthropic': { target: 'https://api.anthropic.com', strip: '/api/ai/anthropic' },
  '/api/ai/openai':    { target: 'https://api.openai.com',    strip: '/api/ai/openai' },
  '/api/ai/google':    { target: 'https://generativelanguage.googleapis.com', strip: '/api/ai/google' },
  '/api/ai/groq':      { target: 'https://api.groq.com',      strip: '/api/ai/groq' },
  '/api/ai/openrouter': { target: 'https://openrouter.ai',    strip: '/api/ai/openrouter' },
};

// ─── Proxy handler ───────────────────────────────────────────────────────────

function proxyRequest(req, res, proxyConfig) {
  const rewritten = req.url.replace(proxyConfig.strip, '') || '/';
  const target = new URL(rewritten, proxyConfig.target);

  // Collect request body
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(chunks);

    // Forward headers, stripping host/origin (let https set them)
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.origin;
    delete headers.referer;
    headers['host'] = target.hostname;

    const options = {
      hostname: target.hostname,
      port: 443,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    };

    const proxyReq = https.request(options, (proxyRes) => {
      // Forward CORS headers for browser
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');

      // Forward response headers
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (key.toLowerCase() !== 'access-control-allow-origin' &&
            key.toLowerCase() !== 'access-control-allow-methods' &&
            key.toLowerCase() !== 'access-control-allow-headers') {
          if (value) res.setHeader(key, value);
        }
      }

      res.writeHead(proxyRes.statusCode || 500);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`Proxy error -> ${target.hostname}: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Proxy error: ${err.message}` }));
    });

    if (body.length > 0) proxyReq.write(body);
    proxyReq.end();
  });
}

// ─── Static file handler ─────────────────────────────────────────────────────

function serveStatic(req, res) {
  let filePath = path.join(STATIC_DIR, req.url === '/' ? 'index.html' : req.url.split('?')[0]);

  // Security: prevent directory traversal
  if (!filePath.startsWith(STATIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // SPA fallback: serve index.html for client-side routes
      filePath = path.join(STATIC_DIR, 'index.html');
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
      });
      res.end(data);
    });
  });
}

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return;
  }

  // Check if this is an AI proxy request
  for (const [prefix, config] of Object.entries(AI_PROXIES)) {
    if (req.url.startsWith(prefix)) {
      proxyRequest(req, res, config);
      return;
    }
  }

  // Serve static files
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`\n  NowAIKit Web Server`);
  console.log(`  ───────────────────────────────`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`\n  AI proxy:  /api/ai/* -> provider APIs`);
  console.log(`  Static:    ${STATIC_DIR}`);
  console.log(`\n  All AI providers supported (CORS proxied).`);
  console.log(`  Press Ctrl+C to stop.\n`);
});
