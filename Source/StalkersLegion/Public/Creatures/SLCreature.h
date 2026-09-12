#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "Core/SLTypes.h"
#include "SLCreature.generated.h"

class UBoxComponent;
class UProceduralMeshComponent;

/**
 * Shared base for everything that swims.
 *
 * Creatures do not use the navigation system or character movement: open water
 * has no navmesh and no ground to walk on. Instead each creature integrates its
 * own velocity, steers by blending a desired direction, and stays between the
 * sea floor and the surface analytically. Subclasses only supply the steering.
 */
UCLASS(Abstract)
class STALKERSLEGION_API ASLCreature : public APawn
{
	GENERATED_BODY()

public:
	ASLCreature();

	/** Builds the body from a species definition. Safe to call before or after BeginPlay. */
	UFUNCTION(BlueprintCallable, Category = "Creature")
	void InitializeSpecies(const FSLSpeciesDef& InSpecies);

	/** Anchors the creature's roaming area. */
	UFUNCTION(BlueprintCallable, Category = "Creature")
	void SetTerritory(const FVector& Center, float Radius);

	UFUNCTION(BlueprintPure, Category = "Creature")
	const FSLSpeciesDef& GetSpecies() const { return Species; }

	UFUNCTION(BlueprintPure, Category = "Creature")
	FString GetDisplayName() const { return Species.DisplayName; }

	UFUNCTION(BlueprintPure, Category = "Creature")
	float GetHealth() const { return Health; }

	UFUNCTION(BlueprintPure, Category = "Creature")
	bool IsAlive() const { return !bDead; }

	/** Body length in cm - used for bite reach and spacing. */
	UFUNCTION(BlueprintPure, Category = "Creature")
	float GetBodyLength() const { return Species.Shape.Length; }

	/** Creatures integrate their own motion, so report that instead of the (unused) movement component's. */
	virtual FVector GetVelocity() const override { return Velocity; }

	virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator,
		AActor* DamageCauser) override;

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;

	/**
	 * Subclass hook: return the velocity this creature wants right now, in world
	 * space. Returning a zero vector means "drift".
	 */
	virtual FVector ComputeDesiredVelocity(float DeltaSeconds) { return FVector::ZeroVector; }

	/** Called once when health reaches zero, before the body starts sinking. */
	virtual void OnDeath(AActor* Killer);

	/** Called whenever the creature is hurt but survives. */
	virtual void OnHurt(float Damage, AActor* Causer) {}

	/** Keeps the creature off the floor, under the surface and inside the world. */
	FVector ApplyEnvironmentAvoidance(const FVector& DesiredVelocity) const;

	/** Height of the sea floor directly below the creature. */
	float FloorBelow() const;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Creature")
	FSLSpeciesDef Species;

	UPROPERTY(VisibleAnywhere, Category = "Creature")
	TObjectPtr<UBoxComponent> CollisionBox;

	UPROPERTY(VisibleAnywhere, Category = "Creature")
	TObjectPtr<UProceduralMeshComponent> BodyMesh;

	UPROPERTY(VisibleAnywhere, Category = "Creature")
	TObjectPtr<UProceduralMeshComponent> TailMesh;

	UPROPERTY(VisibleAnywhere, Category = "Creature")
	TObjectPtr<UProceduralMeshComponent> JawMesh;

	/** Current world velocity. */
	UPROPERTY(BlueprintReadOnly, Category = "Creature")
	FVector Velocity = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "Creature")
	float Health = 10.f;

	UPROPERTY(BlueprintReadOnly, Category = "Creature")
	FVector TerritoryCenter = FVector::ZeroVector;

	UPROPERTY(BlueprintReadOnly, Category = "Creature")
	float TerritoryRadius = 2500.f;

	/** 0..1 exertion, drives tail wag speed and amplitude. */
	float Exertion = 0.f;

	/** How wide the jaw is open, 0..1. Subclasses drive this. */
	float JawOpen = 0.f;

	bool bDead = false;

private:
	void BuildBody();
	void UpdateSwimAnimation(float DeltaSeconds);
	void UpdateDeath(float DeltaSeconds);

	float SwimPhase = 0.f;
	float DeathTimer = 0.f;

	/** Local-space pivots reported by the mesh builder. */
	FVector TailPivotLocal = FVector::ZeroVector;
	FVector JawPivotLocal = FVector::ZeroVector;

	bool bBodyBuilt = false;
};
