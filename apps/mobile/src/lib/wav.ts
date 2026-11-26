// The API accepts only 16 kHz mono 16-bit WAV (apps/api/app/audio.py), so the phone builds exactly that.
// Pure functions (no Expo imports) so wav.check.ts can run them in Node.
export const RATE = 16000;

/** Mono 16-bit samples at `rate` -> bytes of a 16 kHz mono 16-bit WAV, cut to `maxSeconds`
 *  (the API rejects anything longer than its limit, and the last mic buffer can overshoot it). */
export function encodeWav(samples: Int16Array, rate: number, maxSeconds = Infinity): Uint8Array {
  const pcm = (rate === RATE ? samples : resample(samples, rate)).subarray(0, Math.floor(maxSeconds * RATE));
  const bytes = new Uint8Array(44 + pcm.length * 2);
  const v = new DataView(bytes.buffer);
  const text = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, RATE, true);
  v.setUint32(28, RATE * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((s, i) => v.setInt16(44 + i * 2, s, true));
  return bytes;
}

// Linear interpolation: plenty for speech-to-text, used only when the phone can't record at 16 kHz itself.
export function resample(src: Int16Array, rate: number): Int16Array {
  const out = new Int16Array(Math.floor((src.length * RATE) / rate));
  const step = rate / RATE;
  for (let i = 0; i < out.length; i++) {
    const x = i * step, j = Math.floor(x), t = x - j;
    out[i] = Math.round(src[j] * (1 - t) + (src[Math.min(j + 1, src.length - 1)] ?? 0) * t);
  }
  return out;
}

/** Interleaved 16-bit PCM -> mono (average of channels). */
export function toMono(data: ArrayBuffer, channels: number): Int16Array {
  const all = new Int16Array(data);
  if (channels <= 1) return all.slice();
  const out = new Int16Array(Math.floor(all.length / channels));
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < channels; c++) sum += all[i * channels + c];
    out[i] = sum / channels;
  }
  return out;
}
