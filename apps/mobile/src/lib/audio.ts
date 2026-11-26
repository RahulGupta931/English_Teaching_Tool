import { createAudioPlayer, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioStream, type AudioPlayer } from "expo-audio";
import { File, Paths } from "expo-file-system";
import * as Speech from "expo-speech";
import { useEffect, useRef, useState } from "react";

import { encodeWav, RATE, toMono } from "./wav";

/** Mono 16-bit samples at `rate` -> 16 kHz WAV file in the cache. Returns its uri. */
function writeWav(samples: Int16Array, rate: number, maxSeconds: number): string {
  const file = new File(Paths.cache, `rec-${Date.now()}.wav`);
  file.write(encodeWav(samples, rate, maxSeconds));
  return file.uri;
}

const rms = (s: Int16Array) => Math.sqrt(s.reduce((n, x) => n + x * x, 0) / Math.max(1, s.length)) / 32768;

// Hands-free turn detection (same numbers as the web app's useHandsFree).
const CALIBRATE_SECONDS = 0.25;
const MIN_LEVEL = 0.012;
const SPEECH_SECONDS = 0.3;
const END_SILENCE_SECONDS = 1.4;
const NO_SPEECH_SECONDS = 10;

type MicOptions = {
  maxSeconds: number;
  onWav: (uri: string, seconds: number) => void;
  onError: (message: string) => void;
  /** Send automatically when the learner stops talking. */
  handsFree?: boolean;
  /** Hands-free only: nothing was said for a while. */
  onSilence?: () => void;
};

/** Record the microphone as 16 kHz WAV. `level` (0..1) drives the waveform, `seconds` the timer. */
export function useMic({ maxSeconds, onWav, onError, handsFree, onSilence }: MicOptions) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(12).fill(0.1)); // recent levels, for the waveform
  const st = useRef({ chunks: [] as Int16Array[], rate: RATE, elapsed: 0, noise: 0, noiseN: 0, loud: 0, lastLoud: 0, on: false });
  const cb = useRef({ onWav, onError, onSilence });
  useEffect(() => {
    cb.current = { onWav, onError, onSilence };
  });

  const { stream } = useAudioStream({
    sampleRate: RATE,
    channels: 1,
    encoding: "int16",
    onBuffer: (b) => {
      const s = st.current;
      if (!s.on) return;
      const mono = toMono(b.data, b.channels);
      s.rate = b.sampleRate;
      s.chunks.push(mono);
      const dt = mono.length / b.sampleRate;
      const lvl = rms(mono);
      s.elapsed += dt;
      setSeconds(s.elapsed);
      setLevels((l) => [...l.slice(1), Math.max(0.1, Math.min(1, lvl * 8))]);
      if (s.elapsed >= maxSeconds) return void end(true);
      if (!handsFree) return;
      if (s.elapsed < CALIBRATE_SECONDS) {
        s.noise = (s.noise * s.noiseN + lvl) / ++s.noiseN;
        return;
      }
      if (lvl > Math.max(MIN_LEVEL, s.noise * 3)) {
        s.loud += dt;
        s.lastLoud = s.elapsed;
      }
      const heard = s.loud >= SPEECH_SECONDS;
      if (heard && s.elapsed - s.lastLoud > END_SILENCE_SECONDS) end(true);
      else if (!heard && s.elapsed > NO_SPEECH_SECONDS) end(false).then(() => cb.current.onSilence?.());
    },
  });

  async function start() {
    if (st.current.on) return;
    stopAudio(); // don't record the app's own voice
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) return cb.current.onError("Microphone access is needed. Please allow it in your phone's settings.");
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      st.current = { chunks: [], rate: RATE, elapsed: 0, noise: 0, noiseN: 0, loud: 0, lastLoud: 0, on: true };
      setSeconds(0);
      await stream.start();
      setRecording(true);
    } catch (e) {
      st.current.on = false;
      cb.current.onError(`Could not start recording: ${e instanceof Error ? e.message : e}`);
    }
  }

  async function end(send: boolean) {
    const s = st.current;
    if (!s.on) return;
    s.on = false;
    stream.stop();
    setRecording(false);
    // Back to normal playback, so replies come from the loudspeaker rather than the earpiece.
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});
    if (!send) return;
    const length = s.chunks.reduce((n, c) => n + c.length, 0);
    if (!length) return cb.current.onError("No audio was captured. Check your microphone and try again.");
    const all = new Int16Array(length);
    let o = 0;
    for (const c of s.chunks) {
      all.set(c, o);
      o += c.length;
    }
    try {
      cb.current.onWav(writeWav(all, s.rate, maxSeconds), Math.min(s.elapsed, maxSeconds));
    } catch (e) {
      cb.current.onError(`Could not save the recording: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Release the microphone when the screen closes.
  useEffect(() => () => void end(false), []); // eslint-disable-line react-hooks/exhaustive-deps

  return { recording, seconds, levels, start, send: () => end(true), cancel: () => end(false) };
}

let current: AudioPlayer | null = null;

export function stopAudio() {
  current?.remove();
  current = null;
  Speech.stop();
}

/** Play the server's voice (base64 MP3) if it sent one; otherwise (free plan) read `text` with the phone's voice.
 *  `onEnd` runs once when playback finishes or fails. */
export function playAudio(base64?: string | null, text?: string, onEnd?: () => void) {
  stopAudio();
  let ended = false;
  const done = () => {
    if (!ended) onEnd?.();
    ended = true;
  };
  if (base64) {
    try {
      const file = new File(Paths.cache, `voice-${Date.now()}.mp3`);
      file.write(base64, { encoding: "base64" });
      const player = createAudioPlayer(file.uri);
      current = player;
      player.addListener("playbackStatusUpdate", (s) => {
        if (s.didJustFinish) {
          if (current === player) stopAudio();
          done();
        }
      });
      player.play();
      return;
    } catch {
      // fall through to the phone's voice
    }
  }
  if (!text) return done();
  Speech.speak(text, { language: "en-IN", onDone: done, onError: done, onStopped: done });
}
