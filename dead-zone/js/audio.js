/* DEAD ZONE — tiny synthesized sound engine (no external assets) */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.noiseBuf = null;
    this.lastZombie = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.ctx.destination);
      this.noiseBuf = this.makeNoise();
    } catch (e) { this.ctx = null; }
  }

  makeNoise() {
    const len = this.ctx.sampleRate * 0.5;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setEnabled(v) { this.enabled = v; if (this.master) this.master.gain.value = v ? 0.24 : 0; }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  noise(dur, vol, freq, type = 'lowpass') {
    if (!this.ctx || !this.enabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type; filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    src.connect(filter); filter.connect(gain); gain.connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + dur);
  }

  tone(freq, dur, vol, type = 'square', slide = 0) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), this.ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  shoot(kind = 'gun') {
    this.init();
    if (!this.enabled) return;
    if (kind === 'shotgun') { this.noise(0.22, 0.65, 1200); this.tone(65, 0.2, 0.28, 'sawtooth', -35); }
    else if (kind === 'rifle') { this.noise(0.14, 0.55, 1700); this.tone(90, 0.16, 0.2, 'square', -50); }
    else { this.noise(0.09, 0.42, 2200); this.tone(120, 0.08, 0.15, 'square', -50); }
  }
  melee() { this.init(); this.noise(0.07, 0.16, 900, 'bandpass'); }
  hit() { this.init(); this.noise(0.1, 0.25, 420); this.tone(70, 0.1, 0.1, 'sine', -20); }
  zombie() {
    this.init();
    if (!this.ctx || !this.enabled) return;
    if (this.now() - this.lastZombie < 1.2) return;
    this.lastZombie = this.now();
    this.tone(58 + Math.random() * 22, 0.6, 0.05, 'sawtooth', -20);
  }
  hurt() { this.init(); this.tone(140, 0.18, 0.11, 'sawtooth', -80); this.noise(0.12, 0.2, 500); }
  pickup() { this.init(); this.tone(620, 0.05, 0.08, 'square'); setTimeout(() => this.tone(880, 0.06, 0.06, 'square'), 45); }
  reload() { this.init(); this.tone(190, 0.04, 0.1, 'square'); setTimeout(() => this.tone(150, 0.05, 0.08, 'square'), 120); }
  craft() { this.init(); this.tone(240, 0.06, 0.08, 'square'); setTimeout(() => this.tone(360, 0.07, 0.08, 'square'), 80); setTimeout(() => this.tone(520, 0.1, 0.07, 'square'), 160); }
  build() { this.init(); this.noise(0.18, 0.25, 300); this.tone(110, 0.2, 0.12, 'square', 40); }
  extract() { this.init(); [440, 554, 659, 880].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 0.08, 'square'), i * 130)); }
  alarm() { this.init(); this.tone(330, 0.18, 0.1, 'sawtooth', 220); }
  ui() { this.init(); this.tone(480, 0.025, 0.04, 'square'); }
}

export const audio = new AudioEngine();
