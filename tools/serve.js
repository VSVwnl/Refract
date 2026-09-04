'use strict';
/*
 * serve.js - zero-dependency static file server for development.
 *
 * Rebuilds index.html (development build, debug tools included) on every
 * request for "/" or "/index.html" so the browser never sees a stale file.
 *
 * Usage: node tools/serve.js [port] [host]
 *   node tools/serve.js               localhost only
 *   node tools/serve.js 8080 0.0.0.0  reachable from a phone on the same network
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const build = require('./build.js');

const ROOT = path.resolve(__dirname, '..');
const PORT = Number(process.argv[2]) || 8080;
const HOST = process.argv[3] || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png'
};

const server = http.createServer(function (req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  if (urlPath === '/index.html') {
    try {
      build(true);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('build failed:\n' + err.stack);
      return;
    }
  }

  const filePath = path.join(ROOT, urlPath.replace(/^\/+/, ''));
  if (filePath.indexOf(ROOT) !== 0) {
    res.writeHead(403).end('forbidden');
    return;
  }

  fs.readFile(filePath, function (err, data) {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found: ' + urlPath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, function () {
  console.log('REFRACT dev server on http://localhost:' + PORT + '/');
  if (HOST === '0.0.0.0') {
    const nets = require('os').networkInterfaces();
    Object.keys(nets).forEach(function (name) {
      nets[name].forEach(function (net) {
        if (net.family === 'IPv4' && !net.internal) {
          console.log('  on this network: http://' + net.address + ':' + PORT + '/');
        }
      });
    });
  }
});
