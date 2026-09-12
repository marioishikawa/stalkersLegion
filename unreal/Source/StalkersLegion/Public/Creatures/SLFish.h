#pragma once

#include "CoreMinimal.h"
#include "Creatures/SLCreature.h"
#include "SLFish.generated.h"

UENUM(BlueprintType)
enum class ESLFishState : uint8
{
	Cruise	UMETA(DisplayName = "Cruise"),	// wandering, or following the school leader
	Graze	UMETA(DisplayName = "Graze"),	// nosing around near the floor
	Flee	UMETA(DisplayName = "Flee")		// something scared it
};

/**
 * Prey. Fish wander their territory in loose schools, drift down to graze, and
 * scatter from anything bigger than they are - which in practice means stalkers
 * and the player.
 */
UCLASS()
class STALKERSLEGION_API ASLFish : public ASLCreature
{
	GENERATED_BODY()

public:
	ASLFish();

	/** Makes this fish follow another of its kind. Passing null promotes it to leader. */
	UFUNCTION(BlueprintCallable, Category = "Fish")
	void SetSchoolLeader(ASLFish* Leader, const FVector& SlotOffset);

	/** Scares the fish away from a location for a few seconds. */
	UFUNCTION(BlueprintCallable, Category = "Fish")
	void Startle(const FVector& ThreatLocation, float Duration = 4.f);

	UFUNCTION(BlueprintPure, Category = "Fish")
	ESLFishState GetFishState() const { return State; }

protected:
	virtual FVector ComputeDesiredVelocity(float DeltaSeconds) override;
	virtual void OnHurt(float Damage, AActor* Causer) override;
	virtual void BeginPlay() override;

private:
	/** Cheap periodic threat scan; full-rate scanning is wasted on prey. */
	void SenseThreats();

	/** Picks a new wander target inside the territory. */
	void ChooseWanderTarget();

	UPROPERTY()
	ESLFishState State = ESLFishState::Cruise;

	UPROPERTY()
	TWeakObjectPtr<ASLFish> SchoolLeader;

	/** Offset from the leader that keeps the school spread out. */
	FVector SchoolSlot = FVector::ZeroVector;

	FVector WanderTarget = FVector::ZeroVector;
	FVector FleeFrom = FVector::ZeroVector;

	float FleeTimer = 0.f;
	float SenseTimer = 0.f;
	float StateTimer = 0.f;

	/** Per-fish phase so a school does not move in lockstep. */
	float NoiseOffset = 0.f;
};
