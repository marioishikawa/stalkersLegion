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
        'deathScreen', 'carryNote', 'hint', 'muteNote', 'titaniumCount', 'toothCount',
        'fabricator', 'recipeList', 'toasts', 'lookMode', 'fps', 'worldName',
        'quartzCount', 'goldCount', 'diamondCount', 'medkitCount', 'resources',
        'beaconCount', 'baitCount', 'repelCount', 'minimap', 'chartLegend',
        'scan', 'scanFill', 'scanLabel']) {
        this.el[id] = document.getElementById(id);
      }

      this.hitTimer = 0;
      this.damageTimer = 0;
      this.heartbeatTimer = 0;
      this.lastBiome = null;
      this.chart = new SL.Minimap(game, this.el.minimap);
      this.buildFabricator();
    }

    // --- Fabricator ---------------------------------------------------------

    /** Builds one row per recipe once; affordability is refreshed on open. */
    buildFabricator() {
      this.recipeRows = SL.Crafting.recipes.map((recipe) => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'recipe';

        const cost = Object.entries(recipe.cost)
          .map(([type, n]) => n + ' ' + (SL.Pickup.TYPES[type]
            ? SL.Pickup.TYPES[type].label.replace('Stalker ', '')
            : type))
          .join('  ·  ');

        row.innerHTML =
          '<span class="recipe__name"></span>' +
          '<span class="recipe__cost"></span>' +
          '<span class="recipe__blurb"></span>';
        row.querySelector('.recipe__name').textContent = recipe.name;
        row.querySelector('.recipe__cost').textContent = cost;
        row.querySelector('.recipe__blurb').textContent = recipe.blurb;

        row.addEventListener('click', () => {
          if (SL.Crafting.craft(recipe, this.game)) this.refreshFabricator();
        });

        this.el.recipeList.appendChild(row);
        return { recipe, row };
      });
    }

    refreshFabricator() {
      for (const { recipe, row } of this.recipeRows) {
        const blocked = SL.Crafting.blockedReason(recipe);
        row.classList.toggle('is-built', blocked === 'built');
        row.classList.toggle('is-locked', blocked !== null && blocked !== 'built');
        row.disabled = blocked !== null;

        const note = blocked === 'built' ? 'equipped'
          : blocked && blocked !== 'short' ? blocked
          : '';
        row.dataset.note = note;
      }
      this.updateResources();
    }

    updateResources() {
      const inventory = SL.Crafting.inventory;
      this.el.titaniumCount.textContent = inventory.titanium;
      this.el.toothCount.textContent = inventory.tooth;
      this.el.quartzCount.textContent = inventory.quartz;
      this.el.goldCount.textContent = inventory.gold;
      this.el.diamondCount.textContent = inventory.diamond;
      this.el.medkitCount.textContent = SL.Crafting.stacks.medkit;
      this.el.beaconCount.textContent = SL.Crafting.stacks.beacon;
      this.el.baitCount.textContent = SL.Crafting.stacks.bait;
      this.el.repelCount.textContent = SL.Crafting.stacks.repel;

      // A resource you have never seen stays hidden, so the strip starts small
      // and grows as the ocean gives things up.
      for (const node of this.el.resources.children) {
        const type = node.dataset.type;
        const held = type in SL.Crafting.stacks ? SL.Crafting.stacks[type] : inventory[type];
        node.classList.toggle('is-known', held > 0 || type === 'titanium' || type === 'tooth');
      }
    }

    setFabricatorOpen(open) {
      this.el.fabricator.classList.toggle('is-visible', open);
      if (open) this.refreshFabricator();
    }

    /** A short message that stacks and fades, for pickups and crafting. */
    toast(text) {
      const node = document.createElement('div');
      node.className = 'toast';
      node.textContent = text;
      this.el.toasts.appendChild(node);
      setTimeout(() => node.classList.add('is-fading'), 900);
      setTimeout(() => node.remove(), 1600);

      // Never let a long session pile up hundreds of nodes.
      while (this.el.toasts.childElementCount > 6) this.el.toasts.firstChild.remove();
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

      this.updateResources();

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

      // --- Scanner progress ------------------------------------------------------
      const scanning = p.scanTarget && p.scanProgress > 0;
      this.el.scan.classList.toggle('is-visible', !!scanning);
      if (scanning) {
        this.el.scanFill.style.transform = 'scaleX(' + p.scanProgress.toFixed(3) + ')';
        this.el.scanLabel.textContent = SL.Index.has(p.scanTarget.species.id)
          ? p.scanTarget.species.name + ' — known'
          : 'Scanning ' + p.scanTarget.species.name;
      }

      this.updateChart();

      if (this.game.fps) this.el.fps.textContent = this.game.fps + ' fps';

      // --- Controls hint ---------------------------------------------------------
      if (this.game.time < HINT_DURATION) {
        this.el.hint.style.opacity = SL.clamp((HINT_DURATION - this.game.time) / 3, 0, 1) * 0.9;
      } else if (this.el.hint.style.opacity !== '0') {
        this.el.hint.style.opacity = 0;
      }
    }

    /** Tells the player how to aim when pointer lock was refused. */
    showLookMode(mode) {
      if (mode !== 'drag') { this.el.lookMode.classList.remove('is-visible'); return; }
      this.el.lookMode.textContent = 'Drag to look  ·  click to swing  ·  Esc to pause';
      this.el.lookMode.classList.add('is-visible');
      clearTimeout(this._lookTimer);
      this._lookTimer = setTimeout(() => this.el.lookMode.classList.remove('is-visible'), 9000);
    }

    setWorldName(name) {
      this.el.worldName.textContent = name || '';
    }

    /** Redraws the chart, and lists whatever it can tell you about leviathans. */
    updateChart() {
      this.chart.draw();

      const player = this.game.player;
      const tracked = SL.Crafting.built.tracker;
      const lines = [];

      for (const apex of this.game.leviathans()) {
        if (apex.dead) continue;
        const distance = apex.position.distanceTo(player.position);

        // Without the tracker you only learn about one close enough to hear,
        // which is itself worth knowing.
        if (!tracked && distance > 70) continue;

        lines.push('<span style="color:' + (apex.species.markerColor || '#fff') + '">&#9679;</span> '
          + apex.species.name.replace(' Leviathan', '') + '  ' + Math.round(distance) + ' m');
      }

      if (!tracked && lines.length === 0) {
        lines.push('<span class="chart__hint">Build a tracker to chart leviathans</span>');
      }

      const html = lines.join('<br>');
      if (html !== this._legendHtml) {
        this._legendHtml = html;
        this.el.chartLegend.innerHTML = html;
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
