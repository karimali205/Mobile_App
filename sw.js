const CACHE_NAME = 'rafiq-almuslim-v14';
const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// التثبيت وتجاوز الانتظار فورياً
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// تفعيل وتنظيف كافة النسخ القديمة فورياً وإشعار كافة النوافذ المفتوحة
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            console.log('Clearing outdated cache:', k);
            return caches.delete(k);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// التعامل مع النقر على الإشعارات
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

// استقبال الرسائل من التطبيق
self.addEventListener('message', (event) => {
  if (event.data) {
    if (event.data.type === 'SKIP_WAITING') {
      self.skipWaiting();
    } else if (event.data.type === 'SHOW_NOTIFICATION') {
      const { title, options } = event.data;
      self.registration.showNotification(title, {
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [300, 150, 300, 150, 400],
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: true,
        renotify: true,
        ...options
      });
    }
  }
});

// استراتيجية التعامل مع الطلبات:
// Network-First لصفحات HTML (لكي يصل أي تحديث يتم رفعه على جيت هب فورياً) مع Fallback للكاش عند انقطاع النت
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // تخطي ملفات التلاوات الصوتية المباشرة والإذاعات
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('radio') || url.hostname.includes('stream')) {
    return;
  }

  const isHTMLRequest = e.request.mode === 'navigate' || 
                        e.request.destination === 'document' || 
                        url.pathname.endsWith('.html') || 
                        url.pathname.endsWith('/') || 
                        url.pathname.endsWith('/mobile_app');

  if (isHTMLRequest) {
    // Network-First لصفحات HTML لضمان نزول التحديثات فورياً
    e.respondWith(
      fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
        }
        return networkResponse;
      }).catch(() => {
        return caches.match(e.request).then((cached) => {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }

  // Cache-First للأصول الثابتة (أيقونات وخطوط وتصميم) مع تحديثها في الخلفية
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const networkUpdate = fetch(e.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          if (url.origin === location.origin || url.hostname.includes('cdnjs') || url.hostname.includes('fonts.googleapis') || url.hostname.includes('tailwindcss')) {
            const resClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, resClone));
          }
        }
        return networkResponse;
      }).catch(() => null);

      return cached || networkUpdate;
    })
  );
});
