#pragma once

#include "CoreMinimal.h"
#include "SLTypes.generated.h"

/** The six regions of the ocean. They are laid out as rings around the origin. */
UENUM(BlueprintType)
enum class ESLBiome : uint8
{
	SafeShallows	UMETA(DisplayName = "Safe Shallows"),
	KelpForest		UMETA(DisplayName = "Kelp Forest"),
	GrassyPlateau	UMETA(DisplayName = "Grassy Plateau"),
	RedCoralReef	UMETA(DisplayName = "Red Coral Reef"),
	BoulderField	UMETA(DisplayName = "Boulder Field"),
	DeepTrench		UMETA(DisplayName = "Deep Trench"),
	Count			UMETA(Hidden)
};

/**
 * Silhouette family for a creature. The mesh builder turns this into a very
 * different body: it controls how the cross-section radius evolves along the
 * spine and how square/round each cross-section is.
 */
UENUM(BlueprintType)
enum class ESLBodyProfile : uint8
{
	Torpedo		UMETA(DisplayName = "Torpedo"),		// classic streamlined fish
	Disc		UMETA(DisplayName = "Disc"),		// tall, coin-like, wafer thin
	Ribbon		UMETA(DisplayName = "Ribbon"),		// long and flat, drifts like cloth
	Boxy		UMETA(DisplayName = "Boxy"),		// blunt cube-ish boxfish
	Eel			UMETA(DisplayName = "Eel"),			// long, near-constant radius
	Diamond		UMETA(DisplayName = "Diamond"),		// sharp shoulders, angular
	Arrow		UMETA(DisplayName = "Arrow"),		// needle nose, wide shoulders
	Bulb		UMETA(DisplayName = "Bulb")			// fat front, whip tail
};

UENUM(BlueprintType)
enum class ESLDiet : uint8
{
	Grazer		UMETA(DisplayName = "Grazer"),		// harmless, flees everything
	Scavenger	UMETA(DisplayName = "Scavenger"),	// harmless, curious about scrap
	Carnivore	UMETA(DisplayName = "Carnivore")	// hunts fish, bites the player
};

/** Types of static flora/rock the world builder scatters over the floor. */
UENUM(BlueprintType)
enum class ESLFloraType : uint8
{
	Kelp,
	SeaGrass,
	CoralFan,
	CoralTube,
	Boulder,
	GlowPod
};

/**
 * Everything the procedural mesh builder needs to grow a body. Two species with
 * the same profile but different numbers here still read as different animals.
 */
USTRUCT(BlueprintType)
struct FSLBodyShape
{
	GENERATED_BODY()

	/** Nose-to-tail length in cm. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Length = 40.f;

	/** Peak half-height as a fraction of Length. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Height = 0.28f;

	/** Peak half-width as a fraction of Length. Small values give flat fish. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Width = 0.14f;

	/** Where along the spine the body is fattest (0 = nose, 1 = tail root). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float BellyPosition = 0.35f;

	/** Cross-section squareness. 2 = ellipse, 4+ = boxy, <2 = pinched. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float CrossSectionPower = 2.f;

	/** How pointed the snout is. 0 = blunt, 1 = needle. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float NoseSharpness = 0.5f;

	/** Tail fin height and sweep, as fractions of Length. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float TailHeight = 0.35f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float TailSweep = 0.25f;

	/** 0 = paddle tail, 1 = deeply forked tail. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float TailFork = 0.4f;

	/** Dorsal (top) fin height as a fraction of Length. 0 removes it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float DorsalFin = 0.18f;

	/** Ventral (bottom) fin height as a fraction of Length. 0 removes it. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float VentralFin = 0.f;

	/** Pectoral (side) fin length as a fraction of Length. 0 removes them. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float SideFin = 0.12f;

	/** Eye radius as a fraction of Length. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float EyeSize = 0.05f;

	/** Number of vertical stripes painted into the vertex colours. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 Stripes = 0;

	/** Segments along the spine / around each ring. More = smoother, costlier. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 SpineSegments = 14;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 RadialSegments = 10;

	/** If > 0 the creature gets a hinged lower jaw of this length fraction. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float JawLength = 0.f;

	/** Number of spikes running down the back. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 BackSpikes = 0;
};

/** A full species definition: looks, stats and behaviour tuning in one place. */
USTRUCT(BlueprintType)
struct FSLSpeciesDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FName Id;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString DisplayName;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) ESLBiome HomeBiome = ESLBiome::SafeShallows;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) ESLDiet Diet = ESLDiet::Grazer;

	/** Silhouette family. Drives how the body radius evolves along the spine. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) ESLBodyProfile BodyProfile = ESLBodyProfile::Torpedo;

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FSLBodyShape Shape;

	/** Back, belly, fin and eye colours. Blended across the body by the builder. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor BackColor = FLinearColor(0.1f, 0.3f, 0.5f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor BellyColor = FLinearColor(0.9f, 0.9f, 0.85f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor FinColor = FLinearColor(0.2f, 0.5f, 0.7f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor EyeColor = FLinearColor(0.02f, 0.02f, 0.03f);

	/** Emissive boost for deep-sea species (drives an unlit glow in the colour). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Glow = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite) float MaxHealth = 20.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float CruiseSpeed = 180.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float SprintSpeed = 380.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float TurnRate = 90.f;

	/** How far the creature can notice things. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float SenseRadius = 1200.f;

	/** Carnivore only: damage per bite and seconds between bites. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float BiteDamage = 0.f;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float BiteInterval = 1.6f;

	/** Typical number spawned together, and how many groups per biome. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 SchoolSize = 1;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 GroupsPerBiome = 6;

	/** Preferred height above the sea floor. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float PreferredAltitude = 300.f;

	/** Tail wag frequency multiplier - small fish flutter, big ones sweep. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float WagRate = 6.f;
};

/** Per-biome look and contents. */
USTRUCT(BlueprintType)
struct FSLBiomeDef
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite) ESLBiome Biome = ESLBiome::SafeShallows;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FString DisplayName;

	/** Distance from the world origin where this ring ends. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float OuterRadius = 4000.f;

	/** Average floor depth (positive = metres-ish below the surface, in cm). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float FloorDepth = 800.f;

	/** Vertical noise amplitude of the floor in this ring. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float Roughness = 200.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor FloorColor = FLinearColor(0.76f, 0.70f, 0.52f);
	UPROPERTY(EditAnywhere, BlueprintReadWrite) FLinearColor WaterColor = FLinearColor(0.05f, 0.35f, 0.45f);

	/** Visibility falls as this rises. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) float FogDensity = 0.02f;

	/** How much scrap metal litters this biome's floor. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 ScrapCount = 0;

	/** How many stalkers patrol this biome. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 StalkerCount = 0;

	/** Flora scattered per square of floor, keyed by type. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite) TArray<ESLFloraType> Flora;
	UPROPERTY(EditAnywhere, BlueprintReadWrite) int32 FloraDensity = 40;
};
