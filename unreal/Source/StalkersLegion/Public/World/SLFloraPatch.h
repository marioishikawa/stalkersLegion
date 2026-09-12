#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/SLTypes.h"
#include "SLFloraPatch.generated.h"

class UProceduralMeshComponent;

/** One plant/rock instance inside a patch, in patch-local space. */
USTRUCT()
struct FSLFloraInstance
{
	GENERATED_BODY()

	UPROPERTY() ESLFloraType Type = ESLFloraType::Kelp;
	UPROPERTY() FVector Location = FVector::ZeroVector;
	UPROPERTY() float Yaw = 0.f;
	UPROPERTY() float Scale = 1.f;
	UPROPERTY() int32 Seed = 0;
};

/**
 * A cluster of scenery welded into one mesh.
 *
 * Kelp forests need hundreds of plants; hundreds of actors would be hundreds of
 * draw calls. Instead the world builder groups nearby plants into a patch and
 * bakes them all into a single procedural mesh - two sections, one lit and one
 * emissive for the glow pods.
 */
UCLASS()
class STALKERSLEGION_API ASLFloraPatch : public AActor
{
	GENERATED_BODY()

public:
	ASLFloraPatch();

	/** Bakes the instances into this patch's mesh. Locations are patch-local. */
	UFUNCTION(BlueprintCallable, Category = "Flora")
	void BuildPatch(const TArray<FSLFloraInstance>& Instances);

private:
	UPROPERTY(VisibleAnywhere, Category = "Flora")
	TObjectPtr<UProceduralMeshComponent> Mesh;
};
