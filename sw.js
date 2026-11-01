const CACHE_NAME = 'rafiq-almuslim-v17';
const MUSHAF_CACHE_NAME = 'rafiq-mushaf-pages';
const API_CACHE_NAME = 'rafiq-api-cache';

const STATIC_ASSETS = [
  './',
  './index.html',
  './app.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon.svg'
];

// التثبيت وتجاوز الانتظار فورياً وحفظ الأصول الأساسية
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// تفعيل وتنظيف النسخ القديمة للكود الرئيسي فقط، مع الاحتفاظ بكاش المصحف الدائم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== MUSHAF_CACHE_NAME && k !== API_CACHE_NAME) {
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

// استراتيجية التعامل مع الطلبات (Network-First لـ HTML، Cache-First للمصحف والملفات الثابتة)
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // تخطي ملفات التلاوات الصوتية المباشرة والإذاعات
  if (url.pathname.endsWith('.mp3') || url.hostname.includes('radio') || url.hostname.includes('stream')) {
    return;
  }

  // 1. صور صفحات مصحف المدينة: Cache-First لضمان عملها أوفلاين للأبد
  if (url.hostname.includes('quran.com') || url.hostname.includes('quran-images-madinah')) {
    e.respondWith(
      caches.open(MUSHAF_CACHE_NAME).then((mushafCache) => {
        return mushafCache.match(e.request).then((cached) => {
          if (cached) return cached;
          return fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              mushafCache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => null);
        });
      })
    );
    return;
  }

  // 2. طلبات نصوص وتفاسير الآيات: حفظها في كاش API لتعمل أوفلاين
  if (url.hostname.includes('api.alquran.cloud')) {
    e.respondWith(
      caches.open(API_CACHE_NAME).then((apiCache) => {
        return apiCache.match(e.request).then((cached) => {
          if (cached) return cached;
          return fetch(e.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              apiCache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => null);
        });
      })
    );
    return;
  }

  // 3. صفحات HTML: Network-First لضمان وصول التحديثات فوراً مع Fallback للكاش
  const isHTMLRequest = e.request.mode === 'navigate' || 
                        e.request.destination === 'document' || 
                        url.pathname.endsWith('.html') || 
                        url.pathname.endsWith('/') || 
                        url.pathname.endsWith('/mobile_app');

  if (isHTMLRequest) {
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

  // 4. الأصول الثابتة: Cache-First مع التحديث في الخلفية
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
