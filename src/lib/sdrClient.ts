type IQCallback = (iqData: Float32Array) => void;

class SdrClient {
  private ws: WebSocket | null = null;
  private onIQData: IQCallback | null = null;
  private onStatusChange: ((connected: boolean) => void) | null = null;
  private reconnectTimer: any = null;
  private url = "ws://localhost:8001/ws/sdr";
  private isIntentionalDisconnect = false;

  public isConnected = false;

  setCallback(callback: IQCallback) {
    this.onIQData = callback;
  }

  setStatusCallback(callback: (connected: boolean) => void) {
    this.onStatusChange = callback;
  }

  connect() {
    this.isIntentionalDisconnect = false;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(this.url);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = () => {
        console.log("[SDR] Connected to hardware stream");
        this.isConnected = true;
        if (this.onStatusChange) this.onStatusChange(true);
      };

      this.ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          if (this.onIQData) {
            const floatArray = new Float32Array(event.data);
            this.onIQData(floatArray);
          }
        }
      };

      this.ws.onclose = () => {
        console.warn("[SDR] Disconnected from hardware stream");
        this.isConnected = false;
        if (this.onStatusChange) this.onStatusChange(false);
        this.ws = null;
        
        if (!this.isIntentionalDisconnect) {
          this.reconnectTimer = setTimeout(() => this.connect(), 2000);
        }
      };

      this.ws.onerror = (err) => {
        console.error("[SDR] WebSocket error", err);
      };
    } catch (e) {
      console.error("[SDR] Connection failed", e);
    }
  }

  disconnect() {
    this.isIntentionalDisconnect = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.sendCommand("stop");
      this.ws.close();
    }
  }

  sendCommand(cmd: string, value?: string | number | boolean) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, value }));
    }
  }

  startStreaming() {
    this.sendCommand("start");
  }

  stopStreaming() {
    this.sendCommand("stop");
  }

  setCenterFreq(hz: number) {
    this.sendCommand("set_freq", hz);
  }

  setSampleRate(hz: number) {
    this.sendCommand("set_sample_rate", hz);
  }

  setGain(db: number) {
    this.sendCommand("set_gain", db);
  }
}

export const sdrClient = new SdrClient();
