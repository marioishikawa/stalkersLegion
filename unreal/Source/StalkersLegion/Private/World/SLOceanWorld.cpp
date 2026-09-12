#include "World/SLOceanWorld.h"

#include "Components/ExponentialHeightFogComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Creatures/SLFish.h"
#include "Creatures/SLSpeciesLibrary.h"
#include "Creatures/SLStalker.h"
#include "Engine/DirectionalLight.h"
#include "Engine/ExponentialHeightFog.h"
#include "Engine/SkyLight.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "ProceduralMeshComponent.h"
#include "Procedural/SLMaterialLibrary.h"
#include "Procedural/SLProcMesh.h"
#include "StalkersLegion.h"
#include "World/SLBiomeLibrary.h"
#include "World/SLFloraPatch.h"
#include "World/SLScrapMetal.h"

ASLOceanWorld::ASLOceanWorld()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;

	SceneRoot = CreateDefaultSubobject<USceneComponent>(TEXT("SceneRoot"));
	SetRootComponent(SceneRoot);
}

void ASLOceanWorld::BeginPlay()
{
	Super::BeginPlay();

	BuildWorld();

	// The player pawn may not exist yet depending on how the level was entered,
	// so Tick keeps trying for a moment.
	bPlayerPlaced = PlacePlayerAtStart();
}

void ASLOceanWorld::BuildWorld()
{
	if (bWorldBuilt)
	{
		return;
	}
	bWorldBuilt = true;

	// Terrain vertices and every gameplay query use the same analytic height
	// field in world space, so the builder itself has to sit at the origin.
	if (!GetActorLocation().IsNearlyZero())
	{
		UE_LOG(LogStalkersLegion, Warning,
			TEXT("SLOceanWorld must be placed at the world origin; moving it there from %s."),
			*GetActorLocation().ToCompactString());
		SetActorLocation(FVector::ZeroVector);
	}

	const double StartTime = FPlatformTime::Seconds();

	BuildTerrain();

	if (bSpawnWaterSurface)
	{
		BuildWaterSurface();
	}

	if (bSpawnLighting)
	{
		SpawnAtmosphere();
	}

	ScatterFlora();
	ScatterScrap();
	SpawnCreatures();

	UE_LOG(LogStalkersLegion, Log, TEXT("Ocean generated in %.2fs."), FPlatformTime::Seconds() - StartTime);
}

// ---------------------------------------------------------------------------
// Terrain
// ---------------------------------------------------------------------------

void ASLOceanWorld::BuildTerrain()
{
	const float TileSize = CellsPerTile * CellSize;
	const float HalfWorld = TileSize * TilesPerSide * 0.5f;

	for (int32 TileY = 0; TileY < TilesPerSide; ++TileY)
	{
		for (int32 TileX = 0; TileX < TilesPerSide; ++TileX)
		{
			const FVector TileOrigin(
				-HalfWorld + TileX * TileSize,
				-HalfWorld + TileY * TileSize,
				0.f);

			FSLMeshData Mesh;
			const int32 VertsPerSide = CellsPerTile + 1;
			Mesh.Reserve(VertsPerSide * VertsPerSide, CellsPerTile * CellsPerTile * 2);

			for (int32 Y = 0; Y < VertsPerSide; ++Y)
			{
				for (int32 X = 0; X < VertsPerSide; ++X)
				{
					// Vertices are placed in world space and the component sits at
					// the origin, so neighbouring tiles share exact edge heights
					// and the floor has no visible seams.
					const float WorldX = (float)(TileOrigin.X + X * CellSize);
					const float WorldY = (float)(TileOrigin.Y + Y * CellSize);
					const float Height = SLBiomeLibrary::FloorHeightAt(WorldX, WorldY);

					Mesh.AddVertex(
						FVector(WorldX, WorldY, Height),
						FVector::UpVector,
						FVector2D(X * 0.25f, Y * 0.25f),
						SLBiomeLibrary::FloorColorAt(WorldX, WorldY));
				}
			}

			for (int32 Y = 0; Y < CellsPerTile; ++Y)
			{
				for (int32 X = 0; X < CellsPerTile; ++X)
				{
					const int32 A = Y * VertsPerSide + X;
					Mesh.AddQuad(A, A + VertsPerSide, A + VertsPerSide + 1, A + 1);
				}
			}

			Mesh.RecalculateNormals();

			UProceduralMeshComponent* Tile = NewObject<UProceduralMeshComponent>(this,
				*FString::Printf(TEXT("TerrainTile_%d_%d"), TileX, TileY));
			Tile->SetupAttachment(SceneRoot);
			Tile->RegisterComponent();
			Tile->bUseAsyncCooking = true;
			Tile->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
			Tile->SetCollisionObjectType(ECC_WorldStatic);
			Tile->SetCollisionResponseToAllChannels(ECR_Block);
			Tile->SetCastShadow(false);

			SLProcMesh::ApplyToComponent(Tile, 0, Mesh, true);
			Tile->SetMaterial(0, SLMaterialLibrary::GetSurfaceMaterial());

			TerrainTiles.Add(Tile);
		}
	}
}

void ASLOceanWorld::BuildWaterSurface()
{
	// A coarse, gently rippled sheet at the water line. Seen from below it is
	// the ceiling of the world; seen from above it reads as open ocean.
	const float Extent = SLBiomeLibrary::WorldExtent * 1.4f;
	const int32 Cells = 24;
	const float Step = (Extent * 2.f) / Cells;

	FSLMeshData Mesh;
	const int32 VertsPerSide = Cells + 1;

	for (int32 Y = 0; Y < VertsPerSide; ++Y)
	{
		for (int32 X = 0; X < VertsPerSide; ++X)
		{
			const float WorldX = -Extent + X * Step;
			const float WorldY = -Extent + Y * Step;
			const float Ripple = SLProcMesh::FBM(WorldX, WorldY, 2, 0.0008f, 2.f, 0.5f, 4242) * 35.f;

			const FLinearColor Color = FLinearColor(0.04f, 0.22f, 0.30f) * (1.f + Ripple * 0.004f);
			Mesh.AddVertex(FVector(WorldX, WorldY, SLBiomeLibrary::WaterLevel + Ripple),
				FVector::UpVector, FVector2D(X * 0.5f, Y * 0.5f), Color);
		}
	}

	for (int32 Y = 0; Y < Cells; ++Y)
	{
		for (int32 X = 0; X < Cells; ++X)
		{
			const int32 A = Y * VertsPerSide + X;
			// Wound twice, so the surface is visible from above and below.
			Mesh.AddQuad(A, A + VertsPerSide, A + VertsPerSide + 1, A + 1);
			Mesh.AddQuad(A, A + 1, A + VertsPerSide + 1, A + VertsPerSide);
		}
	}

	Mesh.RecalculateNormals();

	WaterSurface = NewObject<UProceduralMeshComponent>(this, TEXT("WaterSurface"));
	WaterSurface->SetupAttachment(SceneRoot);
	WaterSurface->RegisterComponent();
	WaterSurface->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	WaterSurface->SetCastShadow(false);

	SLProcMesh::ApplyToComponent(WaterSurface, 0, Mesh, false);
	// Unlit, so the surface glows softly instead of going black at depth.
	WaterSurface->SetMaterial(0, SLMaterialLibrary::GetGlowMaterial());
}

// ---------------------------------------------------------------------------
// Atmosphere
// ---------------------------------------------------------------------------

void ASLOceanWorld::SpawnAtmosphere()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.ObjectFlags |= RF_Transient;

	// Only add what the level does not already have, so a hand-lit level of your
	// own keeps its lighting.
	{
		TActorIterator<ADirectionalLight> It(World);
		if (It)
		{
			SunLight = *It;
		}
		else
		{
			SunLight = World->SpawnActor<ADirectionalLight>(ADirectionalLight::StaticClass(),
				FVector(0.f, 0.f, 4000.f), FRotator(-52.f, 35.f, 0.f), Params);

			if (SunLight)
			{
				// Runtime-spawned lights default to Stationary, which is invalid
				// outside the editor's baked lighting - make them Movable.
				SunLight->GetLightComponent()->SetMobility(EComponentMobility::Movable);
				if (UDirectionalLightComponent* Light = Cast<UDirectionalLightComponent>(SunLight->GetLightComponent()))
				{
					Light->SetIntensity(7.f);
					Light->SetLightColor(FLinearColor(1.f, 0.96f, 0.85f));
					Light->SetVolumetricScatteringIntensity(2.5f);
				}
			}
		}
	}

	{
		TActorIterator<ASkyLight> It(World);
		if (It)
		{
			SkyLight = *It;
		}
		else
		{
			SkyLight = World->SpawnActor<ASkyLight>(ASkyLight::StaticClass(), FVector(0.f, 0.f, 500.f), FRotator::ZeroRotator, Params);
			if (SkyLight)
			{
				if (USkyLightComponent* Component = SkyLight->GetLightComponent())
				{
					Component->SetMobility(EComponentMobility::Movable);
					Component->SetIntensity(1.6f);
					Component->SetLightColor(FLinearColor(0.35f, 0.62f, 0.75f));
					Component->bLowerHemisphereIsBlack = false;
					Component->RecaptureSky();
				}
			}
		}
	}

	{
		TActorIterator<AExponentialHeightFog> It(World);
		if (It)
		{
			Fog = *It;
		}
		else
		{
			// Anchored at the water line: density climbs steeply below it and
			// thins out above, which is what sells "underwater" without a
			// dedicated water volume or post process material.
			Fog = World->SpawnActor<AExponentialHeightFog>(AExponentialHeightFog::StaticClass(),
				FVector(0.f, 0.f, SLBiomeLibrary::WaterLevel), FRotator::ZeroRotator, Params);
		}

		if (Fog)
		{
			if (UExponentialHeightFogComponent* Component = Fog->GetComponent())
			{
				Component->SetMobility(EComponentMobility::Movable);
				Component->SetFogDensity(CurrentFogDensity);
				Component->SetFogHeightFalloff(0.35f);
				Component->SetFogMaxOpacity(1.f);
				Component->SetStartDistance(0.f);
				Component->SetFogInscatteringColor(CurrentWaterColor);
			}
		}
	}
}

void ASLOceanWorld::UpdateAmbience(float DeltaSeconds)
{
	if (!Fog)
	{
		return;
	}

	const APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	const APawn* Player = PC ? PC->GetPawn() : nullptr;
	if (!Player)
	{
		return;
	}

	const FVector Location = Player->GetActorLocation();
	const FSLBiomeDef& Biome = SLBiomeLibrary::Get(SLBiomeLibrary::BiomeAt(Location.X, Location.Y));

	// Above the surface the haze lifts entirely.
	const float SurfaceBlend = FMath::Clamp((float)(SLBiomeLibrary::WaterLevel - Location.Z) / 400.f, 0.f, 1.f);
	const float TargetDensity = Biome.FogDensity * SurfaceBlend;

	// Deeper water is darker water, regardless of biome.
	const float DepthFade = FMath::Clamp(1.f - (float)(SLBiomeLibrary::WaterLevel - Location.Z) / 6000.f, 0.15f, 1.f);
	const FLinearColor TargetColor = Biome.WaterColor * DepthFade;

	CurrentFogDensity = FMath::FInterpTo(CurrentFogDensity, TargetDensity, DeltaSeconds, 1.2f);
	CurrentWaterColor = FMath::CInterpTo(CurrentWaterColor, TargetColor, DeltaSeconds, 1.2f);

	if (UExponentialHeightFogComponent* Component = Fog->GetComponent())
	{
		Component->SetFogDensity(CurrentFogDensity);
		Component->SetFogInscatteringColor(CurrentWaterColor);
	}
}

// ---------------------------------------------------------------------------
// Population
// ---------------------------------------------------------------------------

float ASLOceanWorld::InnerRadiusOf(ESLBiome Biome) const
{
	const int32 Index = (int32)Biome;
	if (Index <= 0)
	{
		return 0.f;
	}

	return SLBiomeLibrary::All()[Index - 1].OuterRadius;
}

bool ASLOceanWorld::RandomPointInBiome(ESLBiome Biome, float& OutX, float& OutY) const
{
	const float Inner = InnerRadiusOf(Biome);
	const float Outer = FMath::Min(SLBiomeLibrary::Get(Biome).OuterRadius, SLBiomeLibrary::WorldExtent);

	if (Outer <= Inner)
	{
		return false;
	}

	// Ring boundaries are noise-warped, so a point sampled from the ideal ring
	// can land in a neighbour. Sample a few times and take the first that agrees.
	for (int32 Attempt = 0; Attempt < 14; ++Attempt)
	{
		const float Angle = FMath::FRandRange(0.f, 2.f * PI);
		// Area-uniform radius, so outer rings do not end up sparser.
		const float Radius = FMath::Sqrt(FMath::FRandRange(Inner * Inner, Outer * Outer));

		const float X = FMath::Cos(Angle) * Radius;
		const float Y = FMath::Sin(Angle) * Radius;

		if (SLBiomeLibrary::BiomeAt(X, Y) == Biome)
		{
			OutX = X;
			OutY = Y;
			return true;
		}
	}

	return false;
}

void ASLOceanWorld::ScatterFlora()
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.ObjectFlags |= RF_Transient;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	int32 TotalPlants = 0;

	for (const FSLBiomeDef& Biome : SLBiomeLibrary::All())
	{
		if (Biome.Flora.Num() == 0)
		{
			continue;
		}

		const int32 PatchCount = FMath::Max(1, FMath::RoundToInt(Biome.FloraDensity * 0.5f));

		for (int32 P = 0; P < PatchCount; ++P)
		{
			float CenterX = 0.f;
			float CenterY = 0.f;
			if (!RandomPointInBiome(Biome.Biome, CenterX, CenterY))
			{
				continue;
			}

			const FVector PatchOrigin(CenterX, CenterY, 0.f);
			const int32 PlantsInPatch = FMath::RandRange(8, 20);

			TArray<FSLFloraInstance> Instances;
			Instances.Reserve(PlantsInPatch);

			for (int32 i = 0; i < PlantsInPatch; ++i)
			{
				const float Angle = FMath::FRandRange(0.f, 2.f * PI);
				const float Distance = FMath::Sqrt(FMath::FRand()) * 700.f;
				const float X = CenterX + FMath::Cos(Angle) * Distance;
				const float Y = CenterY + FMath::Sin(Angle) * Distance;

				FSLFloraInstance Instance;
				Instance.Type = Biome.Flora[FMath::RandRange(0, Biome.Flora.Num() - 1)];
				// Patch-local, with the plant's foot planted on the sea floor.
				Instance.Location = FVector(X, Y, SLBiomeLibrary::FloorHeightAt(X, Y)) - PatchOrigin;
				Instance.Yaw = FMath::FRandRange(0.f, 360.f);
				Instance.Scale = FMath::FRandRange(0.7f, 1.4f);
				Instance.Seed = FMath::Rand();
				Instances.Add(Instance);
			}

			if (ASLFloraPatch* Patch = World->SpawnActor<ASLFloraPatch>(ASLFloraPatch::StaticClass(), PatchOrigin, FRotator::ZeroRotator, Params))
			{
				Patch->BuildPatch(Instances);
				TotalPlants += Instances.Num();
			}
		}
	}

	UE_LOG(LogStalkersLegion, Log, TEXT("Scattered %d plants and rocks."), TotalPlants);
}

void ASLOceanWorld::SpawnScrapAt(const FVector& Location, int32 Seed)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.ObjectFlags |= RF_Transient;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	const FRotator Rotation(FMath::FRandRange(-20.f, 20.f), FMath::FRandRange(0.f, 360.f), FMath::FRandRange(-20.f, 20.f));

	if (ASLScrapMetal* Scrap = World->SpawnActor<ASLScrapMetal>(ASLScrapMetal::StaticClass(), Location, Rotation, Params))
	{
		Scrap->BuildScrap(Seed);
	}
}

void ASLOceanWorld::ScatterScrap()
{
	int32 Total = 0;

	for (const FSLBiomeDef& Biome : SLBiomeLibrary::All())
	{
		const int32 Count = FMath::RoundToInt(Biome.ScrapCount * PopulationScale);

		for (int32 i = 0; i < Count; ++i)
		{
			float X = 0.f;
			float Y = 0.f;
			if (!RandomPointInBiome(Biome.Biome, X, Y))
			{
				continue;
			}

			SpawnScrapAt(FVector(X, Y, SLBiomeLibrary::FloorHeightAt(X, Y) + 14.f), FMath::Rand());
			++Total;
		}
	}

	UE_LOG(LogStalkersLegion, Log, TEXT("Scattered %d pieces of scrap metal."), Total);
}

void ASLOceanWorld::SpawnFishGroup(const FSLSpeciesDef& SpeciesDef, const FVector& Center)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.ObjectFlags |= RF_Transient;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	const int32 Count = FMath::Max(1, FMath::RoundToInt(SpeciesDef.SchoolSize * PopulationScale));
	ASLFish* Leader = nullptr;

	for (int32 i = 0; i < Count; ++i)
	{
		const FVector Offset(
			FMath::FRandRange(-260.f, 260.f),
			FMath::FRandRange(-260.f, 260.f),
			FMath::FRandRange(-120.f, 120.f));
		const FVector SpawnLocation = Center + Offset;
		const FRotator SpawnRotation(0.f, FMath::FRandRange(0.f, 360.f), 0.f);

		ASLFish* Fish = World->SpawnActor<ASLFish>(ASLFish::StaticClass(), SpawnLocation, SpawnRotation, Params);
		if (!Fish)
		{
			continue;
		}

		Fish->InitializeSpecies(SpeciesDef);
		Fish->SetTerritory(Center, 2200.f);

		if (i == 0)
		{
			Leader = Fish;
		}
		else
		{
			// Followers hold a slot in a loose wedge behind the leader.
			const float Spacing = FMath::Max(60.f, SpeciesDef.Shape.Length * 1.6f);
			const int32 Row = (i + 1) / 2;
			const float Side = (i % 2 == 0) ? 1.f : -1.f;

			const FVector Slot(
				-Row * Spacing,
				Side * Row * Spacing * 0.8f,
				FMath::FRandRange(-0.4f, 0.4f) * Spacing);
			Fish->SetSchoolLeader(Leader, Slot);
		}
	}
}

void ASLOceanWorld::SpawnStalkerAt(const FVector& Location)
{
	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	FActorSpawnParameters Params;
	Params.ObjectFlags |= RF_Transient;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	ASLStalker* Stalker = World->SpawnActor<ASLStalker>(ASLStalker::StaticClass(), Location,
		FRotator(0.f, FMath::FRandRange(0.f, 360.f), 0.f), Params);

	if (Stalker)
	{
		Stalker->InitializeSpecies(SLSpeciesLibrary::Stalker());
		Stalker->SetTerritory(Location, 2600.f);
	}
}

void ASLOceanWorld::SpawnCreatures()
{
	int32 FishGroups = 0;
	int32 Stalkers = 0;

	for (const FSLBiomeDef& Biome : SLBiomeLibrary::All())
	{
		// --- Fish -------------------------------------------------------------
		for (const FSLSpeciesDef* SpeciesDef : SLSpeciesLibrary::FishOfBiome(Biome.Biome))
		{
			const int32 Groups = FMath::Max(1, FMath::RoundToInt(SpeciesDef->GroupsPerBiome * PopulationScale));

			for (int32 G = 0; G < Groups; ++G)
			{
				float X = 0.f;
				float Y = 0.f;
				if (!RandomPointInBiome(Biome.Biome, X, Y))
				{
					continue;
				}

				const float FloorZ = SLBiomeLibrary::FloorHeightAt(X, Y);
				const float Z = FMath::Min(
					FloorZ + SpeciesDef->PreferredAltitude * FMath::FRandRange(0.8f, 1.6f),
					SLBiomeLibrary::WaterLevel - 300.f);

				SpawnFishGroup(*SpeciesDef, FVector(X, Y, Z));
				++FishGroups;
			}
		}

		// --- Stalkers ----------------------------------------------------------
		const int32 StalkerCount = FMath::RoundToInt(Biome.StalkerCount * PopulationScale);
		for (int32 i = 0; i < StalkerCount; ++i)
		{
			float X = 0.f;
			float Y = 0.f;
			if (!RandomPointInBiome(Biome.Biome, X, Y))
			{
				continue;
			}

			const float FloorZ = SLBiomeLibrary::FloorHeightAt(X, Y);
			SpawnStalkerAt(FVector(X, Y, FloorZ + 500.f));
			++Stalkers;
		}
	}

	UE_LOG(LogStalkersLegion, Log, TEXT("Spawned %d fish groups and %d stalkers."), FishGroups, Stalkers);
}

void ASLOceanWorld::ReplenishScrap()
{
	// Stalkers chew scrap out of existence, so top the kelp forest back up.
	// Without this the biome's whole reason to exist quietly disappears.
	const FSLBiomeDef& Kelp = SLBiomeLibrary::Get(ESLBiome::KelpForest);
	const int32 Target = FMath::RoundToInt(Kelp.ScrapCount * PopulationScale);

	int32 Alive = 0;
	for (const TWeakObjectPtr<ASLScrapMetal>& Weak : ASLScrapMetal::GetAll())
	{
		if (Weak.IsValid())
		{
			++Alive;
		}
	}

	if (Alive >= Target)
	{
		return;
	}

	const APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	const APawn* Player = PC ? PC->GetPawn() : nullptr;

	for (int32 i = Alive; i < Target; ++i)
	{
		float X = 0.f;
		float Y = 0.f;
		if (!RandomPointInBiome(ESLBiome::KelpForest, X, Y))
		{
			continue;
		}

		// Never pop a piece of scrap into existence in front of the player.
		if (Player && FVector::DistSquared2D(Player->GetActorLocation(), FVector(X, Y, 0.f)) < FMath::Square(3000.f))
		{
			continue;
		}

		SpawnScrapAt(FVector(X, Y, SLBiomeLibrary::FloorHeightAt(X, Y) + 14.f), FMath::Rand());
	}
}

// ---------------------------------------------------------------------------

bool ASLOceanWorld::PlacePlayerAtStart()
{
	APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0);
	APawn* Player = PC ? PC->GetPawn() : nullptr;
	if (!Player)
	{
		return false;
	}

	// Just under the surface, dead centre of the Safe Shallows, looking down.
	Player->SetActorLocation(FVector(0.f, 0.f, SLBiomeLibrary::WaterLevel - 120.f), false, nullptr,
		ETeleportType::TeleportPhysics);
	PC->SetControlRotation(FRotator(-20.f, 0.f, 0.f));
	return true;
}

void ASLOceanWorld::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (!bPlayerPlaced)
	{
		PlacementRetryTimer -= DeltaSeconds;
		if (PlacementRetryTimer <= 0.f)
		{
			PlacementRetryTimer = 0.25f;
			bPlayerPlaced = PlacePlayerAtStart();
		}
	}

	UpdateAmbience(DeltaSeconds);

	ScrapCheckTimer -= DeltaSeconds;
	if (ScrapCheckTimer <= 0.f)
	{
		ScrapCheckTimer = 20.f;
		ReplenishScrap();
	}
}
