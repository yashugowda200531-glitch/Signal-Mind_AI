// @ts-ignore
import { fft } from "fft-js";

export interface CarrierInfo {
  id: string;
  freq: number;
  peakMag: number;
  snr: number;
  bandwidth: number;
  startIndex: number;
  endIndex: number;
}

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
  carriers: CarrierInfo[];
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

  const magnitudes = phasors.map(([re, im]: number[]) => {
    const mag = Math.sqrt(re * re + im * im);
    // dB conversion
    return 20 * Math.log10(mag + 1e-12);
  });

  const linearSpectrum = phasors.map(([re, im]: number[]) => Math.sqrt(re * re + im * im));

  // =========================================
  // FREQUENCY AXIS
  // =========================================

  const frequencies = magnitudes.map((_: number, i: number) => {
    return (i * sampleRate) / magnitudes.length;
  });

  // =========================================
  // PEAK DETECTION
  // =========================================

  let peakMagnitude = -Infinity;
  let peakFrequency = 0;
  let linearPeak = 0;

  magnitudes.forEach((mag: number, i: number) => {
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
      sliced.reduce((sum: number, x: number) => sum + x * x, 0) / sliced.length
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
        (sum: number, x: number) => sum + Math.log(x + epsilon),
        0
      ) / linearSpectrum.length
    );

  arithMean =
    linearSpectrum.reduce((a: number, b: number) => a + b, 0) /
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
  magnitudes.forEach((mag: number) => {
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
  // MULTI-CARRIER PEAK DETECTION
  // =========================================
  const carriers: CarrierInfo[] = [];
  const minPeakSnr = 10; // dB above noise floor
  const minSpacingBins = Math.max(2, Math.floor((1000 / (sampleRate / 2)) * magnitudes.length)); // ~1 kHz spacing min
  const maxCarriers = 5;

  let localPeaks: { idx: number, mag: number }[] = [];
  for (let i = 1; i < magnitudes.length - 1; i++) {
    if (magnitudes[i] > magnitudes[i - 1] && magnitudes[i] > magnitudes[i + 1]) {
      if (magnitudes[i] > noiseFloor + minPeakSnr) {
        localPeaks.push({ idx: i, mag: magnitudes[i] });
      }
    }
  }

  // Sort peaks by magnitude (descending)
  localPeaks.sort((a, b) => b.mag - a.mag);

  // Filter peaks that are too close to stronger peaks
  const validPeaks: typeof localPeaks = [];
  for (const peak of localPeaks) {
    let tooClose = false;
    for (const vp of validPeaks) {
      if (Math.abs(peak.idx - vp.idx) < minSpacingBins) {
        tooClose = true;
        break;
      }
    }
    if (!tooClose) {
      validPeaks.push(peak);
      if (validPeaks.length >= maxCarriers) break;
    }
  }

  // For each valid peak, estimate bandwidth (walk down until 6dB drop or noise floor)
  let trkIdCounter = 1;
  for (const peak of validPeaks) {
    const peakMag = peak.mag;
    const threshold = Math.max(peakMag - 15, noiseFloor + 3);
    
    let startIdx = peak.idx;
    while (startIdx > 0 && magnitudes[startIdx - 1] > threshold) {
      startIdx--;
    }
    
    let endIdx = peak.idx;
    while (endIdx < magnitudes.length - 1 && magnitudes[endIdx + 1] > threshold) {
      endIdx++;
    }

    const bwHz = frequencies[endIdx] - frequencies[startIdx];

    carriers.push({
      id: `TRK-${trkIdCounter.toString().padStart(2, '0')}`,
      freq: frequencies[peak.idx],
      peakMag,
      snr: peakMag - noiseFloor,
      bandwidth: bwHz,
      startIndex: startIdx,
      endIndex: endIdx
    });
    trkIdCounter++;
  }

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
    signalPowerDb,
    carriers
  };
}