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
    },

    // --- Consumables. These stack and are spent, not equipped. ---------------
    {
      id: 'medkit',
      name: 'Medkit',
      blurb: 'Heals 55 on the spot. Press H to use one. Build as many as you like.',
      cost: { titanium: 1, quartz: 2 },
      consumable: true,
      stack: 'medkit'
    },

    // --- Crystal-biome tier ---------------------------------------------------
    {
      id: 'visor',
      name: 'Quartz Visor',
      blurb: 'Cuts the murk. You see roughly twice as far in every biome.',
      cost: { quartz: 5, gold: 2 },
      apply(player) { player.visionBonus = 0.5; }
    },
    {
      id: 'rebreather',
      name: 'Gold Rebreather',
      blurb: 'Air 260s → 420s. Enough to reach the far water and come home.',
      cost: { gold: 5, quartz: 4, titanium: 6 },
      requires: 'tank3',
      apply(player) { player.maxOxygen = 420; player.oxygen = 420; }
    },
    {
      id: 'prismsuit',
      name: 'Prism Suit',
      blurb: 'Take 65% less damage. Survivable even where the king lives.',
      cost: { diamond: 3, titanium: 8, quartz: 4 },
      requires: 'suit',
      apply(player) { player.damageResist = 0.65; }
    },
    // --- Light, navigation and tools -----------------------------------------
    {
      id: 'lantern',
      name: 'Lantern',
      blurb: 'Replaces the torch with a broad, far-reaching lamp. Press F.',
      cost: { titanium: 4, quartz: 3 },
      apply(player) { player.lanternBuilt = true; player.upgradeLight(); }
    },
    {
      id: 'scanner',
      name: 'Scanner',
      blurb: 'Hold X on a creature to catalogue it. Press I to read the databank.',
      cost: { titanium: 3, quartz: 2, gold: 1 }
    },
    {
      id: 'beacon',
      name: 'Marker Beacon',
      blurb: 'Drop one with G. It lights the spot and pins it to your chart.',
      cost: { titanium: 2, quartz: 1 },
      consumable: true,
      stack: 'beacon'
    },
    {
      id: 'tracker',
      name: 'Leviathan Tracker',
      blurb: 'Puts both leviathans on the chart, with range, wherever they are.',
      cost: { gold: 3, quartz: 4, tooth: 4 }
    },
    {
      id: 'bait',
      name: 'Bait Pod',
      blurb: 'Throw with B. Every stalker that hears it goes there, not at you.',
      cost: { titanium: 2, tooth: 1 },
      consumable: true,
      stack: 'bait'
    },
    {
      id: 'repel',
      name: 'Repel Charge',
      blurb: 'Press V. Drives every stalker within 25 m off you for a while.',
      cost: { quartz: 3, tooth: 2 },
      consumable: true,
      stack: 'repel'
    },
    {
      id: 'blade4',
      name: 'Diamond Blade',
      blurb: 'Knife 84 → 140 damage. The only edge that troubles a leviathan.',
      cost: { diamond: 4, titanium: 10, tooth: 8 },
      requires: 'blade3',
      apply(player) { player.knifeDamage = 140; player.knifeReach = 3.2; }
    }
  ];

  const Crafting = {
    recipes: RECIPES,
    inventory: { titanium: 0, tooth: 0, quartz: 0, gold: 0, diamond: 0 },
    /** Consumables held, keyed by recipe stack name. */
    stacks: { medkit: 0, beacon: 0, bait: 0, repel: 0 },
    built: {},

    reset() {
      for (const key of Object.keys(this.inventory)) this.inventory[key] = 0;
      for (const key of Object.keys(this.stacks)) this.stacks[key] = 0;
      this.built = {};
    },

    add(type, amount) {
      this.inventory[type] = (this.inventory[type] || 0) + amount;
    },

    /** Why a recipe is unavailable, or null if it can be built now. */
    blockedReason(recipe) {
      // Consumables can always be built again, so they never read as "built".
      if (!recipe.consumable && this.built[recipe.id]) return 'built';
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
        if (recipe.consumable) {
          this.stacks[recipe.stack] = (this.stacks[recipe.stack] || 0) + 9;
        } else if (!this.built[recipe.id]) {
          this.built[recipe.id] = true;
          if (recipe.apply) recipe.apply(game.player);
        }
      }
      for (const key of Object.keys(this.inventory)) this.inventory[key] += 99;

      // Infinite health and air: nothing bites through it and the tank never
      // empties, so the far water can be explored without the trip home.
      game.player.invulnerable = true;
      game.player.health = game.player.maxHealth;
      game.player.oxygen = game.player.maxOxygen;
    },

    craft(recipe, game) {
      if (this.blockedReason(recipe) !== null) return false;

      for (const type of Object.keys(recipe.cost)) this.inventory[type] -= recipe.cost[type];

      if (recipe.consumable) {
        this.stacks[recipe.stack] = (this.stacks[recipe.stack] || 0) + 1;
        game.audio.craft();
        game.hud.toast(recipe.name + ' x' + this.stacks[recipe.stack]);
        return true;
      }

      this.built[recipe.id] = true;
      if (recipe.apply) recipe.apply(game.player);

      game.audio.craft();
      game.hud.toast(recipe.name + ' equipped');
      return true;
    }
  };

  /** Spends one consumable of a kind. Returns false if none are held. */
  Crafting.consume = function (stack) {
    if (!this.stacks[stack]) return false;
    this.stacks[stack]--;
    return true;
  };

  SL.Crafting = Crafting;
})(window.SL);
