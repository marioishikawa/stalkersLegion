/**
 * What the world is for.
 *
 * Two things finish a world: every species in the databank catalogued, and
 * every leviathan dead. They overlap, because killing anything catalogues it -
 * you are not going to hold a scanner steady on a leviathan for a second and a
 * half and live, and a corpse is a specimen whatever size it was.
 *
 * That last part matters for more than convenience. Scanning is the only other
 * way into the databank, and a dead animal sinks and rots: kill the last of
 * something you never scanned and, without this, its entry could never be
 * filled and the world could never be finished.
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
  const LEVIATHANS = ['kingstalker', 'redpuff', 'kelperlev', 'glowlev', 'carnilev'];

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
     * Anything the diver kills passes through here. The kill is the scan, for
     * a leviathan and for a minnow alike; on top of that a leviathan is struck
     * off the list of things that have to die.
     */
    recordKill(game, species, killer) {
      if (!species || killer !== game.player) return;

      const newToScience = SL.Index.record(species.id);
      if (newToScience) game.hud.toast(species.name + ' added to the databank');

      if (this.isLeviathan(species) && !this.killed[species.id]) {
        this.killed[species.id] = Date.now();

        const left = this.leviathanTotal - this.leviathansDown;
        game.hud.toast(left > 0
          ? (left === 1 ? 'One leviathan left' : left + ' leviathans left')
          : 'Every leviathan is dead');
      } else if (!newToScience) {
        // Nothing changed, so there is nothing to check.
        return;
      }

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
