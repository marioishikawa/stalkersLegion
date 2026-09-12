#pragma once

#include "CoreMinimal.h"
#include "Core/SLTypes.h"

/**
 * Static registry of every creature in the game. Kept in C++ rather than a data
 * asset so the whole species roster lives in version control as readable text.
 */
namespace SLSpeciesLibrary
{
	/** All species, fish and predators alike. */
	STALKERSLEGION_API const TArray<FSLSpeciesDef>& All();

	/** Looks up a species by id, or nullptr. */
	STALKERSLEGION_API const FSLSpeciesDef* Find(FName Id);

	/** The stalker - the biome's apex predator. */
	STALKERSLEGION_API const FSLSpeciesDef& Stalker();

	/** Every non-predator species that lives in the given biome. */
	STALKERSLEGION_API TArray<const FSLSpeciesDef*> FishOfBiome(ESLBiome Biome);
}
