import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const all = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      all.map((x) =>
        x.isDirectory() ? files(`${dir}/${x.name}`) : `${dir}/${x.name}`,
      ),
    )
  ).flat();
}
const paths = (await files("dist")).filter((p) => !p.endsWith("/sw.js"));
const hash = createHash("sha256");
for (const p of paths) hash.update(await readFile(p));
const cache = `8mb-${hash.digest("hex").slice(0, 12)}`;
const urls = ["/", ...paths.map((p) => p.slice(4))];
await writeFile(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(cache)};const URLS=${JSON.stringify(urls)};
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);await cache.addAll(URLS);await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('8mb-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='status')event.ports[0]?.postMessage({ready:true});});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);const cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==='navigate')return await cache.match('/')||fetch(event.request);return fetch(event.request);})());});
`,
);
console.log(`Offline cache: ${urls.length} local assets (${cache}).`);
