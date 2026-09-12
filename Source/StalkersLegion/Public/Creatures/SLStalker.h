#pragma once

#include "CoreMinimal.h"
#include "Creatures/SLCreature.h"
#include "SLStalker.generated.h"

class ASLScrapMetal;
class ASLFish;

UENUM(BlueprintType)
enum class ESLStalkerState : uint8
{
	Patrol		UMETA(DisplayName = "Patrol"),		// cruising the kelp
	SeekScrap	UMETA(DisplayName = "Seek Scrap"),	// heading for a piece of metal
	ChewScrap	UMETA(DisplayName = "Chew Scrap"),	// biting it in place
	CarryScrap	UMETA(DisplayName = "Carry Scrap"),	// hauling it somewhere else
	HuntFish	UMETA(DisplayName = "Hunt Fish"),	// chasing prey
	Feed		UMETA(DisplayName = "Feed"),		// eating a kill
	AttackPlayer UMETA(DisplayName = "Attack Player"),
	Retreat		UMETA(DisplayName = "Retreat")		// hurt badly, backing off
};

/**
 * The stalker: the kelp forest's resident predator.
 *
 * Its behaviour is a priority ladder re-evaluated a few times a second.
 * Threats and food come first, but its defining trait is an obsession with
 * scrap metal - a stalker will break off a hunt to go chew on a plate, and will
 * often pick the plate up and carry it somewhere else before losing interest.
 */
UCLASS()
class STALKERSLEGION_API ASLStalker : public ASLCreature
{
	GENERATED_BODY()

public:
	ASLStalker();

	UFUNCTION(BlueprintPure, Category = "Stalker")
	ESLStalkerState GetStalkerState() const { return State; }

	/** Human-readable state, for the HUD's tracker. */
	UFUNCTION(BlueprintPure, Category = "Stalker")
	FString GetStateLabel() const;

	/** Makes this stalker treat the actor as a threat worth attacking. */
	UFUNCTION(BlueprintCallable, Category = "Stalker")
	void Provoke(AActor* Threat);

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual FVector ComputeDesiredVelocity(float DeltaSeconds) override;
	virtual void OnHurt(float Damage, AActor* Causer) override;
	virtual void OnDeath(AActor* Killer) override;

private:
	/** Re-runs the priority ladder and may change state. */
	void UpdateSenses();

	/** Distance at which this stalker's jaws can reach a target. */
	float BiteReach() const;

	void EnterState(ESLStalkerState NewState);
	void BiteTarget(AActor* Target);
	void GrabScrap(ASLScrapMetal* Scrap);
	void ReleaseScrap(const FVector& TossVelocity);

	/** Steering helper: swim toward a point at a given speed. */
	FVector SteerTo(const FVector& Target, float Speed) const;

	UPROPERTY()
	ESLStalkerState State = ESLStalkerState::Patrol;

	UPROPERTY()
	TWeakObjectPtr<ASLScrapMetal> TargetScrap;

	UPROPERTY()
	TWeakObjectPtr<ASLScrapMetal> CarriedScrap;

	UPROPERTY()
	TWeakObjectPtr<ASLFish> TargetFish;

	UPROPERTY()
	TWeakObjectPtr<AActor> ThreatActor;

	FVector PatrolTarget = FVector::ZeroVector;
	FVector CarryDestination = FVector::ZeroVector;

	float SenseTimer = 0.f;
	float StateTimer = 0.f;
	float BiteCooldown = 0.f;

	/** Seconds of aggression left toward ThreatActor. */
	float AggroTimer = 0.f;

	/** Counts bites taken out of the current scrap piece. */
	int32 ScrapBites = 0;

	/** Drives the jaw snap animation. */
	float SnapTimer = 0.f;
};
