// Self-check for the WAV the API receives. Run: node src/lib/wav.check.ts <out-dir>
// Writes two files; the API's own validator (python) then reads them back.
import assert from "node:assert";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { encodeWav, resample, toMono } from "./wav.ts";

const tone = (rate: number, seconds: number) =>
  Int16Array.from({ length: rate * seconds }, (_, i) => Math.round(8000 * Math.sin((2 * Math.PI * 440 * i) / rate)));

// 16 kHz in -> unchanged samples, valid header.
const direct = encodeWav(tone(16000, 1), 16000);
assert.equal(direct.length, 44 + 16000 * 2);
assert.equal(String.fromCharCode(...direct.slice(0, 4)), "RIFF");

// 48 kHz (a common phone default) -> resampled to exactly 1 s at 16 kHz.
assert.equal(resample(tone(48000, 1), 48000).length, 16000);
const resampled = encodeWav(tone(48000, 1), 48000);
assert.equal(resampled.length, 44 + 16000 * 2);

// A recording that overshoots its limit (30.1 s for a 30 s turn) is cut to exactly the limit.
assert.equal(encodeWav(tone(16000, 31), 16000, 30).length, 44 + 30 * 16000 * 2);
assert.equal(encodeWav(tone(48000, 31), 48000, 30).length, 44 + 30 * 16000 * 2);

// Stereo -> mono averages the channels.
assert.deepEqual([...toMono(new Int16Array([100, 300, -50, 50]).buffer, 2)], [200, 0]);

const out = process.argv[2] ?? ".";
writeFileSync(join(out, "direct.wav"), direct);
writeFileSync(join(out, "resampled.wav"), resampled);
writeFileSync(join(out, "full30.wav"), encodeWav(tone(16000, 31), 16000, 30));
console.log("wav self-check passed");
