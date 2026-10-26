import {copyFile,mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
await mkdir('public/ffmpeg',{recursive:true});
await copyFile(fileURLToPath(import.meta.resolve('@ffmpeg/core')),'public/ffmpeg/ffmpeg-core.js');
await copyFile(fileURLToPath(import.meta.resolve('@ffmpeg/core/wasm')),'public/ffmpeg/ffmpeg-core.wasm');
