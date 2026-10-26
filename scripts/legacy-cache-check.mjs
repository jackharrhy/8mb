import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
let legacy = true;
const oldWorker = `self.addEventListener('install',e=>e.waitUntil((async()=>{const c=await caches.open('8mb-legacy-test');await c.add('/');await self.skipWaiting()})()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.mode==='navigate')e.respondWith(caches.match('/'));});`;
const oldHtml = `<!doctype html><h1>Old cached page</h1><script>navigator.serviceWorker.register('/sw.js')</script>`;
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader(
    "Content-Type",
    path === "/"
      ? "text/html"
      : path.endsWith(".js")
        ? "text/javascript"
        : path.endsWith(".css")
          ? "text/css"
          : path.endsWith(".wasm")
            ? "application/wasm"
            : "application/octet-stream",
  );
  try {
    res.end(
      legacy && path === "/"
        ? oldHtml
        : legacy && path === "/sw.js"
          ? oldWorker
          : await readFile("dist" + (path === "/" ? "/index.html" : path)),
    );
  } catch {
    res.writeHead(404);
    res.end();
  }
});
await new Promise((r) => server.listen(5201, "127.0.0.1", r));
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:5201/");
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  legacy = false;
  await page.reload();
  await page
    .getByRole("heading", { name: "Video editor", exact: true })
    .waitFor({ timeout: 30000 });
  await page.waitForFunction(
    async () => !(await navigator.serviceWorker.getRegistrations()).length,
  );
  assert.deepEqual(await page.evaluate(() => caches.keys()), []);
  assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
  await page.reload();
  await page
    .getByRole("heading", { name: "Video editor", exact: true })
    .waitFor();
  console.log(
    "Old cached page migrated to SPA; registrations and app caches removed; refresh stays current.",
  );
} finally {
  await browser.close();
  await new Promise((r) => server.close(r));
}
