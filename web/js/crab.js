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
    hide: 'sitting very still'
  };

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

    /** Anything that hits it makes it run, and it has nothing to fight with. */
    onHurt() { this.enterState('bolt'); this.stateTimer = 0; }
    provoke() { this.onHurt(); }

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

      // Glued to the floor, which is the point of it.
      const ground = groundAt(p.x, p.z);
      p.y = SL.damp(p.y, ground + this.legHeight, 12, dt);

      const speed = Math.hypot(step.x, step.z);
      if (speed > 0.05) {
        // Carried side-on to the direction of travel.
        const travel = Math.atan2(step.x, step.z);
        this.heading = SL.dampAngle(this.heading,
          travel + this.sidleSign * Math.PI * 0.5, 7, dt);
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
})(window.SL);
