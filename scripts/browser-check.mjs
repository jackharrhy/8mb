import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1440, height: 1050 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => {
  errors.push(e.message);
  console.log("PAGE ERROR", e.message);
});
page.on("console", (m) => {
  if (m.type() === "error") console.log("CONSOLE", m.text());
});
await page.goto("http://127.0.0.1:5188");
await page.getByRole("navigation", { name: "Workspace" }).waitFor();
await page.screenshot({
  path: ".impeccable/review/empty-desktop.png",
  fullPage: true,
});
await page.locator("#file").setInputFiles(".artifacts/source.mp4");
await page.locator("#export").waitFor({ state: "visible" });
await page.waitForFunction(() => !document.querySelector("#export").disabled);
console.log("METADATA", await page.locator("#file-meta").textContent());
await page.locator("#start").fill("1.1");
await page.locator("#end").fill("4.6");
await page.locator("#audio").selectOption("keep");
await page.locator("#target").fill("0.5");
await page.locator("#crop-toggle").click();
for (const [id, v] of Object.entries({
  "crop-x": "40",
  "crop-y": "20",
  "crop-w": "480",
  "crop-h": "300",
})) {
  await page.locator("#" + id).fill(v);
  await page.locator("#" + id).dispatchEvent("change");
}
await page.locator("#export").click();
await page.locator("#result").waitFor({ state: "visible", timeout: 120000 });
console.log(
  "EXPORT",
  await page.locator("#status").textContent(),
  await page.locator("#result-size").textContent(),
);
const download = page.waitForEvent("download");
await page.locator("#download").click();
await (await download).saveAs(".artifacts/keep-audio.mp4");
await page.waitForFunction(
  () => document.querySelector("#waveform-status").textContent.trim() === "",
);
await page.locator("#result-video").evaluate(async (video) => {
  video.muted = true;
  await video.play();
});
await page.waitForTimeout(200);
await page.locator("#result-video").evaluate((video) => video.pause());
await page.screenshot({
  path: ".impeccable/review/desktop.png",
  fullPage: true,
});
await page.emulateMedia({ colorScheme: "dark" });
await page.screenshot({ path: ".impeccable/review/dark.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.emulateMedia({ colorScheme: "light" });
await page.screenshot({
  path: ".impeccable/review/mobile.png",
  fullPage: true,
});
console.log(
  "MOBILE OVERFLOW",
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
);
await page.setViewportSize({ width: 1440, height: 1050 });
await page.locator("#advanced-tab").click();
await page
  .locator("#command")
  .fill("-t 1 -c:v libx264 -preset ultrafast -c:a aac output.mp4");
await page.locator("#run-command").click();
await page.waitForFunction(
  () =>
    document
      .querySelector("#advanced-status")
      .textContent.startsWith("Complete") ||
    document
      .querySelector("#advanced-status")
      .textContent.startsWith("Command failed"),
  {},
  { timeout: 120000 },
);
console.log(
  "ADVANCED",
  await page.locator("#advanced-status").textContent(),
  await page.locator("#error").textContent(),
);
console.log(
  "LOG TAIL",
  (await page.locator("#logs").textContent()).slice(-1200),
);
await page.screenshot({
  path: ".impeccable/review/advanced.png",
  fullPage: true,
});
await page.locator("#edit-tab").click();
await page.locator("#file").setInputFiles(".artifacts/large.mp4");
await page.waitForFunction(() =>
  document.querySelector("#file-meta").textContent.includes("2193.45"),
);
await page.waitForFunction(() => !document.querySelector("#export").disabled);
console.log("LARGE INPUT", await page.locator("#file-meta").textContent());
await page.locator("#end").fill("1");
await page.locator("#target").fill("0.5");
await page.locator("#export").click();
await page.locator("#result").waitFor({ state: "visible", timeout: 120000 });
console.log("LARGE EXPORT", await page.locator("#result-size").textContent());
await writeFile(
  ".artifacts/browser-results.json",
  JSON.stringify({ errors, completed: true }, null, 2),
);
assert.deepEqual(errors, []);
assert.equal(
  await page.evaluate(
    async () => (await navigator.serviceWorker.getRegistrations()).length,
  ),
  0,
);
assert.equal(await page.locator('link[rel="manifest"]').count(), 0);
await browser.close();
