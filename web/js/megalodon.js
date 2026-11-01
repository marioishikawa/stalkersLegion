/**
 * The Megalodon Leviathan.
 *
 * Eighteen metres of shark patrolling the open water of the abyssal plain.
 * It hunts the way sharks do: it notices you from a long way off, comes in
 * and circles - round and round at your depth, closing in - and then, with no
 * more warning than the circling stopping, it turns and charges. A hit or a
 * miss, it carries straight on past and swings round to circle again.
 *
 * The circling is the warning and the charge is the danger. It turns wide
 * at speed, so getting out of the line of a charge works; so does cutting it
 * as it comes in, which makes it flinch away early. And it will not follow
 * you into the wreck.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _mouth = new THREE.Vector3();
  const _fwd = new THREE.Vector3();

  const LABELS = {
    patrol: 'patrolling',
    circle: 'circling you',
    charge: 'charging',
    veer: 'turning away'
  };

  const CIRCLE_RADIUS = 22;
  /** Gives up past this. */
  const LOSE_INTEREST = 120;
  /** How far past its patrol ground it will chase. */
  const LEASH = 2.4;

  class MegalodonLeviathan extends SL.Creature {
    constructor(game, species, x, y, z) {
      super(game, species, x, y, z);
      this.territoryRadius = 320;
      this.state = 'patrol';
      this.stateTimer = 0;
      this.circleFor = SL.randRange(7, 11);
      this.circleAngle = SL.random() * Math.PI * 2;
      this.circleDir = SL.random() < 0.5 ? 1 : -1;
      this.biteCooldown = 0;
      this.patrolTarget = new THREE.Vector3(x, y, z);
      this.pickPatrol();
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get hunting() { return !this.dead && this.state !== 'patrol'; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** It bites with its head, eight metres in front of its middle. */
    mouthPosition() {
      return _mouth.set(0, 0, this.bodyLength * 0.46).applyQuaternion(this.object.quaternion).add(this.position);
    }

    pickPatrol() {
      const angle = SL.random() * Math.PI * 2;
      const r = SL.randRange(40, this.territoryRadius);
      const x = this.territory.x + Math.cos(angle) * r;
      const z = this.territory.z + Math.sin(angle) * r;
      const floor = SL.Biomes.floorHeightAt(x, z);
      this.patrolTarget.set(x, Math.min(floor + this.species.altitude, SL.WATER_LEVEL - 14), z);
    }

    /** Whether the diver is somewhere it can go after them. */
    canHunt(player) {
      if (player.dead) return false;
      if (SL.Wreck && SL.Wreck.isInside(player.position)) return false;
      const fromHome = Math.hypot(player.position.x - this.territory.x, player.position.z - this.territory.z);
      return fromHome < this.territoryRadius * LEASH;
    }

    provoke() {
      if (this.dead) return;
      if (this.state === 'patrol') {
        this.enterState('circle');
        this.circleFor = SL.randRange(3, 5);
      }
    }

    /** Cut on the way in, it flinches off rather than finishing the charge. */
    onHurt() {
      if (this.state === 'charge') this.enterState('veer');
      else this.provoke();
    }

    onDeath() {
      SL.Pickup.burst(this.game, 'gold', this.position, 6);
      SL.Pickup.burst(this.game, 'simyphit', this.position, 4);
      SL.Pickup.burst(this.game, 'titanium', this.position, 8);
      this.game.hud.toast('The Megalodon Leviathan sinks into the dark');
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;
      this.stateTimer += dt;
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);
      const distance = player.dead ? Infinity : player.position.distanceTo(this.position);
      const huntable = this.canHunt(player);

      switch (this.state) {
        case 'charge': {
          this.jawOpen = SL.damp(this.jawOpen, distance < 20 ? 1 : 0.4, 6, dt);
          if (!huntable) { this.enterState('veer'); break; }
          const mouth = this.mouthPosition();
          const reach = this.bodyLength * 0.12 + 1.8;
          if (this.biteCooldown <= 0 && mouth.distanceTo(player.position) < reach) {
            this.biteCooldown = S.biteInterval;
            this.game.audio.bite(this.game.distanceToPlayer(this.position));
            player.hurt(S.biteDamage, this);
            this.enterState('veer');
            break;
          }
          // Missed, and long gone past: give it up and come round again.
          if (this.stateTimer > 6) { this.enterState('veer'); break; }
          // Aimed with the mouth, a little ahead of where you are going.
          _tmp.copy(player.position).addScaledVector(player.velocity, 0.3).sub(mouth);
          return _tmp.normalize().multiplyScalar(S.sprintSpeed);
        }

        case 'veer': {
          // Straight on through and away, climbing a little.
          this.jawOpen = SL.damp(this.jawOpen, 0.1, 3, dt);
          if (this.stateTimer > 3.5) {
            if (huntable && distance < LOSE_INTEREST) {
              this.enterState('circle');
              this.circleFor = SL.randRange(6, 10);
              this.circleAngle = Math.atan2(this.position.z - player.position.z, this.position.x - player.position.x);
            } else {
              this.enterState('patrol');
              this.pickPatrol();
            }
          }
          this.object.getWorldDirection(_fwd);
          return _tmp.copy(_fwd).setY(_fwd.y + 0.15).normalize().multiplyScalar(S.sprintSpeed * 0.75);
        }

        case 'circle': {
          this.jawOpen = SL.damp(this.jawOpen, 0.15, 2, dt);
          if (!huntable || distance > LOSE_INTEREST) {
            this.enterState('patrol');
            this.pickPatrol();
            break;
          }
          if (this.stateTimer > this.circleFor) {
            this.game.audio.blow(this.game.distanceToPlayer(this.position));
            this.enterState('charge');
            break;
          }
          // Round you, at your depth, the circle drawing in as it goes on.
          const radius = SL.lerp(CIRCLE_RADIUS * 1.4, CIRCLE_RADIUS, SL.clamp(this.stateTimer / this.circleFor, 0, 1));
          this.circleAngle += this.circleDir * (S.cruiseSpeed * 1.5 / radius) * dt;
          const floor = SL.Biomes.floorHeightAt(player.position.x, player.position.z);
          _tmp.set(player.position.x + Math.cos(this.circleAngle) * radius,
            SL.clamp(player.position.y, floor + this.bodyLength * 0.4, SL.WATER_LEVEL - 4),
            player.position.z + Math.sin(this.circleAngle) * radius);
          return _tmp.sub(this.position).normalize().multiplyScalar(S.cruiseSpeed * 1.6);
        }

        case 'patrol':
        default: {
          this.jawOpen = SL.damp(this.jawOpen, 0.1, 1, dt);
          if (huntable && distance < S.senseRadius) {
            this.enterState('circle');
            this.circleFor = SL.randRange(7, 11);
            this.circleAngle = Math.atan2(this.position.z - player.position.z, this.position.x - player.position.x);
            this.game.hud.toast('Something very large is circling you');
            break;
          }
          if (this.patrolTarget.distanceToSquared(this.position) < 400 || this.stateTimer > 90) {
            this.stateTimer = 0;
            this.pickPatrol();
          }
          return _tmp.subVectors(this.patrolTarget, this.position).normalize().multiplyScalar(S.cruiseSpeed);
        }
      }
      return _tmp.set(0, 0, 0);
    }
  }

  SL.MegalodonLeviathan = MegalodonLeviathan;
})(window.SL);
