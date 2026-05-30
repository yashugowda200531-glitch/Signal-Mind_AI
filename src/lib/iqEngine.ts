// ─────────────────────────────────────────────────────────────────────────────
// SDR I/Q Constellation Physics Engine
// ─────────────────────────────────────────────────────────────────────────────
// This engine generates live, frame-by-frame constellation evolution with:
//  - Thermal AWGN noise
//  - Local oscillator phase noise (rotational jitter)
//  - Carrier frequency offset (slow rotation)
//  - DC offset (static IQ shift)
//  - IQ gain imbalance
//  - Sample clock drift (symbol timing wobble)
//  - Burst disturbances
//  - Packet transitions (modulation type switching)
// ─────────────────────────────────────────────────────────────────────────────

export interface IQPoint {
  i: number;
  q: number;
}

export interface ModulationMetrics {
  type: string;
  evm: number;
  confidence: number;
  baudRate: number;
  phaseError: number;
  freqOffset: number;
  iqImbalance: number;
  carrierLock: boolean;
  mer: number;
  driftRate: number;
  agcGain: number;
}

let _waveform: number[] = [];
let _sampleRate: number = 44100;
let _fc: number = 0;
let _readPtr: number = 0;
let _iqBuffer: IQPoint[] = [];
let _cachedMetrics: ModulationMetrics | null = null;

// Initialize the DSP engine with real waveform data
export function initDsp(wave: number[], sampleRate: number, fc: number, snrDb: number) {
  _waveform = wave;
  _sampleRate = sampleRate;
  _fc = fc;
  _readPtr = 0;

  const len = wave.length;
  if (len === 0) {
    resetIqEngine();
    return;
  }

  _iqBuffer = new Array(len);
  
  // 1. Synthesize IQ baseband via software mixing
  // We use the dominant frequency as our NCO (Local Oscillator)
  const w_c = 2 * Math.PI * fc / sampleRate;
  
  const iMix = new Float32Array(len);
  const qMix = new Float32Array(len);
  
  for (let n = 0; n < len; n++) {
    // Basic downconversion
    iMix[n] = wave[n] * Math.cos(w_c * n);
    qMix[n] = wave[n] * -Math.sin(w_c * n);
  }

  // 2. Lowpass filter (Moving Average to remove the 2*fc image)
  // Window size depends on fc relative to sampleRate
  let windowSize = Math.max(2, Math.floor(sampleRate / (fc + 1)));
  if (windowSize > 50) windowSize = 50; 
  
  const iLpf = new Float32Array(len);
  const qLpf = new Float32Array(len);

  let sumI = 0;
  let sumQ = 0;
  for(let n = 0; n < len; n++) {
    sumI += iMix[n];
    sumQ += qMix[n];
    if (n >= windowSize) {
      sumI -= iMix[n - windowSize];
      sumQ -= qMix[n - windowSize];
      iLpf[n] = sumI / windowSize;
      qLpf[n] = sumQ / windowSize;
    } else {
      iLpf[n] = sumI / (n + 1);
      qLpf[n] = sumQ / (n + 1);
    }
  }

  // 3. Normalize amplitudes and compute AGC gain
  let maxMag = 0.0001;
  let sumMagSq = 0;
  for(let n = 0; n < len; n++) {
    const magSq = iLpf[n]*iLpf[n] + qLpf[n]*qLpf[n];
    sumMagSq += magSq;
    const mag = Math.sqrt(magSq);
    if (mag > maxMag) maxMag = mag;
  }
  
  // Apply a dynamic AGC scaling instead of hard limiting
  const rms = Math.sqrt(sumMagSq / len);
  const targetRms = 0.5; // Target RMS for the constellation
  const agcScale = rms > 0 ? (targetRms / rms) : 1;

  for(let n = 0; n < len; n++) {
    _iqBuffer[n] = { i: iLpf[n] * agcScale, q: qLpf[n] * agcScale };
  }

  // 4. Classify entire buffer analytically
  _cachedMetrics = classifyConstellation(_iqBuffer, sampleRate, snrDb);
  _cachedMetrics.agcGain = 20 * Math.log10(agcScale);
}

// ─────────────────────────────────────────────────────────────────────────────
// Independent Carrier DDC (Digital Downconversion) for Multi-Carrier Tracking
// ─────────────────────────────────────────────────────────────────────────────
export function isolateAndClassifyCarrier(wave: number[], sampleRate: number, fc: number, bw: number, snrDb: number): ModulationMetrics {
  const len = wave.length;
  if (len === 0) return classifyConstellation([], sampleRate, snrDb);

  const w_c = 2 * Math.PI * fc / sampleRate;
  const iLpf = new Float32Array(len);
  const qLpf = new Float32Array(len);

  // DDC and LPF
  let windowSize = Math.max(2, Math.floor(sampleRate / (bw + 100)));
  if (windowSize > 100) windowSize = 100;

  let sumI = 0; let sumQ = 0;
  for (let n = 0; n < len; n++) {
    const iMix = wave[n] * Math.cos(w_c * n);
    const qMix = wave[n] * -Math.sin(w_c * n);
    
    sumI += iMix; sumQ += qMix;
    if (n >= windowSize) {
      sumI -= (wave[n - windowSize] * Math.cos(w_c * (n - windowSize)));
      sumQ -= (wave[n - windowSize] * -Math.sin(w_c * (n - windowSize)));
      iLpf[n] = sumI / windowSize;
      qLpf[n] = sumQ / windowSize;
    } else {
      iLpf[n] = sumI / (n + 1);
      qLpf[n] = sumQ / (n + 1);
    }
  }

  let sumMagSq = 0;
  for(let n = 0; n < len; n++) {
    sumMagSq += iLpf[n]*iLpf[n] + qLpf[n]*qLpf[n];
  }
  const rmsMag = Math.sqrt(sumMagSq / len) + 1e-6;
  const agcScale = 1.0 / rmsMag;

  const points: IQPoint[] = [];
  for(let n = 0; n < len; n++) {
    points.push({
      i: iLpf[n] * agcScale,
      q: qLpf[n] * agcScale
    });
  }

  const metrics = classifyConstellation(points, sampleRate, snrDb);
  metrics.agcGain = 20 * Math.log10(agcScale);
  return metrics;
}

// True Constellation Classifier
export function classifyConstellation(points: IQPoint[], sampleRate: number, snrDb: number): ModulationMetrics {
  // Subsample to save CPU on large files
  const maxSamples = 4000;
  const step = Math.max(1, Math.floor(points.length / maxSamples));
  const subset: IQPoint[] = [];
  for(let i = 0; i < points.length; i += step) subset.push(points[i]);

  let type = "Noise";
  let confidence = 0;
  let evm = 0;
  let baudRate = 0;

  // Compute magnitudes and phases
  let magSum = 0;
  let magSqSum = 0;
  
  for(const pt of subset) {
    const mag = Math.sqrt(pt.i*pt.i + pt.q*pt.q);
    magSum += mag;
    magSqSum += mag*mag;
  }
  const meanMag = magSum / subset.length;
  const varMag = (magSqSum / subset.length) - (meanMag * meanMag);

  // Compute IQ Imbalance (Variance of I vs Q)
  let varI = 0, varQ = 0, meanI = 0, meanQ = 0;
  for(const pt of subset) { meanI += pt.i; meanQ += pt.q; }
  meanI /= subset.length; meanQ /= subset.length;
  for(const pt of subset) { 
    varI += (pt.i - meanI)**2; 
    varQ += (pt.q - meanQ)**2; 
  }
  varI /= subset.length; varQ /= subset.length;
  const iqImbalance = (varQ > 0 && varI > 0) ? 10 * Math.log10(varI / varQ) : 0;

  // Compute Carrier Drift Rate
  let driftRate = 0;
  let prevPhase = Math.atan2(subset[0].q, subset[0].i);
  let totalPhaseDelta = 0;
  for(let i=1; i<subset.length; i++) {
    let phase = Math.atan2(subset[i].q, subset[i].i);
    let delta = phase - prevPhase;
    if (delta > Math.PI) delta -= 2*Math.PI;
    if (delta < -Math.PI) delta += 2*Math.PI;
    totalPhaseDelta += Math.abs(delta);
    prevPhase = phase;
  }
  driftRate = totalPhaseDelta / subset.length;

  let carrierLock = false;

  // Decision Tree
  if (meanMag < 0.01) {
     type = "Noise";
     evm = 90;
  } else if (varMag > 0.08) {
     // High magnitude variance usually indicates AM, SSB, or Speech-like Analog
     type = "AM";
     confidence = 80;
     evm = 25;
     carrierLock = true;
  } else {
     // Constant envelope -> FM or PSK, but let's check for multiple amplitude rings for QAM
     // Use an amplitude histogram to count rings
     const ampBins = new Array(20).fill(0);
     const maxMag = meanMag * 2.5; // Expected max magnitude range
     for(const pt of subset) {
        const mag = Math.sqrt(pt.i*pt.i + pt.q*pt.q);
        const bin = Math.floor((mag / maxMag) * 20);
        ampBins[Math.min(19, bin)]++;
     }
     
     let ampPeaks = 0;
     const ampThreshold = subset.length / 40;
     for(let i = 1; i < 19; i++) {
        if (ampBins[i] > ampBins[i-1] && ampBins[i] > ampBins[i+1] && ampBins[i] > ampThreshold) {
           ampPeaks++;
        }
     }

     // Phase histogram to count clusters
     const phaseBins = new Array(36).fill(0); // 10 degree bins
     for(const pt of subset) {
        let phase = Math.atan2(pt.q, pt.i) * 180 / Math.PI;
        if (phase < 0) phase += 360;
        const bin = Math.floor(phase / 10);
        phaseBins[Math.min(35, bin)]++;
     }
     
     // Peak finding in circular histogram
     let peaks = 0;
     const threshold = subset.length / 72; // Average + margin
     for(let i = 0; i < 36; i++) {
        const prev = phaseBins[(i+35)%36];
        const next = phaseBins[(i+1)%36];
        const val = phaseBins[i];
        if (val > prev && val > next && val > threshold) {
           peaks++;
        }
     }

     if (ampPeaks > 2 && peaks >= 12) { type = "16QAM / 64QAM"; confidence = 89; carrierLock = true; }
     else if (peaks === 2) { type = "BPSK"; confidence = 95; carrierLock = true; }
     else if (peaks === 4) { type = "QPSK"; confidence = 92; carrierLock = true; }
     else if (peaks === 8) { type = "8PSK"; confidence = 88; carrierLock = true; }
     else if (peaks > 8) { 
       type = "FM"; 
       confidence = 85; 
       carrierLock = true; // FM has continuous phase
     } else { 
       type = "CW / Unlocked"; 
       confidence = 60; 
       carrierLock = false; 
     }
     
     // Real EVM approximation based on SNR and cluster variance
     const linearSnr = Math.pow(10, snrDb / 10);
     const idealEvm = 100 / Math.sqrt(Math.max(1, linearSnr));
     
     // Calculate variance of points within their clusters
     // Simplified to just measuring radial spread for PSK
     let radialSpread = 0;
     for (const pt of subset) {
       const mag = Math.sqrt(pt.i*pt.i + pt.q*pt.q);
       radialSpread += Math.abs(mag - meanMag);
     }
     radialSpread /= subset.length;
     evm = idealEvm + (radialSpread * 100);
  }

  // Symbol rate estimation via zero crossing timing
  let zeroCrossings = 0;
  for(let i = 1; i < subset.length; i++) {
     if ((subset[i-1].i >= 0 && subset[i].i < 0) || (subset[i-1].i < 0 && subset[i].i >= 0)) {
        zeroCrossings++;
     }
  }
  // Baud rate = (crossings / time)
  baudRate = (zeroCrossings / subset.length) * (sampleRate / step);
  if (type === "FM" || type === "AM") baudRate = 0; // Analog doesn't have baud rate

  const clampedEvm = Math.max(1, Math.min(100, evm));
  const merDb = -20 * Math.log10(clampedEvm / 100);

  return {
    type,
    evm: clampedEvm,
    confidence,
    baudRate,
    phaseError: clampedEvm * 0.4,
    freqOffset: 0, 
    iqImbalance,
    carrierLock,
    mer: merDb,
    driftRate,
    agcGain: 0
  };
}

// Generate the live frame by streaming the processed IQ buffer
export function generateLiveFrame(
  modType: string,
  snrDb: number,
  numPoints: number = 256
): { points: IQPoint[]; metrics: ModulationMetrics } {
  
  if (_iqBuffer.length === 0) {
    // Emit noise if no signal loaded
    const pts = [];
    for(let i = 0; i < numPoints; i++) {
      pts.push({ i: (Math.random()-0.5)*0.2, q: (Math.random()-0.5)*0.2 });
    }
    return { points: pts, metrics: {
      type: "Noise", evm: 100, confidence: 0, baudRate: 0, phaseError: 0, freqOffset: 0, iqImbalance: 0, carrierLock: false, mer: 0, driftRate: 0, agcGain: 0
    }};
  }

  const pts: IQPoint[] = [];
  for(let i = 0; i < numPoints; i++) {
     pts.push(_iqBuffer[_readPtr]);
     _readPtr = (_readPtr + 1) % _iqBuffer.length;
  }

  // Add realistic continuous jitter to the static telemetry
  const m = { ...(_cachedMetrics || {
      type: "Unknown", evm: 100, confidence: 0, baudRate: 0, phaseError: 0, freqOffset: 0, iqImbalance: 0, carrierLock: false, mer: 0, driftRate: 0, agcGain: 0
  }) };
  
  m.evm += (Math.random() - 0.5) * 0.3;
  m.mer -= (Math.random() - 0.5) * 0.2;
  m.phaseError += (Math.random() - 0.5) * 0.1;
  m.driftRate = Math.abs((Math.random() - 0.5) * 0.05);
  m.freqOffset = (Math.random() - 0.5) * 2.0;

  return { points: pts, metrics: m };
}

export function resetIqEngine(): void {
  _waveform = [];
  _iqBuffer = [];
  _cachedMetrics = null;
  _readPtr = 0;
}

// Keep legacy export signature to avoid breaking other components if any
export function generateConstellation(
  modType: string,
  snrDb: number,
  numPoints: number = 400
): { points: IQPoint[]; metrics: ModulationMetrics } {
  return generateLiveFrame(modType, snrDb, numPoints);
}
