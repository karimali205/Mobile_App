const CACHE_NAME = 'rafiq-almuslim-v12';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// التثبيت وتخزين الملفات الأساسية فورياً لفتح فوري بدون إنترنت
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// تفعيل وتنظيف أي كاش قديم لتحديث النسخة فورياً
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

// التعامل مع النقر على الإشعارات وفتح التطبيق فورياً
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || './index.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// استقبال طلب إرسال إشعار من الصفحة والتطبيق
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, {
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200, 100, 200],
      dir: 'rtl',
      lang: 'ar',
      ...options
    });
  }
});

// استراتيجية التشغيل الفوري (Stale-While-Revalidate / Cache First للأصول الثابتة)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // تخطي ملفات التلاوات الصوتية المباشرة والإذاعات
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('radio') || url.hostname.includes('stream')) {
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cached) => {
      // إطلاق استعلام الشبكة في الخلفية لتحديث الملفات دائماً بأحدث نسخة
      const networkUpdate = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          if (url.origin === location.origin || url.hostname.includes('cdnjs') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('tailwindcss')) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
        }
        return networkResponse;
      }).catch(() => {
        // في حال عدم توفر اتصال بالإنترنت
        return cached || (e.request.destination === 'document' ? caches.match('./index.html') : null);
      });

      // إذا كان الملف مخزناً، يتم إرجاعه فورياً (0ms) مع تحديثه في الخلفية
      return cached || networkUpdate;
    })
  );
});