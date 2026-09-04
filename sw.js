const CACHE_NAME = 'coffee-tracker-v25';
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.svg',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Cài đặt service worker và lưu các tài nguyên tĩnh vào cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Kích hoạt service worker và xóa các cache cũ
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Phản hồi các yêu cầu fetch từ cache (offline-first)
self.addEventListener('fetch', (e) => {
  if (!(e.request.url.indexOf('http') === 0)) return;

  // Với tài liệu HTML, ưu tiên bản mới từ mạng để Chrome không giữ code cũ.
  // Chỉ dùng cache khi offline hoặc máy chủ không phản hồi.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('index.html', responseToCache));
          }
          return networkResponse;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Trả về từ cache và cập nhật ngầm nếu có kết nối mạng
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Bỏ qua lỗi mạng khi chạy offline */ });
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
