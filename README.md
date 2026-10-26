# 8mb

A local browser video editor: open a video, choose a range, crop, and export below a chosen size. Media processing runs on your device. The server only delivers static assets.

Built from the behavior of [jackharrhy/8mber's preserved-audio branch](https://github.com/jackharrhy/8mber/tree/video-quality-preserve-audio), commit `227acc904069a36280b6a6a081fdc48d7f6b4683`, with the visual system of [jackharrhy/auth](https://github.com/jackharrhy/auth). Those references are cloned at `~/repos/contrib/8mber` and `~/repos/personal/auth`.

## Try it

Tailnet preview: **https://newport.hedgehog-python.ts.net:8465/**

Open this address on a computer connected to your tailnet. Wait for **Available offline** before disconnecting. The initial visit caches the complete application, font, workers, AAC encoder and FFmpeg engine (about 34 MB). Reopen this same address, or use the installed app, while offline. Your source video is never uploaded or cached by the service worker.

Chrome/Edge is the tested browser environment. Other browsers can offer different WebCodecs encoders and decoders; failures name a recovery option. HTTPS is required outside localhost. The app also supports system dark mode and narrow screens.

## Features

- Source preview and playback, scrubbing, waveform and trim handles, with numeric start/end fields.
- Drag-to-select crop, numeric crop coordinates, and reset.
- Size presets or a custom maximum, in MiB (1,048,576 bytes).
- MP4/H.264 or WebM/VP9, optional resolution and frame-rate limits.
- Compress audio, remove it, or copy original encoded audio without re-encoding.
- Actual output-size validation with up to three retries; an oversized result is never presented as a successful size-constrained export.
- Exports above a 64 MiB target write to browser-private storage, rather than a full in-memory output buffer. Failed/retried files are removed. Successful temporary files are removed on the next export, and abandoned files older than a day are removed on later visits.
- Advanced FFmpeg WASM arguments, local saved commands, logs, cancellation and output preview/download. H.264, MP3 and GIF command presets are included. Refer to your selected input as `input.ext`; without `-i`, it is inserted automatically. Outputs use simple filenames in the WASM filesystem.
- Offline use after the first successful cache installation. No account or API service is required.

## Media limits

MediaBunny reads the original File lazily; inputs are not loaded into a single ArrayBuffer. The large-file integration check uses an 8-second MP4 extended to **2.3 billion bytes** with sparse trailing padding. It proves reading and exporting beyond the WASM input limit, not real-world long-video throughput. A real two-minute input also exercises the disk output path.

Codec/container support depends on MediaBunny and the browser. AVI/WMV/FLV and unsupported video codecs need Advanced, whose supported codecs follow the bundled FFmpeg build. Advanced is restricted to inputs below 2 GiB and may run out of memory sooner; it is not the large-file backend. FFmpeg's output filesystem remains memory-backed. Commands cannot address arbitrary files on your computer.

Preserved audio is packet copied. MP4 is required when combining a nonzero trim start with preserved audio; WebM requires audio recompression in that case. Trim boundaries may differ by roughly one encoded audio packet (e.g. 21 ms for AAC). Incompatible audio/container combinations fail explicitly instead of silently re-encoding or discarding audio. The encoder uses a bitrate supported by your browser and verifies the final size; a maximum target need not be filled completely. This is not native x264 two-pass encoding.

The Edit workspace exports primary video/audio tracks. It does not preserve every subtitle, attachment, alternate track or HDR characteristic of an arbitrary source. Any custom filters, codec options or multitrack selection should be expressed in Advanced and checked against the resulting file.

Browser storage eviction removes offline availability; revisit online to restore it. Local favorites and temporary output files can be removed through the browser's site-storage controls. FFmpeg WASM core is bundled locally; see [THIRD_PARTY.md](THIRD_PARTY.md) for license/source notices.

## Development

Node 24+, npm, and a browser with WebCodecs:

```sh
npm ci
npm run dev
```

Production build and preview:

```sh
npm run build
npm start
```

The server binds `127.0.0.1:5188`; set `PORT` to override it. Development does not install the offline cache; use the production build to test offline. Builds hash all static assets into a versioned service-worker cache. No runtime CDN requests are used.

## Validation

```sh
npm test
npm run build
# With npm start running, Chromium installed for Playwright, and native ffmpeg/ffprobe available:
npm run test:browser
npm run test:edge
```

`test:browser` creates ignored fixtures, checks trimmed/cropped audio-preserving export, browser playback, actual file size, offline export and >2GB sparse input handling. It saves viewport screenshots to `.impeccable/review/` and validates exported AAC packet hashes against a contiguous range from the source. `test:edge` additionally exercises the live HTTPS tailnet address, OPFS output, WebM, audio removal, impossible budgets, cancellation, GIF, offline MP3 and axe accessibility. Its fixtures come from `test:browser`.

Automated validation was run in Chromium. Safari and Firefox have not been tested. The 2.3GB fixture is sparse on disk; do not upload/copy it through a tool that expands sparse files unnecessarily.

## Preview service

On newport, `~/.config/systemd/user/8mb-preview.service` runs `node server.mjs` and is enabled for the user. Tailscale Serve maps HTTPS port 8465 to localhost 5188. Existing tailnet routes are untouched; no Funnel/public endpoint is enabled.

```sh
systemctl --user status 8mb-preview
systemctl --user restart 8mb-preview
journalctl --user -u 8mb-preview -n 50
sudo tailscale serve status
```

After source edits, run `npm run build`; the static server reads the new build without a restart. To stop this preview, stop the user service and disable only its route with `sudo tailscale serve --https=8465 off`.
