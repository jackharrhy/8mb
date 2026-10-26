export const MIB = 1024 * 1024;
export function videoBudget(targetMiB, duration, audioBytes) {
  if (
    ![targetMiB, duration, audioBytes].every(Number.isFinite) ||
    targetMiB <= 0 ||
    duration <= 0 ||
    audioBytes < 0
  )
    throw new Error("Enter a positive size and a valid clip range.");
  const bytes = Math.floor(targetMiB * MIB);
  const video = ((bytes * 0.94 - audioBytes) * 8) / duration;
  if (video < 10000)
    throw new Error(
      "The audio and clip length exceed this size budget. Increase the target size, shorten the clip, or compress/remove audio.",
    );
  return { bytes, bitrate: Math.floor(video) };
}
export function parseCommand(command, inputPath) {
  const args = [];
  let token = "";
  let quote = "";
  let escaped = false;
  let started = false;
  for (const char of command.trim()) {
    if (escaped) {
      token += char;
      escaped = false;
      started = true;
    } else if (char === "\\" && quote !== "'") {
      escaped = true;
      started = true;
    } else if (quote) {
      if (char === quote) quote = "";
      else token += char;
    } else if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        args.push(token);
        token = "";
        started = false;
      }
    } else {
      token += char;
      started = true;
    }
  }
  if (quote || escaped)
    throw new Error("Close the quotes or finish the escape in your command.");
  if (started) args.push(token);
  if (args[0] === "ffmpeg") args.shift();
  if (!args.length)
    throw new Error("Enter FFmpeg arguments and an output filename.");
  const replaced = args.map((x) => (x === "input.ext" ? inputPath : x));
  if (!replaced.includes("-i")) replaced.unshift("-i", inputPath);
  const output = replaced.at(-1);
  if (
    !output ||
    output.startsWith("-") ||
    output.includes("/") ||
    output === "input.ext" ||
    !/^[\w .-]+\.[a-z0-9]+$/i.test(output)
  )
    throw new Error(
      "End the command with a simple output filename, such as output.mp4.",
    );
  return { args: replaced, output };
}
export function timeLabel(seconds) {
  const s = Math.max(0, seconds || 0);
  return `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
}
