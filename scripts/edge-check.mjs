import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
const context = await browser.newContext({ acceptDownloads: true });
const page = await context.newPage();
page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
await page.goto("https://newport.hedgehog-python.ts.net:8465");
await page
  .getByText("Available offline", { exact: true })
  .waitFor({ timeout: 60000 });
console.log(
  "SECURE",
  await page.evaluate(() => ({
    secure: isSecureContext,
    isolated: crossOriginIsolated,
  })),
);
await page.locator("#file").setInputFiles(".artifacts/source.mp4");
await page.waitForFunction(() => !document.querySelector("#export").disabled);
await page.waitForFunction(
  () => document.querySelector("#waveform-status").textContent.trim() === "",
  {},
  { timeout: 30000 },
);
console.log("WAVEFORM", await page.locator("#waveform-status").textContent());
async function exportClip(name) {
  await page.locator("#export").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#result").hidden ||
      !document.querySelector("#error").hidden,
    {},
    { timeout: 90000 },
  );
  if (await page.locator("#error").isVisible())
    throw new Error(await page.locator("#error").textContent());
  const d = page.waitForEvent("download");
  await page.locator("#download").click();
  await (await d).saveAs(".artifacts/" + name);
  console.log(
    "EXPORTED",
    name,
    await page.locator("#result-size").textContent(),
  );
}
await page.locator("#file").setInputFiles(".artifacts/long.mp4");
await page.waitForFunction(
  () =>
    document.querySelector("#filename").textContent === "long.mp4" &&
    Number(document.querySelector("#end").value) > 119,
);
await page.locator("#target").fill("65");
await exportClip("opfs.mp4");
console.log(
  "OPFS",
  await page.evaluate(async () => {
    const dir = await navigator.storage.getDirectory();
    return [...(await Array.fromAsync(dir.keys()))];
  }),
);
await page.locator("#file").setInputFiles(".artifacts/source.mp4");
await page.waitForFunction(
  () =>
    document.querySelector("#filename").textContent === "source.mp4" &&
    Number(document.querySelector("#end").value) < 9,
);
await page.locator("#end").fill("1");
await page.locator("#format").selectOption("webm");
await page.locator("#target").fill("0.5");
await exportClip("webm.webm");
await page.locator("#audio").selectOption("mute");
await exportClip("silent.webm");
await page.locator("#target").fill("0.1");
await page.locator("#end").fill("8");
await page.locator("#audio").selectOption("keep");
await page.locator("#format").selectOption("mp4");
await page.locator("#export").click();
await page.locator("#error").waitFor();
console.log("BUDGET ERROR", await page.locator("#error").textContent());
await page.locator("#target").fill("8");
await page.locator("#export").click();
await page.locator("#cancel").click();
await page.waitForFunction(
  () => document.querySelector("#status").textContent.includes("cancelled"),
  {},
  { timeout: 30000 },
);
assert.equal(await page.locator("#export").isEnabled(), true);
console.log("CANCEL", await page.locator("#status").textContent());
const results = await new AxeBuilder({ page }).analyze();
console.log(
  "AXE",
  JSON.stringify(
    results.violations.map((x) => ({
      id: x.id,
      impact: x.impact,
      nodes: x.nodes.map((n) => n.target),
    })),
  ),
);
await page.locator("#advanced-tab").click();
await page.locator("#favorites").selectOption("GIF · 10 fps");
await page
  .locator("#command")
  .fill('-t 1 -vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif output.gif');
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
  { timeout: 90000 },
);
console.log(
  "GIF",
  await page.locator("#advanced-status").textContent(),
  await page.locator("#error").textContent(),
);
assert.equal(await page.locator("#advanced-image").isVisible(), true);
await context.setOffline(true);
await page.reload();
await page.locator("#file").setInputFiles(".artifacts/source.mp4");
await page.waitForFunction(
  () => !document.querySelector("#run-command").disabled,
);
await page.locator("#command").fill("-t 0.5 -vn -acodec libmp3lame audio.mp3");
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
  { timeout: 90000 },
);
console.log(
  "OFFLINE ADVANCED",
  await page.locator("#advanced-status").textContent(),
);
assert.match(await page.locator("#advanced-status").textContent(), /^Complete/);
await browser.close();
