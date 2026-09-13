/**
 * The chart.
 *
 * The world is 480 m across and the biomes no longer sit in rings you can
 * reason about from the middle, so navigating by feel does not work. This draws
 * the whole sea floor at once, coloured by biome, from the very same index the
 * world was populated from - what you see on the chart is literally where things
 * were placed.
 *
 * Leviathans only appear on it once you have built the tracker. Until then you
 * get a bearing when one is close enough to hear, which is its own kind of
 * information.
 */
(function (SL) {
  'use strict';

  const SIZE = 168;

  class Minimap {
    constructor(game, canvas) {
      this.game = game;
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.base = document.createElement('canvas');
      this.built = false;
    }

    /** Paints the biome colours once per world into an offscreen canvas. */
    build() {
      const index = SL.Biomes.index;
      const n = index.resolution;

      this.base.width = n;
      this.base.height = n;

      const ctx = this.base.getContext('2d');
      const image = ctx.createImageData(n, n);
      const data = image.data;

      for (let i = 0; i < index.cells.length; i++) {
        const biome = index.cells[i];
        const offset = i * 4;

        if (!biome) {
          data[offset + 3] = 0;                   // outside the world
          continue;
        }

        // Lift the floor colour so the chart reads at a glance rather than
        // being as dark as the water it describes.
        const c = biome.floorColor;
        data[offset] = Math.min(255, c.r * 300);
        data[offset + 1] = Math.min(255, c.g * 300);
        data[offset + 2] = Math.min(255, c.b * 300);
        data[offset + 3] = 235;
      }

      ctx.putImageData(image, 0, 0);
      this.built = true;
    }

    /** World position to chart pixels. */
    project(x, z) {
      const scale = SIZE / (SL.WORLD_RADIUS * 2);
      return {
        x: (x + SL.WORLD_RADIUS) * scale,
        y: (z + SL.WORLD_RADIUS) * scale
      };
    }

    marker(point, color, radius) {
      const ctx = this.ctx;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    draw() {
      if (!this.built) this.build();

      const ctx = this.ctx;
      const game = this.game;
      ctx.clearRect(0, 0, SIZE, SIZE);

      // The sea floor.
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.base, 0, 0, SIZE, SIZE);

      // Beacons the player has dropped.
      for (const beacon of game.beacons) {
        this.marker(this.project(beacon.position.x, beacon.position.z), '#67e8d8', 2.5);
      }

      // Leviathans, once the tracker exists.
      if (SL.Crafting.built.tracker) {
        for (const apex of game.leviathans()) {
          if (apex.dead) continue;
          const point = this.project(apex.position.x, apex.position.z);
          this.marker(point, apex.species.markerColor || '#ffffff', 4);
          ctx.strokeStyle = 'rgba(0,0,0,0.55)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }

      // The diver: a bright ringed dot so it is never lost against the sea
      // floor colours, with a short tick showing which way they are facing.
      const p = this.project(game.player.position.x, game.player.position.z);
      ctx.save();
      ctx.translate(p.x, p.y);

      ctx.rotate(-game.player.yaw);
      ctx.strokeStyle = '#e8efe6';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.lineTo(0, -9);
      ctx.stroke();
      ctx.rotate(game.player.yaw);

      // Dark halo first, so the dot reads on pale sand as well as dark abyss.
      ctx.fillStyle = 'rgba(4, 20, 27, 0.85)';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  SL.Minimap = Minimap;
})(window.SL);
