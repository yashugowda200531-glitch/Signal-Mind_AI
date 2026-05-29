// @ts-ignore
import { fft } from "fft-js";

export interface FFTResult {
  frequencies: number[];
  magnitudes: number[];

  peakFrequency: number;
  peakMagnitude: number;

  spectralCentroid: number;
  rms: number;
  zcr: number;
  spectralFlatness: number;
}

export function analyzeSignal(
  samples: Float32Array,
  sampleRate: number
): FFTResult {

  // =========================================
  // LIMIT FFT SIZE
  // =========================================

  const FFT_SIZE = 2048;

  const sliced = samples.slice(0, FFT_SIZE);

  // =========================================
  // HANNING WINDOW
  // =========================================

  const windowed = sliced.map((x, n) => {
    const w =
      0.5 *
      (1 - Math.cos((2 * Math.PI * n) / (sliced.length - 1)));

    return x * w;
  });

  // =========================================
  // FFT
  // =========================================

  const phasors = fft(Array.from(windowed));

  // =========================================
  // MAGNITUDE SPECTRUM
  // =========================================

  const magnitudes = phasors.map(([re, im]) => {

    const mag = Math.sqrt(re * re + im * im);

    // dB conversion
    return 20 * Math.log10(mag + 1e-12);
  });

  // =========================================
  // FREQUENCY AXIS
  // =========================================

  const frequencies = magnitudes.map((_, i) => {
    return (i * sampleRate) / magnitudes.length;
  });

  // =========================================
  // PEAK DETECTION
  // =========================================

  let peakMagnitude = -Infinity;
  let peakFrequency = 0;

  magnitudes.forEach((mag, i) => {
    if (mag > peakMagnitude) {
      peakMagnitude = mag;
      peakFrequency = frequencies[i];
    }
  });

  // =========================================
  // RMS POWER
  // =========================================

  const rms =
    Math.sqrt(
      sliced.reduce((sum, x) => sum + x * x, 0) / sliced.length
    );

  // =========================================
  // ZERO CROSSING RATE
  // =========================================

  let zeroCrossings = 0;

  for (let i = 1; i < sliced.length; i++) {
    if (
      (sliced[i - 1] >= 0 && sliced[i] < 0) ||
      (sliced[i - 1] < 0 && sliced[i] >= 0)
    ) {
      zeroCrossings++;
    }
  }

  const zcr = zeroCrossings / sliced.length;

  // =========================================
  // SPECTRAL CENTROID
  // =========================================

  let weightedSum = 0;
  let magnitudeSum = 0;

  for (let i = 0; i < magnitudes.length; i++) {

    const linearMag =
      Math.pow(10, magnitudes[i] / 20);

    weightedSum += frequencies[i] * linearMag;

    magnitudeSum += linearMag;
  }

  const spectralCentroid =
    magnitudeSum > 0
      ? weightedSum / magnitudeSum
      : 0;

  // =========================================
  // SPECTRAL FLATNESS
  // =========================================

  let geoMean = 0;
  let arithMean = 0;

  const linearSpectrum = magnitudes.map(m =>
    Math.pow(10, m / 20)
  );

  const epsilon = 1e-12;

  geoMean =
    Math.exp(
      linearSpectrum.reduce(
        (sum, x) => sum + Math.log(x + epsilon),
        0
      ) / linearSpectrum.length
    );

  arithMean =
    linearSpectrum.reduce((a, b) => a + b, 0) /
    linearSpectrum.length;

  const spectralFlatness =
    arithMean > 0
      ? geoMean / arithMean
      : 0;

  // =========================================
  // RETURN
  // =========================================

  return {
    frequencies,
    magnitudes,

    peakFrequency,
    peakMagnitude,

    spectralCentroid,
    rms,
    zcr,
    spectralFlatness,
  };
}