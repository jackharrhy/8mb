# 8mb

A Vite + TypeScript SPA for trimming, cropping and compressing videos. Files are processed in the browser with MediaBunny/WebCodecs or FFmpeg WASM. Nothing is uploaded.

Preview: https://newport.hedgehog-python.ts.net:8465/

## Run

Node 24+:

```sh
npm ci
npm run dev
```

For the hosted build:

```sh
npm run build
npm start
```

The static server listens on `127.0.0.1:5188`. It requires HTTPS outside localhost for browser media APIs. There is no PWA, install prompt, or offline cache. `public/sw.js` only removes service workers installed by earlier builds.

## Editing

Open a video, set its start/end times, optionally crop, and choose a maximum output size in MiB. The trim waveform shows the current playhead; click or drag it to seek. Export as MP4/H.264 or WebM/VP9. Audio can be compressed, removed, or copied without re-encoding. Exports check their actual size and retry up to three times if oversized.

Advanced runs custom FFmpeg arguments and saves commands locally. Use `input.ext` for the selected file; omit `-i` to insert it automatically.

## Limits

- MediaBunny reads files incrementally. A 2.3 GB sparse test input exported successfully; this is not a long-video throughput benchmark.
- Output targets above 64 MiB use browser-private disk storage. Abandoned exports are cleaned up after a day.
- Codec support depends on the browser. Chromium is tested; Safari and Firefox are not.
- FFmpeg WASM inputs must be below 2 GiB and may run out of memory sooner.
- Preserving audio with a trimmed start requires MP4. Trim boundaries can differ by one audio packet, about 21 ms for AAC.
- Edit exports primary video/audio tracks. Use Advanced for custom codecs, filters, or track selection.

Media processing is local, but loading the app and its processing modules requires a connection. See [THIRD_PARTY.md](THIRD_PARTY.md) for licenses.

## Checks

```sh
npm test
npm run build
# With npm start running and Playwright Chromium plus native ffmpeg/ffprobe installed:
npm run test:browser
npm run test:edge
node scripts/timeline-check.mjs
```

Browser tests cover exports, size limits, preserved audio packet hashes, large-file reading, playback, and responsive layout. Edge checks cover OPFS, WebM, cancellation, GIF, MP3, and accessibility.

## Hosting

On newport, `~/.config/systemd/user/8mb-preview.service` runs the static server. Tailscale Serve maps HTTPS port 8465 to localhost 5188.

```sh
systemctl --user status 8mb-preview
systemctl --user restart 8mb-preview
```

Rebuild after edits; the server reads the updated files without restarting.

Behavior reference: [jackharrhy/8mber, video-quality-preserve-audio](https://github.com/jackharrhy/8mber/tree/video-quality-preserve-audio), commit `227acc9`, cloned in `~/repos/contrib/8mber`. Styling follows `~/repos/personal/auth`.
