export interface RfSpike {
  binNormalized: number;
  widthNormalized: number;
  powerDb: number;
  startTime: number;
  durationMs: number;
}

const activeSpikes: RfSpike[] = [];

// Generates and manages short-lived transient RF events (interference, carrier fading, bursts).
// Because it uses the shared global performance clock, any component that queries it will 
// receive perfectly synchronized physical artifacts without needing React state updates.
export function getRfSpikes(time: number, totalBins: number): Float32Array {
  // 1. Stochastic chance to spawn a new interference burst or carrier pop
  // About 5% per frame at 60fps = 3 spikes per second
  if (Math.random() < 0.05) {
     activeSpikes.push({
       binNormalized: Math.random(),
       widthNormalized: (Math.random() * 0.01) + 0.002, // very narrow to slightly wide
       powerDb: Math.random() * 30 + 15, // 15 to 45 dB spike
       startTime: time,
       durationMs: Math.random() * 400 + 100 // 100ms to 500ms duration
     });
  }

  const spikeArray = new Float32Array(totalBins);
  
  // 2. Process active spikes & apply temporal envelopes
  for (let i = activeSpikes.length - 1; i >= 0; i--) {
     const spike = activeSpikes[i];
     const elapsed = time - spike.startTime;
     
     if (elapsed > spike.durationMs) {
        activeSpikes.splice(i, 1);
        continue;
     }
     
     // Hardware-style temporal envelope (fast attack, cosine decay)
     const env = Math.cos((elapsed / spike.durationMs) * (Math.PI / 2));
     const currentPower = spike.powerDb * env;
     
     const centerBin = Math.round(spike.binNormalized * (totalBins - 1));
     const widthBins = Math.max(1, Math.round(spike.widthNormalized * totalBins));
     
     for(let w = -widthBins; w <= widthBins; w++) {
        const bin = centerBin + w;
        if (bin >= 0 && bin < totalBins) {
           spikeArray[bin] += currentPower / (Math.abs(w) + 1);
        }
     }
  }
  
  return spikeArray;
}
