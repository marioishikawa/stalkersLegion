/**
 * Everything that swims.
 *
 * Creatures integrate their own velocity and stay between the sea floor and the
 * surface analytically - no physics, no navmesh (open water has no walkable
 * surface), no raycasts. Subclasses only supply a desired velocity, and the AI
 * that produces it runs a few times a second rather than every frame.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _ahead = new THREE.Vector3();
  const _look = new THREE.Vector3();
  const _shore = new THREE.Vector3();

  class Creature {
    constructor(game, species, x, y, z) {
      this.game = game;
      this.species = species;
      this.health = species.maxHealth;
      this.dead = false;
      this.deathTimer = 0;

      this.velocity = new THREE.Vector3(0, 0, 1).multiplyScalar(species.cruiseSpeed);
      this.territory = new THREE.Vector3(x, y, z);
      this.territoryRadius = 22;

      this.exertion = 1;
      this.swimPhase = Math.random() * Math.PI * 2;
      this.jawOpen = 0;

      const built = SL.buildBody(species);
      this.bodyLength = built.length;
      this.radius = built.radius;

      this.object = new THREE.Group();
      this.object.position.set(x, y, z);

      const material = species.glow > 0.35 ? game.materials.glow : game.materials.surface;

      // Most bodies are a single mesh. A serpentine one comes back as a chain
      // of links, each parented to the one ahead of it, so yawing a joint
      // carries everything behind it - which is how a wave gets down a spine
      // with no skeleton to put it there.
      this.segmentMeshes = [];
      let parent = this.object;
      for (let i = 0; i < built.segments.length; i++) {
        const mesh = new THREE.Mesh(built.segments[i].geometry, material);
        if (i === 0) mesh.position.copy(built.rootOffset);
        else mesh.position.set(0, 0, -built.segments[i - 1].span);
        parent.add(mesh);
        parent = mesh;
        this.segmentMeshes.push(mesh);
      }
      this.bodyMesh = this.segmentMeshes[0];
      this.segmented = this.segmentMeshes.length > 1;

      // On a rigid animal the tail and jaw hang off the creature itself, as
      // they always have. On a chain they ride the link they grow out of.
      this.tailMesh = new THREE.Mesh(built.tail, material);
      this.tailMesh.position.copy(built.tailPivot);
      (this.segmented ? this.segmentMeshes[built.tailSegment] : this.object).add(this.tailMesh);

      if (built.jaw) {
        this.jawMesh = new THREE.Mesh(built.jaw, game.materials.surface);
        this.jawMesh.position.copy(built.jawPivot);
        (this.segmented ? this.segmentMeshes[built.jawSegment] : this.object).add(this.jawMesh);
      }

      game.addToWorld(this.object);
    }

    get position() { return this.object.position; }

    /** Subclass hook: the velocity this creature wants, in world space. */
    desiredVelocity(dt) { return _tmp.set(0, 0, 0); }

    /** Subclass hook: whether this creature simply cannot be hurt by someone. */
    immuneTo(source) { return false; }

    /**
     * How hard its bite throws the diver, as a multiple of the usual shove.
     * Zero means the damage lands and the diver stays where they were.
     */
    get knockback() { return 1; }

    /**
     * How much of a collision with the diver the diver absorbs. One is solid:
     * they bounce off it. Zero lets it walk through them without pushing them
     * around, for something big enough that being barged by it is worse than
     * the bite.
     */
    get diverPush() { return 1; }
    onHurt(damage, source) {}
    onDeath(killer) {}

    hurt(damage, source) {
      if (this.dead || damage <= 0) return;
      this.health -= damage;

      // Knocked back along the hit direction, so strikes feel like they land.
      if (source) {
        _tmp.subVectors(this.position, source.position || source).normalize();
        this.velocity.addScaledVector(_tmp, 2.6);
      }

      if (this.health <= 0) {
        this.health = 0;
        this.dead = true;
        this.deathTimer = 0;
        this.jawOpen = 0;
        this.onDeath(source);
        // A leviathan you killed is a leviathan you catalogued.
        if (SL.Quest) SL.Quest.recordKill(this.game, this.species, source);
      } else {
        this.onHurt(damage, source);
      }
    }

    /** Keeps the creature off the floor, under the surface and inside the world. */
    avoidEnvironment(desired) {
      const p = this.position;
      const speed = Math.max(this.species.cruiseSpeed, 0.1);

      // Fish do not fly. Everything below steers them away from the shallows,
      // but steering takes time and there is no version of this where one ends
      // up over the beach and that is acceptable, so the surface is a hard lid
      // as well. Air breathers are on their own - going up is the point.
      if (!this.isMammal && this.state !== 'surfacing' && p.y > SL.WATER_LEVEL - 0.15) {
        p.y = SL.WATER_LEVEL - 0.15;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }

      // Sea floor: look ahead so fast swimmers pull up in time.
      _ahead.copy(desired).normalize().multiplyScalar(Math.max(1.2, this.bodyLength * 2)).add(p);
      const floor = Math.max(
        SL.Biomes.floorHeightAt(p.x, p.z),
        SL.Biomes.floorHeightAt(_ahead.x, _ahead.z));
      const clearance = Math.max(0.6, this.bodyLength * 0.6);
      const ceiling = SL.WATER_LEVEL - (this.isMammal ? 0.35 : 1.2);

      if (floor + clearance > ceiling) {
        // The ground ahead has run out of water over it.
        //
        // Climbing is the answer to a seamount because there is always sea
        // above it. The islet is the one place where there is not: its slope
        // comes clean out of the water, and a fish that treated it as just
        // another hill swam up the beach and carried on over the island. So
        // where the water runs out the shore is a wall, not a slope - it gets
        // turned away from rather than climbed.
        const probe = Math.max(3, this.bodyLength * 2);
        const uphillX = SL.Biomes.floorHeightAt(p.x + probe, p.z) - SL.Biomes.floorHeightAt(p.x - probe, p.z);
        const uphillZ = SL.Biomes.floorHeightAt(p.x, p.z + probe) - SL.Biomes.floorHeightAt(p.x, p.z - probe);
        const steepness = Math.hypot(uphillX, uphillZ);
        if (steepness > 1e-4) {
          desired.addScaledVector(
            _shore.set(-uphillX / steepness, 0, -uphillZ / steepness), speed * 2.2);
        }
        desired.y = Math.min(desired.y, 0);
      } else if (p.y < floor + clearance) {
        desired.y += speed * SL.clamp((floor + clearance - p.y) / clearance, 0, 2) * 1.6;
      }

      // Surface: fish are held under it, but an air breather on its way up is
      // allowed through - that is the whole point of the climb.
      if (p.y > ceiling && this.state !== 'surfacing') {
        desired.y -= speed * SL.clamp((p.y - ceiling) / 2, 0, 2) * 1.6;
      }

      // World bounds: turn back rather than swimming off the map.
      const distance = Math.hypot(p.x, p.z);
      if (distance > SL.WORLD_RADIUS) {
        const urgency = SL.clamp((distance - SL.WORLD_RADIUS) / 8, 0, 1);
        desired.lerp(_tmp.set(-p.x, 0, -p.z).normalize().multiplyScalar(speed), urgency);
      }

      return desired;
    }

    update(dt) {
      if (this.dead) return this.updateDeath(dt);

      const desired = this.avoidEnvironment(this.desiredVelocity(dt));
      const desiredSpeed = desired.length();

      if (desiredSpeed > 1e-4) {
        // The turn rate limits how fast the heading can rotate, which is what
        // gives each species its handling - darters snap, gulpers lumber.
        const maxTurn = this.species.turnRate * dt;
        _tmp.copy(desired).divideScalar(desiredSpeed);

        const current = this.velocity.lengthSq() > 1e-6
          ? _look.copy(this.velocity).normalize()
          : _look.set(0, 0, 1);

        const angle = Math.acos(SL.clamp(current.dot(_tmp), -1, 1));
        if (angle > 1e-4) current.lerp(_tmp, SL.clamp(maxTurn / angle, 0, 1)).normalize();

        const target = Math.min(desiredSpeed, this.species.sprintSpeed);
        const speed = SL.damp(this.velocity.length(), target, 2.5, dt);
        this.velocity.copy(current).multiplyScalar(speed);
        this.exertion = SL.clamp(speed / Math.max(this.species.cruiseSpeed, 0.1), 0.2, 2.2);
      } else {
        this.velocity.multiplyScalar(Math.max(0, 1 - 1.2 * dt));
        this.exertion = SL.damp(this.exertion, 0.25, 2, dt);
      }

      this.object.position.addScaledVector(this.velocity, dt);

      // Checked again on the way out. Far-off fish are stepped in catch-up
      // jumps of up to four tenths of a second, which is long enough for a
      // fast one to finish a step in mid-air over the beach and stay there
      // until its next turn comes round.
      if (!this.isMammal && this.state !== 'surfacing'
        && this.object.position.y > SL.WATER_LEVEL - 0.15) {
        this.object.position.y = SL.WATER_LEVEL - 0.15;
        if (this.velocity.y > 0) this.velocity.y = 0;
      }

      if (this.velocity.lengthSq() > 1e-6) {
        _look.copy(this.position).add(this.velocity);
        this.object.lookAt(_look);
      }

      this.animate(dt);
    }

    /**
     * No skeleton: the body yaws gently and the tail follows a beat behind,
     * which reads convincingly as swimming for almost no CPU.
     *
     * A segmented body gets the same idea taken all the way down its length -
     * every joint repeats its neighbour a beat later, which is a wave
     * travelling from head to tail, which is a snake swimming.
     */
    animate(dt) {
      this.swimPhase += dt * this.species.wagRate * SL.clamp(this.exertion, 0.3, 2.2);
      const amp = SL.clamp(this.exertion, 0.3, 1.8);

      if (this.segmented) {
        const links = this.segmentMeshes.length;
        // Just over a wavelength along the body: enough for a clear S, not so
        // much that the animal ties itself in a knot.
        const lag = (Math.PI * 2 * 1.25) / links;
        const swing = (this.species.shape.bodySwing || 0.24) * amp;

        // The head barely moves and the tail end throws itself about, which is
        // the difference between a snake swimming and a rope being shaken.
        this.segmentMeshes[0].rotation.y = Math.sin(this.swimPhase) * swing * 0.3;
        for (let i = 1; i < links; i++) {
          const along = i / (links - 1);
          this.segmentMeshes[i].rotation.y =
            Math.sin(this.swimPhase - i * lag) * swing * (0.45 + 0.55 * along);
        }
      } else {
        this.bodyMesh.rotation.y = Math.sin(this.swimPhase) * 0.07 * amp;
      }

      this.tailMesh.rotation.y = Math.sin(this.swimPhase - 0.9) * 0.38 * amp;
      if (this.jawMesh) this.jawMesh.rotation.x = this.jawOpen * 0.55;
    }

    updateDeath(dt) {
      this.deathTimer += dt;

      // Roll belly-up and sink, then clean up once out of sight.
      this.object.rotation.z = SL.damp(this.object.rotation.z, Math.PI, 1.2, dt);

      const p = this.position;
      const floor = SL.Biomes.floorHeightAt(p.x, p.z);
      if (p.y > floor + this.bodyLength * 0.25) {
        p.y -= Math.min(0.55, 0.18 + this.deathTimer * 0.14) * dt * 3;
      }

      if (this.deathTimer > 14) this.destroy();
    }

    destroy() {
      if (this.object.parent) this.object.parent.remove(this.object);

      for (const list of [this.game.fish, this.game.stalkers, this.game.kings,
        this.game.whales, this.game.puffers, this.game.kelperLevs,
        this.game.kelpers, this.game.carnis, this.game.carniLevs,
        this.game.crabers, this.game.glowLevs, this.game.diamondLevs,
        this.game.pets]) {
        const i = list.indexOf(this);
        if (i >= 0) { list.splice(i, 1); return; }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Fish: prey
  // ---------------------------------------------------------------------------

  class Fish extends Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);

      // Mammals carry a lungful rather than gills. Staggered at spawn so a pod
      // does not all surface on the same tick.
      this.isMammal = species.diet === 'mammal';
      this.breath = species.breathSeconds
        ? species.breathSeconds * SL.randRange(0.35, 1)
        : 0;

      // Porpoises call to each other while they work, not only at the surface.
      this.callTimer = species.callInterval
        ? SL.randRange(species.callInterval[0], species.callInterval[1])
        : 0;

      // Some fish blow bubbles as they go. Staggered so a school does not puff
      // in unison.
      this.bubbleTimer = species.bubbleInterval
        ? SL.randRange(0, species.bubbleInterval[1])
        : 0;

      this.state = 'cruise';
      this.leader = null;
      this.slot = new THREE.Vector3();
      this.wanderTarget = new THREE.Vector3();
      this.fleeFrom = new THREE.Vector3();
      this.fleeTimer = 0;
      this.senseTimer = Math.random() * 0.5;
      this.stateTimer = 0;
      this.noise = Math.random() * 1000;
      this.chooseWanderTarget();
    }

    setLeader(leader, slot) { this.leader = leader; this.slot.copy(slot); }

    startle(from, duration) {
      if (this.dead) return;
      this.fleeFrom.copy(from);
      this.fleeTimer = Math.max(this.fleeTimer, duration);
      this.state = 'flee';
    }

    onHurt(damage, source) {
      if (source) this.startle(source.position || source, 6);
    }

    onDeath(killer) {
      // Crystal-biome fish are made of the thing you are there to collect.
      const drops = this.species.drops;
      if (!drops || killer !== this.game.player) return;

      for (const type of Object.keys(drops)) {
        const [low, high] = drops[type];
        SL.Pickup.burst(this.game, type, this.position, SL.randInt(low, high));
      }
    }

    /** Cheap periodic threat scan; full-rate scanning is wasted on prey. */
    sense() {
      const p = this.position;
      const r = this.species.senseRadius;

      // Stalkers are the thing fish actually fear.
      for (const stalker of this.game.stalkers) {
        if (stalker.dead) continue;
        if (stalker.position.distanceToSquared(p) < r * r) {
          this.startle(stalker.position, 3.5);
          return;
        }
      }

      // The player counts too, but only up close - otherwise the shallows would
      // empty out the moment you arrived.
      const player = this.game.player;
      const personal = r * 0.3;
      if (player && player.position.distanceToSquared(p) < personal * personal) {
        this.startle(player.position, 2);
      }
    }

    chooseWanderTarget() {
      const angle = Math.random() * Math.PI * 2;
      const dist = SL.randRange(this.territoryRadius * 0.2, this.territoryRadius);
      const x = this.territory.x + Math.cos(angle) * dist;
      const z = this.territory.z + Math.sin(angle) * dist;
      const floor = SL.Biomes.floorHeightAt(x, z);
      const altitude = this.species.altitude * SL.randRange(0.6, 1.5);
      this.wanderTarget.set(x, Math.min(floor + altitude, SL.WATER_LEVEL - 2.5), z);
    }

    desiredVelocity(dt) {
      const p = this.position;

      this.senseTimer -= dt;
      if (this.senseTimer <= 0) { this.senseTimer = SL.randRange(0.3, 0.6); this.sense(); }
      this.stateTimer += dt;

      // --- Bubbles ------------------------------------------------------------
      //
      // Only worth spending on when someone is there to see them, so they are
      // skipped entirely past the fog.
      if (this.species.bubbleInterval && !this.dead) {
        this.bubbleTimer -= dt;
        if (this.bubbleTimer <= 0) {
          const [low, high] = this.species.bubbleInterval;
          // Startled fish blow far harder - it is what the bubbles are for.
          const panicking = this.fleeTimer > 0;
          this.bubbleTimer = panicking ? SL.randRange(low * 0.25, low * 0.5)
            : SL.randRange(low, high);

          if (this.game.distanceToPlayer(p) < 42) {
            // Out of the mouth, which is the nose end of a nose-forward body.
            _look.set(0, 0, this.bodyLength * 0.46).applyQuaternion(this.object.quaternion).add(p);
            SL.Bubbles.puff(this.game, _look, panicking ? SL.randInt(4, 7) : SL.randInt(1, 3),
              this.bodyLength * 0.16, this.bodyLength * 0.09);
          }
        }
      }

      // --- Breathing ----------------------------------------------------------
      //
      // An air breather that is running out of air stops caring about anything
      // else and climbs. It is the one thing that outranks fleeing.
      if (this.isMammal) {
        this.breath -= dt;

        const atSurface = p.y > SL.WATER_LEVEL - 1.4;
        if (atSurface && this.breath < this.species.breathSeconds) {
          // Break the surface, blow, and go back down with a full lungful.
          this.breath = this.species.breathSeconds;
          this.state = 'cruise';
          this.surfacedAt = this.game.time;
          this.game.audio.blow(this.game.distanceToPlayer(p));
        }

        // Idle calling, for the ones that have a voice for it.
        if (this.species.voice === 'whistle' && this.callTimer > 0) {
          this.callTimer -= dt;
          if (this.callTimer <= 0) {
            const [low, high] = this.species.callInterval;
            this.callTimer = SL.randRange(low, high);
            this.game.audio.dolphinWhistle(this.game.distanceToPlayer(p));
          }
        }

        // Start climbing with enough air left to actually get there.
        const climbDepth = SL.WATER_LEVEL - p.y;
        if (this.breath < 12 + climbDepth * 0.35) {
          this.state = 'surfacing';
          const rise = _tmp.set(0, 1, 0);
          // Keep a little forward motion so the climb reads as swimming.
          return rise.multiplyScalar(this.species.sprintSpeed * 0.75)
            .addScaledVector(_look.copy(this.velocity).setY(0).normalize(),
              this.species.cruiseSpeed * 0.5);
        }
      }

      // --- Fleeing ------------------------------------------------------------
      if (this.fleeTimer > 0) {
        this.fleeTimer -= dt;
        this.state = 'flee';

        _tmp.subVectors(p, this.fleeFrom);
        _tmp.y += 0.6;            // prey breaks upward as well as away
        _tmp.normalize();

        // Weave while fleeing, so the escape is not a straight, easy line.
        const weave = Math.sin(this.game.time * 6 + this.noise);
        _look.set(-_tmp.z, 0, _tmp.x).multiplyScalar(weave * 0.45);

        if (this.fleeTimer <= 0) { this.state = 'cruise'; this.chooseWanderTarget(); this.stateTimer = 0; }
        return _tmp.add(_look).normalize().multiplyScalar(this.species.sprintSpeed);
      }

      // --- Following a leader ---------------------------------------------------
      if (this.leader) {
        if (!this.leader.dead) {
          // Hold a slot behind and beside the leader, in the leader's frame.
          _look.copy(this.slot).applyQuaternion(this.leader.object.quaternion).add(this.leader.position);
          _tmp.subVectors(_look, p);
          const distance = _tmp.length();

          const catchup = SL.clamp((distance - 0.6) / 8.4, 0, 1);
          const speed = SL.lerp(this.species.cruiseSpeed * 0.55, this.species.sprintSpeed, catchup);

          // Independent drift keeps the school from looking rigid.
          const t = this.game.time;
          _look.set(Math.sin(t * 0.9 + this.noise), Math.sin(t * 1.3 + this.noise * 0.6) * 0.5,
            Math.cos(t * 0.7 + this.noise * 1.3)).multiplyScalar(0.4);

          return _tmp.normalize().multiplyScalar(speed).add(_look);
        }
        this.leader = null;        // on its own now
        this.chooseWanderTarget();
      }

      // --- Wandering -------------------------------------------------------------
      _tmp.subVectors(this.wanderTarget, p);
      if (_tmp.lengthSq() < 3.2 || this.stateTimer > 12) {
        this.stateTimer = 0;
        if (this.state !== 'graze' && Math.random() < 0.35) {
          // Grazers periodically drop to the floor to pick at it.
          this.state = 'graze';
          const x = p.x + SL.randRange(-3, 3);
          const z = p.z + SL.randRange(-3, 3);
          this.wanderTarget.set(x, SL.Biomes.floorHeightAt(x, z) + SL.randRange(0.4, 1.1), z);
        } else {
          this.state = 'cruise';
          this.chooseWanderTarget();
        }
        _tmp.subVectors(this.wanderTarget, p);
      }

      const speed = this.state === 'graze' ? this.species.cruiseSpeed * 0.45 : this.species.cruiseSpeed;
      return _tmp.normalize().multiplyScalar(speed);
    }
  }

  // ---------------------------------------------------------------------------
  // Stalker: the predator
  // ---------------------------------------------------------------------------

  const BITES_BEFORE_CARRY = 3;
  const SCRAP_BITE_DAMAGE = 14;

  const STATE_LABELS = {
    patrol: 'patrolling',
    seekScrap: 'drawn to scrap',
    chewScrap: 'chewing metal',
    carryScrap: 'carrying scrap',
    huntFish: 'hunting',
    feed: 'feeding',
    attack: 'attacking you',
    veerOff: 'circling back',
    retreat: 'retreating'
  };

  class Stalker extends Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 26;
      this.state = 'patrol';
      this.stateTimer = 0;
      this.senseTimer = Math.random() * 0.35;
      this.biteCooldown = 0;
      this.aggro = 0;
      this.scrapBites = 0;
      this.snap = 0;

      this.targetScrap = null;
      this.carriedScrap = null;
      this.targetFish = null;
      this.threat = null;

      this.patrolTarget = new THREE.Vector3(x, y, z);
      this.carryDestination = new THREE.Vector3();

      // Scrap is carried in the jaws, just in front of the head.
      this.carryPoint = new THREE.Object3D();
      this.carryPoint.position.set(0, -this.bodyLength * 0.04, this.bodyLength * 0.34);
      this.object.add(this.carryPoint);
    }

    get stateLabel() { return STATE_LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.75 + 0.9; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;

      if (state === 'carryScrap') {
        // Scrap belongs to the king. A stalker that has a king to serve hauls
        // the piece out to the hoard; one with no king dumps it nearby.
        const king = this.game.kings.find((k) => !k.dead);
        this.tribute = !!king;

        if (king) {
          this.carryDestination.copy(king.hoard);
          this.carryDestination.y += 2;
        } else {
          const angle = Math.random() * Math.PI * 2;
          const dist = SL.randRange(this.territoryRadius * 0.4, this.territoryRadius);
          const x = this.territory.x + Math.cos(angle) * dist;
          const z = this.territory.z + Math.sin(angle) * dist;
          this.carryDestination.set(x, SL.Biomes.floorHeightAt(x, z) + 2.6, z);
        }
      }
    }

    /** Makes this stalker treat something as a threat worth attacking. */
    provoke(threat) {
      if (this.dead || !threat) return;
      this.threat = threat;
      this.aggro = Math.max(this.aggro, 12);
      // Dropping what it was chewing is what sells the switch to aggression.
      if (this.carriedScrap) this.releaseScrap(new THREE.Vector3(0, -0.4, 0));
      this.enterState('attack');
    }

    onHurt(damage, source) {
      // Badly hurt stalkers break off; otherwise they turn on whoever hit them.
      if (this.health < this.species.maxHealth * 0.25) {
        this.threat = source;
        this.enterState('retreat');
      } else if (source) {
        this.provoke(source);
      }
    }

    onDeath() {
      if (this.carriedScrap) this.releaseScrap(new THREE.Vector3());
      SL.Pickup.burst(this.game, 'tooth', this.position, SL.randInt(3, 5));
      SL.Pickup.burst(this.game, 'titanium', this.position, 1);
    }

    grabScrap(scrap) {
      if (!scrap || scrap.isHeld) return;
      this.carriedScrap = scrap;
      scrap.carriedBy(this, this.carryPoint, new THREE.Vector3(0, 0, 0));
      this.jawOpen = 0.45;
    }

    releaseScrap(toss) {
      if (this.carriedScrap) this.carriedScrap.drop(toss);
      this.carriedScrap = null;
      this.targetScrap = null;
      this.scrapBites = 0;
      this.jawOpen = 0;
    }

    /** The priority ladder, re-run a few times a second. */
    sense() {
      const p = this.position;
      const sense = this.species.senseRadius;

      // 1. An active threat outranks everything.
      if (this.aggro > 0 && this.threat && !this.threat.dead) {
        if (this.threat.position.distanceTo(p) < sense * 1.5) {
          if (this.state !== 'retreat' && this.state !== 'veerOff') this.enterState('attack');
          return;
        }
        this.aggro = 0;
        this.threat = null;
      }

      // 2. Busy states run to completion.
      if (this.state === 'chewScrap' || this.state === 'carryScrap'
        || this.state === 'feed' || this.state === 'retreat'
        || this.state === 'veerOff') return;

      // 3. The player, if close.
      const player = this.game.player;
      if (player && !player.dead && player.position.distanceTo(p) < sense * 0.45) {
        this.threat = player;
        this.aggro = 8;
        this.enterState('attack');
        return;
      }

      // 4. Scrap metal: the obsession.
      const scrap = SL.Scrap.findNearest(this.game, p, sense * 1.6);
      if (scrap) { this.targetScrap = scrap; this.enterState('seekScrap'); return; }

      // 5. Prey.
      let closest = null, closestDist = sense * sense;
      for (const fish of this.game.fish) {
        if (fish.dead) continue;
        const d = fish.position.distanceToSquared(p);
        if (d < closestDist) { closestDist = d; closest = fish; }
      }
      if (closest) { this.targetFish = closest; this.enterState('huntFish'); return; }

      this.enterState('patrol');
    }

    steerTo(target, speed) {
      return _tmp.subVectors(target, this.position).normalize().multiplyScalar(speed);
    }

    newPatrolTarget() {
      const angle = Math.random() * Math.PI * 2;
      const dist = SL.randRange(this.territoryRadius * 0.3, this.territoryRadius);
      const x = this.territory.x + Math.cos(angle) * dist;
      const z = this.territory.z + Math.sin(angle) * dist;
      this.patrolTarget.set(x, SL.Biomes.floorHeightAt(x, z) + SL.randRange(2, 7), z);
    }

    desiredVelocity(dt) {
      const p = this.position;
      const S = this.species;

      this.senseTimer -= dt;
      if (this.senseTimer <= 0) { this.senseTimer = 0.35; this.sense(); }

      this.stateTimer += dt;
      this.aggro = Math.max(0, this.aggro - dt);
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      if (this.snap > 0) { this.snap -= dt; this.jawOpen = Math.max(0, this.jawOpen - dt * 6); }

      switch (this.state) {
        case 'patrol': {
          if (this.patrolTarget.distanceToSquared(p) < 16 || this.stateTimer > 14) {
            this.stateTimer = 0;
            this.newPatrolTarget();
          }
          return this.steerTo(this.patrolTarget, S.cruiseSpeed);
        }

        case 'seekScrap': {
          const scrap = this.targetScrap;
          if (!scrap || scrap.dead || scrap.isHeld) {
            this.targetScrap = null;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          const distance = scrap.position.distanceTo(p);
          // Jaws start opening on the approach.
          this.jawOpen = SL.damp(this.jawOpen, distance < 5 ? 0.7 : 0.15, 4, dt);

          if (distance < this.biteReach) { this.enterState('chewScrap'); return _tmp.set(0, 0, 0); }

          // Approach from slightly above, the way a real ambusher would.
          _look.copy(scrap.position); _look.y += this.bodyLength * 0.25;
          return this.steerTo(_look, SL.lerp(S.cruiseSpeed, S.sprintSpeed, 0.5));
        }

        case 'chewScrap': {
          const scrap = this.targetScrap;
          if (!scrap || scrap.dead) { this.scrapBites = 0; this.enterState('patrol'); return _tmp.set(0, 0, 0); }

          const distance = scrap.position.distanceTo(p);
          if (distance > this.biteReach * 1.6) {
            this.enterState('seekScrap');
            return this.steerTo(scrap.position, S.cruiseSpeed);
          }

          // Worry at the metal: bite, shake, bite again.
          this.jawOpen = 0.5 + 0.5 * Math.sin(this.game.time * 9);

          if (this.biteCooldown <= 0) {
            this.biteCooldown = 0.85;
            this.snap = 0.3;
            this.scrapBites++;
            this.game.audio.metalBite(this.game.distanceToPlayer(p));

            // Stalkers shed teeth on metal. This is the reliable way to farm
            // them: bait one onto a plate and let it work.
            if (Math.random() < 0.4) {
              SL.Pickup.burst(this.game, 'tooth', scrap.position, 1);
            }

            _look.subVectors(scrap.position, p).normalize();
            if (scrap.bite(SCRAP_BITE_DAMAGE, _look)) {
              this.targetScrap = null;
              this.scrapBites = 0;
              this.enterState('patrol');
              return _tmp.set(0, 0, 0);
            }
            if (this.scrapBites >= BITES_BEFORE_CARRY) {
              this.grabScrap(scrap);
              this.enterState('carryScrap');
            }
          }

          return this.steerTo(scrap.position, S.cruiseSpeed * 0.4);
        }

        case 'carryScrap': {
          if (!this.carriedScrap || this.carriedScrap.dead) {
            this.carriedScrap = null;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          this.jawOpen = 0.35;

          // A tribute run crosses most of the map, so it is given the time.
          const arrived = this.carryDestination.distanceToSquared(p) < (this.tribute ? 64 : 25);
          if (arrived || this.stateTimer > (this.tribute ? 150 : 22)) {
            // Drop it and lose interest for a while.
            _look.copy(this.velocity).normalize().multiplyScalar(1.2).add(_tmp.set(0, -0.6, 0));
            const delivered = this.tribute && arrived;
            this.releaseScrap(_look.clone());
            this.tribute = false;

            if (delivered && this.game.distanceToPlayer(p) < 60) {
              this.game.hud.toast('A stalker adds to the hoard');
            }
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }
          return this.steerTo(this.carryDestination, S.cruiseSpeed * (this.tribute ? 1.35 : 1.1));
        }

        case 'huntFish': {
          const fish = this.targetFish;
          if (!fish || fish.dead) {
            this.targetFish = null;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          const distance = fish.position.distanceTo(p);
          if (distance > S.senseRadius * 1.6 || this.stateTimer > 18) {
            this.targetFish = null;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          this.jawOpen = SL.damp(this.jawOpen, distance < 4 ? 1 : 0.2, 5, dt);

          if (distance < this.biteReach) {
            // A stalker's bite kills a fish outright.
            this.snap = 0.4;
            this.game.audio.bite(this.game.distanceToPlayer(p));
            fish.hurt(9999, this);
            this.targetFish = null;
            this.enterState('feed');
            return _tmp.set(0, 0, 0);
          }

          // Intercept: aim where the fish is going, not where it is.
          _look.copy(fish.velocity).multiplyScalar(Math.min(distance / S.sprintSpeed, 1.2)).add(fish.position);
          return this.steerTo(_look, S.sprintSpeed);
        }

        case 'feed': {
          // Thrash in place for a moment after a kill.
          this.jawOpen = 0.5 + 0.5 * Math.sin(this.game.time * 12);
          if (this.stateTimer > 2.5) this.enterState('patrol');
          return _tmp.copy(this.velocity).normalize().multiplyScalar(S.cruiseSpeed * 0.25);
        }

        case 'attack': {
          const threat = this.threat;
          if (!threat || threat.dead) {
            this.threat = null;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          const distance = threat.position.distanceTo(p);
          if (distance > S.senseRadius * 1.6) {
            this.threat = null; this.aggro = 0;
            this.enterState('patrol');
            return this.steerTo(this.patrolTarget, S.cruiseSpeed);
          }

          this.jawOpen = SL.damp(this.jawOpen, distance < 5 ? 1 : 0.3, 5, dt);

          if (distance < this.biteReach && this.biteCooldown <= 0) {
            this.biteCooldown = S.biteInterval;
            this.snap = 0.35;
            this.game.audio.bite(0);
            threat.hurt(S.biteDamage, this);
            this.velocity.addScaledVector(_tmp.subVectors(threat.position, p).normalize(), 2);

            // Break off and circle back rather than chewing continuously. This
            // is what gives the player room to fight back or swim for it.
            this.enterState('veerOff');
            return this.steerTo(p.clone().addScaledVector(
              _tmp.subVectors(p, threat.position).normalize(), 10), S.sprintSpeed);
          }

          return this.steerTo(threat.position, S.sprintSpeed);
        }

        case 'veerOff': {
          // Swim clear for a few seconds, then decide again.
          this.jawOpen = SL.damp(this.jawOpen, 0.15, 3, dt);
          if (this.stateTimer > 4) {
            this.enterState(this.threat && !this.threat.dead ? 'attack' : 'patrol');
          }
          const away = this.threat ? this.threat.position : this.patrolTarget;
          return _tmp.subVectors(p, away).normalize().multiplyScalar(S.cruiseSpeed * 1.3);
        }

        case 'retreat':
        default: {
          this.jawOpen = SL.damp(this.jawOpen, 0, 3, dt);
          if (this.stateTimer > 10) { this.aggro = 0; this.threat = null; this.enterState('patrol'); }
          const from = this.threat ? this.threat.position : this.patrolTarget;
          return _tmp.subVectors(p, from).normalize().multiplyScalar(S.sprintSpeed * 0.9);
        }
      }
    }
  }

  SL.Creature = Creature;
  SL.Fish = Fish;
  SL.Stalker = Stalker;
})(window.SL);
