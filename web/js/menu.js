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

        // A world someone finished can be deleted too - but it is not a world
        // to lose to a stray click, so it asks twice instead of once.
        let done = null;
        if (world.completed) {
          done = document.createElement('span');
          done.className = 'world__done';
          done.title = 'You finished this world';
          done.textContent = 'complete';
        }

        const asks = world.completed
          ? ['delete?', 'it is complete — sure?']
          : ['delete?'];
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'world__delete';
        remove.title = 'Delete this world';
        remove.textContent = '×';
        let step = 0;
        let timer = null;
        remove.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (step < asks.length) {
            remove.textContent = asks[step];
            remove.dataset.confirm = 'yes';
            step++;
            clearTimeout(timer);
            timer = setTimeout(() => {
              step = 0;
              remove.dataset.confirm = '';
              remove.textContent = '×';
            }, 3000);
            return;
          }
          clearTimeout(timer);
          await SL.Saves.remove(world.id);
          await this.refresh();
        });

        // Renaming swaps the row's button for a text box in place: Enter or
        // clicking away keeps the new name, Escape puts the old one back.
        const rename = document.createElement('button');
        rename.type = 'button';
        rename.className = 'world__rename';
        rename.title = 'Rename this world';
        rename.textContent = 'rename';
        rename.addEventListener('click', (e) => {
          e.stopPropagation();
          const box = document.createElement('input');
          box.type = 'text';
          box.className = 'world__name-input';
          box.maxLength = 40;
          box.value = world.name;
          box.setAttribute('aria-label', 'World name');
          let finished = false;
          const finish = async (keep) => {
            if (finished) return;
            finished = true;
            const name = box.value.trim();
            if (keep && name && name !== world.name) {
              world.name = name;
              await SL.Saves.put(world);
            }
            await this.refresh();
          };
          box.addEventListener('keydown', (k) => {
            k.stopPropagation();
            if (k.key === 'Enter') finish(true);
            else if (k.key === 'Escape') finish(false);
          });
          box.addEventListener('blur', () => finish(true));
          row.replaceChild(box, open);
          rename.hidden = true;
          box.focus();
          box.select();
        });

        row.appendChild(open);
        if (done) row.appendChild(done);
        row.appendChild(rename);
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
