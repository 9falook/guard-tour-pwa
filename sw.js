/*** ============================================================
 *  Service Worker — v3 (Network First for HTML)
 *  ============================================================ */

const CACHE_NAME = 'guard-tour-v3';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ✅ บังคับติดตั้งทันที
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => console.log('Cache install failed:', err))
  );
});

// ✅ ล้าง Cache เก่าทิ้งทันที
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// ✅ Network-First สำหรับ HTML, Cache-First สำหรับไฟล์อื่น
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ไม่จัดการ Request ที่ไปหา Google Apps Script
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return; 
  }

  // ถ้าเป็น HTML ให้โหลดจากเน็ตก่อน (จะได้โค้ดใหม่เสมอ)
  if (event.request.mode === 'navigate' || (event.request.method === 'GET' && event.request.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request)) // ถ้าเน็ตหลุด ให้ใช้ Cache
    );
    return;
  }

  // ไฟล์อื่นๆ (รูป, CSS, JS) ให้โหลดจาก Cache ก่อน
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
