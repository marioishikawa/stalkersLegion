# Stalkers Legion

An open-ocean survival game in the spirit of Subnautica. You start at the
surface with a survival knife and ninety seconds of air. Below you are six
biomes, eleven species of fish, and a kelp forest full of stalkers — long,
armoured predators with a fixation on scrap metal.

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

Every recipe either lets you stay down longer or survive what is down there, so
each one extends how far out you can push. Upgrades survive death.

That closes the loop: bait a stalker onto a plate so it sheds teeth, knife the
plate for titanium, and spend both on the gear that lets you reach the next
biome out.

## The ocean

Six biomes in rings around the origin, with boundaries warped by noise so they
read as coastlines rather than circles. Swim any direction and it gets deeper
and darker.

| Biome | Radius | Floor | What lives there |
|---|---|---|---|
| **Safe Shallows** | 0–26 m | 7 m | Glimmerfin, Bubblepeep. Bright, sandy, harmless. |
| **Kelp Forest** | 26–52 m | 15 m | Bladefish, Kelp Darter — **and six stalkers.** Dense kelp, scrap everywhere. |
| **Grassy Plateau** | 52–74 m | 21 m | Spadefin, Grass Nibbler. Open sea grass, a couple of stalkers. |
| **Red Coral Reef** | 74–92 m | 27 m | Emberfin, Coral Boxfish. Coral fans and tubes. |
| **Boulder Field** | 92–106 m | 34 m | Stone Gulper. Rocks and glow pods, deep gloom. |
| **Deep Trench** | 106 m + | 48 m + | Lanternjaw, Abyss Ribbon. Near-total darkness — bring the flashlight. |

Fog colour and density track the biome you are in, fading between them and
darkening with depth. The audio does the same: everything runs through a lowpass
that closes further the deeper you go.

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
* **Stalker** — 2.6 m predator with a hinged, toothed jaw and a yellow eye.

None of them have skeletons. The body yaws gently and the tail wags a beat
behind it, which costs almost nothing and reads as swimming.

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
* **There is a cheat code.** Type `sus` at any point while diving to unlock every
  fabricator recipe and top up your materials.
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
