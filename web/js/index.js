/**
 * The databank.
 *
 * Scanning a creature records it here. Each entry draws the animal's actual
 * silhouette - not an illustration, but the same profile function the mesh is
 * lofted from, so the outline in the index and the body in the water come from
 * one set of numbers. Anything unscanned stays a blank card.
 */
(function (SL) {
  'use strict';

  const CARD_W = 108;
  const CARD_H = 62;

  const DIET_LABEL = {
    grazer: 'Grazer',
    scavenger: 'Scavenger',
    carnivore: 'Carnivore',
    mammal: 'Air breather',
    whale: 'Filter feeder'
  };

  /**
   * Draws a side-on outline from the species' own shape numbers.
   *
   * Everything is computed in units of body length and then fitted to the card
   * with a single uniform scale, so the proportions are the animal's real ones:
   * a ribbon reads as a ribbon, a disc as a disc, and an eel as a thin line.
   */
  function drawSilhouette(ctx, species) {
    const S = species.shape;
    const steps = 44;

    // Half-height along the spine, in fractions of body length.
    const spine = [];
    let maxHalf = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const { h } = SL.profileAt(species.profile, t, S.bellyPosition);
      const nose = Math.pow(Math.min(t / 0.2, 1), 0.35 + S.noseSharpness * 0.9);
      const half = h * S.height * nose;
      spine.push([t, half]);
      maxHalf = Math.max(maxHalf, half);
    }

    const dorsalPeak = S.dorsalFin > 0.02
      ? SL.profileAt(species.profile, 0.5, S.bellyPosition).h * S.height + S.dorsalFin
      : 0;
    const ventralPeak = S.ventralFin > 0.02
      ? SL.profileAt(species.profile, 0.6, S.bellyPosition).h * S.height + S.ventralFin
      : 0;

    const halfExtent = Math.max(maxHalf, S.tailHeight, dorsalPeak, ventralPeak, 0.02);
    const totalLength = 1 + S.tailSweep;

    // One scale for both axes keeps the aspect ratio honest.
    const scale = Math.min((CARD_W - 12) / totalLength, (CARD_H - 10) / (halfExtent * 2));
    const originX = (CARD_W - totalLength * scale) / 2;
    const midY = CARD_H / 2;

    const px = (t) => originX + t * scale;
    const py = (v) => midY + v * scale;

    ctx.beginPath();
    ctx.moveTo(px(0), py(0));
    for (const [t, half] of spine) ctx.lineTo(px(t), py(-half));

    // Tail fin, swept back off the end of the body.
    const tailX = 1 + S.tailSweep;
    ctx.lineTo(px(tailX), py(-S.tailHeight));
    ctx.lineTo(px(1 + S.tailSweep * (1 - SL.clamp(S.tailFork, 0, 0.95))), py(0));
    ctx.lineTo(px(tailX), py(S.tailHeight));

    for (let i = spine.length - 1; i >= 0; i--) ctx.lineTo(px(spine[i][0]), py(spine[i][1]));
    ctx.closePath();
    ctx.fill();

    if (dorsalPeak > 0) {
      ctx.beginPath();
      ctx.moveTo(px(0.34), py(-spine[Math.round(0.34 * steps)][1]));
      ctx.lineTo(px(0.53), py(-dorsalPeak));
      ctx.lineTo(px(0.72), py(-spine[Math.round(0.72 * steps)][1]));
      ctx.closePath();
      ctx.fill();
    }

    if (ventralPeak > 0) {
      ctx.beginPath();
      ctx.moveTo(px(0.45), py(spine[Math.round(0.45 * steps)][1]));
      ctx.lineTo(px(0.6), py(ventralPeak));
      ctx.lineTo(px(0.75), py(spine[Math.round(0.75 * steps)][1]));
      ctx.closePath();
      ctx.fill();
    }

    // Antennae, for the crustaceans.
    if (S.antennae > 0.01) {
      ctx.save();
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = Math.max(1, scale * 0.012);
      ctx.beginPath();
      ctx.moveTo(px(0.1), py(-spine[Math.round(0.1 * steps)][1]));
      ctx.lineTo(px(-S.antennae * 0.5), py(-S.antennae * 0.3));
      ctx.moveTo(px(0.1), py(-spine[Math.round(0.1 * steps)][1] * 0.4));
      ctx.lineTo(px(-S.antennae * 0.45), py(-S.antennae * 0.05));
      ctx.stroke();
      ctx.restore();
    }
  }

  const Index = {
    /** Species ids the player has scanned, in this world. */
    scanned: {},

    reset() { this.scanned = {}; },

    has(id) { return !!this.scanned[id]; },

    get count() { return Object.keys(this.scanned).length; },
    get total() { return SL.Species.list.length; },

    /** Records a species. Returns false if it was already known. */
    record(id) {
      if (this.scanned[id]) return false;
      this.scanned[id] = Date.now();
      return true;
    },

    init(game) {
      this.game = game;
      this.el = document.getElementById('indexScreen');
      this.list = document.getElementById('indexList');
      this.progress = document.getElementById('indexProgress');
      this.cards = null;
    },

    build() {
      this.list.innerHTML = '';
      this.cards = SL.Species.list.map((species) => {
        const card = document.createElement('article');
        card.className = 'entry';

        const canvas = document.createElement('canvas');
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        canvas.className = 'entry__art';

        const body = document.createElement('div');
        body.className = 'entry__body';
        body.innerHTML =
          '<h3 class="entry__name"></h3>' +
          '<p class="entry__stats"></p>' +
          '<p class="entry__note"></p>';

        card.appendChild(canvas);
        card.appendChild(body);
        this.list.appendChild(card);
        return { species, card, canvas, body };
      });
    },

    refresh() {
      if (!this.cards) this.build();

      for (const { species, card, canvas, body } of this.cards) {
        const known = this.has(species.id);
        card.classList.toggle('is-known', known);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, CARD_W, CARD_H);
        ctx.fillStyle = known
          ? '#' + species.backColor.getHexString()
          : 'rgba(125, 148, 154, 0.20)';
        drawSilhouette(ctx, species);

        body.querySelector('.entry__name').textContent = known ? species.name : 'Unscanned';

        const biome = SL.Biomes.byId[species.biome];
        body.querySelector('.entry__stats').textContent = known
          ? [
              (species.shape.length < 1
                ? Math.round(species.shape.length * 100) + ' cm'
                : species.shape.length.toFixed(1) + ' m'),
              DIET_LABEL[species.diet] || 'Grazer',
              biome ? biome.name : '',
              species.biteDamage > 0 ? species.biteDamage + ' dmg bite' : 'Harmless'
            ].filter(Boolean).join('  ·  ')
          : '—';

        body.querySelector('.entry__note').textContent = known ? (species.note || '') : '';
      }

      this.progress.textContent = this.count + ' of ' + this.total + ' catalogued';
    },

    setOpen(open) {
      this.el.classList.toggle('is-visible', open);
      if (open) this.refresh();
    }
  };

  SL.Index = Index;
})(window.SL);
