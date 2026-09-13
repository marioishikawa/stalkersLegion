# Stalkers Legion

An open-ocean survival game in the spirit of Subnautica. You start at the
surface with a survival knife and ninety seconds of air. Below you are eleven
biomes, thirty-nine species, four leviathans, one island, and a kelp forest
full of stalkers — long, armoured predators with a fixation on scrap metal.

**▶ Play it in the browser:** https://claude.ai/code/artifact/d8dc6549-e78f-4c4e-bbab-81b828bfdad7

Everything you see is generated procedurally at runtime from code: the sea
floor, the biome layout, every fish body, every kelp stalk, every piece of
scrap, and every sound. There are no models, textures, or audio files in this
repository.

---

## Two implementations

| | `web/` | `unreal/` |
|---|---|---|
| **Status** | Playable, actively iterated | Complete source, never compiled |
| **Engine** | Three.js r128 in the browser | Unreal Engine 5 (C++) |
| **Run it** | Open `web/index.html`, or use the link above | Needs a working UE 5 C++ toolchain |
| **Units** | metres, Y up | centimetres, Z up |

The web build is the one to work in. It reloads instantly, which is the whole
point of it — design decisions get made here, and the Unreal build is where they
get ported once the game behaves the way we want.

The two share an architecture deliberately, file for file, so that port stays
mechanical rather than a rewrite:

```
web/js/core.js       ~ SLProcMesh.cpp        (noise, math)
web/js/geometry.js   ~ SLProcMesh.cpp        (mesh assembly, lofts, primitives)
web/js/biomes.js     ~ SLBiomeLibrary.cpp    (the analytic height field)
web/js/species.js    ~ SLSpeciesLibrary.cpp  (the creature roster)
web/js/bodies.js     ~ SLBodyBuilder.cpp     (parametric body growth)
web/js/flora.js      ~ SLFloraPatch.cpp      (batched scenery)
web/js/scrap.js      ~ SLScrapMetal.cpp
web/js/creatures.js  ~ SLCreature/SLFish/SLStalker.cpp
web/js/player.js     ~ SLDiver.cpp + SLSurvivalKnife.cpp
web/js/world.js      ~ SLOceanWorld.cpp
web/js/hud.js        ~ SLHUD.cpp
```

To run the web build locally, open `web/index.html` directly — it uses classic
scripts rather than ES modules specifically so that it works from `file://` with
no server and no build step. The only external dependency is Three.js from a CDN.

## Worlds

The game opens on a list of saved worlds rather than a play button, because each
world is its own ocean. A world stores a **seed**, and the seed regenerates
everything — the sea floor, where the kelp grows, where the scrap lies, where the
stalkers patrol — so coming back gives you the same sea you left, and a new world
is a genuinely different map.

Saves hold the seed, your position, health and air, your materials and every
piece of gear you have built. They write themselves every 25 seconds, on pause,
on death, and when you leave a world. Gear survives death; only health and air
are restored.

Storage goes to the artifact's own database when the page is running on
claude.ai, so worlds follow your account rather than one browser. Opened as a
local file it falls back to `localStorage`, and if even that is blocked it keeps
worlds in memory for the session and says so on the menu.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Swim (you go where you look — look down and hold `W` to dive) |
| `Space` / `Ctrl` | Rise / sink |
| `Shift` | Sprint (burns air faster) |
| Mouse | Look |
| **Left click** | Swing the survival knife |
| `E` | Pick up scrap metal / throw the piece you are holding |
| `Tab` | Open the fabricator |
| `H` | Use a medkit |
| `G` | Drop a marker beacon |
| `B` | Throw a bait pod |
| `V` | Set off a repel charge |
| `X` | Hold on a creature to scan it (needs the Scanner) |
| `I` | Open the databank |
| `F` | Flashlight |
| `M` | Mute |
| `R` | Respawn, once you are dead |
| `Esc` | Pause, and hand the cursor back |
| Pause menu | Resume, save now, or save and leave the world |

The cursor is captured while you are diving and free on the title card, the
pause screen and the fabricator — nowhere else. If the browser refuses pointer
lock (some embeddings do), the game falls back to drag-to-look automatically and
tells you so: drag to aim, a click that did not drag still swings the knife.

## How it plays

**Air is the clock.** Ninety seconds of it. Surfacing refills it in a few
seconds, so the game is a series of round trips — how far down and how far out
can you get before you have to turn back. Running out starts drowning you.

**The knife works on everything.** 28 damage per strike to any creature in the
game, including stalkers (130 HP, so about five clean hits). It also pries apart
scrap. Hit a stalker and it turns on you; hurt one badly enough and it breaks off
and retreats.

**Scrap metal is the mechanic.** Salvage litters the kelp forest floor. Stalkers
home in on it from 48 metres, worry at it with their jaws, and after a few bites
pick a piece up and carry it somewhere else before losing interest. A piece that
was just disturbed — chewed, or thrown — is louder than the rest and pulls
stalkers preferentially.

That gives you a tool. Pick up a plate with `E`, throw it with `E`, and every
stalker in range chases the noise instead of you. It is the difference between
crossing the kelp forest and dying in it.

**Creatures are solid.** You cannot swim through anything. Both sides are pushed
apart with the share decided by size, so a 10 cm shrimp is the one that gets
shoved aside while a 15 m whale is effectively a wall — one rule covering the
whole range. Bodies collide along their full length, not as a ball at the
middle, so a leviathan's tail is as solid as its head.

**Stalkers hunt.** Left alone they patrol, run fish down and kill them outright,
then feed for a couple of seconds. Get within about 13 metres and you become the
more interesting target: 13 damage a bite, a hard knockback, and you drop
whatever you were carrying. After every bite a stalker breaks off and circles
back rather than chewing continuously, which is what gives you room to fight or
swim for it — expect to lose about a quarter of your health over fifteen seconds
of unbroken contact, not all of it.

**Then you build your way out of that.** Cutting a scrap pile apart with the
knife leaves **titanium**; a stalker chewing one sheds **teeth**. Swim into them
to collect, then press `Tab`:

| Item | Cost | Effect |
|---|---|---|
| Reinforced Fins | 3 titanium | Swim 30% faster |
| Reinforced Tank | 5 titanium | Air 90s → 150s |
| Serrated Blade | 4 titanium, 2 teeth | Knife 28 → 52, swings faster |
| Plated Dive Suit | 6 titanium, 3 teeth | Take 40% less damage |
| High-Pressure Tank | 9 titanium, 4 teeth | Air 150s → 260s |
| Tooth-Edged Blade | 8 titanium, 6 teeth | Knife 52 → 84, longer reach |
| **Medkit** | 1 titanium, 2 quartz | Heals 55. Stacks — build as many as you like, press `H` |
| Quartz Visor | 5 quartz, 2 gold | Roughly doubles how far you can see |
| Gold Rebreather | 5 gold, 4 quartz, 6 titanium | Air 260s → 420s |
| Prism Suit | 3 diamond, 8 titanium, 4 quartz | Take 65% less damage |
| Diamond Blade | 4 diamond, 10 titanium, 8 teeth | Knife 84 → 140 |
| **Lantern** | 4 titanium, 3 quartz | A broad, far-reaching lamp in place of the torch |
| **Marker Beacon** | 2 titanium, 1 quartz | Drop with `G` — lights the spot and pins it to your chart |
| **Leviathan Tracker** | 3 gold, 4 quartz, 4 teeth | Every leviathan on the chart, with range, wherever they are |
| **Bait Pod** | 2 titanium, 1 tooth | Throw with `B` — every stalker that hears it goes there, not at you |
| **Repel Charge** | 3 quartz, 2 teeth | Press `V` — drives stalkers within 25 m off you |
| **Scanner** | 3 titanium, 2 quartz, 1 gold | Hold `X` on a creature to catalogue it |

Five materials in all. **Titanium** from cutting scrap, **teeth** from stalkers
chewing it, and **quartz, gold and diamond** from the Crystal Caverns — the
crystals themselves give quartz, and the metal fish give what they are cast in.
The resource strip only shows a material once you have collected some, so it
starts as two counters and fills out as the ocean gives things up.

Every recipe either lets you stay down longer or survive what is down there, so
each one extends how far out you can push. Upgrades survive death.

That closes the loop: bait a stalker onto a plate so it sheds teeth, knife the
plate for titanium, and spend both on the gear that lets you reach the next
biome out.

## The ocean

The sea floor is modelled on a **continental margin**, not on rings. Depth is no
longer just distance from the middle:

* a shallow **shelf** around the origin, sloping gently — this is where the game
  lives, and it is wide on purpose;
* a **shelf break** at about 140 m where the floor falls away fast;
* nine **seamounts** that rise back out of the deep, three of them tall enough to
  reach the light — so coral reefs grow in shallow water a long way from home;
* a **submarine canyon** that wanders across the whole map and bites into the
  shelf, putting the deepest water in the game within 90 m of home;
* a **basin** gouged below the abyssal plain, where the king lives;
* a **far bank**, a plateau rising 78 m out of the abyss near the edge of the
  map, carrying the only kelp forest that is not on the shelf — and the
  leviathan that holds it;
* **the islet**, a seamount that did not stop at the surface. A sand cone
  standing twenty-odd metres out of the water on a broad reef flat, on the far
  side of the map from the far forest. It is the only dry ground in the game,
  and something lives on it.

Biomes then follow from what the floor *is* at a point — its depth, whether it
sits on a seamount, whether it lies in the canyon — rather than from how far out
you have swum. Roughly a tenth of the sea floor is shallow enough to be sunlit
even past 120 m.

| Biome | Where it occurs | Share of the floor |
|---|---|---|
| **Safe Shallows** | The shelf above ~6 m | ~3% |
| **Kelp Forest** | The shelf, 6–27 m, where the ground is right for it | ~8% |
| **Grassy Plateau** | Open shelf, 17–38 m | ~3% |
| **Coral Seamount** | Sunlit seamount tops, wherever they rise | ~6% |
| **Boulder Slope** | Shelf break, seamount flanks, the far bank's sides | ~14% |
| **Crystal Caverns** | Mineral-rich deep floor, 38–76 m | ~8% |
| **Deep Trench** | Inside the canyon | ~4% |
| **King's Basin** | The gouged basin | ~1% |
| **Kelper's Reach** | The sunlit crown of the far bank | ~1% |
| **The Islet** | The island and its reef flat | ~1% |
| **Abyssal Plain** | Everything below 76 m | ~51% |

Shares move with the seed, since the features are placed from it.

The world is **1,690 m across**. The islet is about 545 m out and the far
forest about 605 m, which is a serious swim at 4.2 m/s on ninety seconds of
air — the fabricator exists to close that gap.

### How the floor is built at that size

One grid fine enough for the shelf, stretched over the whole map, is 630,000
vertices and stalls the dive. So the sea floor is two grids: **2.2 m cells**
over the 845 m you actually swim in, and **6.6 m cells** over the abyss you
cross. Coarse cells are exactly three fine cells wide and the ring starts on a
fine tile boundary, so the grids share vertices along the seam instead of
tearing. It builds in about a second and a half on a real machine.

### How many fish

Population used to be a **share** of the map, which is why the ocean emptied
out every single time the world got wider: the same fraction of four times the
area meant the same schools spread four times as thin. It is now **absolute** —
square metres of sea floor per unit of population — so a biome that covers
twice the ground gets twice the fish, and widening the map adds ocean without
diluting it. Biomes that should defy their size say so: the abyssal plain is
scaled *down* (it is meant to feel like crossing nothing), the trench, the far
forest, the basin and the islet all scaled *up*.

A world carries roughly 5,400 fish, of which 12–40 are inside the 55 m you can
see at any moment, and 90–130 over the islet's reef. Stepping all of them costs
about 2.3 ms a frame; everything past the fog is neither drawn nor stepped at
full rate.

## The databank

Build the **Scanner**, hold `X` on a creature for a second and a half, and it is
catalogued. Press `I` to read the result.

Each entry draws the animal's **actual silhouette** — not an illustration, but
the same profile function its mesh is lofted from, fitted to the card with a
single uniform scale so the proportions are the creature's real ones. A ribbon
reads as a ribbon, a stingray as a flat sliver, an eel as a thin line. Unscanned
species keep their slot as a blank grey contact.

Scans belong to the world they were made in and are saved with it.

## The chart

A larger, less predictable ocean needs a map, so the HUD carries one. It is
drawn from the very same index the world was populated from — what you see on
the chart is literally where things were placed — coloured by biome, with your
position and heading on it.

Leviathans appear on the chart once you build the **Leviathan Tracker**, with
live range. Before that you only get a bearing when one is within 70 m, which is
its own kind of information. Beacons you drop show up as pins.

## The fish

Every species is built by the same parametric body builder from a different set
of numbers, so they are genuinely different shapes rather than recoloured copies.
Eight silhouette families drive the body: `torpedo`, `disc`, `ribbon`, `boxy`,
`eel`, `diamond`, `arrow`, `bulb`.

* **Glimmerfin** — small striped torpedo, schools of ten.
* **Bubblepeep** — round, orange, huge-eyed and slow.
* **Bladefish** — tall green ribbon that hides edge-on in the kelp.
* **Kelp Darter** — needle-nosed sprinter with a deeply forked tail.
* **Spadefin** — wafer-thin teal disc.
* **Grass Nibbler** — angular purple grazer that noses along the floor.
* **Emberfin** — hot red reef fish, faintly luminous.
* **Coral Boxfish** — a swimming brick with a square cross-section.
* **Stone Gulper** — heavy grey bottom-feeder with spines down its back.
* **Lanternjaw** — bioluminescent eel, often the only thing visible in the trench.
* **Abyss Ribbon** — 1.2 m violet streamer that drifts in the dark.
* **Stingray** — 1.1 m of wing, hugging the plateau grass.
* **Reef Porpoise / Sand Seal** — **air breathers**. The porpoise whistles as it
  works — a swept sine with vibrato over a burst of echolocation clicks, carried
  on its own open audio path, because the water filter that muffles everything
  else would swallow a whistle whole. They carry a lungful and,
  when it runs low, break off whatever they were doing and climb for the
  surface to blow. It outranks even fleeing, which is why you meet them on the
  shelf where the trip up is short.
* **Glass Shrimp / Ember Shrimp / Crystal Krill** — crustaceans, built on their
  own body profile with antennae and paddle legs. They swarm low in dense
  clouds; the krill glow, which is why the Crystal Caverns are never wholly dark.
* **Goldfin / Prism Diamondfish / Silverscale** — cast in gold, diamond and
  silver. Kill them and they leave what they are made of.
* **Crownfin** — bronze and armoured, living in the hoard's shadow.
* **Blue Drifter** — open-water ribbon out where the whale swims.
* **Stalker** — 2.6 m predator with a hinged, toothed jaw and a yellow eye.
* **Stalker Leviathan** — 8.4 m and 900 HP, the king. It sits on a pile of
  scrap its subjects drag out to it, and **will not touch you unless you touch
  it first**. Then it hits for 34.
* **Red Puff Leviathan** — 6 m, 520 HP, grazing the reef on a seamount. It
  hunts nothing and starts nothing. Attack it and it swells to nearly twice its
  size and throws a cage of thorned red vines up around *you* — sixteen stalks
  on a three-metre ring, spaced closer together than you are wide, so the ring
  genuinely holds. They wither after 26 seconds, or two knife strikes cuts one.
  Then it comes after you: a swollen fish is slow, so you can outswim it in open
  water, which is exactly why it cages you first. It throws a fresh cage every
  nine seconds while it is chasing, so running only ever buys you distance. It
  gives up once you are 90 m off, and every hit you land stokes it further.
* **Kelper Leviathan** — 11 m, 780 HP, holding the far bank's kelp forest and
  never leaving it. It barely fights. Instead it **calls kelpers**: two or three
  at a time, up to five at once, quick spindly things that weave in, take one
  loose item off you and run for the weeds. They only take what you can make
  again — bait pods, beacons, medkits, repel charges — and never touch built
  gear or raw materials. Kill the one that robbed you and the item comes
  straight back; let it reach the forest and it is gone. The leviathan itself
  only bites what comes at it, for 24.
* **Bubble Clown** — orange, banded, on the reef, and it shoots bubbles. A puff
  every few seconds normally; startled, it empties itself in a burst and bolts.
  Completely harmless. The bubbles rise, swell as the pressure drops, wobble on
  their own phase and pop at the surface.
* **Walkingcarni** — lives on the islet, and is the only animal in the game that
  is not swimming. Four legs, a long jaw, and it takes its height from the
  ground rather than integrating against the sea floor like everything else, so
  it walks the island and wades the shallows. Its appetite is tiny: a fish every
  few minutes out of the reef flat, and the rest of the time it does nothing in
  particular. It has no opinion about divers until one cuts it — and it cannot
  follow you into deep water, which is the whole defence against it.
* **Snowfleck / Ghost Bell** — the open abyss: a glowing swarm that hangs in the
  dark, and a slow pale bell that pulses rather than swims.
* **Cobblejaw / Trench Dart / Weaverfish** — the boulder slope, the canyon and
  the far forest respectively. Squat and rubble-coloured, mirror-sided and very
  fast, and flat enough to vanish between the fronds.
* **Bonded Stalker** — catalogue every fish in the databank and one of them
  bonds to you. It keeps station off your shoulder, goes after anything hunting
  you, and cannot hurt you whatever you do. Killed, it returns 10 seconds later.
* **Glasswhale Leviathan** — 15 m, 2,600 HP, with a broad baleen mouth that
  opens when it feeds and small dark eyes set behind pale rings. 15 m, and the only thing that eats stalkers. It
  swallows them whole and has **no interest in a diver at all** — it cannot hurt
  you, at any range, ever.

### The standoff

When the whale drifts into the king's water they clash: nine seconds of circling
and real damage, then both break off and stay clear of each other for a while.
Neither ever wins — health is floored at a third for both — so if you find them
fighting, it is a thing happening in the ocean rather than a fight you are in.

None of them have skeletons. The body yaws gently and the tail wags a beat
behind it, which costs almost nothing and reads as swimming.

## Nests

Six of the thirty-nine species build them — Bladefish, Grass Nibbler, Stone
Gulper, Cobblejaw, Weaverfish and the Bubble Clown. A nest is a scrape in the
floor with a clutch in it, tinted from the sea floor it is dug out of and the
parent it belongs to.

They are placed **before** the schools are, and a nesting species puts most of
its schools on its own clutches rather than on arbitrary points. That is what
makes a nest worth finding instead of a decoration: it is a reliable place to
find that species. Cutting one takes an egg and scatters every parent within
thirty metres, and there is nothing in it for you.

## Two ideas worth knowing

**The sea floor is a function, not a mesh.** `floorHeightAt(x, z)` returns the
height analytically from layered value noise. The visible terrain is generated by
sampling it, but so is every gameplay query — where kelp plants, where scrap
settles, how a fish avoids the bottom. Nothing raycasts against terrain to find
the ground, which is why a couple of hundred creatures stay cheap.

**Creatures are self-driving.** No navmesh (open water has no walkable surface)
and no behaviour trees. Each creature integrates its own velocity, turns at a
species-specific rate, and runs a small state machine re-evaluated a few times a
second. Distant creatures are neither drawn nor stepped at full rate — except
stalkers, which always think, because one hunting you from out in the murk is the
entire point.

## Tuning

* **Species** — `web/js/species.js`. One block per creature: shape numbers,
  colours, speeds, health, bite damage, school size. Adding a species is adding a
  block and giving it a `biome`. See `unreal/Docs/AddingASpecies.md`, which
  applies to both builds.
* **Biomes** — `web/js/biomes.js`: radius, depth, roughness, colours, fog
  density, how much scrap and how many stalkers.
* **Population** — `POPULATION` in `web/js/world.js` scales every school at once.
  Lower it if the frame rate suffers.
* **Terrain resolution** — `TILES`, `CELLS`, `CELL_SIZE` in `web/js/world.js`.

## Publishing an update

`web/index.html` is a complete document so it opens locally by double-clicking.
The hosted copy needs it without the `<html>`/`<head>`/`<body>` wrapper, so:

```
python3 web/tools/build-artifact.py
```

...produces `web/dist/artifact.html`, which is what gets published alongside
`web/css/` and `web/js/`.

## What is not here

* **No crafting, inventory, or base building.** The loop is dive, fight, bait,
  surface. Scrap is a tool for manipulating stalkers, not a crafting resource.
* **Water rendering is cheap.** The underwater look is exponential fog plus a
  rippled surface plane, not a water shader.
* **Health regenerates slowly** (2.5/s after 18 seconds without damage). With no
  medkits, the alternative was a one-way trip.
* **There are four cheat codes**, typed at any point while diving:
  * `sus` — every fabricator recipe, 99 of each material, infinite health and
    air, and a 9.4 m/s cruise with a 22.6 m/s sprint, because the map is
    1,690 m across and the point of this one is going to look at it.
  * `candle` — a hacked candle in the off hand that **only catches in the Deep
    Trench**. That is the thickest water in the game (0.070 fog against the
    shallows' 0.012); the candle halves it there and warms what it lights, and
    gutters out on the way over the lip. Anywhere else you carry an unlit stub.
  * `sandwich` — drags the king and the whale together, starts a clash, and
    parks you at a ringside seat to watch it.
  * `tame` — the bonded stalker now, without filling the databank first.

  A letter part-way through a code is swallowed rather than firing whatever it
  is normally bound to, so typing `sandwich` does not open the databank on the
  `i` or spend a medkit on the `h`.
* **The Unreal build has never been compiled.** It was written without an engine
  available; expect to shake out compile errors on a first build. See
  `unreal/` and the toolchain notes below.

### Unreal build notes

Requires UE 5.4+ **and** a working C++ toolchain, which is a separate install: on
Windows, Visual Studio 2022 with *Desktop development with C++*, *Game
development with C++*, and a Windows 10/11 SDK (10.0.19041 or newer). Without the
SDK, project generation fails with `Some Platforms were skipped due to invalid
SDK setup: Win64` before it reaches any of this code.

Open `unreal/StalkersLegion.uproject`, let it compile, then **File → New Level →
Empty Level** and press Play. `SLGameMode` spawns an `SLOceanWorld` that builds
everything, so an empty level is all it needs.
