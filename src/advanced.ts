import { FFmpeg, FFFSType } from "@ffmpeg/ffmpeg";
import { parseCommand } from "./domain.mjs";
import { $, value, setValue, bytes } from "./ui";
export function initAdvanced({
  getFile,
  isBusy,
  setBusy,
  showError,
}: {
  getFile: () => File | undefined;
  isBusy: () => boolean;
  setBusy: (busy: boolean) => void;
  showError: (text: string) => void;
}) {
  let ffmpeg: FFmpeg | undefined;
  let advancedUrl = "";
  const defaults: Record<string, string> = {
    "H.264 video": "-c:v libx264 -preset fast -crf 22 -c:a aac output.mp4",
    "Extract MP3": "-vn -acodec libmp3lame -q:a 2 audio.mp3",
    "GIF · 10 fps":
      '-vf "fps=10,scale=320:-1:flags=lanczos" -c:v gif output.gif',
  };
  let favorites = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem("8mb-favorites") ?? "null");
    if (saved && typeof saved === "object" && !Array.isArray(saved))
      favorites = Object.fromEntries(
        Object.entries(saved).filter(([k, v]) => k && typeof v === "string"),
      ) as Record<string, string>;
  } catch {}
  function refreshFavorites() {
    const select = $<HTMLSelectElement>("favorites");
    select.replaceChildren(
      ...Object.keys(favorites).map((name) => new Option(name, name)),
    );
    $<HTMLButtonElement>("delete-favorite").disabled = !select.options.length;
  }
  function persistFavorites() {
    try {
      localStorage.setItem("8mb-favorites", JSON.stringify(favorites));
    } catch {
      showError(
        "This browser could not save favorites. Allow local storage, or copy the command before leaving.",
      );
    }
  }
  refreshFavorites();
  $("favorites").addEventListener("change", () => {
    $<HTMLTextAreaElement>("command").value =
      favorites[value("favorites")] ?? "";
  });
  $("save-favorite").addEventListener("click", () => {
    const name = prompt("Name this saved command:", "My command");
    if (!name?.trim()) return;
    favorites[name.trim()] = value("command");
    persistFavorites();
    refreshFavorites();
    setValue("favorites", name.trim());
  });
  $("delete-favorite").addEventListener("click", () => {
    const name = value("favorites");
    if (name && confirm(`Delete “${name}” from saved commands?`)) {
      delete favorites[name];
      persistFavorites();
      refreshFavorites();
    }
  });
  $("run-command").addEventListener("click", async () => {
    const file = getFile();
    if (!file || isBusy()) return;
    showError("");
    if (file.size >= 2 * 1024 ** 3) {
      showError(
        "FFmpeg WASM accepts inputs below 2 GiB. Use the Edit workspace for large supported files.",
      );
      return;
    }
    const ext = file.name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "bin";
    const inputPath = `/source/input.${ext}`;
    let parsed;
    try {
      parsed = parseCommand(value("command"), inputPath);
    } catch (e) {
      showError(e instanceof Error ? e.message : String(e));
      return;
    }
    setBusy(true);
    $("stop-command").hidden = false;
    $("advanced-result").hidden = true;
    $("logs").textContent = "";
    $("advanced-status").textContent = "Loading local FFmpeg engine…";
    const engine = new FFmpeg();
    ffmpeg = engine;
    engine.on("log", ({ message }) => {
      const logs = $("logs");
      logs.textContent = (logs.textContent + "\n" + message).slice(-60000);
      logs.scrollTop = logs.scrollHeight;
    });
    engine.on("progress", ({ progress }) => {
      $("advanced-status").textContent =
        `Processing ${Math.max(0, Math.min(100, Math.round(progress * 100)))}%…`;
    });
    try {
      await engine.load({
        coreURL: location.origin + "/ffmpeg/ffmpeg-core.js",
        wasmURL: location.origin + "/ffmpeg/ffmpeg-core.wasm",
      });
      await engine.createDir("/source");
      await engine.mount(
        FFFSType.WORKERFS,
        { blobs: [{ name: `input.${ext}`, data: file }] },
        "/source",
      );
      $("advanced-status").textContent = "Running command…";
      const code = await engine.exec(["-y", ...parsed.args]);
      if (code !== 0)
        throw new Error(
          `FFmpeg exited with code ${code}. Check the log and adjust your command.`,
        );
      const data = await engine.readFile(parsed.output);
      if (typeof data === "string")
        throw new Error("Expected a binary output.");
      const mime = parsed.output.endsWith(".mp4")
        ? "video/mp4"
        : parsed.output.endsWith(".webm")
          ? "video/webm"
          : parsed.output.endsWith(".mp3")
            ? "audio/mpeg"
            : parsed.output.endsWith(".gif")
              ? "image/gif"
              : "application/octet-stream";
      if (advancedUrl) URL.revokeObjectURL(advancedUrl);
      advancedUrl = URL.createObjectURL(
        new Blob([new Uint8Array(data)], { type: mime }),
      );
      const a = $<HTMLAnchorElement>("advanced-download");
      a.href = advancedUrl;
      a.download = parsed.output;
      $("advanced-result").hidden = false;
      const out = $<HTMLVideoElement>("advanced-video");
      out.hidden =
        mime.startsWith("image/") || mime === "application/octet-stream";
      out.src = advancedUrl;
      const image = $<HTMLImageElement>("advanced-image");
      image.hidden = !mime.startsWith("image/");
      if (!image.hidden) {
        image.src = advancedUrl;
        await image.decode();
        image.width = image.naturalWidth;
        image.height = image.naturalHeight;
      }
      $("advanced-status").textContent =
        `Complete · ${bytes(data.length)} · ${parsed.output}`;
    } catch (e) {
      if (ffmpeg === engine) {
        showError(e instanceof Error ? e.message : String(e));
        $("advanced-status").textContent =
          "Command failed. See the log for details.";
      }
    } finally {
      engine.terminate();
      if (ffmpeg === engine) ffmpeg = undefined;
      setBusy(false);
      if (getFile()) $<HTMLButtonElement>("run-command").disabled = false;
      $("stop-command").hidden = true;
    }
  });
  $("stop-command").addEventListener("click", () => {
    ffmpeg?.terminate();
    ffmpeg = undefined;
    $("advanced-status").textContent = "Command stopped.";
  });
}
