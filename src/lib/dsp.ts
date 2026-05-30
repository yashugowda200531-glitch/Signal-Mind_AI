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

  noiseFloor: number;
  occupiedBandwidth: number;
  occupancy: number;
  spectralEntropy: number;
  crestFactor: number;
  spectralRolloff: number;

  snrDb: number;
  signalPowerDb: number;
}

export function analyzeSignal(
  samples: Float32Array,
  sampleRate: number
): FFTResult {

  // =========================================
  // LIMIT FFT SIZE & PAD TO POWER OF 2
  // =========================================

  const FFT_SIZE = 2048;
  const sliced = new Float32Array(FFT_SIZE); // Default is all zeros
  if (samples.length > 0) {
    const actualLen = Math.min(samples.length, FFT_SIZE);
    sliced.set(samples.slice(0, actualLen));
  }

  // =========================================
  // HANNING WINDOW
  // =========================================

  const windowed = sliced.map((x, n) => {
    const w =
      0.5 *
      (1 - Math.cos((2 * Math.PI * n) / (FFT_SIZE - 1)));
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

  const linearSpectrum = phasors.map(([re, im]) => Math.sqrt(re * re + im * im));

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
  let linearPeak = 0;

  magnitudes.forEach((mag, i) => {
    if (mag > peakMagnitude) {
      peakMagnitude = mag;
      peakFrequency = frequencies[i];
      linearPeak = linearSpectrum[i];
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
  // CREST FACTOR
  // =========================================
  const crestFactor = rms > 0 ? (linearPeak / rms) : 0;

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
    weightedSum += frequencies[i] * linearSpectrum[i];
    magnitudeSum += linearSpectrum[i];
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
  // NOISE FLOOR & OCCUPANCY
  // =========================================
  const sortedMags = [...magnitudes].sort((a, b) => a - b);
  // Estimate noise floor using the 10th percentile bin
  const noiseFloor = sortedMags[Math.floor(sortedMags.length * 0.1)] || -100;
  
  // A bin is "occupied" if it's 3dB above noise floor
  const threshold = noiseFloor + 3;
  let occupiedBins = 0;
  magnitudes.forEach(mag => {
    if (mag > threshold) occupiedBins++;
  });
  const occupancy = occupiedBins / magnitudes.length;
  const occupiedBandwidth = occupancy * (sampleRate / 2);

  // =========================================
  // SPECTRAL ENTROPY
  // =========================================
  let spectralEntropy = 0;
  if (magnitudeSum > 0) {
    for (let i = 0; i < linearSpectrum.length; i++) {
      const p = linearSpectrum[i] / magnitudeSum;
      if (p > 0) {
        spectralEntropy -= p * Math.log2(p);
      }
    }
  }
  // Normalize by log2(N)
  spectralEntropy = spectralEntropy / Math.log2(linearSpectrum.length || 1);

  // =========================================
  // SPECTRAL ROLLOFF (85%)
  // =========================================
  let rolloffSum = 0;
  const targetSum = magnitudeSum * 0.85;
  let spectralRolloff = 0;
  for (let i = 0; i < linearSpectrum.length; i++) {
    rolloffSum += linearSpectrum[i];
    if (rolloffSum >= targetSum) {
      spectralRolloff = frequencies[i];
      break;
    }
  }

  const signalPowerDb = rms > 0 ? 20 * Math.log10(rms) : -100;
  const snrDb = peakMagnitude - noiseFloor;

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

    noiseFloor,
    occupiedBandwidth,
    occupancy,
    spectralEntropy,
    crestFactor,
    spectralRolloff,

    snrDb,
    signalPowerDb
  };
}