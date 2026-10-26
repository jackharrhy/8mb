import { clearStaleExports } from "./storage";
import { initAdvanced } from "./advanced";
import { initOffline } from "./offline";
import { $, num, value, setValue, bytes } from "./ui";
import "./style.css";
import {
  createIcons,
  FolderOpen,
  Film,
  Crop as CropIcon,
  Play,
  Download,
} from "lucide";
import { createPreview } from "./preview";
import { timeLabel, videoBudget } from "./domain.mjs";
import type { Crop, Metadata, ExportOptions, MediaResponse } from "./types";
createIcons({
  icons: { FolderOpen, Film, Crop: CropIcon, Play, Download },
  attrs: { "aria-hidden": "true" },
});
const mediaWorker = () =>
  new Worker(new URL("./media.worker.ts", import.meta.url), { type: "module" });
let file: File | undefined,
  meta: Metadata | undefined,
  inspector: Worker | undefined,
  encoder: Worker | undefined;
let resultUrl = "",
  temporary: string | undefined;
let crop: Crop | undefined,
  busy = false,
  peaks: number[] = [];
let activeKind: "edit" | "advanced" = "edit";
const playback = createPreview(error);
function error(text: string) {
  $("error").textContent = text;
  $("error").hidden = !text;
}
function job(text: string) {
  $("status").textContent = text;
}
function syncTabs() {
  const advanced = location.hash === "#advanced";
  $("edit-panel").hidden = advanced;
  $("advanced-panel").hidden = !advanced;
  for (const id of ["edit", "advanced"]) {
    const a = $(id + "-tab");
    if ((id === "advanced") === advanced)
      a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}
addEventListener("hashchange", syncTabs);
syncTabs();
function setBusy(next: boolean, kind: "edit" | "advanced" = "edit") {
  busy = next;
  activeKind = kind;
  $<HTMLButtonElement>("choose").disabled = next;
  $<HTMLFieldSetElement>("settings").disabled = next;
  for (const id of [
    "start",
    "end",
    "trim-start",
    "trim-end",
    "crop-toggle",
    "crop-clear",
    "preview-clip",
  ])
    $<HTMLButtonElement>(id).disabled = next || !meta;
  for (const el of $("crop-fields").querySelectorAll("input"))
    el.disabled = next;
  $<HTMLButtonElement>("run-command").disabled = next || !file;
  $<HTMLButtonElement>("export").disabled = next || !meta || !meta.decodable;
  $("cancel").hidden = !next || kind === "advanced";
}
function updateBudget() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-size]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.size) === num("target")),
      ),
    );
  $("audio-hint").textContent =
    value("audio") === "keep"
      ? "Copy original sound without re-encoding. Its size comes out of the video budget."
      : value("audio") === "mute"
        ? "Export a silent clip. Use the entire budget for video."
        : "Balance sound quality with a smaller file.";
  if (!meta) return;
  const duration = num("end") - num("start");
  $("selection-duration").textContent =
    `${Math.max(0, duration).toFixed(2)} sec selected`;
  $("summary-duration").textContent = `${Math.max(0, duration).toFixed(2)} sec`;
  const audioRate = meta.audioCodec
    ? value("audio") === "keep"
      ? meta.audioBitrate
      : value("audio") === "mute"
        ? 0
        : 128000
    : 0;
  try {
    $("budget").textContent =
      `${Math.round(videoBudget(num("target"), duration, (audioRate * duration) / 8).bitrate / 1000).toLocaleString()} kb/s${value("audio") === "keep" ? " ≈" : ""}`;
  } catch {
    $("budget").textContent = "Increase size or trim";
  }
}
function drawWaveform() {
  const canvas = $<HTMLCanvasElement>("waveform");
  const width = canvas.clientWidth,
    height = canvas.clientHeight,
    dpr = devicePixelRatio;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue(
    "--muted",
  );
  const max = Math.max(0.05, ...peaks);
  for (let x = 0; x < width; x += 3) {
    const peak = peaks.length
      ? peaks[Math.floor((x / width) * peaks.length)]
      : 0;
    const h = Math.max(1, (peak / max) * (height - 14));
    ctx.fillRect(x, (height - h) / 2, 1.5, h);
  }
}
function updateTrim(seek?: number) {
  if (!meta) return;
  const start = num("start"),
    end = num("end");
  setValue("trim-start", start);
  setValue("trim-end", end);
  const selection = $("trim-selection");
  selection.style.left = `${(start / meta.duration) * 100}%`;
  selection.style.right = `${(1 - end / meta.duration) * 100}%`;
  updateBudget();
  if (seek !== undefined) void playback.seek(seek);
}
async function clearOutput() {
  if (resultUrl) {
    URL.revokeObjectURL(resultUrl);
    resultUrl = "";
  }
  $("result").hidden = true;
  $<HTMLVideoElement>("result-video").removeAttribute("src");
  if (temporary) {
    const d = await navigator.storage.getDirectory();
    await d.removeEntry(temporary).catch(() => {});
    temporary = undefined;
  }
}
async function loadFile(next: File) {
  if (busy) {
    error(
      "Wait for the current export, or cancel it before opening another file.",
    );
    return;
  }
  if (!next.size) {
    error("This file is empty. Choose another video.");
    return;
  }
  error("");
  file = next;
  meta = undefined;
  crop = undefined;
  peaks = [];
  void clearOutput().catch(() => {});
  inspector?.terminate();
  playback.load(next);
  $("empty").hidden = true;
  $("crop-overlay").hidden = true;
  $("crop-fields").hidden = true;
  $("crop-toggle").setAttribute("aria-pressed", "false");
  $("dimensions").textContent = "Original frame";
  $("filename").textContent = next.name;
  $("file-meta").textContent = `${bytes(next.size)} · Reading video…`;
  setBusy(false);
  $<HTMLButtonElement>("run-command").disabled = false;
  $("advanced-status").textContent = `Input: ${next.name}`;
  $("waveform-status").textContent = "Reading audio waveform…";
  job("Reading video…");
  updateBudget();
  drawWaveform();
  inspector = mediaWorker();
  inspector.onerror = () =>
    error("The media worker stopped. Reopen the video or try Advanced FFmpeg.");
  inspector.onmessage = (event: MessageEvent<MediaResponse>) => {
    const message = event.data;
    if (message.type === "metadata") {
      meta = message.metadata;
      $("file-meta").textContent =
        `${meta.width} × ${meta.height} · ${timeLabel(meta.duration)} · ${bytes(next.size)}`;
      for (const id of ["start", "end", "trim-start", "trim-end"])
        $<HTMLInputElement>(id).max = String(meta.duration);
      setValue("start", 0);
      setValue("end", meta.duration.toFixed(3));
      $("timeline-end").textContent = timeLabel(meta.duration);
      $<HTMLSelectElement>("audio").disabled = !meta.audioCodec;
      setBusy(busy, activeKind);
      updateTrim();
      job(
        meta.decodable
          ? "Ready when you are."
          : "Source codec unavailable in this browser. Try Advanced FFmpeg.",
      );
      if (!meta.decodable) {
        $<HTMLButtonElement>("export").disabled = true;
      }
    } else if (message.type === "waveform") {
      peaks = message.peaks;
      drawWaveform();
    } else if (message.type === "waveform-status")
      $("waveform-status").textContent = message.text;
    else if (message.type === "error") {
      if (meta)
        $("waveform-status").textContent =
          `Waveform unavailable: ${message.text}`;
      else {
        error(message.text);
        job("Try Advanced FFmpeg, or choose another video.");
        $("file-meta").textContent = bytes(next.size);
        $<HTMLButtonElement>("run-command").disabled = false;
      }
    }
  };
  inspector.postMessage({ type: "inspect", file: next });
}
for (const id of ["choose", "empty-choose"])
  $(id).addEventListener("click", () => $<HTMLInputElement>("file").click());
$("file").addEventListener("change", () => {
  const input = $<HTMLInputElement>("file");
  if (input.files?.[0]) void loadFile(input.files[0]);
  input.value = "";
});
const preview = $("preview");
preview.addEventListener("dragover", (e) => {
  e.preventDefault();
  preview.classList.add("dragover");
});
preview.addEventListener("dragleave", () =>
  preview.classList.remove("dragover"),
);
preview.addEventListener("drop", (e) => {
  e.preventDefault();
  preview.classList.remove("dragover");
  if (e.dataTransfer?.files[0]) void loadFile(e.dataTransfer.files[0]);
});
for (const id of ["start", "end", "trim-start", "trim-end"])
  $(id).addEventListener("input", () => {
    if (!meta) return;
    const startChanged = id === "start" || id === "trim-start";
    let n = num(id);
    if (!Number.isFinite(n)) return;
    n = Math.max(0, Math.min(meta.duration, n));
    if (startChanged) setValue("start", Math.min(n, num("end") - 0.05));
    else setValue("end", Math.max(n, num("start") + 0.05));
    updateTrim(
      startChanged ? num("start") : Math.max(num("start"), num("end") - 0.05),
    );
  });
for (const id of ["target", "format", "audio", "height", "fps"])
  $(id).addEventListener("input", updateBudget);
document.querySelectorAll<HTMLButtonElement>("[data-size]").forEach((b) =>
  b.addEventListener("click", () => {
    setValue("target", b.dataset.size!);
    updateBudget();
  }),
);
$("preview-clip").addEventListener("click", () => {
  if (meta) void playback.play(num("start"), num("end"));
});
$("timeline").addEventListener("pointerdown", (e) => {
  if (!meta || busy || e.target instanceof HTMLInputElement) return;
  const rect = $("timeline").getBoundingClientRect();
  void playback.seek(
    Math.max(
      0,
      Math.min(
        meta.duration,
        ((e.clientX - rect.left) / rect.width) * meta.duration,
      ),
    ),
  );
});
function fittedRect() {
  const r = preview.getBoundingClientRect();
  const scale = Math.min(r.width / meta!.width, r.height / meta!.height);
  return {
    left: (r.width - meta!.width * scale) / 2,
    top: (r.height - meta!.height * scale) / 2,
    scale,
  };
}
function drawCrop() {
  if (!meta || !crop) return;
  const r = fittedRect();
  const box = $("crop-box");
  Object.assign(box.style, {
    left: `${r.left + crop.left * r.scale}px`,
    top: `${r.top + crop.top * r.scale}px`,
    width: `${crop.width * r.scale}px`,
    height: `${crop.height * r.scale}px`,
  });
  for (const [id, n] of Object.entries({
    "crop-x": crop.left,
    "crop-y": crop.top,
    "crop-w": crop.width,
    "crop-h": crop.height,
  }))
    setValue(id, n);
  $("dimensions").textContent = `${crop.width} × ${crop.height} crop`;
}
$("crop-toggle").addEventListener("click", () => {
  if (!meta) return;
  const active = $("crop-overlay").hidden;
  $("crop-overlay").hidden = !active;
  $("crop-fields").hidden = !active;
  $("crop-toggle").setAttribute("aria-pressed", String(active));
  playback.pause();
  if (active) {
    crop ??= {
      left: 0,
      top: 0,
      width: Math.floor(meta.width / 2) * 2,
      height: Math.floor(meta.height / 2) * 2,
    };
    drawCrop();
  }
});
$("crop-clear").addEventListener("click", () => {
  crop = undefined;
  $("crop-overlay").hidden = true;
  $("crop-fields").hidden = true;
  $("crop-toggle").setAttribute("aria-pressed", "false");
  $("dimensions").textContent = "Original frame";
});
for (const id of ["crop-x", "crop-y", "crop-w", "crop-h"])
  $(id).addEventListener("change", () => {
    if (!meta || !crop) return;
    const even = (n: number) =>
      Math.max(0, Math.floor((Number.isFinite(n) ? n : 0) / 2) * 2);
    crop = {
      left: Math.min(meta.width - 2, even(num("crop-x"))),
      top: Math.min(meta.height - 2, even(num("crop-y"))),
      width: even(num("crop-w")),
      height: even(num("crop-h")),
    };
    crop.width = Math.max(
      2,
      Math.min(crop.width, Math.floor((meta.width - crop.left) / 2) * 2),
    );
    crop.height = Math.max(
      2,
      Math.min(crop.height, Math.floor((meta.height - crop.top) / 2) * 2),
    );
    drawCrop();
  });
let cropOrigin: { x: number; y: number } | undefined;
function cropPoint(e: PointerEvent) {
  const rect = preview.getBoundingClientRect(),
    r = fittedRect();
  return {
    x: Math.max(
      0,
      Math.min(
        meta!.width - 2,
        Math.floor((e.clientX - rect.left - r.left) / r.scale / 2) * 2,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        meta!.height - 2,
        Math.floor((e.clientY - rect.top - r.top) / r.scale / 2) * 2,
      ),
    ),
  };
}
$("crop-overlay").addEventListener("pointerdown", (e) => {
  if (!meta || busy) return;
  cropOrigin = cropPoint(e);
  $("crop-overlay").setPointerCapture(e.pointerId);
  e.preventDefault();
});
$("crop-overlay").addEventListener("pointermove", (e) => {
  if (!cropOrigin || !meta) return;
  const p = cropPoint(e);
  crop = {
    left: Math.min(p.x, cropOrigin.x),
    top: Math.min(p.y, cropOrigin.y),
    width: Math.max(2, Math.abs(p.x - cropOrigin.x)),
    height: Math.max(2, Math.abs(p.y - cropOrigin.y)),
  };
  drawCrop();
});
for (const event of ["pointerup", "pointercancel"])
  $("crop-overlay").addEventListener(event, () => {
    cropOrigin = undefined;
  });
new ResizeObserver(() => {
  drawWaveform();
  drawCrop();
}).observe(preview);
matchMedia("(prefers-color-scheme:dark)").addEventListener(
  "change",
  drawWaveform,
);
$("export").addEventListener("click", async () => {
  if (!file || !meta || busy) return;
  error("");
  playback.pause();
  const options: ExportOptions = {
    start: num("start"),
    end: num("end"),
    target: num("target"),
    format: value("format") as ExportOptions["format"],
    audio: value("audio") as ExportOptions["audio"],
    height: num("height"),
    fps: num("fps"),
    crop,
  };
  if (
    !Number.isFinite(options.target) ||
    options.target < 0.1 ||
    options.target > 4096
  ) {
    error("Choose a target size between 0.1 and 4096 MiB.");
    return;
  }
  setBusy(true);
  try {
    await clearOutput();
  } catch (e) {
    setBusy(false);
    error(`Could not clear the previous export. Reload and try again. ${e}`);
    return;
  }
  $("progress").hidden = false;
  $<HTMLProgressElement>("progress").value = 0;
  job("Preparing export…");
  encoder?.terminate();
  encoder = mediaWorker();
  const finish = () => {
    setBusy(false);
    $("progress").hidden = true;
  };
  encoder.onerror = (e) => {
    finish();
    error(
      `The export worker stopped. Try a lower resolution or smaller target size. ${e.message}`,
    );
    job("Export failed.");
  };
  encoder.onmessage = (event: MessageEvent<MediaResponse>) => {
    const m = event.data;
    if (m.type === "progress") {
      $<HTMLProgressElement>("progress").value = m.progress;
      job(m.text);
    } else if (m.type === "done") {
      finish();
      temporary = m.temporary;
      resultUrl = URL.createObjectURL(m.blob);
      const a = $<HTMLAnchorElement>("download");
      a.href = resultUrl;
      a.download = m.name;
      $<HTMLVideoElement>("result-video").src = resultUrl;
      $("result-size").textContent =
        `${bytes(m.blob.size)} · within ${options.target} MiB`;
      $("result").hidden = false;
      job("Export complete. Your clip is ready to save.");
    } else if (m.type === "error") {
      finish();
      error(m.text);
      job("Export failed. Adjust settings and try again.");
    } else if (m.type === "cancelled") {
      finish();
      job("Export cancelled. Your source is unchanged.");
    }
  };
  encoder.postMessage({ type: "export", file, options });
});
$("cancel").addEventListener("click", () => {
  encoder?.postMessage({ type: "cancel" });
  job("Cancelling…");
  $<HTMLButtonElement>("cancel").disabled = true;
  setTimeout(() => {
    $<HTMLButtonElement>("cancel").disabled = false;
  }, 1000);
});
initAdvanced({
  getFile: () => file,
  isBusy: () => busy,
  setBusy: (next) => setBusy(next, "advanced"),
  showError: error,
});
addEventListener("beforeunload", (e) => {
  if (busy) {
    e.preventDefault();
  }
});
initOffline();

void clearStaleExports();
