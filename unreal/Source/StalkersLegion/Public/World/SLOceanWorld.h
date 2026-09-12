#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/SLTypes.h"
#include "SLOceanWorld.generated.h"

class UProceduralMeshComponent;
class AExponentialHeightFog;
class ADirectionalLight;
class ASkyLight;
class APostProcessVolume;
class ASLFloraPatch;

/**
 * Builds and runs the ocean.
 *
 * Drop this actor in a level - or let SLGameMode spawn one - and it generates
 * the sea floor, the water surface, the lighting rig, every plant, every piece
 * of scrap and every creature at BeginPlay. An empty level is all the project
 * needs, which is why it ships without a .umap.
 *
 * It also drives the ambience: fog colour and density track whichever biome the
 * player is currently swimming through, so the shallows stay bright and blue
 * while the trench closes in to almost nothing.
 */
UCLASS()
class STALKERSLEGION_API ASLOceanWorld : public AActor
{
	GENERATED_BODY()

public:
	ASLOceanWorld();

	/** Generates everything. Called from BeginPlay; safe to call again to rebuild. */
	UFUNCTION(BlueprintCallable, Category = "Ocean")
	void BuildWorld();

	/**
	 * Puts the player at the surface above the Safe Shallows.
	 * Returns false if there is no player pawn yet, in which case the caller
	 * should try again shortly.
	 */
	UFUNCTION(BlueprintCallable, Category = "Ocean")
	bool PlacePlayerAtStart();

	virtual void Tick(float DeltaSeconds) override;

	// --- Generation settings ---------------------------------------------------

	/** Tiles per side of the sea floor grid. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Terrain") int32 TilesPerSide = 6;

	/** Quads per side within a tile. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Terrain") int32 CellsPerTile = 34;

	/** Size of one quad, in cm. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Terrain") float CellSize = 130.f;

	/** Set false to keep an existing level's own lighting. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Atmosphere") bool bSpawnLighting = true;

	/** Set false to skip the water surface plane. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Atmosphere") bool bSpawnWaterSurface = true;

	/** Master multiplier on every creature count, for profiling on slow machines. */
	UPROPERTY(EditAnywhere, Category = "Ocean|Population") float PopulationScale = 1.f;

protected:
	virtual void BeginPlay() override;

private:
	void BuildTerrain();
	void BuildWaterSurface();
	void SpawnAtmosphere();
	void ScatterFlora();
	void ScatterScrap();
	void SpawnCreatures();

	/** Keeps the kelp forest stocked as stalkers chew pieces out of existence. */
	void ReplenishScrap();

	/** Updates fog and post process toward the player's current biome. */
	void UpdateAmbience(float DeltaSeconds);

	/** Random point inside a biome ring; false if none found in a few tries. */
	bool RandomPointInBiome(ESLBiome Biome, float& OutX, float& OutY) const;

	/** Inner radius of a biome ring. */
	float InnerRadiusOf(ESLBiome Biome) const;

	void SpawnFishGroup(const FSLSpeciesDef& Species, const FVector& Center);
	void SpawnStalkerAt(const FVector& Location);
	void SpawnScrapAt(const FVector& Location, int32 Seed);

	UPROPERTY() TArray<TObjectPtr<UProceduralMeshComponent>> TerrainTiles;
	UPROPERTY() TObjectPtr<UProceduralMeshComponent> WaterSurface;
	UPROPERTY() TObjectPtr<USceneComponent> SceneRoot;

	UPROPERTY() TObjectPtr<AExponentialHeightFog> Fog;
	UPROPERTY() TObjectPtr<ADirectionalLight> SunLight;
	UPROPERTY() TObjectPtr<ASkyLight> SkyLight;

	/** Smoothed ambience so biome transitions fade rather than snap. */
	FLinearColor CurrentWaterColor = FLinearColor(0.1f, 0.5f, 0.6f);
	float CurrentFogDensity = 0.015f;

	float ScrapCheckTimer = 0.f;
	bool bWorldBuilt = false;

	/** Cleared once the player has been moved to the start position. */
	bool bPlayerPlaced = false;
	float PlacementRetryTimer = 0.f;
};
