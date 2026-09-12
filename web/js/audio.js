/**
 * Every sound in the game is synthesized with the Web Audio API - there are no
 * audio files in this project, the same way there are no textures or models.
 *
 * Underwater sound is muffled and carries oddly, so everything runs through a
 * lowpass, and distance attenuation is deliberately gentle: hearing a stalker
 * chewing metal somewhere out in the murk is part of the game.
 */
(function (SL) {
  'use strict';

  class Audio {
    constructor() {
      this.ctx = null;
      this.muted = false;
      this.ready = false;
    }

    /** Must be called from a user gesture (browsers block audio otherwise). */
    start() {
      if (this.ready) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }

      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;

      this.ctx = new Ctx();
      this.ready = true;

      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;

      // Everything is heard through water.
      this.water = this.ctx.createBiquadFilter();
      this.water.type = 'lowpass';
      this.water.frequency.value = 900;
      this.water.Q.value = 0.7;

      this.water.connect(this.master);
      this.master.connect(this.ctx.destination);

      this.buildNoiseBuffer();
      this.startAmbience();
    }

    buildNoiseBuffer() {
      const length = this.ctx.sampleRate * 2;
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }

    /** A slow, detuned drone that sits under everything. */
    startAmbience() {
      const drone = this.ctx.createGain();
      drone.gain.value = 0.10;
      drone.connect(this.water);

      for (const freq of [55, 82.5, 110.3]) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.4;
        osc.connect(gain); gain.connect(drone);
        osc.start();

        // Slow drift so the drone never sits perfectly still.
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.05 + Math.random() * 0.08;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.6;
        lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
        lfo.start();
      }

      // A wash of filtered noise: the sea itself.
      const hiss = this.ctx.createBufferSource();
      hiss.buffer = this.noiseBuffer;
      hiss.loop = true;
      const hissFilter = this.ctx.createBiquadFilter();
      hissFilter.type = 'lowpass';
      hissFilter.frequency.value = 420;
      const hissGain = this.ctx.createGain();
      hissGain.gain.value = 0.05;
      hiss.connect(hissFilter); hissFilter.connect(hissGain); hissGain.connect(this.master);
      hiss.start();

      this.ambientDrone = drone;
    }

    /** Distance attenuation, deliberately gentle. */
    gainFor(distance) {
      return SL.clamp(1 - distance / 45, 0, 1);
    }

    envelope(node, peak, attack, decay) {
      const now = this.ctx.currentTime;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + attack + decay);
      node.connect(gain);
      return { gain, stopAt: now + attack + decay + 0.05 };
    }

    tone(freq, type, peak, attack, decay, destination) {
      if (!this.ready || this.muted) return;
      const osc = this.ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      const { gain, stopAt } = this.envelope(osc, peak, attack, decay);
      gain.connect(destination || this.water);
      osc.start();
      osc.stop(stopAt);
      return osc;
    }

    noise(peak, attack, decay, filterFreq, type) {
      if (!this.ready || this.muted) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = type || 'bandpass';
      filter.frequency.value = filterFreq;
      src.connect(filter);
      const { gain, stopAt } = this.envelope(filter, peak, attack, decay);
      gain.connect(this.water);
      src.start();
      src.stop(stopAt);
      return filter;
    }

    // --- Game sounds ----------------------------------------------------------

    swing() { this.noise(0.22, 0.02, 0.18, 1400, 'bandpass'); }
    swingMiss() {}

    hit() {
      // A wet thunk: low body plus a short noise slap.
      this.tone(90, 'sine', 0.45, 0.005, 0.16);
      this.noise(0.18, 0.004, 0.09, 700);
    }

    bite(distance) {
      const g = this.gainFor(distance);
      if (g <= 0.01) return;
      this.tone(58, 'sine', 0.5 * g, 0.005, 0.28);
      this.tone(140, 'triangle', 0.2 * g, 0.005, 0.12);
      this.noise(0.16 * g, 0.004, 0.14, 500);
    }

    /** Metal being worried at: detuned partials and a scrape. */
    metalBite(distance) {
      const g = this.gainFor(distance);
      if (g <= 0.01) return;
      for (const f of [523, 784, 1170]) {
        this.tone(f * SL.randRange(0.97, 1.03), 'square', 0.05 * g, 0.004, 0.22);
      }
      this.noise(0.10 * g, 0.005, 0.20, 2600, 'highpass');
    }

    playerHurt() {
      this.tone(70, 'sawtooth', 0.35, 0.01, 0.45);
      this.noise(0.2, 0.005, 0.3, 300);
    }

    death() {
      this.tone(110, 'sine', 0.4, 0.02, 1.6);
      this.tone(55, 'sine', 0.4, 0.05, 2.2);
    }

    pickUp() { this.tone(420, 'triangle', 0.15, 0.005, 0.1); }
    throwScrap() { this.noise(0.2, 0.01, 0.25, 900); }
    click() { this.tone(900, 'square', 0.06, 0.002, 0.04); }

    /** Heartbeat that rises as the air runs out. */
    heartbeat(intensity) {
      this.tone(48, 'sine', 0.30 * intensity, 0.01, 0.22);
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.ready) this.master.gain.value = muted ? 0 : 0.55;
    }

    /** Muffles everything further as the player goes deeper. */
    setDepth(depth) {
      if (!this.ready) return;
      const target = SL.lerp(1100, 420, SL.clamp(depth / 45, 0, 1));
      this.water.frequency.value = SL.damp(this.water.frequency.value, target, 2, 0.016);
    }
  }

  SL.Audio = Audio;
})(window.SL);
