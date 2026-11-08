/* REY Chord Songbook: service worker
   - Kerangka aplikasi (halaman, ikon): ambil dari internet dulu, kalau gagal pakai simpanan.
   - Daftar lagu (songs/index.json): internet dulu, kalau gagal pakai simpanan terakhir.
   - Isi lagu (songs/*.txt): tampil dari simpanan seketika, lalu diperbarui diam-diam di belakang.
   Naikkan angka SHELL kalau mengubah daftar file di bawah. Simpanan lagu (SONGS) tidak ikut terhapus. */
const SHELL = 'rey-songbook-shell-v1';
const SONGS = 'rey-songbook-songs-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('rey-songbook-shell-') && k !== SHELL).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((res, rej) => { const t = setTimeout(() => rej(new Error('timeout')), ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
}
async function networkFirst(req, cacheName, fallbackKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true }) || (fallbackKey ? await cache.match(fallbackKey, { ignoreSearch: true }) : null);
    if (hit) return hit;
    throw err;
  }
}
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(() => null);
  if (hit) { net.catch(() => {}); return hit; }
  const res = await net;
  return res || new Response('', { status: 504, statusText: 'Offline' });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  const p = decodeURIComponent(url.pathname);
  if (/\/songs\/index\.json$/.test(p)) { e.respondWith(networkFirst(req, SONGS)); return; }
  if (/\/songs\/[^/]+\.txt$/.test(p)) { e.respondWith(staleWhileRevalidate(req, SONGS)); return; }
  if (req.mode === 'navigate') { e.respondWith(networkFirst(req, SHELL, './')); return; }
  e.respondWith(networkFirst(req, SHELL));
});
