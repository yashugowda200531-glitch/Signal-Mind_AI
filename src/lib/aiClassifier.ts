import { FFTResult } from "./dsp";
import { ModulationMetrics } from "./iqEngine";

export interface ThreatAssessment {
  severity: "SAFE" | "LOW" | "ELEVATED" | "HIGH" | "CRITICAL";
  confidence: number;
  type: string;
  affectedBandwidth: number; // Hz
  sourceEstimate: string;
}

export interface AIAnalysisResult {
  modulationType: string;
  confidenceScore: number;
  signalPurity: number;
  anomalyLevel: number;
  signalCategory: string;
  analysisText: string;
  threatAssessment: ThreatAssessment;
}

/**
 * AI Signal Classification Engine
 * Fuses DSP FFT metrics and IQ Baseband metrics into high-level intelligence.
 */
export function generateSignalIntelligence(
  fft: FFTResult,
  iq: ModulationMetrics,
  durationMs: number = 1000 // default 1s for streaming context
): AIAnalysisResult {
  
  let modulationType = iq.type;
  let confidenceScore = iq.confidence;
  let signalCategory = "Unknown";
  let anomalyLevel = 0;
  
  // 1. Refine Modulation & Category via FFT + IQ Fusion
  
  // High spectral entropy means it's very noise-like or very wideband
  const isNoisy = fft.snrDb < 10 || fft.spectralEntropy > 0.85;
  
  if (modulationType === "Noise" || isNoisy && iq.evm > 70) {
    modulationType = "Thermal Noise";
    signalCategory = "Wideband Noise";
    confidenceScore = Math.max(confidenceScore, 90);
  } 
  else if (modulationType === "AM") {
    // Distinguish between pure AM (carrier + tone) and Speech (chaotic)
    // Speech has high crest factor and high zero crossing rate variance, but we'll use entropy and flatness
    if (fft.spectralEntropy > 0.6 && fft.crestFactor > 3.0) {
      modulationType = "Analog Speech (AM)";
      signalCategory = "Voice Communications";
    } else {
      modulationType = "AM Broadcast / Tone";
      signalCategory = "Analog Transmission";
    }
  } 
  else if (modulationType === "FM") {
    if (fft.occupiedBandwidth > 150000) {
      modulationType = "Wideband FM";
      signalCategory = "Broadcast Radio";
    } else {
      modulationType = "Narrowband FM";
      signalCategory = "Voice/Telemetry";
    }
  }
  else if (modulationType.includes("PSK") || modulationType.includes("QAM")) {
    signalCategory = "Digital Data";
    
    // Telemetry vs Burst
    // If we have high drift and low bandwidth, might be telemetry
    if (fft.occupiedBandwidth < 50000 && iq.baudRate < 10000) {
       signalCategory = "Telemetry / SCADA";
    }
    
    // If duration is short, call it a burst (in live mode, we'd look at temporal envelope, but here we estimate)
    // We will just use the name from IQ engine, maybe append burst if needed
  }
  else if (modulationType === "CW / Unlocked") {
    modulationType = "Unmodulated Carrier (CW)";
    signalCategory = "Beacon / Radar";
  }

  // 2. Compute Signal Purity (0-100)
  // Purity is inversely proportional to EVM, combined with SNR
  // High EVM -> Low Purity. Low SNR -> Low Purity.
  let purity = 100 - (iq.evm * 0.8);
  if (fft.snrDb < 20) {
    purity -= (20 - fft.snrDb) * 2; // Penalty for low SNR
  }
  const signalPurity = Math.max(0, Math.min(100, purity));

  // 3. Compute Anomaly Level (0-100)
  // Anomalies: High IQ Imbalance, High Drift, Unexpected EVM
  let anomaly = 0;
  if (Math.abs(iq.iqImbalance) > 3) anomaly += 30; // Significant imbalance
  if (Math.abs(iq.driftRate) > 0.2) anomaly += 40; // High drift
  if (signalCategory === "Digital Data" && iq.evm > 30) anomaly += 20; // Poor digital quality
  if (fft.spectralFlatness > 0.5 && !isNoisy) anomaly += 20; // Unusual flatness for non-noise
  const anomalyLevelClamped = Math.max(0, Math.min(100, anomaly));

  // 4. Natural Language Generation (AI Assistant Text)
  let text = "";
  
  if (modulationType === "Thermal Noise") {
    text = `Detected ambient RF noise floor. Signal-to-Noise ratio is very low (${fft.snrDb.toFixed(1)} dB). No coherent modulation structures found in baseband.`;
  } else {
    text = `Detected ${modulationType} signal classified as ${signalCategory}. `;
    
    if (signalCategory === "Digital Data" || signalCategory === "Telemetry / SCADA") {
      text += `Estimated symbol rate: ${(iq.baudRate / 1000).toFixed(1)} kBd. `;
      if (iq.carrierLock) {
        text += "Carrier lock is stable. ";
      } else {
        text += "Carrier lock is unstable or drifting. ";
      }
    }

    if (fft.snrDb > 30) {
      text += `Signal is exceptionally strong (${fft.snrDb.toFixed(1)} dB SNR) with a clear spectral peak at ${(fft.peakFrequency / 1000).toFixed(1)} kHz. `;
    } else if (fft.snrDb < 15) {
      text += `Signal is weak and near the noise floor. `;
    }

    if (anomalyLevelClamped > 50) {
      text += "CRITICAL ANOMALIES DETECTED: ";
      if (Math.abs(iq.driftRate) > 0.2) text += "Severe carrier drift observed. ";
      if (Math.abs(iq.iqImbalance) > 3) text += "Significant I/Q gain imbalance present. ";
      if (iq.evm > 40 && signalCategory === "Digital Data") text += "Error Vector Magnitude (EVM) is unacceptably high, indicating severe multipath or distortion. ";
    } else if (anomalyLevelClamped > 20) {
      text += "Minor signal degradation noted. ";
      if (Math.abs(iq.iqImbalance) > 1.5) text += "Slight I/Q imbalance. ";
    } else {
      if (signalCategory !== "Wideband Noise") {
         text += "Signal geometry and spectral footprint are nominal. ";
      }
    }
  }

  // 5. Threat Assessment Engine
  const threat: ThreatAssessment = {
    severity: "SAFE",
    confidence: 0,
    type: "None",
    affectedBandwidth: fft.occupiedBandwidth,
    sourceEstimate: "Unknown"
  };

  if (signalCategory === "Telemetry / SCADA" && fft.snrDb > 25) {
     threat.severity = "ELEVATED";
     threat.confidence = 85;
     threat.type = "Covert Data Exfiltration";
     threat.sourceEstimate = "Unregistered IoT / Rogue Transmitter";
  } else if (Math.abs(iq.iqImbalance) > 3 && fft.snrDb > 35) {
     threat.severity = "HIGH";
     threat.confidence = 92;
     threat.type = "Rogue Spoofing Carrier";
     threat.sourceEstimate = "Hardware Malfunction / Malicious SDR";
  } else if (fft.occupancy && fft.occupancy > 0.6 && fft.noiseFloor > -60) {
     threat.severity = "CRITICAL";
     threat.confidence = 98;
     threat.type = "Broadband Jamming";
     threat.sourceEstimate = "High-Power Electronic Warfare";
  } else if (Math.abs(iq.driftRate) > 0.4) {
     threat.severity = "LOW";
     threat.confidence = 70;
     threat.type = "Unstable Carrier";
     threat.sourceEstimate = "Thermally Unstable Oscillator";
  } else {
     threat.confidence = 100;
  }

  return {
    modulationType,
    confidenceScore: Math.max(0, Math.min(100, confidenceScore)),
    signalPurity,
    anomalyLevel: anomalyLevelClamped,
    signalCategory,
    analysisText: text.trim(),
    threatAssessment: threat
  };
}
