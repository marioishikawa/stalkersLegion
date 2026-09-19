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

  // Drawn at twice the size it is shown at, so the lines stay crisp.
  const CARD_W = 240;
  const CARD_H = 144;
  const DPR = 2;

  const DIET_LABEL = {
    grazer: 'Grazer',
    scavenger: 'Scavenger',
    carnivore: 'Carnivore',
    mammal: 'Air breather',
    whale: 'Filter feeder'
  };

  const _c = new THREE.Color();
  const css = (colour) => '#' + colour.getHexString();
  const shade = (colour, f) => css(_c.copy(colour).multiplyScalar(f));

  /**
   * Draws the animal, side on, from its own shape numbers.
   *
   * Not a silhouette. Every part the body builder puts on the mesh gets drawn
   * here as its own piece in its own colour - fins behind the body, a gradient
   * down the flank from back to belly, stripes, spines, legs, antennae, a
   * mouth and an eye - so the card is a picture of the fish rather than the
   * shape of one. It is all computed in units of body length and fitted with a
   * single uniform scale, so the proportions stay the animal's real ones.
   */
  function drawFish(ctx, species, known) {
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
    const halfAt = (t) => spine[SL.clamp(Math.round(t * steps), 0, steps)][1];

    const dorsalPeak = S.dorsalFin > 0.02
      ? SL.profileAt(species.profile, 0.5, S.bellyPosition).h * S.height + S.dorsalFin
      : 0;
    const ventralPeak = S.ventralFin > 0.02
      ? SL.profileAt(species.profile, 0.6, S.bellyPosition).h * S.height + S.ventralFin
      : 0;
    const legDrop = S.legPairs > 0 ? S.legScale * 1.1 : 0;

    const halfExtent = Math.max(maxHalf, S.tailHeight, dorsalPeak, ventralPeak, legDrop, 0.02);
    const totalLength = 1 + S.tailSweep;

    const scale = Math.min((CARD_W - 16) / totalLength, (CARD_H - 14) / (halfExtent * 2));
    const originX = (CARD_W - totalLength * scale) / 2;
    const midY = CARD_H / 2;

    const px = (t) => originX + t * scale;
    const py = (v) => midY + v * scale;

    // An unscanned entry keeps its slot and gives nothing away: one flat grey.
    const flat = 'rgba(125, 148, 154, 0.22)';
    const back = known ? species.backColor : null;
    const belly = known ? species.bellyColor : null;
    const fin = known ? species.finColor : null;

    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(px(0), py(0));
      for (const [t, half] of spine) ctx.lineTo(px(t), py(-half));
      for (let i = spine.length - 1; i >= 0; i--) ctx.lineTo(px(spine[i][0]), py(spine[i][1]));
      ctx.closePath();
    };

    // --- Fins, behind the body ------------------------------------------------
    ctx.fillStyle = known ? shade(fin, 1) : flat;

    // Tail, swept off the end and forked by its own number.
    const tailX = 1 + S.tailSweep;
    ctx.beginPath();
    ctx.moveTo(px(0.97), py(-halfAt(0.97)));
    ctx.lineTo(px(tailX), py(-S.tailHeight));
    ctx.lineTo(px(1 + S.tailSweep * (1 - SL.clamp(S.tailFork, 0, 0.95))), py(0));
    ctx.lineTo(px(tailX), py(S.tailHeight));
    ctx.lineTo(px(0.97), py(halfAt(0.97)));
    ctx.closePath();
    ctx.fill();

    if (dorsalPeak > 0) {
      ctx.beginPath();
      ctx.moveTo(px(0.34), py(-halfAt(0.34)));
      ctx.lineTo(px(0.53), py(-dorsalPeak));
      ctx.lineTo(px(0.72), py(-halfAt(0.72)));
      ctx.closePath();
      ctx.fill();
    }

    if (ventralPeak > 0) {
      ctx.beginPath();
      ctx.moveTo(px(0.45), py(halfAt(0.45)));
      ctx.lineTo(px(0.6), py(ventralPeak));
      ctx.lineTo(px(0.75), py(halfAt(0.75)));
      ctx.closePath();
      ctx.fill();
    }

    // Legs, for the things that have them.
    if (S.legPairs > 0) {
      ctx.strokeStyle = known ? shade(fin, 0.8) : flat;
      ctx.lineWidth = Math.max(1.5, scale * 0.018);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < S.legPairs; i++) {
        const t = SL.lerp(0.28, 0.62, S.legPairs > 1 ? i / (S.legPairs - 1) : 0.5);
        const root = halfAt(t) * 0.75;
        ctx.moveTo(px(t), py(root));
        ctx.lineTo(px(t - S.legScale * 0.25), py(root + S.legScale * 1.05));
      }
      ctx.stroke();
    }

    // --- The body -------------------------------------------------------------
    if (known) {
      const grad = ctx.createLinearGradient(0, py(-maxHalf), 0, py(maxHalf));
      grad.addColorStop(0, shade(back, 0.85));
      grad.addColorStop(0.45, css(back));
      grad.addColorStop(1, css(belly));
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = flat;
    }
    bodyPath();
    ctx.fill();

    // Stripes, clipped to the flank.
    if (known && S.stripes > 0) {
      ctx.save();
      bodyPath();
      ctx.clip();
      ctx.fillStyle = shade(back, 0.62);
      for (let i = 0; i < S.stripes; i++) {
        const t = SL.lerp(0.16, 0.82, S.stripes > 1 ? i / (S.stripes - 1) : 0.5);
        ctx.fillRect(px(t) - scale * 0.018, py(-halfExtent), scale * 0.036, halfExtent * 2 * scale);
      }
      ctx.restore();
    }

    // Spines along the back.
    if (S.backSpikes > 0) {
      ctx.fillStyle = known ? shade(fin, 0.75) : flat;
      for (let i = 0; i < S.backSpikes; i++) {
        const t = SL.lerp(0.25, 0.8, S.backSpikes > 1 ? i / (S.backSpikes - 1) : 0.5);
        const top = -halfAt(t);
        ctx.beginPath();
        ctx.moveTo(px(t - 0.03), py(top));
        ctx.lineTo(px(t), py(top - 0.075));
        ctx.lineTo(px(t + 0.03), py(top));
        ctx.closePath();
        ctx.fill();
      }
    }

    // The outline, which is what makes it read as drawn rather than cut out.
    ctx.strokeStyle = known ? shade(back, 0.45) : 'rgba(125, 148, 154, 0.35)';
    ctx.lineWidth = Math.max(1.5, scale * 0.01);
    ctx.lineJoin = 'round';
    bodyPath();
    ctx.stroke();

    // --- The face -------------------------------------------------------------
    const eyeT = SL.clamp(S.eyePosition, 0.04, 0.4);
    const eyeHalf = halfAt(eyeT);

    // Held inside the outline. On something as thin as the Stick Fish the
    // body is barely thicker than the eye, and an unclamped one floats off it.
    const eyeY = SL.clamp(-eyeHalf * (1 - S.eyeHeight * 2) * 0.9,
      -eyeHalf * 0.55, eyeHalf * 0.55);
    const eyeR = Math.min(Math.max(2, S.eyeSize * scale), Math.max(2, eyeHalf * scale * 0.5));

    // Mouth: a short line back from the nose along the jaw.
    ctx.strokeStyle = known ? shade(back, 0.4) : 'rgba(125, 148, 154, 0.3)';
    ctx.lineWidth = Math.max(1.2, scale * 0.008);
    ctx.beginPath();
    ctx.moveTo(px(0.005), py(halfAt(0.02) * 0.15));
    ctx.lineTo(px(0.10 + S.jawLength), py(halfAt(0.12) * 0.55));
    ctx.stroke();

    if (known && S.eyeRing) {
      ctx.fillStyle = 'rgba(245, 248, 246, 0.92)';
      ctx.beginPath();
      ctx.arc(px(eyeT), py(eyeY), eyeR * 1.7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = known ? css(species.eyeColor) : 'rgba(125, 148, 154, 0.45)';
    ctx.beginPath();
    ctx.arc(px(eyeT), py(eyeY), eyeR, 0, Math.PI * 2);
    ctx.fill();

    if (known) {
      // A catchlight. Two pixels of white is the difference between an eye and
      // a hole.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.arc(px(eyeT) - eyeR * 0.3, py(eyeY) - eyeR * 0.3, Math.max(1, eyeR * 0.33), 0, Math.PI * 2);
      ctx.fill();
    }

    // Antennae, for the crustaceans.
    if (S.antennae > 0.01) {
      ctx.strokeStyle = known ? shade(fin, 0.8) : flat;
      ctx.lineWidth = Math.max(1.2, scale * 0.01);
      ctx.beginPath();
      ctx.moveTo(px(0.1), py(-halfAt(0.1)));
      ctx.lineTo(px(-S.antennae * 0.5), py(-S.antennae * 0.3));
      ctx.moveTo(px(0.1), py(-halfAt(0.1) * 0.4));
      ctx.lineTo(px(-S.antennae * 0.45), py(-S.antennae * 0.05));
      ctx.stroke();
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

      // Finishing the fish is what earns the bonded stalker.
      if (this.game && SL.Pet) SL.Pet.checkUnlock(this.game);
      // And it may have been the last thing the world was waiting for.
      if (this.game && SL.Quest) SL.Quest.check(this.game);
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
        // Backing store at twice the displayed size; the CSS pins the box.
        canvas.width = CARD_W;
        canvas.height = CARD_H;
        canvas.style.width = (CARD_W / DPR) + 'px';
        canvas.style.height = (CARD_H / DPR) + 'px';
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
        drawFish(ctx, species, known);

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

      this.progress.textContent = SL.Quest
        ? SL.Quest.summary()
        : this.count + ' of ' + this.total + ' catalogued';
    },

    setOpen(open) {
      this.el.classList.toggle('is-visible', open);
      if (open) this.refresh();
    }
  };

  SL.Index = Index;
})(window.SL);
