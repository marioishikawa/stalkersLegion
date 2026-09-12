/**
 * The HUD is plain DOM over the canvas - crisper than canvas text, and it means
 * the interface is styled in CSS rather than drawn by hand.
 *
 * It reads like a salvage diver's rig: two instrument bars for the things that
 * kill you, a depth readout, and a proximity line that only appears when a
 * stalker is actually close enough to matter.
 */
(function (SL) {
  'use strict';

  const HINT_DURATION = 24;

  class Hud {
    constructor(game) {
      this.game = game;
      this.el = {};
      for (const id of ['healthFill', 'healthValue', 'airFill', 'airValue', 'depthValue',
        'biomeName', 'focus', 'warning', 'warningText', 'hitMarker', 'damageFlash',
        'deathScreen', 'carryNote', 'hint', 'muteNote']) {
        this.el[id] = document.getElementById(id);
      }

      this.hitTimer = 0;
      this.damageTimer = 0;
      this.heartbeatTimer = 0;
      this.lastBiome = null;
    }

    flashDamage() { this.damageTimer = 0.8; }

    showHitMarker(name, killed) {
      this.el.hitMarker.textContent = killed ? name + ' killed' : name;
      this.el.hitMarker.classList.toggle('is-kill', !!killed);
      this.el.hitMarker.classList.add('is-visible');
      this.hitTimer = 1.1;
    }

    update(dt) {
      const p = this.game.player;

      // --- Instruments --------------------------------------------------------
      const healthFraction = p.health / p.maxHealth;
      const airFraction = p.oxygen / p.maxOxygen;

      this.el.healthFill.style.transform = 'scaleX(' + healthFraction.toFixed(3) + ')';
      this.el.airFill.style.transform = 'scaleX(' + airFraction.toFixed(3) + ')';
      this.el.healthValue.textContent = Math.ceil(p.health);
      this.el.airValue.textContent = Math.ceil(p.oxygen) + 's';

      this.el.airFill.classList.toggle('is-critical', airFraction < 0.25);
      this.el.healthFill.classList.toggle('is-critical', healthFraction < 0.3);

      // A heartbeat that quickens as the air runs out.
      if (airFraction < 0.3 && !p.dead) {
        this.heartbeatTimer -= dt;
        if (this.heartbeatTimer <= 0) {
          this.heartbeatTimer = SL.lerp(0.45, 1.1, airFraction / 0.3);
          this.game.audio.heartbeat(1 - airFraction / 0.3);
        }
      }

      // --- Depth and biome ------------------------------------------------------
      this.el.depthValue.textContent = p.depth.toFixed(1);
      const biome = p.biome;
      if (biome !== this.lastBiome) {
        this.lastBiome = biome;
        this.el.biomeName.textContent = biome.name;
        this.el.biomeName.classList.remove('is-entering');
        void this.el.biomeName.offsetWidth;   // restart the animation
        this.el.biomeName.classList.add('is-entering');
      }

      // --- Crosshair focus -------------------------------------------------------
      this.el.focus.textContent = p.dead ? '' : p.focusLabel;

      if (this.hitTimer > 0) {
        this.hitTimer -= dt;
        if (this.hitTimer <= 0) this.el.hitMarker.classList.remove('is-visible');
      }

      // --- Stalker proximity -----------------------------------------------------
      let closest = null, closestDistance = 26;
      for (const stalker of this.game.stalkers) {
        if (stalker.dead) continue;
        const d = stalker.position.distanceTo(p.position);
        if (d < closestDistance) { closestDistance = d; closest = stalker; }
      }

      if (closest && !p.dead) {
        const proximity = 1 - closestDistance / 26;
        this.el.warning.classList.add('is-visible');
        this.el.warning.style.setProperty('--pulse', (0.35 + proximity * 0.65).toFixed(2));
        this.el.warning.style.setProperty('--beat', (1.4 - proximity).toFixed(2) + 's');
        this.el.warningText.textContent =
          'STALKER  ' + closestDistance.toFixed(0) + 'm  ·  ' + closest.stateLabel;
      } else {
        this.el.warning.classList.remove('is-visible');
      }

      // --- Carried scrap ---------------------------------------------------------
      this.el.carryNote.classList.toggle('is-visible', !!p.carriedScrap && !p.dead);

      // --- Damage flash and death ------------------------------------------------
      if (this.damageTimer > 0) {
        this.damageTimer -= dt;
        this.el.damageFlash.style.opacity = Math.max(0, this.damageTimer / 0.8) * 0.5;
      } else {
        this.el.damageFlash.style.opacity = 0;
      }

      this.el.deathScreen.classList.toggle('is-visible', p.dead);

      // --- Controls hint ---------------------------------------------------------
      if (this.game.time < HINT_DURATION) {
        this.el.hint.style.opacity = SL.clamp((HINT_DURATION - this.game.time) / 3, 0, 1) * 0.9;
      } else if (this.el.hint.style.opacity !== '0') {
        this.el.hint.style.opacity = 0;
      }
    }

    showMuted(muted) {
      this.el.muteNote.textContent = muted ? 'sound off' : 'sound on';
      this.el.muteNote.classList.add('is-visible');
      clearTimeout(this._muteTimer);
      this._muteTimer = setTimeout(() => this.el.muteNote.classList.remove('is-visible'), 1200);
    }
  }

  SL.Hud = Hud;
})(window.SL);
