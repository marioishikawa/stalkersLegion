# Stalkers Legion

An open-ocean survival game in the spirit of Subnautica. You start at the
surface with a survival knife and ninety seconds of air. Below you are eleven
biomes, forty-eight species, seven leviathans, one island, and a kelp forest full of
stalkers — long, armoured predators with a fixation on scrap metal.

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

## What finishes a world

Two things, and they turn out to be one list:

* **Catalogue every species** — all forty-eight, in the databank.
* **Kill every leviathan** — all six that can be killed.

The Glasswhale is deliberately not on the list. It cannot hurt you and **you
cannot hurt it** — swing at it and the knife simply does not land, the marker
reads *Peaceful*, and it tells you so: *This is a peaceful leviathan.* Requiring
its death would make a world unfinishable, and it is the one animal out there
that is simply left alone. You still have to catalogue it; you just have to do
that with the scanner like anybody else. (The King Stalker can still mark it —
their standoff is the one thing that does.)

**Anything you kill is something you catalogued.** You are not going to hold a
scanner steady on a leviathan for a second and a half and live, and a corpse is
a specimen whatever size it was, so the kill records the entry.

That is not only a convenience. Scanning is the only other way into the
databank and a dead animal sinks: without this, killing the last of something
you had never scanned left an entry that could never be filled and a world that
could never be finished. It was not hypothetical — the islet used to hold
exactly one Walkingcarni.

**A leviathan you killed stays killed.** A world is a seed, so opening one
regenerates the entire ocean from scratch — which used to hand you back the
leviathan you killed last session, every time the game updated. The kill list
is part of the save, and the spawner now reads it. One wrinkle worth knowing,
because the code looks wasteful on purpose: a dead leviathan is still built and
then thrown away rather than never built. Picking a spot and constructing a
creature both draw from the seeded stream, and skipping those draws would shift
every draw after them — the nests, the crabs and all eighteen thousand fish
would land somewhere else the session after a kill. Tested: with two leviathans
dead, the rest of the ocean comes back identical to three decimal places.

Finishing does not end anything. The card that comes up offers *Keep diving* or
*Leave the world*, and the only lasting change is that a finished world **can no
longer be deleted** — the delete button in the world list is replaced by a
`complete` mark. A world someone finished is not a world to lose to a stray
click.

Where you are shows up in two places: the databank header, and the pause screen.

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
* a **shelf break** at about 467 m where the floor falls away fast;
* eighty **seamounts** that rise back out of the deep, a third of them tall enough to
  reach the light — so coral reefs grow in shallow water a long way from home;
* a **submarine canyon** that wanders across the whole map and bites into the
  shelf, putting the deepest water in the game within 90 m of home;
* a **basin** gouged below the abyssal plain, where the king lives;
* a **far bank**, a plateau rising 78 m out of the abyss near the edge of the
  map, carrying the only kelp forest that is not on the shelf — and the
  leviathan that holds it;
* **the islet**, a seamount that did not stop at the surface. Thirty-odd metres
  of sand standing out of the water on a broad reef flat, on the far side of the
  map from the far forest. It is the only dry ground in the game, and something
  lives on it. Built as a flat, a shoulder and a peak rather than one cone,
  because a cone that comes to a point has a summit you cannot stand anything
  on: there are about **108 m of dry radius** up there, and six animals live on
  it.

The islet is also the one place where the ground leaves the water, and two
things had to learn that.

**Fish do not climb out.** Floor avoidance works by rising, which is the right
answer to a seamount because there is always sea above it — and the wrong answer
to a beach, where a school would follow the sand up and carry on swimming over
the island. Where the water over the ground ahead runs out, the shore is now a
wall rather than a slope: the fish samples the gradient either side of itself
and steers downhill, back toward deep water, instead of climbing. The surface is
a hard lid as well, checked before the step and again after it, because far-off
fish move in catch-up jumps of up to four tenths of a second and one of those
can finish in mid-air.

**And the sky has no black band in it.** The sky dome reaches a little below the
horizon, where its `y` goes negative — and `Math.pow(negative, 0.65)` is NaN,
which the renderer draws as black. Nobody saw it while the surface was a ceiling.
The moment you could put your head out, there was a black stripe across the
waterline. The exponent is clamped now, and below the horizon the dome simply
stays horizon-coloured, which is the air fog's colour too, so the seam vanishes
into the haze.

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

The world is **3,400 m across**. The islet is about 990 m out and the far forest
about 1,170 m, which is a serious swim at 4.2 m/s on ninety seconds of air — the
fabricator exists to close that gap.

### How the floor is built at that size

One grid fine enough for the shelf, stretched over the whole map, is millions of
vertices and stalls the dive. So the sea floor is two grids: **2.2 m cells** over
the 845 m you actually swim in, and **6.6 m cells** over the abyss you cross.
Coarse cells are exactly three fine cells wide and the ring starts on a fine tile
boundary, so the grids share vertices along the seam instead of tearing. 492,000
vertices for a 3.4 km map, and a couple of seconds to build.

### How many fish

Population used to be a **share** of the map, which is why the ocean emptied
out every single time the world got wider: the same fraction of four times the
area meant the same schools spread four times as thin. It is now **absolute** —
square metres of sea floor per unit of population — so a biome that covers
twice the ground gets twice the fish, and widening the map adds ocean without
diluting it. Biomes that should defy their size say so: the abyssal plain is
scaled *down* (it is meant to feel like crossing nothing), the trench, the far
forest, the basin and the islet all scaled *up*.

A world carries roughly 19,700 fish, of which 15–37 are inside the 55 m you can
see at any moment, and 140-odd over the islet's reef. The abyssal plain runs
thinner than that on purpose.

The ceiling on that scaling is a share guard, not a headcount, so it scales with
the map too. Left fixed it started biting on the big biomes the moment the world
grew — the abyssal plain and the boulder slope both pinned at the cap, covering
twice the ground with the same number of fish, which is the share-versus-absolute
thinning again by another route.

Fish are stepped in **three tiers by distance**, not two: full rate inside 55 m,
quarter rate out to 143 m, and a sixteenth beyond that with a correspondingly
longer (and capped) step. That is what stops the frame cost growing with the
map — the last doubling added 87% more fish for 28% more work, because almost
all of them are somewhere you are not.

Stepping the world costs around **15 ms a frame**, measured by instrumenting the
real frame loop in a software-rendered headless container — so the number on a
machine with a GPU is lower, but that is the honest ceiling. Turn `POPULATION`
in `web/js/world.js` down if a weaker machine struggles; it is one dial and it
scales every school at once. (An earlier revision of this file claimed 2.3 ms.
That came from calling `update()` sixty times in a tight loop, which re-runs the
HUD and the chart redraw with no frame in between and does not measure what a
frame costs.)

## The databank

Build the **Scanner**, hold `X` on a creature for a second and a half, and it is
catalogued. Press `I` to read the result.

Each entry is **drawn from the animal's own numbers** — the same profile
function its mesh is lofted from, so the proportions are the creature's real
ones and a ribbon reads as a ribbon, a stingray as a flat sliver, an eel as a
thin line.

It is a picture rather than a silhouette: every part the body builder puts on
the mesh gets drawn as its own piece in its own colour. Fins behind the body, a
gradient down the flank from back to belly, stripes clipped to it, spines along
the back, legs, antennae, a mouth line, and a ringed eye with a catchlight —
two pixels of white being the difference between an eye and a hole. Drawn at
twice the size it is shown at, so the lines stay crisp. Unscanned species keep
their slot as a blank grey contact.

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
  never leaving it. Robbing you is its opening move rather than its whole
  answer: stay in its water about ten seconds after the kelpers are out and it
  comes and drives you off the bank itself, for 24 a bite. Swim off the bank and
  it has to turn back — it will not leave the forest to chase anyone. Its
  opening move is to **call kelpers**: two or three
  at a time, up to five at once, quick spindly things that weave in, take one
  loose item off you and run for the weeds. They only take what you can make
  again — bait pods, beacons, medkits, repel charges — and never touch built
  gear or raw materials. Kill the one that robbed you and the item comes
  straight back; let it reach the forest and it is gone. The leviathan itself
  only bites what comes at it, for 24.
* **Fatfish / Stick Fish / Plate Fish** — three fish that are each mostly one
  shape. The Fatfish is nearly spherical, too wide to hide and too slow to run,
  and does not appear to mind. The Stick Fish is a twig with an eye on it: 95 cm
  long and 3 cm through, hanging among the kelp stalks, and its tail beat is set
  so low that it drifts rather than wriggles. The Plate Fish is round, white and
  4 cm thick, and turns edge-on when something looks at it.
* **Craber** — a crab, so it walks. It takes its height from the sea floor
  instead of swimming above it, steers in two dimensions, and is carried at
  ninety degrees to its travel so it goes **sideways**. It lives in the Safe
  Shallows and nowhere else: every point it picks is checked against the biome
  first, and one that gets chased over the line walks back. Come within nine
  metres and it bolts — off at an angle, not in a straight line — then freezes,
  because a stationary crab is a rock and it knows it.
* **Crober** — the Craber, in blue. Deliberately nothing else: same eight legs,
  same eyes on stalks, same sideways bolt, same sand. The crab class takes its
  species as a parameter rather than naming one, so the two of them are one
  animal with two coats and none of the behaviour is written twice. There are
  fewer blue ones — three to every seven — which is the whole of what makes
  turning one up worth anything.
* **Bubble Clown** — orange, banded, on the reef, and it shoots bubbles. A puff
  every few seconds normally; startled, it empties itself in a burst and bolts.
  Completely harmless. The bubbles rise, swell as the pressure drops, wobble on
  their own phase and pop at the surface.
* **Glow Leviathan** — thirteen metres of fish lit from the inside, crossing the
  abyssal plain. It is the only leviathan that is genuinely a *light source*
  rather than a shape you make out: a 120 m lamp that lays a pool of light on
  the sea floor under it, wrapped in an additive halo that reads as the glow
  coming off it. Its materials are the one place in the game where fog is
  switched off — a fogged light dims with distance, and a light that dims with
  distance is not a landmark. Across a black plain at 180 m it is a single cyan
  point and the only thing you can see.

  **And the light is bait.** It is the only thing in the game that hunts the
  diver on purpose — every other leviathan has to be provoked first, and the
  whale cannot hurt you at all. Come inside 44 m and it stops crossing, hangs
  and burns brighter while you close, then **puts itself out**: the only light
  on the plain, gone, and a second and a half later it is coming at you in the
  dark at 5 m/s. The charge is committed rather than a chase, so it overshoots
  and has to swing wide and come round again, and it rests for five seconds
  after each pass — there is always a window to leave in, and a sprint gets you
  out. Thirty damage a bite. The proximity warning that used to watch only
  stalkers now watches this too, on a wider band, because it closes much faster.
* **Walkingcarni Leviathan** — the same animal three and a half times over:
  6.5 m, six legs instead of four, 900 HP, 34 a bite, and none of its smaller
  relative's indifference. The island is its island. It **walks the tideline**
  rather than the summit, because that is where the fish are and where a diver
  can actually be, and anything that swims onto the reef flat gets charged
  without being provoked first. It wades out to about 7 m of water and no
  further, and it will not leave the island at all — swimming off the flat is
  the whole of your defence, and it works. Tested: three bites and a dead diver
  in seventeen seconds if you stay; untouched and at full health if you swim.
  It **bites and nothing else**: it neither knocks you back nor barges you along
  in front of it. Six and a half metres of animal shoving a diver across the
  beach turned a fight into a wrestling match with the terrain, and the damage
  was always the threat. Tested: dead in sixteen seconds standing in its jaw,
  and moved zero metres doing it.
* **Walkingcarni** — **five of them** live on the islet, spread from the summit
  down to the surf, and they are the only animals in the game that are not
  swimming. Four legs, a long jaw, and it takes its height from the
  ground rather than integrating against the sea floor like everything else, so
  it walks the island and wades the shallows. Its appetite is tiny: a fish every
  few minutes out of the reef flat, and the rest of the time it does nothing in
  particular. It has no opinion about divers until one cuts it — and it cannot
  follow you into deep water, which is the whole defence against it. There used
  to be exactly one, which was a problem: killing it was a perfectly reasonable
  way to meet the species and then the species was gone, taking its databank
  entry and any chance of finishing that world with it.
* **Snake Fish** — four and a bit metres of banded rope over the boulder slope
  and the seamount, and the only animal built as a chain rather than a single
  mesh. Solitary, slow to turn, and no threat to anybody: it has no trick for
  hiding and no speed to run with, so it pours itself between the boulders and
  is gone.
* **Diamond Fish Leviathan** — the crystal caverns' own, and the one animal in
  the game whose defining stat is how much it can take. Eleven metres of cut
  stone: **3,000 health**, against 1,400 for the next biggest thing you can
  kill. That is only the headline. It **heals 7 a second** whenever you stop
  hitting it, so chipping away at it between trips for air does literally
  nothing — the wound is gone before you are back. And land 300 damage inside
  seven seconds and it **sets**: stops dead, glitters, shrugs off 65% of
  everything for five seconds and grows 200 health back while you stand there,
  then goes back to work with a twenty-second cooldown. Keep swinging through
  it and you still make progress, just slowly.

  It is the one leviathan you cannot beat by halves, and it is deliberately
  slow and turns like a barge so that the counterweight is real: you can
  out-swim it trivially, and leading it off the crystal makes it turn back.
  Tested: 147 swings and 75 seconds of uninterrupted knifing, through four
  sets, to put one down. Bring a tank.
* **Snowfleck / Ghost Bell** — the open abyss: a glowing swarm that hangs in the
  dark, and a slow pale bell that pulses rather than swims.
* **Cobblejaw / Trench Dart / Weaverfish** — the boulder slope, the canyon and
  the far forest respectively. Squat and rubble-coloured, mirror-sided and very
  fast, and flat enough to vanish between the fronds.
* **Bonded Stalker** — catalogue every fish in the databank and one of them
  bonds to you. It keeps station off your shoulder, goes after anything hunting
  you, and cannot hurt you whatever you do. Killed, it returns 10 seconds later.
* **Glasswhale Leviathan** — **unkillable, and harmless.** 15 m, with a broad baleen mouth that
  opens when it feeds and small dark eyes set behind pale rings. 15 m, and the only thing that eats stalkers. It
  swallows them whole and has **no interest in a diver at all** — it cannot hurt
  you, at any range, ever.

### The standoff

When the whale drifts into the king's water they clash: nine seconds of circling
and real damage, then both break off and stay clear of each other for a while.
Neither ever wins — health is floored at a third for both — so if you find them
fighting, it is a thing happening in the ocean rather than a fight you are in.

Most of them have no skeleton. The body yaws gently and the tail wags a beat
behind it, which costs almost nothing and reads as swimming.

A serpentine species is the exception, because that trick has nothing to say
about a snake. Its body is lofted as a **chain of linked pieces** instead of one
mesh — neighbouring pieces share a spine ring and each is capped, so the joints
stay closed however far they bend — and every joint repeats its neighbour a beat
later. That is a wave travelling from head to tail, which is a snake swimming.
The amplitude grows toward the tail, so the head leads and the tail throws
itself about rather than the whole animal shaking like a rope. It costs one
`rotation.y` per link per frame. The Snake Fish is four and a bit metres of it,
in eleven links.

## Nests

Six species build them — Bladefish, Grass Nibbler, Stone Gulper, Cobblejaw,
Weaverfish and the Bubble Clown. A nest is a scrape in the floor with a clutch
in it, tinted from the sea floor it is dug out of and the parent it belongs to.

**They hatch, and how fast depends on how badly the species is doing.** Every
world records what it started with, species by species. A nest compares that
against how many are still alive: at ninety per cent or better it does nothing,
and below that the eggs come faster the fewer there are — from one every four
minutes down to one every twenty seconds for something almost gone. Nests tick
everywhere at once, not only where you are, so a species being farmed out at one
end of the map recovers at the other. It is the only way anything comes back,
and it means the last few of something are worth more alive than dead.

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

## When the sound goes

A browser can suspend an audio context whenever it likes — a backgrounded tab
is the usual reason, an iframe nobody has clicked in is the other — and it does
not tell the page. The game simply goes quiet and stays quiet for the rest of
the session, which is indistinguishable from a bug.

Two things now stop that. Every keypress, click and touch is treated as
permission to make noise and wakes a sleeping context, as does coming back to
the tab; and **the HUD says `sound off` for exactly as long as it is true**,
whether the cause is a suspended context or the mute key. Muting used to flash
a note for a second and a quarter, so a diver who hit `M` by accident had a
silent game and nothing on screen to explain it.

## What is not here

* **No crafting, inventory, or base building.** The loop is dive, fight, bait,
  surface. Scrap is a tool for manipulating stalkers, not a crafting resource.
* **Water rendering is cheap.** The underwater look is exponential fog plus a
  rippled surface plane, not a water shader.
* **Health regenerates slowly** (2.5/s after 18 seconds without damage). With no
  medkits, the alternative was a one-way trip.
* **There are five cheat codes**, typed at any point while diving:
  * `sus` — every fabricator recipe, 99 of each material, infinite health and
    air, and a 9.4 m/s cruise with a 22.6 m/s sprint, because the map is
    3,400 m across and the point of this one is going to look at it.
  * `candle` — a hacked candle in the off hand that **only catches in the Deep
    Trench**. That is the thickest water in the game (0.070 fog against the
    shallows' 0.012); the candle halves it there and warms what it lights, and
    gutters out on the way over the lip. Anywhere else you carry an unlit stub.
  * `sandwich` — drags the king and the whale together, starts a clash, and
    parks you at a ringside seat to watch it.
  * `tame` — the bonded stalker now, without filling the databank first.
  * `teletransportsus` — opens a box, you write a place, you go there. The
    places are read off the world each time it opens rather than being a list
    of coordinates: every biome, the island summit, the whale ground, the far
    bank, home, straight up, straight down, every leviathan **still alive**,
    and every beacon you have planted. Matching is deliberately loose — names
    are stripped to letters and digits and tried exact, prefix, contained and
    containing, and then by spelling, so `kelp`, `kelpers reach`, `cristal`,
    `shalows` and `abbys` all arrive somewhere sensible while `narnia` is told
    there is no such place. It never drops you inside the sea floor, it stands
    you on the islet rather than in it, and a biome is re-rolled until the
    point really is in that biome — ask for the abyss and you will not arrive
    in the canyon that cuts through it. Tested: 55 biome jumps, no misses.

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
