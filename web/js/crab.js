/**
 * The Craber, and the Crober - which is the Craber in blue.
 *
 * A crab, so it walks. It shares nothing with the fish: it takes its height
 * from the sea floor rather than swimming above it, it steers in two
 * dimensions, and it goes sideways - which is the whole reason it is not just
 * a Fish with legs bolted on.
 *
 * It lives in the Safe Shallows and nowhere else. Every point it picks to walk
 * to is checked against the biome first, so a crab that wanders downhill turns
 * around at the edge of the sand instead of strolling off into the kelp.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _away = new THREE.Vector3();
  const _prev = new THREE.Vector3();
  const _wall = new THREE.Vector3();

  const LABELS = {
    potter: 'pottering about',
    bolt: 'legging it',
    hide: 'sitting very still',
    refuge: 'running for the cave',
    sheltered: 'hiding in the cave',
    leaving: 'heading home'
  };

  /** How far a hurt lobster will run to reach the cave. */
  const REFUGE_RANGE = 140;

  /**
   * The floor as drawn. A crab stands on what you can see - out on the coarse
   * grid of the abyssal plain the smooth floor and the drawn one can be metres
   * apart, which is a crab walking on air or wading through mud.
   */
  function groundAt(x, z) {
    return SL.Terrain ? SL.Terrain.surfaceAt(x, z) : SL.Biomes.floorHeightAt(x, z);
  }

  /** How close anything gets before it runs. */
  const SPOOK_RANGE = 9;

  class Craber extends SL.Creature {
    // The species is a parameter because there are two of these: the Craber
    // and the Crober, which is the same animal in blue. Nothing else about
    // them differs, so nothing else about them is written twice.
    constructor(game, x, z, species) {
      const y = groundAt(x, z);
      super(game, species || SL.Species.craber, x, y, z);

      this.home = new THREE.Vector3(x, y, z);
      this.rangeRadius = 26;

      this.state = 'potter';
      this.stateTimer = 0;
      this.senseTimer = SL.random() * 0.5;

      this.heading = SL.random() * Math.PI * 2;
      this.target = new THREE.Vector3(x, y, z);

      // Crabs walk sideways. The body is built nose-forward like everything
      // else, so it is simply carried at ninety degrees to its travel and the
      // legs do the rest.
      this.sidleSign = SL.random() < 0.5 ? 1 : -1;
      this.scuttle = SL.random() * Math.PI * 2;

      this.pickTarget();
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get legHeight() { return this.bodyLength * (this.species.shape.legStance || 0.22); }

    /**
     * Whether a point is ground this crab will walk on.
     *
     * The Craber and Crober live on the sand of the Safe Shallows; the Stilt
     * Crab walks the abyssal plain and the vent field. Every check that used
     * to say "shallows" asks this instead, so each keeps to its own country.
     */
    walksOn(x, z) {
      // Nothing but its keeper chooses to walk inside the lobster cave.
      if (SL.LobsterCave && SL.LobsterCave.covers(x, z, 1)) return false;
      // The lobsters that live round the cave keep to their own patch of sand.
      if (this.yard) return Math.hypot(x - this.yard.x, z - this.yard.z) < this.yard.r;
      if (!this.homes) {
        const S = this.species;
        this.homes = [S.biome].concat(S.alsoIn || []).map((id) => SL.Biomes.byId[id]);
      }
      return this.homes.indexOf(SL.Biomes.biomeAt(x, z)) >= 0;
    }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /**
     * Anything that hits it makes it run, and it has nothing to fight with.
     * A lobster near enough to the cave runs there instead - and if it was
     * the diver that hurt it, the Big Lobster takes note.
     */
    onHurt(damage, source) {
      if (this.species.seeksCave) {
        const cave = SL.LobsterCave;
        if (source && source === this.game.player) cave.wronged(this.game);
        if (this.state === 'refuge' || this.state === 'sheltered') return;
        if (cave.placed && Math.hypot(this.position.x - cave.layout.x, this.position.z - cave.layout.z) < REFUGE_RANGE) {
          this.route = cave.routeIn(this.position);
          this.target.copy(this.route.shift());
          this.enterState('refuge');
          return;
        }
      }
      this.enterState('bolt'); this.stateTimer = 0;
    }
    provoke() { this.onHurt(); }

    onDeath(killer) {
      if (this.species.seeksCave && killer && killer === this.game.player) SL.LobsterCave.wronged(this.game);
    }

    /** Somewhere else on the sand. Never off the sand. */
    pickTarget() {
      // Now and then, near the wreck, the way in through the breach - and
      // from inside, mostly the way back out.
      const route = SL.Wreck && SL.Wreck.routeFor(this);
      if (route) {
        this.target.set(route[0].x, 0, route[0].z);
        this.route = route.slice(1);
        return;
      }
      this.route = null;

      for (let attempt = 0; attempt < 14; attempt++) {
        const angle = SL.random() * Math.PI * 2;
        const radius = SL.randRange(2, this.rangeRadius);
        const x = this.home.x + Math.cos(angle) * radius;
        const z = this.home.z + Math.sin(angle) * radius;

        if (!this.walksOn(x, z)) continue;

        this.target.set(x, 0, z);
        return;
      }
      this.target.set(this.home.x, 0, this.home.z);
    }

    update(dt) {
      if (this.dead) {
        this.deathTimer += dt;
        this.object.rotation.z += dt * 1.4;      // rolls onto its back
        if (this.deathTimer > 12) this.destroy();
        return;
      }

      this.stateTimer += dt;

      const step = this.steer(dt);
      const p = this.position;
      _prev.copy(p);
      p.x += step.x * dt;
      p.z += step.z * dt;

      // The wreck's walls stop a crab the way they stop you: the breach is
      // the only way through.
      if (SL.Wreck) {
        const push = SL.Wreck.collide(p, _prev, this.bodyLength * 0.4, _wall);
        if (push) { p.x += push.x; p.z += push.z; }
      }
      if (SL.LobsterCave) {
        const push = SL.LobsterCave.collide(p, _prev, this.bodyLength * 0.4, _wall);
        if (push) { p.x += push.x; p.z += push.z; }
      }

      // Glued to the floor, which is the point of it.
      const ground = groundAt(p.x, p.z);
      p.y = SL.damp(p.y, ground + this.legHeight, 12, dt);

      const speed = Math.hypot(step.x, step.z);
      if (speed > 0.05) {
        const travel = Math.atan2(step.x, step.z);
        // A crab is carried side-on to the direction of travel. A lobster
        // walks forward - and escapes backward, with a flip of its tail, still
        // facing whatever frightened it.
        const face = !this.species.walksForward ? travel + this.sidleSign * Math.PI * 0.5
          : this.state === 'bolt' ? travel + Math.PI : travel;
        this.heading = SL.dampAngle(this.heading, face, 7, dt);
      }

      // Lean with the slope so it does not stand proud of a dune.
      const ahead = this.bodyLength * 0.6;
      const front = groundAt(p.x + Math.sin(this.heading) * ahead,
        p.z + Math.cos(this.heading) * ahead);
      const back = groundAt(p.x - Math.sin(this.heading) * ahead,
        p.z - Math.cos(this.heading) * ahead);

      this.object.rotation.set(0, 0, 0);
      this.object.rotateY(this.heading);
      this.object.rotateX(-Math.atan2(front - back, ahead * 2));

      // A quick scuttling bob, faster the faster it is going.
      this.scuttle += dt * (5 + speed * 3);
      this.object.position.y += Math.sin(this.scuttle) * 0.012 * Math.min(speed, 3);
      this.object.rotateZ(Math.sin(this.scuttle * 0.5) * 0.05 * Math.min(speed, 3));

      this.jawOpen = SL.damp(this.jawOpen, this.state === 'hide' ? 0 : 0.2, 3, dt);
      if (this.tailMesh) this.tailMesh.rotation.y = Math.sin(this.scuttle * 0.5) * 0.15;
    }

    /** The horizontal velocity it wants. */
    steer(dt) {
      const S = this.species;
      const player = this.game.player;
      const threat = player.dead ? null : player.position;
      const distance = threat ? threat.distanceTo(this.position) : Infinity;

      switch (this.state) {
        case 'refuge':
        case 'leaving': {
          // Walking a route: to the cave and in, or out and home. It runs
          // there, and ambles back.
          const dx = this.target.x - this.position.x;
          const dz = this.target.z - this.position.z;
          const gap = Math.hypot(dx, dz);
          if (gap < 0.8 || this.stateTimer > 60) {
            if (this.route && this.route.length && this.stateTimer <= 60) {
              this.target.copy(this.route.shift());
            } else if (this.state === 'refuge') {
              this.route = null;
              this.enterState('sheltered');
              this.shelterFor = SL.randRange(30, 60);
            } else {
              this.route = null;
              this.enterState('potter');
              this.pickTarget();
            }
            return _tmp.set(0, 0, 0);
          }
          const pace = this.state === 'refuge' ? S.sprintSpeed * 0.6 : S.cruiseSpeed * 1.5;
          return _tmp.set(dx / gap, 0, dz / gap).multiplyScalar(pace);
        }

        case 'sheltered': {
          // Tucked up in the cave until it feels safe again.
          if (this.stateTimer > this.shelterFor) {
            this.route = SL.LobsterCave.routeOut(this.home);
            this.target.copy(this.route.shift());
            this.enterState('leaving');
          }
          return _tmp.set(0, 0, 0);
        }

        case 'bolt': {
          // Straight away from whatever spooked it, at a fair clip.
          if (this.stateTimer > 3.5 || distance > SPOOK_RANGE * 2.2) {
            this.enterState('hide');
            return _tmp.set(0, 0, 0);
          }

          _away.subVectors(this.position, threat || this.home).setY(0);
          if (_away.lengthSq() < 1e-4) _away.set(1, 0, 0);
          _away.normalize();

          // Turned aside a little, so it scuttles off at an angle rather than
          // running in a straight line like something with a spine.
          const veer = this.sidleSign * 0.5;
          const x = _away.x * Math.cos(veer) - _away.z * Math.sin(veer);
          const z = _away.x * Math.sin(veer) + _away.z * Math.cos(veer);

          // It will not bolt out of its own biome.
          const next = _tmp.set(this.position.x + x * 3, 0, this.position.z + z * 3);
          if (!this.walksOn(next.x, next.z)) {
            this.sidleSign = -this.sidleSign;
          }

          return _tmp.set(x, 0, z).multiplyScalar(S.sprintSpeed);
        }

        case 'hide': {
          // Frozen. A stationary crab is a rock, and it knows it.
          if (distance < SPOOK_RANGE * 0.7) { this.enterState('bolt'); return _tmp.set(0, 0, 0); }
          if (this.stateTimer > SL.randRange(2, 5)) { this.enterState('potter'); this.pickTarget(); }
          return _tmp.set(0, 0, 0);
        }

        case 'potter':
        default: {
          this.senseTimer -= dt;
          if (this.senseTimer <= 0) {
            this.senseTimer = 0.25;
            if (distance < SPOOK_RANGE) { this.enterState('bolt'); return _tmp.set(0, 0, 0); }
          }

          // Off the sand somehow - a bolt carried it over the line, or the
          // ground shifted under it. Home is always in the shallows.
          if (!this.walksOn(this.position.x, this.position.z)) {
            _away.set(this.home.x - this.position.x, 0, this.home.z - this.position.z);
            if (_away.lengthSq() > 0.01) {
              return _away.normalize().multiplyScalar(S.cruiseSpeed * 1.6);
            }
          }

          const dx = this.target.x - this.position.x;
          const dz = this.target.z - this.position.z;
          const gap = Math.hypot(dx, dz);

          // On a route through the breach: straight on to the next point.
          if (gap < 1 && this.route && this.route.length) {
            const next = this.route.shift();
            this.target.set(next.x, 0, next.z);
            this.stateTimer = 0;
            return _tmp.set(0, 0, 0);
          }

          if (gap < 1 || this.stateTimer > (this.route ? 40 : 16)) {
            this.stateTimer = 0;
            this.pickTarget();
            // It stops a lot, and changes which way round it walks.
            if (SL.random() < 0.4) {
              this.sidleSign = SL.random() < 0.5 ? 1 : -1;
              return _tmp.set(0, 0, 0);
            }
          }

          if (gap < 0.01) return _tmp.set(0, 0, 0);
          return _tmp.set(dx / gap, 0, dz / gap).multiplyScalar(S.cruiseSpeed);
        }
      }
    }
  }

  SL.Craber = Craber;

  // ---------------------------------------------------------------------------

  const BIG_LABELS = {
    potter: 'pottering round its cave',
    watch: 'watching you',
    attack: 'throwing you out of its cave'
  };

  /**
   * The Big Lobster: two metres of lobster, and the cave is its.
   *
   * It never leaves. Come in and it turns to watch you. Come in after you
   * have hurt a lobster - any lobster, anywhere - and it comes for you with
   * its claws, until you are out of the door. Then it lets it go.
   */
  class BigLobster extends Craber {
    constructor(game) {
      const cave = SL.LobsterCave;
      const spot = cave.innerSpot(new THREE.Vector3());
      super(game, spot.x, spot.z, SL.Species.byId.biglobster);
      this.pinchCooldown = 0;
      this.state = 'potter';
      this.pickTarget();
    }

    get stateLabel() { return BIG_LABELS[this.state] || ''; }
    get hunting() { return this.state === 'attack' && !this.dead; }

    walksOn(x, z) { return SL.LobsterCave.insideXZ(x, z, 2.2); }

    pickTarget() {
      this.route = null;
      if (SL.LobsterCave && SL.LobsterCave.placed) SL.LobsterCave.innerSpot(this.target);
    }

    /** It does not run. Hurting it is hurting a lobster. */
    onHurt(damage, source) {
      if (source && source === this.game.player) SL.LobsterCave.wronged(this.game);
    }
    provoke() {}
    onDeath() {}

    steer(dt) {
      const S = this.species;
      const cave = SL.LobsterCave;
      const player = this.game.player;
      const p = this.position;
      this.pinchCooldown = Math.max(0, this.pinchCooldown - dt);

      const intruder = !player.dead && cave.isInside(player.position);
      let want = null;

      if (intruder && cave.grudge) {
        if (this.state !== 'attack') {
          this.enterState('attack');
          this.game.hud.toast('The Big Lobster wants you out of its cave');
        }
        cave.chased = true;
        const dx = player.position.x - p.x, dz = player.position.z - p.z;
        const flat = Math.hypot(dx, dz);
        const rise = player.position.y - p.y;
        // A long reach: it rears up on its tail to get at a diver overhead.
        const reach = this.bodyLength * 0.6 + 1.2;
        if (flat < reach && rise < 3.6 && this.pinchCooldown <= 0) {
          this.pinchCooldown = 1.6;
          player.hurt(S.biteDamage, this);
        }
        const speed = flat > reach * 0.7 ? S.sprintSpeed : 0;
        want = flat > 1e-3 ? _tmp.set(dx / flat * speed, 0, dz / flat * speed) : _tmp.set(0, 0, 0);
      } else {
        if (this.state === 'attack') {
          this.enterState('potter');
          this.pickTarget();
          // Seen off. It lets it go - until the next lobster.
          if (cave.chased && !player.dead) {
            cave.grudge = false;
            this.game.hud.toast('The Big Lobster lets you go');
          }
          cave.chased = false;
        }
        if (intruder) {
          // It turns to keep you in front of it, and edges a little closer.
          this.enterState('watch');
          const dx = player.position.x - p.x, dz = player.position.z - p.z;
          const flat = Math.hypot(dx, dz);
          const speed = flat > 4 ? S.cruiseSpeed * 0.5 : 0.06;
          want = flat > 1e-3 ? _tmp.set(dx / flat * speed, 0, dz / flat * speed) : _tmp.set(0, 0, 0);
        } else {
          if (this.state === 'watch') { this.enterState('potter'); this.pickTarget(); }
          const dx = this.target.x - p.x, dz = this.target.z - p.z;
          const gap = Math.hypot(dx, dz);
          if (gap < 0.8 || this.stateTimer > 20) {
            this.stateTimer = 0;
            this.pickTarget();
            return _tmp.set(0, 0, 0);
          }
          want = _tmp.set(dx / gap, 0, dz / gap).multiplyScalar(S.cruiseSpeed);
        }
      }

      // It keeps to the back of its cave, well clear of the walls and never
      // out of the door: anything taking it outward past that line is cut.
      const ox = p.x - cave.layout.x, oz = p.z - cave.layout.z;
      const out = Math.hypot(ox, oz);
      const limit = cave.layout.R - 2.2;
      if (out > limit - 0.3) {
        const nx = ox / out, nz = oz / out;
        const radial = want.x * nx + want.z * nz;
        if (radial > 0) { want.x -= nx * radial; want.z -= nz * radial; }
        if (out > limit) { want.x -= nx * (out - limit) * 2; want.z -= nz * (out - limit) * 2; }
      }
      return want;
    }
  }

  SL.BigLobster = BigLobster;

  // ---------------------------------------------------------------------------

  const _n = new THREE.Vector3();
  const _f = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const _basis = new THREE.Matrix4();

  const SCRAP_LABELS = {
    cling: 'clinging to the hull',
    creep: 'creeping over the plates',
    freeze: 'holding very still',
    scuttle: 'scuttling round the hull'
  };

  /**
   * The Scrap Crab: a crab that lives on the wreck, and only on the wreck.
   *
   * It walks the outside of the hull - up the sides, over the top, round the
   * curve - and never lets go of it. Its position is not a point in the water
   * at all but a place on the plates, a distance along the hull and an angle
   * round it, so there is no way for it to come off: everything about where
   * it is and which way up it stands is worked out from that each frame.
   *
   * Something coming close makes it hold very still. Something hitting it
   * makes it scuttle round to the far side of the hull.
   */
  class ScrapCrab extends SL.Creature {
    constructor(game, a, phi) {
      const at = SL.Wreck.hullPoint(a, phi, 0.1, new THREE.Vector3());
      super(game, SL.Species.scrapcrab, at.x, at.y, at.z);
      this.a = a;
      this.phi = phi;
      this.targetA = a;
      this.targetPhi = phi;
      this.state = 'cling';
      this.stateTimer = SL.randRange(0, 12);
      this.restFor = SL.randRange(6, 20);
      this.facing = new THREE.Vector3(1, 0, 0);
      this.scuttle = SL.random() * Math.PI * 2;
      this.fallSpeed = 0;
      this.place(0);
    }

    get stateLabel() { return SCRAP_LABELS[this.state] || ''; }
    get legHeight() { return this.bodyLength * (this.species.shape.legStance || 0.22); }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Hit, it runs round to the far side of the hull. */
    onHurt() {
      this.targetPhi = SL.clamp(-this.phi + SL.randRange(-0.3, 0.3), -SL.Wreck.skin.phiMax, SL.Wreck.skin.phiMax);
      this.targetA = SL.clamp(this.a + SL.randRange(-3, 3), SL.Wreck.skin.aMin, SL.Wreck.skin.aMax);
      this.enterState('scuttle');
    }
    provoke() { this.onHurt(); }

    onDeath(killer) {
      // It is half made of the wreck.
      if (killer === this.game.player) SL.Pickup.burst(this.game, 'titanium', this.position, SL.randInt(1, 2));
    }

    /** Somewhere else on the plates. */
    pickSpot() {
      const skin = SL.Wreck.skin;
      for (let tries = 0; tries < 12; tries++) {
        const a = SL.clamp(this.a + SL.randRange(-5, 5), skin.aMin, skin.aMax);
        const phi = SL.clamp(this.phi + SL.randRange(-0.9, 0.9), -skin.phiMax, skin.phiMax);
        if (!SL.Wreck.skinFree(a, phi)) continue;
        this.targetA = a; this.targetPhi = phi;
        return;
      }
    }

    /** Puts the body on the plates, standing out from them, facing its way. */
    place(speed) {
      SL.Wreck.hullPoint(this.a, this.phi, this.legHeight, this.object.position);
      SL.Wreck.hullNormal(this.phi, _n);
      // Keep facing its last direction of travel, laid flat against the hull.
      _f.copy(this.facing).addScaledVector(_n, -this.facing.dot(_n));
      if (_f.lengthSq() < 1e-6) _f.set(0, 0, 1).addScaledVector(_n, -_n.z);
      _f.normalize();
      _r.crossVectors(_n, _f).normalize();
      _basis.makeBasis(_r, _n, _f);
      this.object.quaternion.setFromRotationMatrix(_basis);

      // The scuttling bob, straight out from the plates.
      this.scuttle += 0.016 * (5 + speed * 3);
      this.object.position.addScaledVector(_n, Math.sin(this.scuttle) * 0.01 * Math.min(speed * 4, 3));
    }

    update(dt) {
      if (this.dead) {
        // Lets go, at last, and falls to the sand.
        this.deathTimer += dt;
        const p = this.position;
        const floor = SL.Terrain ? SL.Terrain.surfaceAt(p.x, p.z) : SL.Biomes.floorHeightAt(p.x, p.z);
        if (p.y > floor + 0.1) { this.fallSpeed += 3 * dt; p.y = Math.max(floor + 0.1, p.y - this.fallSpeed * dt); }
        this.object.rotation.z = SL.damp(this.object.rotation.z, Math.PI, 1.4, dt);
        if (this.deathTimer > 12) this.destroy();
        return;
      }

      this.stateTimer += dt;
      const S = this.species;
      const player = this.game.player;
      const near = !player.dead && player.position.distanceTo(this.position) < 4;

      let speed = 0;
      if (this.state === 'scuttle') {
        speed = S.sprintSpeed;
        if (this.stateTimer > 6) this.enterState('cling');
      } else if (near) {
        this.enterState('freeze');
      } else if (this.state === 'freeze') {
        if (this.stateTimer > 2) this.enterState('cling');
      } else if (this.state === 'cling') {
        if (this.stateTimer > this.restFor) {
          this.pickSpot();
          this.enterState('creep');
        }
      } else {
        speed = S.cruiseSpeed;
      }

      if (speed > 0) {
        const R = SL.Wreck.layout.radius;
        const da = this.targetA - this.a;
        const darc = (this.targetPhi - this.phi) * R;
        const gap = Math.hypot(da, darc);
        if (gap < 0.08) {
          if (this.state === 'creep') { this.restFor = SL.randRange(6, 22); this.enterState('cling'); }
        } else {
          const step = Math.min(gap, speed * dt);
          this.a += (da / gap) * step;
          this.phi += (darc / gap) * step / R;
          SL.Wreck.hullTangent(this.phi, da, darc, this.facing).normalize();
        }
      }

      this.place(speed);
      this.jawOpen = SL.damp(this.jawOpen, this.state === 'freeze' ? 0 : 0.2, 3, dt);
    }
  }

  SL.ScrapCrab = ScrapCrab;
})(window.SL);
