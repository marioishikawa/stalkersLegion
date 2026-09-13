/**
 * The world list.
 *
 * Worlds are the entry point rather than a single "play" button, because every
 * world has its own seed and is therefore its own ocean. Coming back to one
 * gives you the same sea floor, the same gear, and the air you had left.
 */
(function (SL) {
  'use strict';

  function formatPlaytime(seconds) {
    const total = Math.max(0, Math.round(seconds || 0));
    const minutes = Math.floor(total / 60);
    if (minutes < 1) return 'just started';
    if (minutes < 60) return minutes + ' min';
    return Math.floor(minutes / 60) + 'h ' + (minutes % 60) + 'm';
  }

  function formatWhen(timestamp) {
    if (!timestamp) return '';
    const days = Math.floor((Date.now() - timestamp) / 86400000);
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    return days + ' days ago';
  }

  const Menu = {
    el: {},

    init(game) {
      this.game = game;
      for (const id of ['menuScreen', 'worldList', 'worldEmpty', 'newWorldName',
        'newWorldButton', 'storageNote']) {
        this.el[id] = document.getElementById(id);
      }

      this.el.newWorldButton.addEventListener('click', () => this.createWorld());
      this.el.newWorldName.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.createWorld(); }
        e.stopPropagation();   // typing a name must not steer the diver
      });
    },

    async open(game) {
      this.game = game;
      this.el.menuScreen.classList.add('is-visible');
      document.body.classList.add('is-cursor-free');
      await this.refresh();
    },

    close() {
      this.el.menuScreen.classList.remove('is-visible');
    },

    async refresh() {
      const worlds = await SL.Saves.list();
      const list = this.el.worldList;
      list.innerHTML = '';

      this.el.worldEmpty.hidden = worlds.length > 0;

      const note = {
        cloud: 'Worlds are saved to your account.',
        local: 'Worlds are saved in this browser.',
        memory: 'Storage is unavailable — this world will not outlast the tab.'
      }[SL.Saves.backend];
      this.el.storageNote.textContent = note || '';

      for (const world of worlds) {
        const row = document.createElement('div');
        row.className = 'world';

        const open = document.createElement('button');
        open.type = 'button';
        open.className = 'world__open';
        open.innerHTML =
          '<span class="world__name"></span>' +
          '<span class="world__meta"></span>';
        open.querySelector('.world__name').textContent = world.name;
        open.querySelector('.world__meta').textContent = [
          world.biome || 'Safe Shallows',
          (world.depth || 0).toFixed(0) + ' m down',
          formatPlaytime(world.playtime),
          world.deaths ? world.deaths + (world.deaths === 1 ? ' death' : ' deaths') : null,
          formatWhen(world.updatedAt)
        ].filter(Boolean).join('  ·  ');

        open.addEventListener('click', () => this.enter(world));

        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'world__delete';
        remove.title = 'Delete this world';
        remove.textContent = '×';
        remove.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (remove.dataset.confirm !== 'yes') {
            remove.dataset.confirm = 'yes';
            remove.textContent = 'delete?';
            setTimeout(() => {
              remove.dataset.confirm = '';
              remove.textContent = '×';
            }, 3000);
            return;
          }
          await SL.Saves.remove(world.id);
          await this.refresh();
        });

        row.appendChild(open);
        row.appendChild(remove);
        list.appendChild(row);
      }
    },

    async createWorld() {
      const world = SL.Saves.create(this.el.newWorldName.value);
      this.el.newWorldName.value = '';
      await SL.Saves.put(world);
      this.enter(world);
    },

    enter(world) {
      this.close();
      this.game.enterWorld(world);
    }
  };

  SL.Menu = Menu;
})(window.SL);
