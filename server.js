const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = 3000;

const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript'
};

// Cache the HTML file in memory to avoid repeated disk reads
let cachedHtml = null;
let cachedHtmlGzip = null;

function loadAndCacheHtml(callback) {
  const filePath = path.join(__dirname, 'public', 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) return callback(err);
    cachedHtml = data;
    zlib.gzip(data, (gzErr, compressed) => {
      if (!gzErr) cachedHtmlGzip = compressed;
      callback(null);
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    const acceptsGzip = (req.headers['accept-encoding'] || '').includes('gzip');

    function sendResponse() {
      const headers = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff'
      };

      if (acceptsGzip && cachedHtmlGzip) {
        headers['Content-Encoding'] = 'gzip';
        headers['Content-Length'] = cachedHtmlGzip.length;
        res.writeHead(200, headers);
        res.end(cachedHtmlGzip);
      } else {
        headers['Content-Length'] = cachedHtml.length;
        res.writeHead(200, headers);
        res.end(cachedHtml);
      }
    }

    if (cachedHtml) {
      sendResponse();
    } else {
      loadAndCacheHtml((err) => {
        if (err) {
          res.writeHead(500);
          res.end('Error loading page');
          return;
        }
        sendResponse();
      });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

// Pre-load the HTML file before the server starts accepting connections
loadAndCacheHtml((err) => {
  if (err) {
    console.error('Warning: could not pre-cache index.html:', err.message);
  }
  server.listen(PORT, () => {
    console.log('Server running at http://localhost:' + PORT);
  });
});

// Watch for file changes in development so the cache stays fresh
fs.watch(path.join(__dirname, 'public', 'index.html'), () => {
  loadAndCacheHtml((err) => {
    if (!err) console.log('index.html reloaded into cache');
  });
});
