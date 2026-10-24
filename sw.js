const CACHE_NAME = 'rafiq-almuslim-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon.svg'
];

// التثبيت وتخزين الملفات الأساسية
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// تفعيل وتنظيف الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) return caches.delete(k);
        })
      );
    })
  );
  self.clients.claim();
});

// استراتيجية الجلب (Network First with Cache Fallback للمحتوى الديناميكي، و Cache First للأصول الثابتة)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // تخطي طلبات البث المباشر للصوت ومكتبات الصوت الكبيرة لتعمل من الشبكة مباشرة
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('radio') || url.hostname.includes('stream')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request).then((res) => {
        if (!res || res.status !== 200 || res.type === 'opaque') {
          return res;
        }
        // تخزين الخطوط وملفات الـ CDN مؤقتاً
        if (url.hostname.includes('cdnjs') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('fonts.gstatic') || url.hostname.includes('tailwindcss')) {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return res;
      }).catch(() => {
        if (e.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});