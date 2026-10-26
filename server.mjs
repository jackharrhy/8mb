import { createServer } from "node:http";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, extname, sep } from "node:path";
const root = resolve("dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};
const server = createServer(async (req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405);
    res.end();
    return;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400);
    res.end();
    return;
  }
  if (pathname === "/" || pathname === "/8mb") {
    res.writeHead(308, { Location: "/8mb/" });
    res.end();
    return;
  }
  // Retire root-scoped workers from the original tailnet preview only.
  if (pathname !== "/sw.js" && !pathname.startsWith("/8mb/")) {
    res.writeHead(404);
    res.end();
    return;
  }
  pathname = pathname === "/sw.js" ? pathname : pathname.slice("/8mb".length);
  const path = resolve(
    root,
    "." + (pathname === "/" ? "/index.html" : pathname),
  );
  if (!path.startsWith(root + sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const info = await stat(path);
    if (!info.isFile()) throw new Error();
    res.setHeader(
      "Content-Type",
      mime[extname(path)] ?? "application/octet-stream",
    );
    res.setHeader(
      "Cache-Control",
      pathname.startsWith("/assets/")
        ? "public,max-age=31536000,immutable"
        : "no-cache",
    );
    res.setHeader("Content-Length", info.size);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
const port = Number(process.env.PORT ?? 5188);
server.listen(port, "127.0.0.1", () =>
  console.log(`8mb listening on http://127.0.0.1:${port}`),
);
