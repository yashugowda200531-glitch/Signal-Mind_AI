"""
SignalMind AI – Real-Time SDR Streaming Server
===============================================
WebSocket-based IQ streaming with SDR device abstraction.
Runs on port 8001 alongside the main analysis backend (8000).
"""

import asyncio
import json
import math
import struct
import time
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ─────────────────────────────────────────────────────────────────────────────
# SDR Device Abstraction Layer
# ─────────────────────────────────────────────────────────────────────────────

class SdrDevice(ABC):
    """Base class for all SDR device drivers."""

    @abstractmethod
    async def open(self) -> None: ...

    @abstractmethod
    async def close(self) -> None: ...

    @abstractmethod
    async def read_samples(self, num_samples: int) -> np.ndarray: ...

    @abstractmethod
    def set_center_freq(self, freq_hz: float) -> None: ...

    @abstractmethod
    def set_sample_rate(self, rate_hz: float) -> None: ...

    @abstractmethod
    def set_gain(self, gain_db: float) -> None: ...

    @abstractmethod
    def get_device_info(self) -> Dict[str, Any]: ...


# ─────────────────────────────────────────────────────────────────────────────
# Simulated SDR Device – Generates Realistic RF Spectrum
# ─────────────────────────────────────────────────────────────────────────────

class SimulatedSdrDevice(SdrDevice):
    """
    Produces rich, evolving IQ data that mimics a real RF environment.
    Generates carriers, FM signals, digital bursts, and thermal noise.
    """

    def __init__(self):
        self.center_freq: float = 100.0e6   # 100 MHz
        self.sample_rate: float = 2.4e6     # 2.4 MSPS
        self.gain: float = 30.0
        self.agc: bool = False
        self._phase_acc: float = 0.0
        self._time: float = 0.0
        self._frame: int = 0

        # Persistent signal definitions that drift over time
        self._carriers = [
            {"freq_offset":  0.3e6, "amplitude": 0.6,  "drift_rate": 50.0,  "phase": 0.0},
            {"freq_offset": -0.5e6, "amplitude": 0.35, "drift_rate": -30.0, "phase": 0.0},
            {"freq_offset":  0.8e6, "amplitude": 0.15, "drift_rate": 10.0,  "phase": 0.0},
        ]
        # FM broadcast-like signal
        self._fm = {
            "freq_offset": -0.2e6,
            "deviation": 75e3,       # 75 kHz FM deviation
            "mod_freq": 1000.0,      # 1 kHz audio tone
            "amplitude": 0.8,
            "phase": 0.0,
        }
        # Digital burst parameters
        self._burst_active = False
        self._burst_timer = 0.0
        self._burst_freq = 0.4e6
        self._burst_symbol_rate = 9600.0
        self._burst_phase = 0.0

    async def open(self) -> None:
        self._time = 0.0
        self._frame = 0

    async def close(self) -> None:
        pass

    def set_center_freq(self, freq_hz: float) -> None:
        self.center_freq = freq_hz

    def set_sample_rate(self, rate_hz: float) -> None:
        self.sample_rate = rate_hz

    def set_gain(self, gain_db: float) -> None:
        self.gain = gain_db

    def get_device_info(self) -> Dict[str, Any]:
        return {
            "name": "Simulated SDR",
            "type": "simulated",
            "center_freq": self.center_freq,
            "sample_rate": self.sample_rate,
            "gain": self.gain,
            "agc": self.agc,
        }

    async def read_samples(self, num_samples: int) -> np.ndarray:
        """Generate num_samples of interleaved float32 I,Q data."""
        self._frame += 1
        dt = 1.0 / self.sample_rate
        t = np.arange(num_samples, dtype=np.float64) * dt + self._time
        self._time += num_samples * dt

        gain_linear = 10.0 ** (self.gain / 20.0) * 0.01

        # 1. Thermal noise floor (Gaussian)
        noise_power = 0.02
        noise_i = np.random.normal(0, noise_power, num_samples)
        noise_q = np.random.normal(0, noise_power, num_samples)

        iq_i = noise_i.copy()
        iq_q = noise_q.copy()

        # 2. Narrowband carriers with slow drift
        for c in self._carriers:
            c["freq_offset"] += c["drift_rate"] * (num_samples * dt)
            # Clamp drift
            if abs(c["freq_offset"]) > self.sample_rate * 0.45:
                c["drift_rate"] *= -1
            # Random amplitude flutter
            amp = c["amplitude"] * (1.0 + 0.05 * math.sin(self._time * 0.7 + c["phase"]))
            phase = 2.0 * np.pi * c["freq_offset"] * t + c["phase"]
            c["phase"] += 2.0 * np.pi * c["freq_offset"] * num_samples * dt
            iq_i += amp * np.cos(phase)
            iq_q += amp * np.sin(phase)

        # 3. FM signal (wideband, modulated)
        fm = self._fm
        fm_audio = fm["amplitude"] * np.sin(2.0 * np.pi * fm["mod_freq"] * t)
        # Add harmonics for richer audio
        fm_audio += 0.3 * fm["amplitude"] * np.sin(2.0 * np.pi * fm["mod_freq"] * 2.7 * t)
        fm_inst_freq = fm["freq_offset"] + fm["deviation"] * fm_audio / fm["amplitude"]
        fm_phase = 2.0 * np.pi * np.cumsum(fm_inst_freq) * dt + fm["phase"]
        fm["phase"] = fm_phase[-1] % (2.0 * np.pi)
        iq_i += fm["amplitude"] * np.cos(fm_phase)
        iq_q += fm["amplitude"] * np.sin(fm_phase)

        # 4. Intermittent digital burst (QPSK-like)
        self._burst_timer -= num_samples * dt
        if not self._burst_active and self._burst_timer <= 0:
            # Random chance to start a burst
            if np.random.random() < 0.15:
                self._burst_active = True
                self._burst_timer = np.random.uniform(0.5, 3.0)
                self._burst_freq = np.random.uniform(-0.8e6, 0.8e6)
        elif self._burst_active and self._burst_timer <= 0:
            self._burst_active = False
            self._burst_timer = np.random.uniform(1.0, 5.0)

        if self._burst_active:
            symbols_per_sample = self._burst_symbol_rate / self.sample_rate
            sym_idx = np.floor(np.arange(num_samples) * symbols_per_sample).astype(int)
            # Generate random QPSK symbols
            np.random.seed(sym_idx[0] % 2**31)
            phases = np.array([np.pi/4, 3*np.pi/4, 5*np.pi/4, 7*np.pi/4])
            sym_phases = phases[np.random.randint(0, 4, size=max(sym_idx) + 1)]
            burst_phase = sym_phases[sym_idx % len(sym_phases)]
            carrier = 2.0 * np.pi * self._burst_freq * t
            burst_amp = 0.4
            iq_i += burst_amp * np.cos(carrier + burst_phase)
            iq_q += burst_amp * np.sin(carrier + burst_phase)

        # 5. Apply gain
        iq_i *= gain_linear
        iq_q *= gain_linear

        # 6. Interleave I,Q as float32
        iq = np.empty(num_samples * 2, dtype=np.float32)
        iq[0::2] = iq_i.astype(np.float32)
        iq[1::2] = iq_q.astype(np.float32)

        return iq


# ─────────────────────────────────────────────────────────────────────────────
# Stub Drivers for Real Hardware (graceful ImportError)
# ─────────────────────────────────────────────────────────────────────────────

class RtlSdrDevice(SdrDevice):
    async def open(self): raise NotImplementedError("RTL-SDR driver not installed. pip install pyrtlsdr")
    async def close(self): pass
    async def read_samples(self, n): return np.zeros(n*2, dtype=np.float32)
    def set_center_freq(self, f): pass
    def set_sample_rate(self, r): pass
    def set_gain(self, g): pass
    def get_device_info(self): return {"name": "RTL-SDR", "type": "rtlsdr", "available": False}

class HackRfDevice(SdrDevice):
    async def open(self): raise NotImplementedError("HackRF driver not installed.")
    async def close(self): pass
    async def read_samples(self, n): return np.zeros(n*2, dtype=np.float32)
    def set_center_freq(self, f): pass
    def set_sample_rate(self, r): pass
    def set_gain(self, g): pass
    def get_device_info(self): return {"name": "HackRF", "type": "hackrf", "available": False}

class AirspyDevice(SdrDevice):
    async def open(self): raise NotImplementedError("Airspy driver not installed.")
    async def close(self): pass
    async def read_samples(self, n): return np.zeros(n*2, dtype=np.float32)
    def set_center_freq(self, f): pass
    def set_sample_rate(self, r): pass
    def set_gain(self, g): pass
    def get_device_info(self): return {"name": "Airspy", "type": "airspy", "available": False}

class PlutoSdrDevice(SdrDevice):
    async def open(self): raise NotImplementedError("PlutoSDR driver not installed. pip install pyadi-iio")
    async def close(self): pass
    async def read_samples(self, n): return np.zeros(n*2, dtype=np.float32)
    def set_center_freq(self, f): pass
    def set_sample_rate(self, r): pass
    def set_gain(self, g): pass
    def get_device_info(self): return {"name": "PlutoSDR", "type": "plutosdr", "available": False}


# ─────────────────────────────────────────────────────────────────────────────
# SDR Manager
# ─────────────────────────────────────────────────────────────────────────────

DEVICE_REGISTRY = {
    "simulated": SimulatedSdrDevice,
    "rtlsdr":    RtlSdrDevice,
    "hackrf":    HackRfDevice,
    "airspy":    AirspyDevice,
    "plutosdr":  PlutoSdrDevice,
}

class SdrManager:
    def __init__(self):
        self.device: Optional[SdrDevice] = None
        self.connected: bool = False
        self.streaming: bool = False
        self.device_type: str = ""
        self.squelch: float = -100.0

    def list_devices(self) -> List[Dict[str, Any]]:
        return [
            {"type": "simulated", "name": "Simulated SDR", "available": True},
            {"type": "rtlsdr",    "name": "RTL-SDR",       "available": False},
            {"type": "hackrf",    "name": "HackRF One",    "available": False},
            {"type": "airspy",    "name": "Airspy",        "available": False},
            {"type": "plutosdr",  "name": "ADALM-PlutoSDR","available": False},
        ]

    async def connect(self, device_type: str = "simulated"):
        if self.connected:
            await self.disconnect()
        cls = DEVICE_REGISTRY.get(device_type)
        if not cls:
            raise ValueError(f"Unknown device type: {device_type}")
        self.device = cls()
        await self.device.open()
        self.connected = True
        self.device_type = device_type

    async def disconnect(self):
        if self.device:
            await self.device.close()
        self.device = None
        self.connected = False
        self.streaming = False
        self.device_type = ""

    def get_status(self) -> Dict[str, Any]:
        if not self.device:
            return {"connected": False, "streaming": False}
        info = self.device.get_device_info()
        return {
            "connected": self.connected,
            "streaming": self.streaming,
            "device_type": self.device_type,
            **info,
        }


# ─────────────────────────────────────────────────────────────────────────────
# FastAPI Application
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="SignalMind SDR Streaming Server", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = SdrManager()

class ConnectRequest(BaseModel):
    device_type: str = "simulated"

@app.get("/sdr/devices")
async def get_devices():
    return {"devices": manager.list_devices()}

@app.post("/sdr/connect")
async def connect_device(req: ConnectRequest):
    try:
        await manager.connect(req.device_type)
        return {"status": "connected", "device": manager.get_status()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/sdr/disconnect")
async def disconnect_device():
    await manager.disconnect()
    return {"status": "disconnected"}

@app.get("/sdr/status")
async def get_status():
    return manager.get_status()


@app.websocket("/ws/sdr")
async def websocket_sdr(ws: WebSocket):
    await ws.accept()
    IQ_FRAME_SIZE = 2048  # Number of IQ samples per frame
    TARGET_FPS = 30
    frame_interval = 1.0 / TARGET_FPS

    try:
        while True:
            # Handle incoming control messages (non-blocking)
            try:
                msg = await asyncio.wait_for(ws.receive_text(), timeout=0.001)
                data = json.loads(msg)
                cmd = data.get("cmd", "")

                if cmd == "start":
                    if not manager.connected:
                        await manager.connect("simulated")
                    manager.streaming = True
                elif cmd == "stop":
                    manager.streaming = False
                elif cmd == "set_freq" and manager.device:
                    manager.device.set_center_freq(float(data["value"]))
                elif cmd == "set_sample_rate" and manager.device:
                    manager.device.set_sample_rate(float(data["value"]))
                elif cmd == "set_gain" and manager.device:
                    manager.device.set_gain(float(data["value"]))
                elif cmd == "set_agc" and manager.device:
                    if hasattr(manager.device, 'agc'):
                        manager.device.agc = bool(data["value"])
                elif cmd == "set_squelch":
                    manager.squelch = float(data["value"])

            except asyncio.TimeoutError:
                pass
            except json.JSONDecodeError:
                pass

            # Stream IQ data if active
            if manager.streaming and manager.device:
                t0 = time.monotonic()
                iq_data = await manager.device.read_samples(IQ_FRAME_SIZE)
                await ws.send_bytes(iq_data.tobytes())
                elapsed = time.monotonic() - t0
                sleep_time = max(0, frame_interval - elapsed)
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
            else:
                await asyncio.sleep(0.05)

    except WebSocketDisconnect:
        manager.streaming = False
    except Exception:
        manager.streaming = False


# ─────────────────────────────────────────────────────────────────────────────
# Entry Point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
