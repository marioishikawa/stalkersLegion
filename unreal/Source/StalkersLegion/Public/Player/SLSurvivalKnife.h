#pragma once

#include "CoreMinimal.h"
#include "Components/SceneComponent.h"
#include "SLSurvivalKnife.generated.h"

class UProceduralMeshComponent;

/**
 * The survival knife: the one tool you start with, and the only thing that can
 * hurt anything in the ocean.
 *
 * It is a scene component rather than an actor so it can live on the camera and
 * be swung without any animation assets - the swing is a procedural arc, and the
 * hit is a swept sphere trace fired at the moment of impact.
 */
UCLASS(ClassGroup = (StalkersLegion), meta = (BlueprintSpawnableComponent))
class STALKERSLEGION_API USLSurvivalKnife : public USceneComponent
{
	GENERATED_BODY()

public:
	USLSurvivalKnife();

	/** Starts a swing. Returns false if still on cooldown. */
	UFUNCTION(BlueprintCallable, Category = "Knife")
	bool Swing();

	UFUNCTION(BlueprintPure, Category = "Knife")
	bool IsSwinging() const { return SwingTime > 0.f; }

	/** 0..1 progress through the current swing. */
	UFUNCTION(BlueprintPure, Category = "Knife")
	float GetSwingAlpha() const;

	/** Damage dealt per connecting strike. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Knife")
	float Damage = 28.f;

	/** Reach from the camera, in cm. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Knife")
	float Reach = 220.f;

	/** Radius of the strike sweep - forgiving enough to hit small fish. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Knife")
	float SweepRadius = 34.f;

	/** Seconds per swing. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Knife")
	float SwingDuration = 0.48f;

	/** Name of the last thing hit, for the HUD. */
	UFUNCTION(BlueprintPure, Category = "Knife")
	FString GetLastHitName() const { return LastHitName; }

	UFUNCTION(BlueprintPure, Category = "Knife")
	float GetTimeSinceHit() const { return TimeSinceHit; }

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

protected:
	virtual void BeginPlay() override;

private:
	/** Fires the trace at the apex of the swing and applies damage. */
	void ResolveStrike();

	void BuildKnifeMesh();

	UPROPERTY()
	TObjectPtr<UProceduralMeshComponent> Mesh;

	float SwingTime = 0.f;
	bool bStrikeResolved = false;

	FString LastHitName;
	float TimeSinceHit = 999.f;

	/** Where the knife rests when idle, relative to the camera. */
	FVector RestLocation = FVector(48.f, 26.f, -20.f);
	FRotator RestRotation = FRotator(-12.f, -18.f, 0.f);
};
