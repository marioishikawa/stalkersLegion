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

    /**
     * Must be called from a user gesture (browsers block audio otherwise), and
     * is safe to call as often as you like afterwards.
     *
     * A browser can suspend an audio context whenever it feels like it - the
     * tab going to the background is the usual one, an iframe that has not
     * been clicked in is the other - and nothing tells the page it happened.
     * The game just goes quiet and stays quiet. So this is idempotent and
     * cheap on purpose: anything that could plausibly be a gesture calls it,
     * and a context that has been put to sleep wakes back up at the first
     * click or keypress rather than staying dead for the rest of the session.
     */
    start() {
      if (this.ready) { if (this.ctx.state !== 'running') this.resume(); return; }

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

      // Whistles carry underwater in a way that a thud does not, and the
      // ordinary water filter at 900 Hz would swallow one whole. Voices get
      // their own, far more open path.
      this.voice = this.ctx.createBiquadFilter();
      this.voice.type = 'lowpass';
      this.voice.frequency.value = 5200;
      this.voice.Q.value = 0.5;
      this.voice.connect(this.master);

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

    /** A bright ringing chip, quite unlike metal. */
    crystal() {
      this.tone(1180 * SL.randRange(0.94, 1.06), 'sine', 0.14, 0.003, 0.34);
      this.tone(1760, 'sine', 0.06, 0.003, 0.2);
      this.noise(0.08, 0.003, 0.08, 3200, 'highpass');
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

    /**
     * A porpoise whistle: a sine swept up and back down, with a little vibrato
     * on top and a burst of echolocation clicks in front of it. Routed through
     * the open voice path so it reads as an animal calling rather than as the
     * muffled thump everything else gets.
     */
    dolphinWhistle(distance) {
      if (!this.ready || this.muted) return;
      const g = this.gainFor(distance);
      if (g <= 0.02) return;

      const now = this.ctx.currentTime;
      const duration = SL.randRange(0.34, 0.52);
      const low = SL.randRange(900, 1250);
      const high = low * SL.randRange(2.1, 2.9);

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(low, now);
      osc.frequency.exponentialRampToValueAtTime(high, now + duration * 0.45);
      osc.frequency.exponentialRampToValueAtTime(low * 1.35, now + duration);

      // Vibrato, which is most of what makes a whistle sound alive.
      const vibrato = this.ctx.createOscillator();
      vibrato.frequency.value = SL.randRange(16, 26);
      const vibratoGain = this.ctx.createGain();
      vibratoGain.gain.value = high * 0.035;
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.14 * g, now + 0.05);
      gain.gain.setValueAtTime(0.14 * g, now + duration * 0.7);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.voice);

      osc.start(now);
      vibrato.start(now);
      osc.stop(now + duration + 0.05);
      vibrato.stop(now + duration + 0.05);

      // A short click train ahead of the whistle.
      const clicks = 5 + Math.floor(SL.random() * 4);
      for (let i = 0; i < clicks; i++) {
        const at = now + i * SL.randRange(0.012, 0.03);
        const click = this.ctx.createOscillator();
        click.type = 'square';
        click.frequency.value = SL.randRange(2200, 3400);
        const clickGain = this.ctx.createGain();
        clickGain.gain.setValueAtTime(0.05 * g, at);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.02);
        click.connect(clickGain);
        clickGain.connect(this.voice);
        click.start(at);
        click.stop(at + 0.03);
      }
    }

    /** A seal breaking the surface: a wet exhale, then a breath drawn in. */
    blow(distance) {
      const g = this.gainFor(distance || 0);
      if (g <= 0.02) return;
      this.noise(0.20 * g, 0.008, 0.28, 900, 'bandpass');
      this.tone(150, 'sine', 0.09 * g, 0.02, 0.22);
      setTimeout(() => this.noise(0.10 * g, 0.12, 0.30, 480, 'lowpass'), 260);
    }

    /** The scanner working, and the chirp when it completes. */
    scanTick() { this.tone(1400, 'square', 0.03, 0.002, 0.05); }
    scanDone() {
      [880, 1320, 1760].forEach((f, i) => setTimeout(() => this.tone(f, 'sine', 0.12, 0.005, 0.18), i * 70));
    }

    /** A rising three-note chime when something is built. */
    craft() {
      [440, 660, 880].forEach((freq, i) => {
        setTimeout(() => this.tone(freq, 'triangle', 0.16, 0.01, 0.22), i * 90);
      });
    }

    /** Cheat accepted: the same chime, lower and dirtier. */
    cheat() {
      [330, 415, 523, 659].forEach((freq, i) => {
        setTimeout(() => this.tone(freq, 'square', 0.10, 0.01, 0.3), i * 80);
      });
    }
    throwScrap() { this.noise(0.2, 0.01, 0.25, 900); }
    click() { this.tone(900, 'square', 0.06, 0.002, 0.04); }

    /** Heartbeat that rises as the air runs out. */
    heartbeat(intensity) {
      this.tone(48, 'sine', 0.30 * intensity, 0.01, 0.22);
    }

    /** Wakes a suspended context, quietly. Called from anywhere, often. */
    resume() {
      if (!this.ready || !this.ctx || this.ctx.state === 'running') return;
      const resumed = this.ctx.resume();
      // Older Safari returns undefined rather than a promise.
      if (resumed && typeof resumed.catch === 'function') resumed.catch(() => {});
    }

    /** Whether sound is actually coming out, for the HUD to be honest about. */
    get silent() {
      return this.muted || !this.ready || !this.ctx || this.ctx.state !== 'running';
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
