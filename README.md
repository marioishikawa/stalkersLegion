# Stalkers Legion

An open-ocean survival game for **Unreal Engine 5**, in the spirit of Subnautica.
You start at the surface with a survival knife and a lungful of air. Below you
are six biomes, eleven species of fish, and a kelp forest full of stalkers —
long, armoured predators with a fixation on scrap metal.

Everything you see is **generated procedurally at runtime from C++**: the sea
floor, the biome layout, every fish body, every kelp stalk, every piece of
scrap. The project therefore contains no `.uasset` or `.umap` files at all — you
can read the whole game as source.

---

## Running it

Requires **Unreal Engine 5.4 or newer** (nothing in the code is version-specific;
5.3 should work if you change `EngineAssociation` in `StalkersLegion.uproject`).

1. Right-click `StalkersLegion.uproject` → **Generate project files**, then build,
   or just open the `.uproject` and let the editor compile the modules.
2. On first editor launch the project generates the two materials it renders with
   (`/Game/Materials/M_SLVertexColor` and `M_SLVertexColorGlow`). This happens
   automatically — see [Materials](#materials) if you want to know why.
3. **File → New Level → Empty Level**, then press **Play**.

That is genuinely all the setup there is. An empty level is enough: `SLGameMode`
spawns an `SLOceanWorld` actor, which builds the sea floor, the lighting, the
water surface, and every plant, fish, stalker and scrap pile before you take your
first breath. Generation takes roughly a second.

To keep the level around, save it and set it as the default map in
**Project Settings → Maps & Modes**.

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` | Swim (you go where you look — look down and hold `W` to dive) |
| `Space` / `Ctrl` | Rise / sink |
| `Shift` | Sprint (burns air faster) |
| Mouse | Look |
| **Left mouse** | Swing the survival knife |
| `E` | Pick up scrap metal / throw the piece you are holding |
| `F` | Flashlight |
| `R` | Respawn, once you are dead |

## How it plays

**Air is the clock.** You carry 90 seconds of it. Surfacing refills it in a few
seconds, so the whole game is a series of round trips — how far down and how far
out can you get before you have to turn around. Running out starts drowning you.

**The knife works on everything.** It does 28 damage per strike to any creature
in the game, including stalkers (130 HP, so about five clean hits). It also pries
apart scrap. Hitting a stalker makes it turn on you; hurt one badly enough and it
breaks off and retreats.

**Scrap metal is the mechanic.** Pieces of salvage litter the kelp forest floor.
Stalkers home in on them from 48 metres away, worry at them with their jaws, and
after a few bites will pick a piece up and carry it somewhere else before losing
interest. A piece that has just been disturbed — chewed, or thrown — is louder
than the rest and pulls stalkers preferentially.

That gives you a tool. Pick up a plate with `E`, throw it with `E`, and every
stalker in range chases the noise instead of you. It is the difference between
crossing the kelp forest and dying in it.

**Stalkers hunt.** Left alone they cruise their territory, chase down fish and
kill them outright, and feed for a couple of seconds before moving on. Get within
about 13 metres and you become the more interesting target: 22 damage per bite,
a hard knockback, and you drop whatever you were carrying.

## The ocean

Six biomes in rings around the origin. Ring boundaries are warped by noise, so
they read as coastlines rather than circles. Swim in any direction and it gets
deeper and darker.

| Biome | Radius | Floor | What lives there |
|---|---|---|---|
| **Safe Shallows** | 0 – 26 m | 7 m | Glimmerfin, Bubblepeep. Bright, sandy, harmless. |
| **Kelp Forest** | 26 – 52 m | 15 m | Bladefish, Kelp Darter — **and seven stalkers.** Dense kelp, scrap everywhere. |
| **Grassy Plateau** | 52 – 74 m | 21 m | Spadefin, Grass Nibbler. Open sea grass, a couple of stalkers. |
| **Red Coral Reef** | 74 – 92 m | 27 m | Emberfin, Coral Boxfish. Coral fans and tubes. |
| **Boulder Field** | 92 – 106 m | 34 m | Stone Gulper. Rocks and glow pods, deep gloom. |
| **Deep Trench** | 106 m + | 48 m + | Lanternjaw, Abyss Ribbon. Near-total darkness — bring the flashlight. |

Fog colour and density track whichever biome you are in, fading smoothly as you
cross between them and darkening with depth.

## The fish

Every species is built by the same parametric body builder from a different set
of numbers, so they are genuinely different shapes rather than recoloured copies.
Eight silhouette families drive the body: `Torpedo`, `Disc`, `Ribbon`, `Boxy`,
`Eel`, `Diamond`, `Arrow`, `Bulb`.

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

Fish swim in schools behind a leader, drop down to graze, and scatter from
stalkers and from you. None of them have skeletons: the body yaws gently and the
tail wags a beat behind it, which costs almost nothing and reads as swimming.

## Architecture

```
Source/StalkersLegion/
  Core/         SLTypes      species, biome and body-shape structs
                SLGameMode   wires up diver + HUD, spawns the ocean
                SLHUD        canvas-drawn HUD (no UMG assets)
  Procedural/   SLProcMesh   mesh container, primitives, lofts, value noise
                SLBodyBuilder grows a creature body from a species definition
                SLMaterialLibrary resolves the vertex-colour materials
  World/        SLBiomeLibrary the analytic height field and biome map
                SLOceanWorld  builds terrain, lighting, flora, scrap, creatures
                SLFloraPatch  batches many plants into one mesh
                SLScrapMetal  the salvage stalkers obsess over
  Creatures/    SLSpeciesLibrary the full species roster
                SLCreature    shared swimming, steering, damage and death
                SLFish        schooling and fleeing
                SLStalker     the predator's priority ladder
  Player/       SLDiver          swimming, air, input, scrap handling
                SLSurvivalKnife  procedural swing and swept-sphere strike
```

Two design decisions are worth calling out, because they explain most of the rest:

**The sea floor is a function, not a mesh.** `SLBiomeLibrary::FloorHeightAt(x, y)`
returns the floor height analytically from layered value noise. The visible
terrain is generated by sampling it, but so is every gameplay query — where to
plant kelp, where scrap settles, how a fish avoids the bottom. Nothing traces
against terrain collision to find the floor, which is why hundreds of creatures
can steer cheaply.

**Creatures are self-driving pawns.** There is no navmesh (open water has no
walkable surface) and no behaviour trees (they would be binary assets). Each
creature integrates its own velocity, turns at a species-specific rate, and runs
a small C++ state machine re-evaluated a few times a second.

## Tuning

* **Species** — `SLSpeciesLibrary.cpp`. One block per creature: shape numbers,
  colours, speeds, health, bite damage, school size. Adding a species is adding a
  block and giving it a `HomeBiome`.
* **Biomes** — `SLBiomeLibrary.cpp`: radius, depth, roughness, colours, fog
  density, how much scrap and how many stalkers.
* **Population** — `SLOceanWorld::PopulationScale` scales every creature and
  scrap count at once. Drop it to 0.5 on a slow machine.
* **Terrain resolution** — `TilesPerSide`, `CellsPerTile`, `CellSize` on
  `SLOceanWorld`.

## Materials

Procedural meshes need a material that reads vertex colour, and a material is a
binary asset. Rather than commit one, the editor module `StalkersLegionEditor`
generates both materials into `/Game/Materials` on first launch:

* `M_SLVertexColor` — lit, vertex colour → base colour. Terrain, fish, scrap.
* `M_SLVertexColorGlow` — unlit, vertex colour → emissive. Bioluminescence, glow
  pods, the water surface.

If they are ever missing, `SLMaterialLibrary` falls back to an engine debug
material that also displays vertex colour, and then to the grid material, so the
game still runs (it just looks wrong). You can also make them by hand in thirty
seconds: new Material, drag in a **VertexColor** node, connect it to Base Color.

## What is not here

Being straight about the edges of this build:

* **No audio.** Sound cues are binary assets; there are none in the project.
* **No particles.** Bites and knife hits are sold by motion and knockback rather
  than by effects.
* **No crafting, inventory, or base building.** The loop is dive, fight, bait,
  surface. Scrap is a tool for manipulating stalkers, not a crafting resource.
* **Water rendering is cheap.** Underwater look comes from exponential height fog
  anchored at the water line, not from a water material or post-process volume.
* **Health regenerates slowly** (2.5 HP/s after 18 seconds without damage).
  With no medkits in the game, the alternative was a one-way trip.
