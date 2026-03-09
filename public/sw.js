const CACHE_NAME = "timetable-v1";

const SHELL_ASSETS = [
  "./",
  "./styles.css",
  "./js/main.js",
  "./js/dom.js",
  "./js/constants.js",
  "./js/utils.js",
  "./js/state.js",
  "./js/data.js",
  "./js/render.js",
  "./js/export.js",
  "./vendor/html2canvas.min.js",
];

const DATA_ASSETS = [
  "./meta.json",
  "./timetables.json",
  "./timetable.json",
];

// 安装：预缓存 App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 请求策略
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 数据文件：网络优先，失败回退缓存
  if (DATA_ASSETS.some((asset) => url.pathname.endsWith(asset.replace("./", "/")))) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // App Shell：缓存优先，回退网络
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.ok && url.origin === self.location.origin) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      });
    })
  );
});
