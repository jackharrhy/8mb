import { mkdir, copyFile, truncate } from "node:fs/promises";
import { execFileSync } from "node:child_process";
await mkdir(".artifacts", { recursive: true });
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=640x360:rate=30",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:sample_rate=48000",
  "-t",
  "8",
  "-c:v",
  "libx264",
  "-preset",
  "fast",
  "-b:v",
  "1800k",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-movflags",
  "+faststart",
  ".artifacts/source.mp4",
]);
await copyFile(".artifacts/source.mp4", ".artifacts/large.mp4");
await truncate(".artifacts/large.mp4", 2300000000);
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-y",
  "-stream_loop",
  "14",
  "-i",
  ".artifacts/source.mp4",
  "-t",
  "120",
  "-c",
  "copy",
  ".artifacts/long.mp4",
]);
