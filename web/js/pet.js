/**
 * The bonded stalker.
 *
 * Catalogue every fish in the ocean and one of the things that has been trying
 * to eat you decides you are worth following instead. It keeps station off your
 * shoulder, goes after anything hunting you, and will not touch you no matter
 * what you do. Killed, it comes back - the bond is the reward for finishing the
 * databank, not something the ocean gets to take away again.
 */
(function (SL) {
  'use strict';

  const _tmp = new THREE.Vector3();
  const _slot = new THREE.Vector3();

  const RESPAWN_SECONDS = 10;
  const GUARD_RANGE = 16;

  const LABELS = {
    follow: 'at your shoulder',
    defend: 'defending you'
  };

  class PetStalker extends SL.Creature {
    constructor(game, x, y, z) {
      super(game, SL.Species.petStalker, x, y, z);
      this.state = 'follow';
      this.stateTimer = 0;
      this.senseTimer = 0;
      this.biteCooldown = 0;
      this.target = null;
      this.bob = SL.random() * Math.PI * 2;
    }

    get stateLabel() { return LABELS[this.state] || ''; }
    get biteReach() { return this.bodyLength * 0.7 + 1; }

    enterState(state) {
      if (this.state === state) return;
      this.state = state;
      this.stateTimer = 0;
    }

    /** Nothing the diver does turns it hostile. That is the whole point. */
    provoke() {}
    onHurt() {}

    onDeath() {
      this.game.hud.toast('Your stalker was killed — it will be back');
      this.game.petRespawn = RESPAWN_SECONDS;
    }

    /** Anything actively hunting the diver is fair game. */
    findThreat() {
      const player = this.game.player;
      let closest = null;
      let closestDistance = GUARD_RANGE;

      for (const stalker of this.game.stalkers) {
        if (stalker.dead) continue;
        // Only ones that have actually taken an interest in the diver.
        if (stalker.threat !== player && stalker.state !== 'attack') continue;

        const distance = stalker.position.distanceTo(player.position);
        if (distance < closestDistance) { closestDistance = distance; closest = stalker; }
      }
      return closest;
    }

    desiredVelocity(dt) {
      const S = this.species;
      const player = this.game.player;

      this.stateTimer += dt;
      this.bob += dt;
      this.biteCooldown = Math.max(0, this.biteCooldown - dt);

      this.senseTimer -= dt;
      if (this.senseTimer <= 0) {
        this.senseTimer = 0.4;
        const threat = this.findThreat();
        if (threat) { this.target = threat; this.enterState('defend'); }
        else if (this.state === 'defend') { this.target = null; this.enterState('follow'); }
      }

      if (this.state === 'defend' && this.target && !this.target.dead) {
        const distance = this.target.position.distanceTo(this.position);
        this.jawOpen = SL.damp(this.jawOpen, distance < 5 ? 1 : 0.3, 5, dt);

        if (distance < this.biteReach && this.biteCooldown <= 0) {
          this.biteCooldown = S.biteInterval;
          this.game.audio.bite(this.game.distanceToPlayer(this.position));
          this.target.hurt(S.biteDamage, this);

          // Drive it off the diver rather than just chewing on it.
          this.target.threat = this;
          this.target.enterState('retreat');
        }

        return _tmp.subVectors(this.target.position, this.position).normalize()
          .multiplyScalar(S.sprintSpeed);
      }

      // --- Station-keeping ------------------------------------------------------
      this.jawOpen = SL.damp(this.jawOpen, 0.12, 2, dt);

      // Just behind and to the left, drifting gently so it never looks pinned.
      _slot.set(-2.4, 1.1 + Math.sin(this.bob * 0.8) * 0.5, -3.2)
        .applyQuaternion(this.game.camera.quaternion)
        .add(player.position);

      const toSlot = _tmp.subVectors(_slot, this.position);
      const distance = toSlot.length();

      if (distance < 0.8) return _tmp.set(0, 0, 0);

      // Falls behind, then hurries to catch up.
      const speed = SL.lerp(S.cruiseSpeed * 0.5, S.sprintSpeed, SL.clamp((distance - 1) / 12, 0, 1));
      return toSlot.normalize().multiplyScalar(speed);
    }
  }

  const Pet = {
    /** Species the databank counts as "the fish" for the purposes of the bond. */
    fishSpecies() {
      return SL.Species.list.filter((s) => !s.leviathan && s.diet !== 'carnivore');
    },

    scannedFish() {
      return this.fishSpecies().filter((s) => SL.Index.has(s.id)).length;
    },

    /** Called whenever something new is catalogued. */
    checkUnlock(game) {
      if (!game || game.pets.length || game.petRespawn > 0) return;

      const fish = this.fishSpecies();
      if (this.scannedFish() < fish.length) return;

      this.spawn(game);
      game.hud.toast('DATABANK COMPLETE — a stalker has bonded to you');
      game.audio.craft();
    },

    spawn(game) {
      const p = game.player.position;
      const pet = new PetStalker(game, p.x + 2, p.y + 1, p.z + 2);
      game.pets.push(pet);
      return pet;
    },

    update(game, dt) {
      if (game.petRespawn > 0) {
        game.petRespawn -= dt;
        if (game.petRespawn <= 0 && !game.pets.length) {
          this.spawn(game);
          game.hud.toast('Your stalker is back');
        }
      }
    }
  };

  SL.PetStalker = PetStalker;
  SL.Pet = Pet;
})(window.SL);
