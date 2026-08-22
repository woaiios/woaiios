/*
 * WordDiscover Service Worker
 *
 * Strategy:
 * - Precache the app shell so the PWA loads quickly.
 * - Cache the large dictionary lazily after the first successful fetch.
 * - Use network-first for app code so deployments take effect on refresh.
 */

const CACHE_NAME = 'word-discoverer-v1';

const PRECACHE_URLS = [
    './index.html',
    './css/main.css',
    './css/components.css',
    './app.js',
    './js/WordDatabase.js',
    './js/TextAnalyzer.js',
    './js/VocabularyManager.js',
    './js/SettingsManager.js',
    './js/GoogleDriveManager.js',
    './components/Component.js',
    './components/AnalyzedText/AnalyzedText.js',
    './components/Vocabulary/Vocabulary.js',
    './components/Settings/Settings.js',
    './components/Modal/Modal.js',
    './components/Modal/Modal.css',
    './components/Settings/Settings.css',
    './components/Vocabulary/Vocabulary.css',
    './eng_dict.txt'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' || url.origin !== self.location.origin) {
        return;
    }

    // Dictionary: cache-first. Once downloaded it should not be re-fetched on every refresh.
    if (url.pathname.endsWith('/eng-zho.json') || url.pathname.endsWith('/eng-zho.json/')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) {
                    return cached;
                }
                return fetch(request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        const cachePromise = caches.open(CACHE_NAME)
                            .then((cache) => cache.put(request, clone))
                            .catch((error) => console.error('Failed to cache dictionary:', error));
                        event.waitUntil(cachePromise);
                    }
                    return response;
                });
            })
        );
        return;
    }

    // App shell: network-first, fall back to cache when offline.
    event.respondWith(
        fetch(request).then((response) => {
            if (response.ok) {
                const clone = response.clone();
                const cachePromise = caches.open(CACHE_NAME)
                    .then((cache) => cache.put(request, clone))
                    .catch((error) => console.error('Failed to cache asset:', error));
                event.waitUntil(cachePromise);
            }
            return response;
        }).catch(() => caches.match(request))
    );
});