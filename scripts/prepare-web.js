const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'www');

function copy(source, destination) {
  const from = path.join(root, source);
  const to = path.join(output, destination || source);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

// Capacitor expects an index.html at the root of webDir.
let html = fs.readFileSync(path.join(root, 'MPMFIT 3.0.html'), 'utf8');
// The native package is updated through APK releases, so the PWA service worker
// must not cache an old web bundle inside the Android WebView.
html = html.replace(
  /<script>\s*if\('serviceWorker' in navigator && location\.protocol\.startsWith\('http'\)\)\s*\{[\s\S]*?\}\s*<\/script>\s*(?=<\/body>)/,
  ''
);
fs.writeFileSync(path.join(output, 'index.html'), html, 'utf8');

copy('nutrition.js');
copy('cloud-sync.js');
copy('manifest.json');
copy('icons/icon.svg');

console.log('MPMFIT web bundle prepared in ./www');
