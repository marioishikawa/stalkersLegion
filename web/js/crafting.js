/**
 * The fabricator: a small, strictly tiered upgrade tree.
 *
 * Every recipe either lets you stay down longer or survive what is down there,
 * so each one changes how far out you can push. Nothing is cosmetic, and there
 * is no inventory management - resources are two counters, and a built item is
 * permanently applied to the diver.
 */
(function (SL) {
  'use strict';

  const RECIPES = [
    {
      id: 'fins',
      name: 'Reinforced Fins',
      blurb: 'Swim 30% faster. The cheapest way to make the crossing shorter.',
      cost: { titanium: 3 },
      apply(player) { player.swimSpeed = 5.5; }
    },
    {
      id: 'tank2',
      name: 'Reinforced Tank',
      blurb: 'Air 90s → 150s. Doubles how far out you can reach and return.',
      cost: { titanium: 5 },
      apply(player) { player.maxOxygen = 150; player.oxygen = 150; }
    },
    {
      id: 'blade2',
      name: 'Serrated Blade',
      blurb: 'Knife 28 → 52 damage, and swings faster. Three hits to a stalker.',
      cost: { titanium: 4, tooth: 2 },
      apply(player) { player.knifeDamage = 52; player.swingDuration = 0.36; }
    },
    {
      id: 'suit',
      name: 'Plated Dive Suit',
      blurb: 'Take 40% less damage. A stalker bite stops being a third of you.',
      cost: { titanium: 6, tooth: 3 },
      apply(player) { player.damageResist = 0.4; }
    },
    {
      id: 'tank3',
      name: 'High-Pressure Tank',
      blurb: 'Air 150s → 260s. Enough to reach the trench floor and come back.',
      cost: { titanium: 9, tooth: 4 },
      requires: 'tank2',
      apply(player) { player.maxOxygen = 260; player.oxygen = 260; }
    },
    {
      id: 'blade3',
      name: 'Tooth-Edged Blade',
      blurb: 'Knife 52 → 84 damage and longer reach. Two hits to a stalker.',
      cost: { titanium: 8, tooth: 6 },
      requires: 'blade2',
      apply(player) { player.knifeDamage = 84; player.knifeReach = 2.9; }
    }
  ];

  const Crafting = {
    recipes: RECIPES,
    inventory: { titanium: 0, tooth: 0 },
    built: {},

    reset() {
      this.inventory.titanium = 0;
      this.inventory.tooth = 0;
      this.built = {};
    },

    add(type, amount) {
      this.inventory[type] = (this.inventory[type] || 0) + amount;
    },

    /** Why a recipe is unavailable, or null if it can be built now. */
    blockedReason(recipe) {
      if (this.built[recipe.id]) return 'built';
      if (recipe.requires && !this.built[recipe.requires]) {
        const prerequisite = RECIPES.find((r) => r.id === recipe.requires);
        return 'needs ' + (prerequisite ? prerequisite.name : recipe.requires);
      }
      for (const type of Object.keys(recipe.cost)) {
        if ((this.inventory[type] || 0) < recipe.cost[type]) return 'short';
      }
      return null;
    },

    /** Cheat: grant every recipe at once, plus a working stock of materials. */
    unlockAll(game) {
      for (const recipe of RECIPES) {
        if (!this.built[recipe.id]) {
          this.built[recipe.id] = true;
          recipe.apply(game.player);
        }
      }
      this.inventory.titanium += 99;
      this.inventory.tooth += 99;

      game.player.health = game.player.maxHealth;
      game.player.oxygen = game.player.maxOxygen;
    },

    craft(recipe, game) {
      if (this.blockedReason(recipe) !== null) return false;

      for (const type of Object.keys(recipe.cost)) this.inventory[type] -= recipe.cost[type];
      this.built[recipe.id] = true;
      recipe.apply(game.player);

      game.audio.craft();
      game.hud.toast(recipe.name + ' equipped');
      return true;
    }
  };

  SL.Crafting = Crafting;
})(window.SL);
