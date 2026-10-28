class BluePCM extends AudioWorkletProcessor {
  constructor() {
    super();
    this.chunk = new Float32Array(2048);
    this.at = 0;
  }

  process(inputs) {
    const samples = inputs[0]?.[0];
    if (samples) {
      for (const value of samples) {
        this.chunk[this.at++] = value;
        if (this.at === this.chunk.length) {
          this.port.postMessage(this.chunk, [this.chunk.buffer]);
          this.chunk = new Float32Array(2048);
          this.at = 0;
        }
      }
    }
    return true;
  }
}
registerProcessor('blue-pcm',BluePCM);
