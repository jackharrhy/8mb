# 8mb
<!-- impeccable:product-schema 1 -->
## Platform
web
## Stack
Delegated by the user's instruction to finish end to end. Vite and TypeScript, browser-local MediaBunny/WebCodecs, optional FFmpeg WASM. A static Node server serves the build on the tailnet.
## Users
People trimming and shrinking local videos for upload limits. Initial testing is by Jack from another computer over Tailscale.
## Product Purpose
Produce a clip below a chosen size without uploading the video. Preserve the original audio when requested.
## Capabilities and Constraints
Behavioral baseline: jackharrhy/8mber branch video-quality-preserve-audio, commit 227acc904069a36280b6a6a081fdc48d7f6b4683. Trim, crop, playback, waveform, size budget, preserved audio, advanced FFmpeg arguments and favorites. Offline after assets have been cached. Codec support depends on the browser. FFmpeg WASM is bounded by its memory and compiled capabilities.
## Brand Commitments
Follow jackharrhy/auth's look and feel: restrained controls, Inter, warm stone neutrals and system light/dark mode.
## Assumptions
The application is named 8mb after the workspace. No account or cloud storage is needed. Target sizes use MiB, matching the desktop code's calculation. Desktop is the main editing environment; mobile remains usable.
