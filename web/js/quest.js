/**
 * What the world is for.
 *
 * Two things finish a world: every species in the databank catalogued, and
 * every leviathan dead. They are the same list in the end - killing a leviathan
 * catalogues it, because you are not going to hold a scanner steady on one for
 * a second and a half and live, and because a corpse is a specimen.
 *
 * Finishing does not end anything. The world stays open and you can keep
 * diving; the only thing that changes is that it can no longer be deleted.
 * A world someone finished is not a world to lose to a stray click.
 */
(function (SL) {
  'use strict';

  /**
   * Everything that has to die.
   *
   * The Glasswhale is deliberately not on it. It cannot hurt you and you cannot
   * hurt it, so requiring its death would make a world unfinishable - and it is
   * the one animal out there that is simply left alone. You still have to
   * catalogue it; you just have to do that with the scanner like anybody else.
   */
  const LEVIATHANS = ['kingstalker', 'redpuff', 'kelperlev', 'glowlev'];

  const Quest = {
    /** Leviathan species ids killed in this world. */
    killed: {},

    /** Set once the world has been finished, so the fanfare only plays once. */
    finished: false,

    reset() {
      this.killed = {};
      this.finished = false;
    },

    get leviathanIds() { return LEVIATHANS.slice(); },
    get leviathansDown() { return LEVIATHANS.filter((id) => this.killed[id]).length; },
    get leviathanTotal() { return LEVIATHANS.length; },

    isLeviathan(species) { return LEVIATHANS.indexOf(species.id) >= 0; },

    /**
     * Anything the diver kills passes through here. A leviathan is recorded and
     * catalogued at once; everything else is somebody's dinner.
     */
    recordKill(game, species, killer) {
      if (!species || killer !== game.player) return;
      if (!this.isLeviathan(species)) return;
      if (this.killed[species.id]) return;

      this.killed[species.id] = Date.now();

      // The kill is the scan.
      if (SL.Index.record(species.id)) {
        game.hud.toast(species.name + ' added to the databank');
      }

      const left = this.leviathanTotal - this.leviathansDown;
      game.hud.toast(left > 0
        ? (left === 1 ? 'One leviathan left' : left + ' leviathans left')
        : 'Every leviathan is dead');

      this.check(game);
    },

    /** Progress, for the databank header and the pause screen. */
    progress() {
      return {
        catalogued: SL.Index.count,
        species: SL.Index.total,
        levs: this.leviathansDown,
        levTotal: this.leviathanTotal,
        complete: SL.Index.count >= SL.Index.total
          && this.leviathansDown >= this.leviathanTotal
      };
    },

    /** One line, for anywhere that wants to show where you are. */
    summary() {
      const p = this.progress();
      if (p.complete) return 'World complete  ·  every species catalogued, every leviathan dead';
      return p.catalogued + ' of ' + p.species + ' catalogued  ·  '
        + p.levs + ' of ' + p.levTotal + ' leviathans down';
    },

    /** Called whenever something that could finish the world happens. */
    check(game) {
      if (this.finished || !game || !game.started) return;
      if (!this.progress().complete) return;

      this.finished = true;
      if (game.world) game.world.completed = true;
      game.saveWorld();
      game.showCompletion();
    }
  };

  SL.Quest = Quest;
})(window.SL);
