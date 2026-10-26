import { test } from "node:test";
import assert from "node:assert/strict";
import { videoBudget, parseCommand } from "../src/domain.mjs";
test("reserves audio and overhead before spending video bitrate", () => {
  const b = videoBudget(8, 60, 960000);
  assert.equal(b.bytes, 8388608);
  assert.ok((b.bitrate * 60) / 8 + 960000 < 8 * 1048576);
  assert.throws(() => videoBudget(0.1, 120, 1920000), /audio and clip length/);
});
test("rejects invalid size and trim inputs", () => {
  for (const args of [
    [NaN, 2, 0],
    [8, 0, 0],
    [8, -1, 0],
    [8, 2, -1],
  ])
    assert.throws(() => videoBudget(...args));
});
test("parses quoted filters and injects the selected input once", () => {
  assert.deepEqual(
    parseCommand(
      '-vf "fps=10,scale=320:-1:flags=lanczos" output.gif',
      "/source/input.mov",
    ),
    {
      args: [
        "-i",
        "/source/input.mov",
        "-vf",
        "fps=10,scale=320:-1:flags=lanczos",
        "output.gif",
      ],
      output: "output.gif",
    },
  );
  assert.deepEqual(
    parseCommand("ffmpeg -i input.ext -c copy output.mp4", "/source/input.mov")
      .args,
    ["-i", "/source/input.mov", "-c", "copy", "output.mp4"],
  );
});
test("rejects unfinished quoting and ambiguous output paths", () => {
  assert.throws(() => parseCommand('-vf "fps=10 output.gif', "x"), /quotes/);
  assert.throws(() => parseCommand("-c copy ../output.mp4", "x"), /filename/);
});
