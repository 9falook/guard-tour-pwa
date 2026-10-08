/*** ============================================================
 *  Service Worker — แคชไฟล์ให้เปิดได้แม้ไม่มีเน็ต
 *  ============================================================ */

const CACHE_NAME = 'guard-tour-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap'
];

// ติดตั้ง → แคชไฟล์ทั้งหมด
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => {
      console.error('[SW] Cache install failed:', err);
    })
  );
  self.skipWaiting();
});

// Activate → ลบ cache เก่า
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

// Fetch → cache-first สำหรับ static, network-only สำหรับ API
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API ไป Apps Script → ไม่แคช
  if (url.hostname.includes('script.google.com')) {
    return;   // ปล่อยให้ browser จัดการ
  }

  // Static assets → cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // แคชเพิ่มเติมสำหรับ font
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // ถ้า offline + ไม่มีใน cache → ลองคืน index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

// Background Sync (ถ้า browser รองรับ)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-scans') {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage({ type: 'SYNC_NOW' }));
      })
    );
  }
});

console.log('[SW] Service Worker loaded');
