#pragma once

#include "CoreMinimal.h"
#include "Core/SLTypes.h"

/**
 * The ocean is laid out as concentric rings around the origin: you start in the
 * bright Safe Shallows and every direction you swim takes you somewhere darker
 * and deeper. Ring boundaries are warped by noise so they never read as circles.
 */
namespace SLBiomeLibrary
{
	/** Water surface height. Everything playable is below this. */
	constexpr float WaterLevel = 0.f;

	/** Half-size of the generated floor, in cm. */
	constexpr float WorldExtent = 12000.f;

	STALKERSLEGION_API const TArray<FSLBiomeDef>& All();
	STALKERSLEGION_API const FSLBiomeDef& Get(ESLBiome Biome);

	/** Which biome covers this world-space XY position. */
	STALKERSLEGION_API ESLBiome BiomeAt(double X, double Y);

	/**
	 * Sea floor height (negative, below the surface) at a world XY.
	 * Analytic, so gameplay code can query the floor without a physics trace.
	 */
	STALKERSLEGION_API float FloorHeightAt(double X, double Y);

	/** Floor colour at a world XY, blended across biome boundaries. */
	STALKERSLEGION_API FLinearColor FloorColorAt(double X, double Y);
}
