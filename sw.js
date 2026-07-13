const CACHE_NAME = 'coffee-tracker-v1';
const ASSETS = [
  'index.html',
  'manifest.json',
  'icon.svg',
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
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
  // Chỉ xử lý các yêu cầu HTTP/HTTPS thông thường (không xử lý các extension của Chrome, v.v.)
  if (!(e.request.url.indexOf('http') === 0)) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Trả về kết quả từ cache nhưng vẫn tìm nạp cập nhật từ mạng ngầm (Stale-While-Revalidate)
        fetch(e.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, networkResponse));
          }
        }).catch(() => {/* Bỏ qua lỗi mạng khi chạy offline */});
        return cachedResponse;
      }
      // Nếu không có trong cache, tải từ mạng
      return fetch(e.request);
    })
  );
});
