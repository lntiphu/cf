const CACHE_NAME = 'coffee-tracker-v4';
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

  // Xử lý đặc biệt cho các yêu cầu điều hướng (khi reload trang hoặc mở lại app standalone)
  // Luôn trả về index.html từ cache để tránh lỗi 404 hoặc trang trắng khi mất mạng/reload
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('index.html').then((cachedResponse) => {
        return cachedResponse || fetch(e.request);
      })
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
        }).catch(() => {/* Bỏ qua lỗi mạng khi chạy offline */});
        return cachedResponse;
      }
      return fetch(e.request);
    })
  );
});
