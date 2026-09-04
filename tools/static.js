'use strict';
/*
 * static.js - zero-dependency static file server with no build step.
 *
 * Used to serve an unpacked release build from an arbitrary directory so the
 * exact submitted files can be tested.
 *
 * Usage: node tools/static.js <directory> [port] [host]
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || '.');
const PORT = Number(process.argv[3]) || 8090;
const HOST = process.argv[4] || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

http.createServer(function (req, res) {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
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
}).listen(PORT, HOST, function () {
  console.log('static server for ' + ROOT + ' on http://localhost:' + PORT + '/');
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
