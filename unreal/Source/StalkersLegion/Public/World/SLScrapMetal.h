#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SLScrapMetal.generated.h"

class UProceduralMeshComponent;

/**
 * A chunk of salvaged metal lying on the sea floor.
 *
 * Stalkers are drawn to it: they swim over, bite it, and often carry it off to
 * drop somewhere else. The player can pick it up too, which makes scrap a
 * deliberate tool - throw a plate away from you and every stalker in earshot
 * goes after the noise instead of after you.
 */
UCLASS()
class STALKERSLEGION_API ASLScrapMetal : public AActor
{
	GENERATED_BODY()

public:
	ASLScrapMetal();

	/** Every scrap piece currently in the world. Used by stalker senses. */
	static const TArray<TWeakObjectPtr<ASLScrapMetal>>& GetAll();

	/**
	 * Nearest unheld scrap within Radius, or nullptr. Scoped to the world the
	 * context object belongs to - the registry is static and would otherwise
	 * span an editor world and a play session at the same time.
	 */
	static ASLScrapMetal* FindNearest(const UObject* WorldContext, const FVector& Location, float Radius);

	/** Builds the mesh with a shape derived from Seed. Call before BeginPlay ideally. */
	UFUNCTION(BlueprintCallable, Category = "Scrap")
	void BuildScrap(int32 Seed);

	/** A stalker (or a knife) hit this. Returns true if the piece was destroyed. */
	UFUNCTION(BlueprintCallable, Category = "Scrap")
	bool ApplyBite(float BiteDamage, const FVector& FromDirection);

	/** Attaches the scrap to a carrier (stalker jaw or player hands). */
	UFUNCTION(BlueprintCallable, Category = "Scrap")
	void SetCarriedBy(AActor* NewCarrier, USceneComponent* AttachTo, FName SocketName);

	/** Detaches and drops the scrap, settling it onto the sea floor below. */
	UFUNCTION(BlueprintCallable, Category = "Scrap")
	void Drop(const FVector& TossVelocity);

	UFUNCTION(BlueprintPure, Category = "Scrap")
	bool IsHeld() const { return Carrier.IsValid(); }

	UFUNCTION(BlueprintPure, Category = "Scrap")
	AActor* GetCarrier() const { return Carrier.Get(); }

	UFUNCTION(BlueprintPure, Category = "Scrap")
	float GetIntegrity() const { return Integrity; }

	/** How loud this piece is to stalkers right now (rises when disturbed). */
	UFUNCTION(BlueprintPure, Category = "Scrap")
	float GetLureStrength() const;

	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type Reason) override;

	UPROPERTY(VisibleAnywhere, Category = "Scrap")
	TObjectPtr<UProceduralMeshComponent> Mesh;

	/** Bite damage this piece can absorb before it is chewed to nothing. */
	UPROPERTY(EditAnywhere, Category = "Scrap")
	float Integrity = 100.f;

	UPROPERTY(EditAnywhere, Category = "Scrap")
	float MaxIntegrity = 100.f;

private:
	static TArray<TWeakObjectPtr<ASLScrapMetal>> Registry;

	TWeakObjectPtr<AActor> Carrier;

	/** Falling state used while the scrap sinks back to the floor after a drop. */
	bool bFalling = false;
	FVector FallVelocity = FVector::ZeroVector;

	/** Decays over time; while high, stalkers prefer this piece over others. */
	float Disturbance = 0.f;

	/** Wobble applied after a bite, purely visual. */
	float ShakeTime = 0.f;
	FRotator RestRotation = FRotator::ZeroRotator;

	int32 BuildSeed = 0;
	bool bBuilt = false;

	void SettleToFloor();
};
