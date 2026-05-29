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

// ─── Modulation Symbol Maps ──────────────────────────────────────────────────

const MOD_PROFILES: Record<string, (rng: () => number) => { i: number; q: number }> = {
  "BPSK": (rng) => {
    const bit = rng() > 0.5 ? 1 : -1;
    return { i: bit, q: 0 };
  },
  "QPSK": (rng) => {
    const iBit = rng() > 0.5 ? 0.707 : -0.707;
    const qBit = rng() > 0.5 ? 0.707 : -0.707;
    return { i: iBit, q: qBit };
  },
  "8PSK": (rng) => {
    const idx = Math.floor(rng() * 8);
    const angle = (idx * Math.PI) / 4;
    return { i: Math.cos(angle), q: Math.sin(angle) };
  },
  "16-QAM": (rng) => {
    const vals = [-0.948, -0.316, 0.316, 0.948];
    return { i: vals[Math.floor(rng() * 4)], q: vals[Math.floor(rng() * 4)] };
  },
  "64-QAM": (rng) => {
    const vals = [-1.0, -0.714, -0.428, -0.142, 0.142, 0.428, 0.714, 1.0];
    return { i: vals[Math.floor(rng() * 8)], q: vals[Math.floor(rng() * 8)] };
  },
  "FM": (rng) => {
    const phase = rng() * 2 * Math.PI;
    return { i: Math.cos(phase), q: Math.sin(phase) };
  },
  "AM": (rng) => {
    const amp = rng() * 0.8 + 0.2;
    return { i: amp, q: 0 };
  },
  "ASK": (rng) => {
    const level = Math.floor(rng() * 4);
    return { i: level * 0.333, q: 0 };
  },
  "FSK": (rng) => {
    const freq = rng() > 0.5 ? 1 : -1;
    const t = rng() * Math.PI * 2;
    return { i: Math.cos(t * freq * 0.3), q: Math.sin(t * freq * 0.3) };
  },
  "OFDM": (rng) => {
    // OFDM subcarriers produce a cloud-like dense scatter
    const angle = rng() * 2 * Math.PI;
    const radius = 0.3 + rng() * 0.7;
    return { i: radius * Math.cos(angle), q: radius * Math.sin(angle) };
  },
};

// ─── Persistent Engine State ─────────────────────────────────────────────────
// This state accumulates across frames to create temporal evolution.

let _carrierPhase = 0;           // Slow drifting carrier rotation
let _freqOffsetHz = 0;           // Current frequency offset
let _dcOffsetI = 0;              // DC bias on I channel
let _dcOffsetQ = 0;              // DC bias on Q channel
let _iqGainImbalance = 1.0;      // I/Q gain ratio (1.0 = perfect)
let _clockDrift = 0;             // Sample clock drift accumulator
let _agcGain = 0;                // Current AGC gain in dB
let _burstActive = false;        // Whether a burst disturbance is active
let _burstTimer = 0;
let _frameCount = 0;
let _lastModType = "";

// Box-Muller transform for Gaussian random numbers
function _gaussRng(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Primary Frame Generator ─────────────────────────────────────────────────
// Called EVERY animation frame to produce a new set of evolving IQ symbols.

export function generateLiveFrame(
  modType: string,
  snrDb: number,
  numPoints: number = 256
): { points: IQPoint[]; metrics: ModulationMetrics } {
  _frameCount++;

  // ── Resolve modulation profile ──
  const profileKey = Object.keys(MOD_PROFILES).find(
    (k) => k.toLowerCase() === modType.toLowerCase() ||
           modType.toUpperCase().includes(k)
  ) || "QPSK";

  const getSymbol = MOD_PROFILES[profileKey] || MOD_PROFILES["QPSK"];

  // ── Detect modulation change (packet transition) ──
  if (_lastModType !== profileKey) {
    _lastModType = profileKey;
    // Simulate brief lock loss during transition
    _burstActive = true;
    _burstTimer = 20; // 20 frames of disturbance
  }

  // ── Evolve carrier frequency offset (slow random walk) ──
  _freqOffsetHz += _gaussRng() * 0.15;
  _freqOffsetHz *= 0.997; // Slow mean-reversion
  if (Math.abs(_freqOffsetHz) > 35) _freqOffsetHz *= 0.9;

  // ── Evolve carrier phase from freq offset (integral relationship) ──
  _carrierPhase += _freqOffsetHz * 0.00005;

  // ── Evolve DC offset (thermal drift) ──
  _dcOffsetI += _gaussRng() * 0.001;
  _dcOffsetQ += _gaussRng() * 0.001;
  _dcOffsetI *= 0.999;
  _dcOffsetQ *= 0.999;

  // ── Evolve IQ imbalance (very slow oscillation) ──
  _iqGainImbalance = 1.0 + Math.sin(_frameCount * 0.002) * 0.025 + _gaussRng() * 0.003;

  // ── Sample clock drift ──
  _clockDrift += _gaussRng() * 0.001;
  _clockDrift *= 0.99;

  // ── AGC: track signal power and adapt ──
  const linearSnr = Math.pow(10, snrDb / 10);
  _agcGain += _gaussRng() * 0.08;
  _agcGain *= 0.98;

  // ── Burst management ──
  if (_burstActive) {
    _burstTimer--;
    if (_burstTimer <= 0) _burstActive = false;
  }
  // Random burst chance (~0.5% per frame = every ~3 seconds at 60fps)
  if (!_burstActive && Math.random() < 0.005) {
    _burstActive = true;
    _burstTimer = Math.floor(Math.random() * 15) + 5;
  }

  // ── Noise parameters from SNR ──
  const noiseSigma = Math.sqrt(1 / (2 * Math.max(linearSnr, 0.1)));
  const phaseNoiseSigma = Math.max(0.005, 0.15 / Math.sqrt(Math.max(linearSnr, 0.1)));

  // ── Generate symbols ──
  const points: IQPoint[] = [];
  let evmAccum = 0;
  let phaseErrAccum = 0;

  for (let p = 0; p < numPoints; p++) {
    const ideal = getSymbol(Math.random);

    // 1. Apply thermal AWGN
    let iRaw = ideal.i + _gaussRng() * noiseSigma;
    let qRaw = ideal.q + _gaussRng() * noiseSigma;

    // 2. Apply IQ gain imbalance
    iRaw *= _iqGainImbalance;

    // 3. Apply DC offset
    iRaw += _dcOffsetI;
    qRaw += _dcOffsetQ;

    // 4. Apply carrier phase rotation (freq offset + phase noise)
    const mag = Math.sqrt(iRaw * iRaw + qRaw * qRaw);
    const phase = Math.atan2(qRaw, iRaw);
    const phaseNoise = _gaussRng() * phaseNoiseSigma;
    const rotatedPhase = phase + _carrierPhase + phaseNoise;

    // 5. Apply symbol timing jitter
    const timingJitter = 1.0 + _clockDrift + _gaussRng() * 0.01;

    // 6. Apply burst disturbance
    let burstNoise = 0;
    if (_burstActive) {
      burstNoise = _gaussRng() * 0.15;
    }

    // 7. Apply AGC scaling
    const agcScale = Math.pow(10, _agcGain / 20);

    const finalI = mag * timingJitter * agcScale * Math.cos(rotatedPhase) + burstNoise;
    const finalQ = mag * timingJitter * agcScale * Math.sin(rotatedPhase) + burstNoise;

    points.push({ i: finalI, q: finalQ });

    // ── EVM calculation ──
    const errI = finalI - ideal.i;
    const errQ = finalQ - ideal.q;
    evmAccum += Math.sqrt(errI * errI + errQ * errQ);
    phaseErrAccum += Math.abs(phaseNoise);
  }

  // ── Physically correlated metrics ──
  const avgEvm = (evmAccum / numPoints) * 100;
  const avgPhaseErr = (phaseErrAccum / numPoints) * (180 / Math.PI);
  const isAnalog = profileKey === "FM" || profileKey === "AM";
  const clampedEvm = Math.min(100, Math.max(0.5, avgEvm));

  // MER is the proper logarithmic inverse of EVM: MER = -20*log10(EVM/100)
  const merDb = clampedEvm > 0 ? -20 * Math.log10(clampedEvm / 100) : 40;

  const metrics: ModulationMetrics = {
    type: profileKey,
    evm: clampedEvm + _gaussRng() * 0.15,
    confidence: Math.max(0, Math.min(100, 100 - clampedEvm * 0.8 + _gaussRng() * 0.2)),
    baudRate: isAnalog ? 0 : 4800 + Math.sin(_frameCount * 0.008) * 30 + _gaussRng() * 5,
    phaseError: avgPhaseErr + _gaussRng() * 0.05,
    freqOffset: _freqOffsetHz + _gaussRng() * 0.2,
    iqImbalance: 20 * Math.log10(_iqGainImbalance),
    carrierLock: !_burstActive && Math.abs(_freqOffsetHz) < 25,
    mer: merDb + _gaussRng() * 0.2,
    driftRate: Math.abs(_freqOffsetHz * 0.03) + Math.abs(_gaussRng() * 0.005),
    agcGain: _agcGain,
  };

  return { points, metrics };
}

// ─── Legacy static generator (kept for backward compatibility) ───────────────
export function generateConstellation(
  modType: string,
  snrDb: number,
  numPoints: number = 400
): { points: IQPoint[]; metrics: ModulationMetrics } {
  return generateLiveFrame(modType, snrDb, numPoints);
}

// ─── Reset engine state (for new signal uploads) ─────────────────────────────
export function resetIqEngine(): void {
  _carrierPhase = 0;
  _freqOffsetHz = 0;
  _dcOffsetI = 0;
  _dcOffsetQ = 0;
  _iqGainImbalance = 1.0;
  _clockDrift = 0;
  _agcGain = 0;
  _burstActive = false;
  _burstTimer = 0;
  _frameCount = 0;
  _lastModType = "";
}
