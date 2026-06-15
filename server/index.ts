import http from 'node:http';

const PORT = Number(process.env.USEEKER_API_PORT) || 8787;

const server = http.createServer((req, res) => {
  // CORS headers (localhost only)
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url === '/api/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  if (req.url === '/api/ai' && req.method === 'POST') {
    const allowCloud = process.env.USEEKER_ALLOW_CLOUD_AI === 'true';
    if (!allowCloud) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cloud AI dinonaktifkan. Aktifkan USEEKER_ALLOW_CLOUD_AI=true di .env' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'AI endpoint aktif', data: JSON.parse(body || '{}') }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('uSeeker API berjalan di http://127.0.0.1:' + PORT);
});
