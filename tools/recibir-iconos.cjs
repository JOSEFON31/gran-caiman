// Utilidad de desarrollo: recibe los PNG que genera el navegador y los guarda.
// Se usa una sola vez para crear los iconos a partir de img/sidebar.jpg.
//   node tools/recibir-iconos.cjs
const http = require('node:http');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const destino = join(__dirname, '..', 'img');

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  const nombre = (new URL(req.url, 'http://x').searchParams.get('nombre') || '')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  if (req.method !== 'POST' || !nombre.endsWith('.png')) {
    return res.writeHead(400).end('nombre invalido');
  }
  const trozos = [];
  req.on('data', (t) => trozos.push(t));
  req.on('end', () => {
    const buf = Buffer.concat(trozos);
    writeFileSync(join(destino, nombre), buf);
    console.log('escrito img/' + nombre + '  ' + buf.length + ' bytes');
    res.writeHead(200).end('ok');
  });
}).listen(4199, () => console.log('receptor escuchando en 4199'));
