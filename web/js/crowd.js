/**
 * Things not going through other things.
 *
 * Three separate problems wearing one coat:
 *
 *  * SOLIDS - the boulders on the sea floor. They are baked into merged patch
 *    geometry for the renderer's sake, so nothing knows where any individual
 *    rock is once the patch is built. The world builder now records each one
 *    as a sphere in a grid here, and creatures steer around them and are
 *    pushed out of them.
 *
 *  * EACH OTHER - a school used to interpenetrate freely, which reads as one
 *    smeared animal rather than nine. Only fish near enough to be drawn are
 *    worth separating, and there are rarely more than a few dozen of those, so
 *    they go into a small grid rebuilt each frame and every overlapping pair
 *    is eased apart.
 *
 *  * THE DIVER - who is pushed out of creatures by their own update, but the
 *    creature then swims its own step afterwards and can finish it inside you.
 *    The same pass fixes that, moving the fish rather than the diver: the
 *    diver has already had their share of the shove, and a minnow does not
 *    move a person.
 *
 * Everything here is a position correction, not a force. Corrections are eased
 * rather than snapped, because a hard snap against a creature's own steering
 * is how a fish ends up vibrating in place.
 */
(function (SL) {
  'use strict';

  const _push = new THREE.Vector3();
  const _delta = new THREE.Vector3();

  // --- Solid rock -----------------------------------------------------------

  /** Cell size for the rock grid. Comfortably larger than the biggest rock. */
  const ROCK_CELL = 10;

  const Solids = {
    grid: {},
    count: 0,

    reset() { this.grid = {}; this.count = 0; },

    key(x, z) {
      return Math.floor(x / ROCK_CELL) + ',' + Math.floor(z / ROCK_CELL);
    },

    /** Records one rock. Called as the world is planted. */
    add(x, y, z, radius) {
      const key = this.key(x, z);
      (this.grid[key] || (this.grid[key] = [])).push({ x, y, z, r: radius });
      this.count++;
    },

    /**
     * The correction that takes a sphere out of any rock it is inside.
     *
     * Returns null when there is nothing to do, which is the overwhelmingly
     * common case and the reason this is a grid lookup rather than a loop over
     * fifteen thousand rocks.
     */
    correction(position, radius, out) {
      const cx = Math.floor(position.x / ROCK_CELL);
      const cz = Math.floor(position.z / ROCK_CELL);
      let hit = false;
      out.set(0, 0, 0);

      for (let gz = cz - 1; gz <= cz + 1; gz++) {
        for (let gx = cx - 1; gx <= cx + 1; gx++) {
          const cell = this.grid[gx + ',' + gz];
          if (!cell) continue;

          for (let i = 0; i < cell.length; i++) {
            const rock = cell[i];
            const dx = position.x - rock.x;
            const dy = position.y - rock.y;
            const dz = position.z - rock.z;

            const minimum = rock.r + radius;
            const d2 = dx * dx + dy * dy + dz * dz;
            if (d2 >= minimum * minimum) continue;

            const d = Math.sqrt(d2);
            // Dead centre: pick a direction rather than dividing by zero.
            if (d < 1e-4) { out.y += minimum; hit = true; continue; }

            const overlap = minimum - d;
            out.x += (dx / d) * overlap;
            out.y += (dy / d) * overlap;
            out.z += (dz / d) * overlap;
            hit = true;
          }
        }
      }

      return hit ? out : null;
    }
  };

  // --- Creatures, each other, and the diver ---------------------------------

  /** Grid cell for the per-frame separation pass. */
  const CROWD_CELL = 2.5;

  /** How much of an overlap is resolved per frame. Eased, not snapped. */
  const EASE = 0.5;

  const Crowd = {
    /**
     * Eases apart everything in `bodies`, and keeps all of them out of the
     * diver. `bodies` is expected to be the handful of creatures close enough
     * to be drawn - this is not meant to run over the whole ocean.
     */
    separate(game, bodies) {
      if (!bodies.length) return;

      const grid = {};
      for (let i = 0; i < bodies.length; i++) {
        const p = bodies[i].position;
        const key = Math.floor(p.x / CROWD_CELL) + ',' +
          Math.floor(p.y / CROWD_CELL) + ',' + Math.floor(p.z / CROWD_CELL);
        (grid[key] || (grid[key] = [])).push(i);
      }

      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        const ap = a.position;
        const ar = this.personalSpace(a);

        const cx = Math.floor(ap.x / CROWD_CELL);
        const cy = Math.floor(ap.y / CROWD_CELL);
        const cz = Math.floor(ap.z / CROWD_CELL);

        for (let gz = cz - 1; gz <= cz + 1; gz++) {
          for (let gy = cy - 1; gy <= cy + 1; gy++) {
            for (let gx = cx - 1; gx <= cx + 1; gx++) {
              const cell = grid[gx + ',' + gy + ',' + gz];
              if (!cell) continue;

              for (let k = 0; k < cell.length; k++) {
                const j = cell[k];
                // Each pair once, and never a body against itself.
                if (j <= i) continue;

                const b = bodies[j];
                const minimum = ar + this.personalSpace(b);
                _delta.subVectors(ap, b.position);

                const d2 = _delta.lengthSq();
                if (d2 >= minimum * minimum || d2 < 1e-8) continue;

                const d = Math.sqrt(d2);
                const share = (minimum - d) * EASE * 0.5;
                _delta.multiplyScalar(share / d);

                ap.add(_delta);
                b.position.sub(_delta);
              }
            }
          }
        }
      }

      this.clearOfDiver(game, bodies);
    },

    /**
     * How much room a creature keeps around itself.
     *
     * Not the mesh radius, which on a fish is its half-height and lets two of
     * them sit inside one another nose to tail. A body length is what reads as
     * a collision, so it is most of one.
     */
    personalSpace(creature) {
      return Math.max(creature.radius || 0.1, (creature.bodyLength || 0.4) * 0.4);
    },

    /** Nothing finishes its frame inside the diver. */
    clearOfDiver(game, bodies) {
      const player = game.player;
      if (!player || player.dead) return;

      const DIVER = 0.55;
      for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        if (body.dead) continue;

        const minimum = DIVER + this.personalSpace(body);
        _delta.subVectors(body.position, player.position);

        const d2 = _delta.lengthSq();
        if (d2 >= minimum * minimum) continue;

        // Straight through the middle of them: push it out sideways.
        if (d2 < 1e-6) { body.position.x += minimum; continue; }

        const d = Math.sqrt(d2);
        body.position.addScaledVector(_delta, (minimum - d) / d);
      }
    }
  };

  SL.Solids = Solids;
  SL.Crowd = Crowd;
})(window.SL);
