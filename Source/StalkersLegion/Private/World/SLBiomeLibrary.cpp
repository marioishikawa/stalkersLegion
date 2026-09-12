#include "World/SLBiomeLibrary.h"

#include "Procedural/SLProcMesh.h"

namespace
{
	constexpr int32 TerrainSeed = 20260912;

	TArray<FSLBiomeDef> BuildBiomes()
	{
		TArray<FSLBiomeDef> B;

		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::SafeShallows;
			D.DisplayName = TEXT("Safe Shallows");
			D.OuterRadius = 2600.f;
			D.FloorDepth = 700.f;
			D.Roughness = 140.f;
			D.FloorColor = FLinearColor(0.86f, 0.80f, 0.60f);
			D.WaterColor = FLinearColor(0.10f, 0.55f, 0.62f);
			D.FogDensity = 0.012f;
			D.Flora = { ESLFloraType::SeaGrass, ESLFloraType::CoralFan };
			D.FloraDensity = 26;
			B.Add(D);
		}
		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::KelpForest;
			D.DisplayName = TEXT("Kelp Forest");
			D.OuterRadius = 5200.f;
			D.FloorDepth = 1500.f;
			D.Roughness = 260.f;
			D.FloorColor = FLinearColor(0.34f, 0.38f, 0.24f);
			D.WaterColor = FLinearColor(0.06f, 0.30f, 0.26f);
			D.FogDensity = 0.024f;
			// The heart of the game: dense kelp, litter everywhere, stalkers.
			D.ScrapCount = 34;
			D.StalkerCount = 7;
			D.Flora = { ESLFloraType::Kelp, ESLFloraType::Kelp, ESLFloraType::SeaGrass };
			D.FloraDensity = 62;
			B.Add(D);
		}
		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::GrassyPlateau;
			D.DisplayName = TEXT("Grassy Plateau");
			D.OuterRadius = 7400.f;
			D.FloorDepth = 2100.f;
			D.Roughness = 190.f;
			D.FloorColor = FLinearColor(0.42f, 0.52f, 0.30f);
			D.WaterColor = FLinearColor(0.05f, 0.28f, 0.34f);
			D.FogDensity = 0.028f;
			D.ScrapCount = 8;
			D.StalkerCount = 2;
			D.Flora = { ESLFloraType::SeaGrass, ESLFloraType::SeaGrass, ESLFloraType::Boulder };
			D.FloraDensity = 48;
			B.Add(D);
		}
		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::RedCoralReef;
			D.DisplayName = TEXT("Red Coral Reef");
			D.OuterRadius = 9200.f;
			D.FloorDepth = 2700.f;
			D.Roughness = 420.f;
			D.FloorColor = FLinearColor(0.62f, 0.26f, 0.22f);
			D.WaterColor = FLinearColor(0.14f, 0.18f, 0.32f);
			D.FogDensity = 0.032f;
			D.ScrapCount = 5;
			D.Flora = { ESLFloraType::CoralFan, ESLFloraType::CoralTube, ESLFloraType::CoralTube };
			D.FloraDensity = 54;
			B.Add(D);
		}
		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::BoulderField;
			D.DisplayName = TEXT("Boulder Field");
			D.OuterRadius = 10600.f;
			D.FloorDepth = 3400.f;
			D.Roughness = 520.f;
			D.FloorColor = FLinearColor(0.30f, 0.31f, 0.33f);
			D.WaterColor = FLinearColor(0.06f, 0.11f, 0.20f);
			D.FogDensity = 0.040f;
			D.ScrapCount = 6;
			D.StalkerCount = 2;
			D.Flora = { ESLFloraType::Boulder, ESLFloraType::Boulder, ESLFloraType::GlowPod };
			D.FloraDensity = 40;
			B.Add(D);
		}
		{
			FSLBiomeDef D;
			D.Biome = ESLBiome::DeepTrench;
			D.DisplayName = TEXT("Deep Trench");
			D.OuterRadius = 100000.f; // Everything past the boulder field.
			D.FloorDepth = 4800.f;
			D.Roughness = 700.f;
			D.FloorColor = FLinearColor(0.12f, 0.12f, 0.15f);
			D.WaterColor = FLinearColor(0.01f, 0.03f, 0.07f);
			D.FogDensity = 0.060f;
			D.ScrapCount = 4;
			D.Flora = { ESLFloraType::GlowPod, ESLFloraType::Boulder };
			D.FloraDensity = 22;
			B.Add(D);
		}

		return B;
	}

	/**
	 * Distance from the origin, warped by low-frequency noise. Using this in
	 * place of the true radius turns the ring boundaries into organic coastlines.
	 */
	float WarpedRadius(float X, float Y)
	{
		const float R = FMath::Sqrt(X * X + Y * Y);
		const float Warp = SLProcMesh::FBM(X, Y, 3, 0.00011f, 2.1f, 0.5f, TerrainSeed + 41) * 1500.f;
		return FMath::Max(0.f, R + Warp);
	}
}

namespace SLBiomeLibrary
{
	const TArray<FSLBiomeDef>& All()
	{
		static const TArray<FSLBiomeDef> Biomes = BuildBiomes();
		return Biomes;
	}

	const FSLBiomeDef& Get(ESLBiome Biome)
	{
		const TArray<FSLBiomeDef>& Biomes = All();
		const int32 Index = FMath::Clamp((int32)Biome, 0, Biomes.Num() - 1);
		return Biomes[Index];
	}

	ESLBiome BiomeAt(double X, double Y)
	{
		const float R = WarpedRadius((float)X, (float)Y);
		for (const FSLBiomeDef& Def : All())
		{
			if (R <= Def.OuterRadius)
			{
				return Def.Biome;
			}
		}
		return ESLBiome::DeepTrench;
	}

	/** Blend weight between the ring containing R and the next one out. */
	static void ResolveRings(float R, const FSLBiomeDef*& Inner, const FSLBiomeDef*& Outer, float& Alpha)
	{
		const TArray<FSLBiomeDef>& Biomes = All();
		constexpr float BlendBand = 900.f;

		int32 Index = Biomes.Num() - 1;
		for (int32 i = 0; i < Biomes.Num(); ++i)
		{
			if (R <= Biomes[i].OuterRadius)
			{
				Index = i;
				break;
			}
		}

		Inner = &Biomes[Index];
		Outer = &Biomes[FMath::Min(Index + 1, Biomes.Num() - 1)];

		const float Edge = Biomes[Index].OuterRadius;
		Alpha = (Inner == Outer) ? 0.f : FMath::Clamp((R - (Edge - BlendBand)) / BlendBand, 0.f, 1.f);
		Alpha = FMath::SmoothStep(0.f, 1.f, Alpha);
	}

	float FloorHeightAt(double X, double Y)
	{
		const float Fx = (float)X;
		const float Fy = (float)Y;
		const float R = WarpedRadius(Fx, Fy);

		const FSLBiomeDef* Inner = nullptr;
		const FSLBiomeDef* Outer = nullptr;
		float Alpha = 0.f;
		ResolveRings(R, Inner, Outer, Alpha);

		const float Depth = FMath::Lerp(Inner->FloorDepth, Outer->FloorDepth, Alpha);
		const float Roughness = FMath::Lerp(Inner->Roughness, Outer->Roughness, Alpha);

		// Two noise layers: broad dunes plus fine detail.
		const float Dunes = SLProcMesh::FBM(Fx, Fy, 4, 0.00035f, 2.0f, 0.5f, TerrainSeed);
		const float Detail = SLProcMesh::FBM(Fx, Fy, 3, 0.0022f, 2.3f, 0.45f, TerrainSeed + 977);

		float Height = -Depth + Dunes * Roughness + Detail * Roughness * 0.28f;

		// Carve a canyon through the trench so the deep has real structure.
		if (R > 9200.f)
		{
			const float Canyon = FMath::Clamp((R - 9200.f) / 2600.f, 0.f, 1.f);
			Height -= Canyon * Canyon * 1400.f;
		}

		// Never let the floor poke through the surface.
		return FMath::Min(Height, WaterLevel - 220.f);
	}

	FLinearColor FloorColorAt(double X, double Y)
	{
		const float Fx = (float)X;
		const float Fy = (float)Y;
		const float R = WarpedRadius(Fx, Fy);

		const FSLBiomeDef* Inner = nullptr;
		const FSLBiomeDef* Outer = nullptr;
		float Alpha = 0.f;
		ResolveRings(R, Inner, Outer, Alpha);

		FLinearColor Color = FMath::Lerp(Inner->FloorColor, Outer->FloorColor, Alpha);

		// Mottle the sand so large flat areas do not read as a solid sheet.
		const float Mottle = SLProcMesh::FBM(Fx, Fy, 2, 0.004f, 2.f, 0.5f, TerrainSeed + 313) * 0.12f;
		Color = Color * (1.f + Mottle);

		return Color;
	}
}
