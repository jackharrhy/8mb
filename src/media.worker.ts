import {
  Input,
  ALL_FORMATS,
  BlobSource,
  AudioSampleSink,
  EncodedPacketSink,
  EncodedAudioPacketSource,
  BufferTarget,
  StreamTarget,
  Output,
  Mp4OutputFormat,
  WebMOutputFormat,
  Conversion,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
  type InputAudioTrack,
} from "mediabunny";
import { registerAacEncoder } from "@mediabunny/aac-encoder";
import { videoBudget } from "./domain.mjs";
import type { ExportOptions, MediaRequest, MediaResponse } from "./types";
const send = (message: MediaResponse) => postMessage(message);
let current: Conversion | undefined;
let cancelled = false;
const openInput = (file: File) =>
  new Input({ source: new BlobSource(file), formats: ALL_FORMATS });
async function copyAudio(
  track: InputAudioTrack,
  start: number,
  end: number,
  add?: EncodedAudioPacketSource,
) {
  const sink = new EncodedPacketSink(track);
  const first = (await sink.getPacket(start)) ?? (await sink.getFirstPacket());
  if (!first) return 0;
  let bytes = 0;
  const config = add ? await track.getDecoderConfig() : null;
  for await (const packet of sink.packets(first)) {
    if (cancelled) throw new Error("Cancelled");
    if (packet.timestamp >= end) break;
    if (packet.timestamp + packet.duration <= start) continue;
    bytes += packet.byteLength;
    // Keep the full encoded boundary packet. MP4 edit lists hide its negative timestamp.
    if (add)
      await add.add(
        packet.clone({
          timestamp: packet.timestamp - start,
          duration: Math.min(packet.duration, end - packet.timestamp),
        }),
        config ? { decoderConfig: config } : undefined,
      );
  }
  return bytes;
}
async function inspect(file: File) {
  const input = openInput(file);
  try {
    const video = await input.getPrimaryVideoTrack();
    if (!video)
      throw new Error(
        "No readable video track. Try this file in the Advanced FFmpeg workspace.",
      );
    const audio = await input.getPrimaryAudioTrack();
    const duration =
      (await input.getDurationFromMetadata()) ??
      (await input.computeDuration());
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error(
        "The file has no finite video duration. Choose another video.",
      );
    const stats = audio ? await audio.computePacketStats(100) : null;
    send({
      type: "metadata",
      metadata: {
        duration,
        width: video.displayWidth,
        height: video.displayHeight,
        audioCodec: audio?.codec ?? null,
        audioBitrate: stats?.averageBitrate ?? 0,
        videoCodec: video.codec,
        decodable: await video.canDecode(),
      },
    });
    if (!audio) {
      send({ type: "waveform-status", text: "No audio track." });
      return;
    }
    if (!(await audio.canDecode())) {
      send({
        type: "waveform-status",
        text: "Cannot display a waveform for this audio codec.",
      });
      return;
    }
    const peaks = new Float32Array(1200);
    let samples = 0;
    for await (const sample of new AudioSampleSink(audio).samples()) {
      try {
        const data = new Float32Array(sample.numberOfFrames);
        sample.copyTo(data, { planeIndex: 0, format: "f32-planar" });
        for (let i = 0; i < data.length; i += 32) {
          const bin = Math.floor(
            ((sample.timestamp + i / sample.sampleRate) / duration) *
              peaks.length,
          );
          if (bin >= 0 && bin < peaks.length)
            peaks[bin] = Math.max(peaks[bin], Math.abs(data[i]));
        }
      } finally {
        sample.close();
      }
      if (++samples % 400 === 0)
        send({ type: "waveform", peaks: Array.from(peaks) });
    }
    send({ type: "waveform", peaks: Array.from(peaks) });
    send({
      type: "waveform-status",
      text: "",
    });
  } finally {
    input.dispose();
  }
}
async function encode(file: File, options: ExportOptions) {
  const input = openInput(file);
  let temporary: string | undefined;
  let directory: FileSystemDirectoryHandle | undefined;
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode()))
      throw new Error(
        "This browser cannot decode the video codec. Try the Advanced FFmpeg workspace.",
      );
    const totalDuration =
      (await input.getDurationFromMetadata()) ??
      (await input.computeDuration());
    const { start, end, target, format, audio: audioMode } = options;
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      end > totalDuration + 0.05 ||
      end - start < 0.05
    )
      throw new Error(
        "Choose a clip range within the video, at least 0.05 seconds long.",
      );
    const duration = end - start;
    const audio = await input.getPrimaryAudioTrack();
    const codec = format === "mp4" ? "avc" : "vp9";
    const crop = options.crop;
    const sourceW = crop?.width ?? track.displayWidth,
      sourceH = crop?.height ?? track.displayHeight;
    const ratio = options.height ? Math.min(1, options.height / sourceH) : 1;
    const width = Math.max(2, Math.floor((sourceW * ratio) / 2) * 2),
      height = Math.max(2, Math.floor((sourceH * ratio) / 2) * 2);
    if (!(await canEncodeVideo(codec, { width, height })))
      throw new Error(
        `This browser cannot encode ${codec === "avc" ? "H.264" : "VP9"} at this resolution. Try the other format, a lower resolution, or Advanced FFmpeg.`,
      );
    const outputFormat =
      format === "mp4"
        ? new Mp4OutputFormat({ fastStart: "fragmented" })
        : new WebMOutputFormat();
    if (
      audioMode === "keep" &&
      audio &&
      !outputFormat.getSupportedAudioCodecs().includes(audio.codec!)
    )
      throw new Error(
        "The original audio codec is incompatible with this format. Choose another format or compress audio.",
      );
    // WebM cannot express a fractional audio boundary with an MP4 edit list.
    if (audioMode === "keep" && audio && format === "webm" && start > 0)
      throw new Error(
        "To preserve original audio with a trimmed start, choose MP4. WebM requires audio to be compressed for precise trimming.",
      );
    let audioBytes = 0;
    if (audio && audioMode === "keep") {
      send({
        type: "progress",
        progress: 0,
        text: "Measuring original audio…",
      });
      audioBytes = await copyAudio(audio, start, end);
    } else if (audio && audioMode === "compress")
      audioBytes = (128000 * duration) / 8;
    let { bytes: limit, bitrate } = videoBudget(target, duration, audioBytes);
    // A maximum file size is not a demand to use an unsupported encoder bitrate.
    for (let step = 0; step < 8; step++) {
      if (
        await canEncodeVideo(codec, {
          width,
          height,
          quality: new Quality({ bitrate }),
          frameRate: options.fps || undefined,
        })
      )
        break;
      bitrate = Math.floor(bitrate / 2);
      if (step === 7 || bitrate < 10000)
        throw new Error(
          "This browser cannot encode these settings. Reduce the resolution, choose another format, or use Advanced FFmpeg.",
        );
    }
    if (
      format === "mp4" &&
      audioMode === "compress" &&
      audio &&
      !(await canEncodeAudio("aac"))
    )
      registerAacEncoder();
    for (let attempt = 0; attempt < 4; attempt++) {
      if (cancelled) throw new Error("Cancelled");
      let buffer: BufferTarget | undefined;
      let stream: FileSystemWritableFileStream | undefined;
      let handle: FileSystemFileHandle | undefined;
      let output: Output | undefined;
      let size = 0;
      try {
        if (limit > 64 * 1024 * 1024) {
          if (!navigator.storage?.getDirectory)
            throw new Error(
              "Exports above 64 MiB need browser private file storage. Use a smaller target size or a browser with OPFS support.",
            );
          directory = await navigator.storage.getDirectory();
          temporary = `8mb-${Date.now()}-${crypto.randomUUID()}.tmp`;
          handle = await directory.getFileHandle(temporary, { create: true });
          stream = await handle.createWritable();
        } else buffer = new BufferTarget();
        const target =
          buffer ??
          new StreamTarget(
            new WritableStream({
              write: async (chunk) => {
                size = Math.max(size, chunk.position + chunk.data.length);
                await stream!.write(chunk);
              },
            }),
          );
        output = new Output({ format: outputFormat, target });
        let copied: EncodedAudioPacketSource | undefined;
        if (audio && audioMode === "keep") {
          copied = new EncodedAudioPacketSource(audio.codec!);
          output.addAudioTrack(copied);
        }
        current = await Conversion.init({
          input,
          output,
          tracks: "primary",
          composable: true,
          trim: { start, end },
          video: {
            codec,
            quality: new Quality({ bitrate }),
            forceTranscode: true,
            width,
            height,
            fit: "fill",
            crop,
            frameRate: options.fps || undefined,
          },
          audio:
            audioMode === "compress"
              ? {
                  codec: format === "mp4" ? "aac" : "opus",
                  quality: new Quality({ bitrate: 128000 }),
                  forceTranscode: true,
                }
              : { discard: true },
          showWarnings: false,
        });
        const discarded = current.discardedTracks.filter(
          (x) =>
            x.track.isVideoTrack() ||
            (audioMode === "compress" && x.track.isAudioTrack()),
        );
        if (!current.isValid || discarded.length)
          throw new Error(
            `The browser could not encode ${discarded.map((x) => `${x.track.type}: ${x.reason.replaceAll("_", " ")}`).join(", ") || "these settings"}. Choose another format, reduce the resolution, or try Advanced FFmpeg.`,
          );
        current.onProgress = (p) =>
          send({
            type: "progress",
            progress: p,
            text: `${attempt ? `Retry ${attempt}/3 · ` : ""}Encoding ${Math.round(p * 100)}%…`,
          });
        await output.start();
        await Promise.all([
          current.execute(),
          (async () => {
            if (copied && audio) {
              await copyAudio(audio, start, end, copied);
              copied.close();
            }
          })(),
        ]);
        if (cancelled) throw new Error("Cancelled");
        await output.finalize();
        if (stream) {
          await stream.close();
          stream = undefined;
        }
        const blob = buffer
          ? new Blob([buffer.buffer!], {
              type: format === "mp4" ? "video/mp4" : "video/webm",
            })
          : await handle!.getFile();
        size = blob.size;
        if (size <= limit) {
          send({
            type: "done",
            blob,
            name: `${file.name.replace(/\.[^.]+$/, "")}-clip.${format}`,
            temporary,
          });
          temporary = undefined;
          return;
        }
        bitrate = Math.floor(
          bitrate *
            Math.max(
              0.25,
              (limit * 0.94 - audioBytes) / Math.max(1, size - audioBytes),
            ),
        );
        if (bitrate < 10000)
          throw new Error(
            "Cannot fit this clip at a usable bitrate. Increase the target size or shorten the clip.",
          );
      } finally {
        await stream?.abort().catch(() => {});
        if (output && output.state !== "finalized")
          await output.cancel().catch(() => {});
        if (temporary && directory) {
          await directory.removeEntry(temporary).catch(() => {});
          temporary = undefined;
        }
      }
    }
    throw new Error(
      "The encoder exceeded the target size after 4 attempts. Increase the size, shorten the clip, or reduce its resolution.",
    );
  } finally {
    input.dispose();
    current = undefined;
  }
}
self.onmessage = async (event: MessageEvent<MediaRequest>) => {
  const message = event.data;
  if (message.type === "cancel") {
    cancelled = true;
    await current?.cancel();
    return;
  }
  if (message.type === "cleanup") {
    await navigator.storage
      .getDirectory()
      .then((d) => d.removeEntry(message.name))
      .catch(() => {});
    return;
  }
  cancelled = false;
  try {
    if (message.type === "inspect") await inspect(message.file);
    else await encode(message.file, message.options);
  } catch (error) {
    if (cancelled) send({ type: "cancelled" });
    else
      send({
        type: "error",
        text: error instanceof Error ? error.message : String(error),
      });
  }
};
