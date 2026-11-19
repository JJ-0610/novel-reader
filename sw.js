const V = 'viewer-v6';
const SHARE = 'viewer-share';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V && k !== SHARE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  // 안드로이드 "공유하기"로 받은 파일: 임시 보관 후 업로드 화면으로 이동
  if (e.request.method === 'POST' && u.origin === location.origin && u.pathname.endsWith('/share-target')) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const files = fd.getAll('files').filter(f => f && typeof f === 'object' && f.name);
        const c = await caches.open(SHARE);
        for (const k of await c.keys()) await c.delete(k);
        let n = 0;
        for (const f of files) await c.put(new Request('shared/' + (n++)), new Response(f, { headers: {
          'x-name': encodeURIComponent(f.name), 'content-type': f.type || 'application/octet-stream' } }));
      } catch (err) {}
      return Response.redirect(new URL('./#shared', self.registration.scope).href, 303);
    })());
    return;
  }
  if (e.request.method !== 'GET') return;
  // 보기 프로그램(PDF·EPUB 라이브러리): 한 번 받으면 기기에 보관
  if (u.hostname === 'cdn.jsdelivr.net') {
    e.respondWith(caches.open(V).then(async c => (await c.match(e.request)) ||
      fetch(e.request).then(r => { if (r.ok || r.type === 'opaque') c.put(e.request, r.clone()); return r; })));
    return;
  }
  if (u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const c = r.clone();
      caches.open(V).then(ca => ca.put(e.request, c));
      return r;
    }).catch(() => caches.match(e.request))
  );
});
