#pragma once

#include "CoreMinimal.h"
#include "Core/SLTypes.h"
#include "Procedural/SLProcMesh.h"

/**
 * The three pieces a creature is split into so it can be animated without a
 * skeleton: a static body, a tail that wags around TailPivot, and (for
 * predators) a lower jaw that hinges around JawPivot.
 */
struct STALKERSLEGION_API FSLCreatureMesh
{
	FSLMeshData Body;
	FSLMeshData Tail;
	FSLMeshData Jaw;

	FVector TailPivot = FVector::ZeroVector;
	FVector JawPivot = FVector::ZeroVector;

	/** Local-space collision half-extents, derived from the built body. */
	FVector HalfExtent = FVector(20.f, 10.f, 10.f);
};

namespace SLBodyBuilder
{
	/** Grows a full creature body from a species definition. Faces +X. */
	STALKERSLEGION_API FSLCreatureMesh Build(const FSLSpeciesDef& Species);

	/**
	 * Silhouette function: returns the body radius multiplier at normalised
	 * position T along the spine (0 = nose, 1 = tail root) for a profile.
	 * Exposed so other systems can reason about a species' shape.
	 */
	STALKERSLEGION_API void EvaluateProfile(ESLBodyProfile Profile, float T, float BellyPosition,
		float& OutWidthScale, float& OutHeightScale);
}
