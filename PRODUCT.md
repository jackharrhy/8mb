# 8mb
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Delegated by the user's instruction to finish end to end. Vite and TypeScript, browser-local MediaBunny/WebCodecs, optional FFmpeg WASM. Production is a static nginx Alpine container at jackharrhy.dev/8mb/. Node is used for builds and the local preview only.
## Users
People trimming and shrinking local videos for upload limits. Initial testing is by Jack from another computer over Tailscale.
## Product Purpose
Produce a clip below a chosen size without uploading the video. Preserve the original audio when requested.
## Capabilities and Constraints
Behavioral baseline: jackharrhy/8mber branch video-quality-preserve-audio, commit 227acc904069a36280b6a6a081fdc48d7f6b4683. Trim, crop, playback, waveform, size budget, preserved audio, advanced FFmpeg arguments and favorites. Plain Vite SPA. No PWA, install prompt, service worker, or offline cache. Media processing stays local. Codec support depends on the browser. FFmpeg WASM is bounded by its memory and compiled capabilities.
## Brand Commitments
Follow jackharrhy/auth's look and feel: restrained controls, Inter, warm stone neutrals and system light/dark mode.
## Assumptions
The application is named 8mb after the workspace. No account or cloud storage is needed. Target sizes use MiB, matching the desktop code's calculation. Desktop is the main editing environment; mobile remains usable.

## Interface copy
Use short functional labels. No slogans, sales copy, motivational headings, or repeated privacy explanations. Show instructions only where needed to operate a control.

The current request supersedes offline app installation: use a basic one-page SPA.

Keep the top bar to Edit / Advanced and Open video. No brand label or visible page title.
