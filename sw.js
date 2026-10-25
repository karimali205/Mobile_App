const CACHE_NAME = 'rafiq-almuslim-v2';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// التثبيت وتخزين الملفات الأساسية فورياً
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// تفعيل وتنظيف أي كاش قديم لتحديث النسخة
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('Clearing old cache:', k);
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية الجلب الذكية (Network First with Cache Fallback)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // تخطي ملفات البث الصوتي المباشر والإذاعات لتعمل مباشرة من الشبكة
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('radio') || url.hostname.includes('stream')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // محاولة جلب أحدث نسخة من الشبكة أولاً
      const fetchPromise = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          // تحديث الكاش بالنسخة الأحدث في الخلفية
          if (url.origin === location.origin || url.hostname.includes('cdnjs') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('tailwindcss')) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
        }
        return networkResponse;
      }).catch(() => {
        // إذا انقطع الإنترنت، استخدم الكاش المخزن
        return cached || (e.request.destination === 'document' ? caches.match('./index.html') : null);
      });

      return cached || fetchPromise;
    })
  );
});