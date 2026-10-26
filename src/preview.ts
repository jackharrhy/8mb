import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
  AudioSampleSink,
} from "mediabunny";
import { $ } from "./ui";

// Native playback handles the common case. Demuxed playback also previews containers
// that WebCodecs understands but the browser's <video> element cannot open.
export function createPreview(reportError: (text: string) => void) {
  const video = $<HTMLVideoElement>("video");
  const canvas = $<HTMLCanvasElement>("frame");
  let file: File | undefined,
    url = "",
    input: Input | undefined,
    sink: CanvasSink | undefined;
  let generation = 0,
    playing = false,
    clipEnd = Infinity,
    audioContext: AudioContext | undefined;
  const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));
  function pause() {
    playing = false;
    generation++;
    video.pause();
    void audioContext?.close();
    audioContext = undefined;
  }
  function draw(wrapped: { canvas: HTMLCanvasElement | OffscreenCanvas }) {
    canvas.width = wrapped.canvas.width;
    canvas.height = wrapped.canvas.height;
    canvas.getContext("2d")!.drawImage(wrapped.canvas, 0, 0);
  }
  async function seek(time: number) {
    pause();
    if (!video.hidden) {
      video.currentTime = time;
      return;
    }
    if (!sink) return;
    const token = generation;
    try {
      const frame = await sink.getCanvas(time);
      if (frame && token === generation) draw(frame);
    } catch (e) {
      if (token === generation)
        reportError(
          `Preview unavailable: ${e instanceof Error ? e.message : e}`,
        );
    }
  }
  async function useDecodedPreview() {
    if (!file || input) return;
    const token = generation;
    try {
      const candidate = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
      });
      input = candidate;
      const track = await candidate.getPrimaryVideoTrack();
      if (token !== generation) {
        candidate.dispose();
        return;
      }
      if (!track || !(await track.canDecode()))
        throw new Error("Try Advanced FFmpeg to convert this file.");
      sink = new CanvasSink(track, {
        width: Math.min(960, track.displayWidth),
      });
      video.hidden = true;
      canvas.hidden = false;
      await seek(0);
    } catch (e) {
      if (token === generation)
        reportError(
          `This browser cannot preview the source. ${e instanceof Error ? e.message : e}`,
        );
    }
  }
  video.addEventListener("error", () => void useDecodedPreview());
  video.addEventListener("timeupdate", () => {
    if (playing && video.currentTime >= clipEnd) pause();
  });
  function load(next: File) {
    pause();
    input?.dispose();
    input = undefined;
    sink = undefined;
    file = next;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(next);
    video.hidden = false;
    canvas.hidden = true;
    video.src = url;
  }
  async function play(start: number, end: number) {
    if (playing) {
      pause();
      return;
    }
    try {
      if (!video.hidden) {
        video.currentTime = start;
        clipEnd = end;
        playing = true;
        await video.play();
        return;
      }
      if (!sink || !input) return;
      playing = true;
      const token = ++generation;
      const audio = await input.getPrimaryAudioTrack();
      if (token !== generation) return;
      const audioPlayable = audio && (await audio.canDecode());
      const context = audioPlayable ? new AudioContext() : undefined;
      audioContext = context;
      if (context) await context.resume();
      const audioStart = context ? context.currentTime + 0.08 : 0,
        wallStart = performance.now() + 80;
      async function renderAudio() {
        if (!audioPlayable || !context || !audio) return;
        for await (const sample of new AudioSampleSink(audio).samples(
          start,
          end,
        )) {
          try {
            if (token !== generation) break;
            const when = audioStart + sample.timestamp - start;
            while (token === generation && when - context.currentTime > 0.25)
              await wait(40);
            if (token !== generation) break;
            const buffer = sample.toAudioBuffer(),
              offset = Math.max(0, start - sample.timestamp);
            const duration = Math.min(
              buffer.duration - offset,
              end - sample.timestamp - offset,
            );
            if (duration <= 0) continue;
            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);
            source.start(Math.max(context.currentTime, when), offset, duration);
          } finally {
            sample.close();
          }
        }
      }
      async function renderVideo() {
        for await (const frame of sink!.canvases(start, end)) {
          if (token !== generation) break;
          const due = wallStart + (frame.timestamp - start) * 1000;
          while (token === generation && performance.now() < due)
            await wait(Math.min(40, due - performance.now()));
          if (token !== generation) break;
          draw(frame);
        }
      }
      await Promise.all([renderVideo(), renderAudio()]);
      while (
        token === generation &&
        performance.now() < wallStart + (end - start) * 1000
      )
        await wait(40);
      if (token === generation) pause();
    } catch (e) {
      pause();
      reportError(`Playback failed. ${e instanceof Error ? e.message : e}`);
    }
  }
  return { load, seek, play, pause };
}
