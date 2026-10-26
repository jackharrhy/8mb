# 8mb

A Vite + TypeScript SPA for trimming, cropping and compressing videos. Files are processed in the browser with MediaBunny/WebCodecs or FFmpeg WASM. Nothing is uploaded.

Site: https://jackharrhy.dev/8mb/

Source: https://github.com/jackharrhy/8mb

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

The local preview server listens on `127.0.0.1:5188` and redirects to `/8mb/`. It requires HTTPS outside localhost for browser media APIs. There is no PWA, install prompt, or offline cache. `public/sw.js` only removes service workers installed by earlier builds.

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
export BASE_URL=http://127.0.0.1:5188/8mb/
npm run test:browser
npm run test:edge
node scripts/timeline-check.mjs
```

Browser tests cover exports, size limits, preserved audio packet hashes, large-file reading, playback, and responsive layout. Edge checks cover OPFS, WebM, cancellation, GIF, MP3, and accessibility.

CI runs unit/build checks and these browser checks against a disposable, read-only nginx container on localhost, on both PRs and pushes to main. Publishing waits for all checks. Workflow lint uses jactionlint 2.3.0 with shellcheck; locally, with uv and shellcheck installed, run `uvx --from jactionlint==2.3.0 jactionlint --strict-exit`.

All workflows are owned by this repository; there is no dependency on a shared workflow repository. Action references are release-commit pinned and maintained by weekly Dependabot PRs, with a seven-day cooldown and grouped minor/patch updates. Major updates and the jactionlint tool version are reviewed explicitly.

## Docker and hosting

```sh
docker build -t 8mb .
docker run --rm --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop ALL -p 8080:8080 8mb
```

Open `http://localhost:8080/8mb/`. The runtime is nginx Alpine running as the nginx user; Node is only used to build. The image serves static files with the isolation headers required by browser media APIs. Hashed assets are cached; HTML is revalidated.

Pushes to main build, test, and publish `ghcr.io/jackharrhy/8mb:main` plus a commit-SHA tag through GitHub Actions. `~/infra/hosts/mug/compose.yml` runs the image behind Traefik at `jackharrhy.dev/8mb/`.

Browser checks can target the container or public site:

```sh
BASE_URL=http://localhost:8080/8mb/ npm run test:browser
BASE_URL=https://jackharrhy.dev/8mb/ npm run test:edge
```

The original tailnet preview remains at `https://newport.hedgehog-python.ts.net:8465/8mb/`.

Behavior reference: [jackharrhy/8mber, video-quality-preserve-audio](https://github.com/jackharrhy/8mber/tree/video-quality-preserve-audio), commit `227acc9`, cloned in `~/repos/contrib/8mber`. Styling follows `~/repos/personal/auth`.
