import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
function probe(path, args) {
  return JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", ...args, "-of", "json", `.artifacts/${path}`],
      { encoding: "utf8" },
    ),
  );
}
const out = probe("keep-audio.mp4", ["-show_streams", "-show_format"]);
const video = out.streams.find((s) => s.codec_type === "video");
assert.equal(video.width, 480);
assert.equal(video.height, 300);
assert.ok(Number(out.format.size) <= 0.5 * 1048576);
assert.ok(Math.abs(Number(out.format.duration) - 3.5) < 0.04);
const args = [
  "-select_streams",
  "a:0",
  "-show_packets",
  "-show_data_hash",
  "sha256",
  "-show_entries",
  "packet=pts_time,data_hash",
];
const source = probe("source.mp4", args).packets;
const audio = probe("keep-audio.mp4", args).packets;
const first = source.findIndex((p) => p.data_hash === audio[0].data_hash);
assert.ok(first >= 0);
assert.deepEqual(
  audio.map((p) => p.data_hash),
  source.slice(first, first + audio.length).map((p) => p.data_hash),
);
assert.ok(Math.abs(Number(source[first].pts_time) - 1.1) < 0.025);
console.log(
  `Verified ${audio.length} contiguous audio packets unchanged; cropped 480×300; ${out.format.duration}s; ${out.format.size} bytes.`,
);
