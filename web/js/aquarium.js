/**
 * The tiny aquarium, and the net that fills it.
 *
 * Small fish - anything under about forty centimetres - can be caught by
 * swimming right up to one and pressing E. The net holds three. The aquarium
 * stands on the rocket pad, a glass tank on legs; put your fish in it and they
 * swim about in there, and when the rocket goes home, they go with you. They
 * are still in their tank when the next ship comes down on the next planet,
 * sat inside the wreck by the console.
 */
(function (SL) {
  'use strict';

  const NET_SIZE = 3;
  const TANK_SIZE = 6;
  const SMALL = 0.42;
  const TANK = { w: 1.3, h: 0.8, d: 0.8, leg: 0.9 };

  const Aquarium = {
    /** Species ids in the net, and in the tank. */
    net: [],
    fish: [],

    setup(game) {
      this.game = game;
      this.net = [];
      this.fish = [];
      this.swimmers = [];
      if (!SL.Wreck) return;
      // On a planet you have crashed on, the tank came down with you and sits
      // inside the wreck. On Earth it stands by the rocket pad.
      if (SL.Planet && SL.Planet.current > 1) {
        this.at = SL.Wreck.tankPoint();
      } else {
        const pad = SL.Wreck.rocketPoint();
        this.at = new THREE.Vector3(pad.x - 3.5, pad.y, pad.z + 3.5);
      }
      this.buildTank(game);
    },

    buildTank(game) {
      const g = new THREE.Group();
      const steel = new THREE.MeshLambertMaterial({ color: 0x3a4246 });
      const glass = new THREE.MeshLambertMaterial({ color: 0xa8e4f0, transparent: true, opacity: 0.28, depthWrite: false });
      const sand = new THREE.MeshLambertMaterial({ color: 0xc8b07a });
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, TANK.leg, 0.08), steel);
        leg.position.set(x * (TANK.w / 2 - 0.05), TANK.leg / 2, z * (TANK.d / 2 - 0.05));
        g.add(leg);
      }
      const base = new THREE.Mesh(new THREE.BoxGeometry(TANK.w + 0.1, 0.08, TANK.d + 0.1), steel);
      base.position.y = TANK.leg;
      g.add(base);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(TANK.w - 0.05, 0.08, TANK.d - 0.05), sand);
      bed.position.y = TANK.leg + 0.08;
      g.add(bed);
      const box = new THREE.Mesh(new THREE.BoxGeometry(TANK.w, TANK.h, TANK.d), glass);
      box.position.y = TANK.leg + TANK.h / 2 + 0.04;
      g.add(box);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(TANK.w + 0.06, 0.05, TANK.d + 0.06), steel);
      lid.position.y = TANK.leg + TANK.h + 0.06;
      g.add(lid);
      g.position.copy(this.at);
      game.addToWorld(g);
      this.group = g;
      this.inside = new THREE.Group();
      this.inside.position.y = TANK.leg + 0.1 + TANK.h / 2;
      g.add(this.inside);
    },

    /** Puts a little model of each fish in the tank. */
    refreshTank() {
      if (!this.inside) return;
      for (const s of this.swimmers) this.inside.remove(s.mesh);
      this.swimmers = [];
      this.fish.forEach((id, i) => {
        const species = SL.Species.byId[id];
        if (!species) return;
        const built = SL.buildBody(species);
        const mesh = new THREE.Group();
        const material = species.translucent ? this.game.materials.jelly : this.game.materials.surface;
        mesh.add(new THREE.Mesh(built.segments[0].geometry, material));
        const tail = new THREE.Mesh(built.tail, material);
        tail.position.copy(built.tailPivot);
        mesh.add(tail);
        // Shrunk to fit, if it has to be.
        const k = Math.min(1, 0.32 / Math.max(built.length, 0.05));
        mesh.scale.setScalar(k);
        this.inside.add(mesh);
        this.swimmers.push({ mesh, tail, phase: i * 1.7, speed: 0.6 + (i % 3) * 0.2, lane: (i / TANK_SIZE - 0.5) * 0.5 });
      });
    },

    capture() {
      return this.fish.length || this.net.length ? { fish: this.fish.slice(), net: this.net.slice() } : null;
    },

    restore(data) {
      if (!data) return;
      this.fish = (data.fish || []).filter((id) => SL.Species.byId[id]).slice(0, TANK_SIZE);
      this.net = (data.net || []).filter((id) => SL.Species.byId[id]).slice(0, NET_SIZE);
      this.refreshTank();
    },

    nearTank(p) {
      return this.at && Math.hypot(p.position.x - this.at.x, p.position.z - this.at.z) < 2.6
        && Math.abs(p.position.y - (this.at.y + 1.2)) < 2.5;
    },

    /** The nearest small fish within reach, or null. */
    catchable(p) {
      let best = null, bestD = 2.4;
      for (const f of this.game.fish) {
        if (f.dead || f.species.leviathan || f.species.uncatalogued || f.bodyLength > SMALL) continue;
        const d = f.position.distanceTo(p.position);
        if (d < bestD) { bestD = d; best = f; }
      }
      return best;
    },

    prompt(p) {
      if (p.dead || !this.nearTank(p)) return null;
      if (this.net.length && this.fish.length < TANK_SIZE) return '[E] put ' + this.net.length + ' fish in the aquarium · ' + this.fish.length + '/' + TANK_SIZE;
      return 'Tiny aquarium · ' + this.fish.length + '/' + TANK_SIZE + ' fish · catch small fish with [E] and bring them here';
    },

    /** E at the tank, with fish in the net. Returns true if it used the key. */
    interactTank(p) {
      if (!this.nearTank(p) || !this.net.length) return false;
      const room = TANK_SIZE - this.fish.length;
      if (room <= 0) { this.game.hud.toast('The aquarium is full'); return true; }
      const moved = this.net.splice(0, room);
      this.fish.push(...moved);
      this.refreshTank();
      this.game.audio.pickUp();
      this.game.hud.toast(moved.length + ' fish in the aquarium · ' + this.fish.length + '/' + TANK_SIZE
        + (this.net.length ? ' · the rest stay in your net' : ''));
      return true;
    },

    /** E near a small fish: into the net. Returns true if it used the key. */
    tryCatch(p) {
      const f = this.catchable(p);
      if (!f) return false;
      if (this.net.length >= NET_SIZE) {
        this.game.hud.toast('Your net is full — take them to the aquarium by the rocket pad');
        return true;
      }
      this.net.push(f.species.id);
      // A fish in the net counts as scanned, since you are holding it.
      if (SL.Index.record(f.species.id)) this.game.hud.toast(f.species.name + ' added to the databank');
      f.destroy();
      this.game.audio.pickUp();
      this.game.hud.toast('Caught a ' + f.species.name + ' · ' + this.net.length + '/' + NET_SIZE + ' in your net');
      return true;
    },

    /** The names of what is in the tank, for the ending. */
    names() {
      return this.fish.map((id) => (SL.Species.byId[id] || {}).name).filter(Boolean);
    },

    update(dt) {
      if (!this.swimmers || !this.swimmers.length) return;
      const t = this.game.time;
      for (const s of this.swimmers) {
        const a = t * s.speed + s.phase;
        const x = Math.cos(a) * (TANK.w / 2 - 0.2);
        const z = Math.sin(a) * (TANK.d / 2 - 0.15);
        s.mesh.position.set(x, s.lane + Math.sin(a * 1.3) * 0.08, z);
        // Facing along the way round: the tangent of the ellipse.
        s.mesh.rotation.y = Math.atan2(-Math.sin(a) * (TANK.w / 2 - 0.2), Math.cos(a) * (TANK.d / 2 - 0.15));
        s.tail.rotation.y = Math.sin(t * 8 + s.phase) * 0.4;
      }
    }
  };

  SL.Aquarium = Aquarium;
})(window.SL);
