import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL ?? "http://127.0.0.1:5188/8mb/");
  await page.locator("#file").setInputFiles(".artifacts/source.mp4");
  await page.waitForFunction(
    () =>
      !document.querySelector("#playhead").disabled &&
      document.querySelector("#waveform-status").textContent === "",
  );
  const rows = await page.locator("#waveform").evaluate((canvas) => {
    const { data, width, height } = canvas
      .getContext("2d")
      .getImageData(0, 0, canvas.width, canvas.height);
    let nonempty = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3]) {
          nonempty++;
          break;
        }
      }
    }
    return nonempty;
  });
  assert.ok(rows > 20, "waveform must contain more than the empty baseline");
  const timeline = page.locator("#timeline");
  const rect = await timeline.boundingBox();
  await page.mouse.click(rect.x + rect.width * 0.25, rect.y + rect.height / 2);
  await page.waitForFunction(
    () => Math.abs(document.querySelector("#video").currentTime - 2) < 0.1,
  );
  assert.ok(
    Math.abs(Number(await page.locator("#playhead").inputValue()) - 2) < 0.1,
  );
  await page.locator("#video").evaluate((video) => {
    video.muted = true;
    return video.play();
  });
  await page.waitForFunction(
    () => Number(document.querySelector("#playhead").value) > 2.3,
  );
  await page.locator("#video").evaluate((video) => video.pause());
  await page.mouse.move(rect.x + rect.width * 0.3, rect.y + rect.height / 2);
  await page.mouse.down();
  await page.mouse.move(rect.x + rect.width * 0.6, rect.y + rect.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  assert.ok(
    Math.abs(Number(await page.locator("#playhead").inputValue()) - 4.8) < 0.1,
  );
  const before = Number(await page.locator("#playhead").inputValue());
  await page.locator("#playhead").focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(
    (before) => Number(document.querySelector("#playhead").value) > before,
    before,
  );
  await page.screenshot({
    path: ".impeccable/review/playhead-desktop.png",
    fullPage: true,
  });
  await page.locator("#start").fill("1");
  await page.locator("#end").fill("2");
  await page.locator("#preview-clip").click();
  await page.waitForFunction(
    () => Number(document.querySelector("#playhead").value) > 1.2,
  );
  await page.waitForFunction(() => document.querySelector("#video").paused);
  assert.ok(Number(await page.locator("#playhead").inputValue()) >= 1.95);
  await page
    .locator("#video")
    .evaluate((video) => video.dispatchEvent(new Event("error")));
  await page.locator("#frame").waitFor({ state: "visible" });
  await page.locator("#preview-clip").click();
  await page.waitForFunction(
    () => Number(document.querySelector("#playhead").value) > 1.2,
  );
  await page.waitForFunction(
    () => Number(document.querySelector("#playhead").value) >= 2,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".impeccable/review/playhead-mobile.png",
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  console.log(
    "Waveform, click/drag/keyboard scrubbing, native playback, trim stop, and decoded playback passed.",
  );
} finally {
  await browser.close();
}
