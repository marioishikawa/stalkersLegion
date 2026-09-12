# Adding a species

Every creature in the game comes from one `FSLSpeciesDef` block in
`Source/StalkersLegion/Private/Creatures/SLSpeciesLibrary.cpp`. There is no
asset to author and no blueprint to derive — add the block, rebuild, press Play,
and the fish is in the ocean with a body of its own.

## The shortest possible example

```cpp
{
    FSLSpeciesDef D = MakeFish(TEXT("Sailfin"), TEXT("Sailfin"),
                               ESLBiome::GrassyPlateau, ESLBodyProfile::Disc);
    D.Shape.Length = 50.f;
    D.Shape.Height = 0.55f;      // very tall
    D.Shape.Width  = 0.05f;      // very thin
    D.Shape.DorsalFin = 0.40f;   // the sail
    D.BackColor  = FLinearColor(0.15f, 0.25f, 0.60f);
    D.BellyColor = FLinearColor(0.95f, 0.95f, 0.90f);
    D.FinColor   = FLinearColor(0.35f, 0.45f, 0.85f);
    R.Add(D);
}
```

`MakeFish` fills in sensible defaults (14 HP, schools of seven, grazer diet), so
a block only has to state what makes the animal different.

## Shaping the body

`BodyProfile` picks the silhouette family; the numbers in `Shape` bend it.

| Profile | Reads as | Characteristic settings |
|---|---|---|
| `Torpedo` | ordinary streamlined fish | even `Height` and `Width` |
| `Disc` | coin, angelfish | `Height` 0.4+, `Width` under 0.08 |
| `Ribbon` | eel-grass, streamer | long `Length`, low `Height`, tiny `Width` |
| `Boxy` | boxfish, armoured | `CrossSectionPower` 4–6 |
| `Eel` | long and cylindrical | low `Height`/`Width`, many `SpineSegments` |
| `Diamond` | angular, hard shoulders | `BellyPosition` around 0.35 |
| `Arrow` | needle nose, broad shoulders | `NoseSharpness` near 1.0 |
| `Bulb` | fat head, whip tail | `BellyPosition` 0.3, high `Width` |

Useful dials beyond the profile:

* `TailFork` — 0 is a paddle tail, 1 is a deep swallowtail.
* `Stripes` — paints N dark bands into the vertex colours.
* `BackSpikes` — spines down the spine.
* `JawLength` — anything above 0 gives a hinged, toothed lower jaw that the
  animation code opens and snaps. This is what makes a predator look like one.
* `Glow` — above 0.35 the body switches to the unlit material and becomes
  bioluminescent, which is how the Lanternjaw stays visible in the trench.
* `SpineSegments` / `RadialSegments` — mesh density. Keep them low; a school of
  ten shares one cached mesh, but every creature is still its own draw call.

Colours are applied as a gradient: `BackColor` over the top, `BellyColor`
underneath (automatic countershading), `FinColor` on every fin, `EyeColor` on the
eyes.

## Behaviour

* `Diet` — `Grazer` and `Scavenger` spawn as `ASLFish`; `Carnivore` is what makes
  something a stalker-style predator.
* `CruiseSpeed` / `SprintSpeed` / `TurnRate` — handling. A high `TurnRate` with a
  high `SprintSpeed` gives a darter; low values give something that lumbers.
* `SenseRadius` — how far it notices threats (or prey).
* `SchoolSize` / `GroupsPerBiome` — how many spawn together, and how many groups
  per biome.
* `PreferredAltitude` — height above the floor it likes to sit at.
* `WagRate` — tail beat. Small fish flutter (7–9), big ones sweep (2–3).

## Where it spawns

`HomeBiome` is all that is needed: `SLOceanWorld::SpawnCreatures` asks
`SLSpeciesLibrary::FishOfBiome` for each biome's roster and places groups inside
that ring. If you want a new predator rather than prey, give it
`ESLDiet::Carnivore` and spawn it like the stalker — `SLOceanWorld` reads
`FSLBiomeDef::StalkerCount` for that, in `SLBiomeLibrary.cpp`.
