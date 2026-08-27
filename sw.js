/**
 * Service Worker for Word Discoverer
 * 提供离线支持和缓存管理
 * Provides offline support and cache management
 */

const CACHE_VERSION = 'v2.0.2';
const CACHE_NAME = `word-discoverer-${CACHE_VERSION}`;

// 需要缓存的静态资源 (Static assets to cache)
// 注意：Vite 构建后源码会被合并成带 hash 的 dist/assets/*.js|css，
// 因此这里只预缓存确定存在的入口，其余资源（含 wasm、SQLite 分片）
// 由运行时 fetch 处理器按需 cacheFirst/networkFirst 缓存，保证首装即激活。
const STATIC_ASSETS = [
  './',
  './index.html',
];

// 外部资源 (External resources)
const EXTERNAL_RESOURCES = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
];

/**
 * Install Event - 安装事件
 * 预缓存所有静态资源 (Pre-cache all static assets)
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // 逐个缓存：单个资源 404 不应中断整个预缓存流程 (Resilient per-asset caching)
      const targets = [...STATIC_ASSETS, ...EXTERNAL_RESOURCES];
      await Promise.all(
        targets.map(async (url) => {
          try {
            await cache.add(url);
            console.log('[Service Worker] Cached:', url);
          } catch (err) {
            console.warn('[Service Worker] Skip caching (not found / offline):', url);
          }
        })
      );
      // 无论预缓存是否完整，都立即激活，接管页面 (Always activate immediately)
      await self.skipWaiting();
      console.log('[Service Worker] Installed, skipWaiting sent');
    })()
  );
});

/**
 * Activate Event - 激活事件
 * 清理旧缓存 (Clean up old caches)
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // 删除旧版本的缓存 (Delete old version caches)
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[Service Worker] Activated successfully');
        // 立即控制所有客户端 (Take control of all clients immediately)
        return self.clients.claim();
      })
  );
});

/**
 * Fetch Event - 请求拦截
 * 实现缓存策略 (Implement caching strategies)
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求 (Skip non-GET requests)
  if (request.method !== 'GET') {
    return;
  }

  // 跳过 chrome-extension 和其他特殊协议 (Skip chrome-extension and other special protocols)
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // 跳过 Google Identity Services 请求 (Skip Google Identity Services)
  if (url.hostname === 'accounts.google.com' || 
      url.hostname.endsWith('.googleapis.com') || 
      url.hostname === 'googleapis.com') {
    return;
  }

  event.respondWith(
    handleFetchRequest(request, url)
  );
});

/**
 * 处理 Fetch 请求 (Handle fetch requests)
 * @param {Request} request - 请求对象
 * @param {URL} url - URL 对象
 * @returns {Promise<Response>}
 */
async function handleFetchRequest(request, url) {
  // 对于数据库文件，使用 Cache First 策略 (Cache First for database files)
  if (isDatabaseAsset(url)) {
    return cacheFirst(request);
  }

  // 对于静态资源，使用 Cache First 策略 (Cache First for static assets)
  if (isStaticAsset(url)) {
    return cacheFirst(request);
  }

  // 对于 HTML 页面，使用 Network First 策略 (Network First for HTML pages)
  const acceptHeader = request.headers.get('accept');
  if (acceptHeader && acceptHeader.includes('text/html')) {
    return networkFirst(request);
  }

  // 对于外部 CDN 资源，使用 Cache First 策略 (Cache First for external CDN resources)
  if (isExternalResource(url)) {
    return cacheFirst(request);
  }

  // 默认使用 Network First 策略 (Default to Network First)
  return networkFirst(request);
}

/**
 * Cache First 策略 - 优先使用缓存
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    // 如果网络请求失败且没有缓存，返回离线页面或错误
    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

/**
 * Network First 策略 - 优先使用网络
 * @param {Request} request
 * @returns {Promise<Response>}
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // 如果是 HTML 页面请求，返回缓存的 index.html
    const acceptHeader = request.headers.get('accept');
    if (acceptHeader && acceptHeader.includes('text/html')) {
      const indexCache = await caches.match('./index.html');
      if (indexCache) {
        return indexCache;
      }
    }

    return new Response('Offline - Resource not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({
        'Content-Type': 'text/plain',
      }),
    });
  }
}

/**
 * 判断是否为数据库资源 (Check if it's a database asset)
 * @param {URL} url
 * @returns {boolean}
 */
function isDatabaseAsset(url) {
  return url.pathname.includes('/public/eng-zho.json') ||
         url.pathname.includes('/public/eng_dict.txt') ||
         url.pathname.includes('/public/db-chunks/') ||
         url.pathname.includes('.db');
}

/**
 * 判断是否为静态资源 (Check if it's a static asset)
 * @param {URL} url
 * @returns {boolean}
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.wasm', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * 判断是否为外部资源 (Check if it's an external resource)
 * @param {URL} url
 * @returns {boolean}
 */
function isExternalResource(url) {
  // 只信任特定的外部CDN域名 (Only trust specific external CDN domains)
  const trustedDomains = [
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ];
  
  return url.hostname !== self.location.hostname && 
         trustedDomains.includes(url.hostname);
}

/**
 * Message Handler - 消息处理
 * 处理来自客户端的消息 (Handle messages from clients)
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  // 清除缓存 (Clear cache)
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => {
        console.log('[Service Worker] Cache cleared');
        event.ports[0].postMessage({ success: true });
      })
    );
  }
});
