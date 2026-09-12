#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Pawn.h"
#include "Core/SLTypes.h"
#include "SLDiver.generated.h"

class UCameraComponent;
class UCapsuleComponent;
class UFloatingPawnMovement;
class USpotLightComponent;
class USLSurvivalKnife;
class ASLScrapMetal;
class UInputAction;
class UInputMappingContext;
struct FInputActionValue;

/**
 * The player: a diver with a survival knife, a finite supply of air, and no
 * other equipment.
 *
 * Movement is full six-degrees-of-freedom swimming rather than walking - there
 * is no ground in this game. Every input action and the mapping context are
 * constructed in C++ at startup, so the project needs no input assets.
 */
UCLASS()
class STALKERSLEGION_API ASLDiver : public APawn
{
	GENERATED_BODY()

public:
	ASLDiver();

	// --- Status, read by the HUD ---------------------------------------------

	UFUNCTION(BlueprintPure, Category = "Diver") float GetHealth() const { return Health; }
	UFUNCTION(BlueprintPure, Category = "Diver") float GetMaxHealth() const { return MaxHealth; }
	UFUNCTION(BlueprintPure, Category = "Diver") float GetOxygen() const { return Oxygen; }
	UFUNCTION(BlueprintPure, Category = "Diver") float GetMaxOxygen() const { return MaxOxygen; }
	UFUNCTION(BlueprintPure, Category = "Diver") bool IsDead() const { return bDead; }
	UFUNCTION(BlueprintPure, Category = "Diver") bool IsAtSurface() const;

	/** Depth below the surface in metres. */
	UFUNCTION(BlueprintPure, Category = "Diver") float GetDepthMeters() const;

	UFUNCTION(BlueprintPure, Category = "Diver") ESLBiome GetCurrentBiome() const;

	UFUNCTION(BlueprintPure, Category = "Diver") USLSurvivalKnife* GetKnife() const { return Knife; }

	UFUNCTION(BlueprintPure, Category = "Diver") ASLScrapMetal* GetCarriedScrap() const;

	/** Seconds since the diver was last bitten - drives the HUD damage flash. */
	UFUNCTION(BlueprintPure, Category = "Diver") float GetTimeSinceDamage() const { return TimeSinceDamage; }

	/** Name of whatever the crosshair is currently over, or empty. */
	UFUNCTION(BlueprintPure, Category = "Diver") FString GetFocusName() const { return FocusName; }

	/** Puts the diver back at the surface with full health and air. */
	UFUNCTION(BlueprintCallable, Category = "Diver") void Respawn();

	virtual float TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator,
		AActor* DamageCauser) override;
	virtual void Tick(float DeltaSeconds) override;
	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;

protected:
	virtual void BeginPlay() override;

	// --- Tuning ---------------------------------------------------------------

	UPROPERTY(EditAnywhere, Category = "Diver") float MaxHealth = 100.f;
	UPROPERTY(EditAnywhere, Category = "Diver") float MaxOxygen = 90.f;

	/** Seconds without damage before the diver slowly recovers. */
	UPROPERTY(EditAnywhere, Category = "Diver") float RegenDelay = 18.f;
	UPROPERTY(EditAnywhere, Category = "Diver") float RegenRate = 2.5f;

	/** Damage per second taken while out of air. */
	UPROPERTY(EditAnywhere, Category = "Diver") float DrowningDamage = 9.f;

	UPROPERTY(EditAnywhere, Category = "Diver") float SwimSpeed = 420.f;
	UPROPERTY(EditAnywhere, Category = "Diver") float SprintMultiplier = 1.85f;

	/** Extra air burned per second while sprinting. */
	UPROPERTY(EditAnywhere, Category = "Diver") float SprintOxygenDrain = 0.8f;

	UPROPERTY(EditAnywhere, Category = "Diver") float MouseSensitivity = 0.6f;

private:
	// --- Components -----------------------------------------------------------

	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<UCapsuleComponent> Capsule;
	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<UCameraComponent> Camera;
	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<UFloatingPawnMovement> Movement;
	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<USLSurvivalKnife> Knife;
	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<USpotLightComponent> Flashlight;

	/** Where carried scrap is held. */
	UPROPERTY(VisibleAnywhere, Category = "Diver") TObjectPtr<USceneComponent> CarryPoint;

	// --- Input (built at runtime, so no .uasset input files are needed) --------

	UPROPERTY() TObjectPtr<UInputMappingContext> MappingContext;
	UPROPERTY() TObjectPtr<UInputAction> IA_Move;      // Axis2D: forward / strafe
	UPROPERTY() TObjectPtr<UInputAction> IA_Ascend;    // Axis1D: up / down
	UPROPERTY() TObjectPtr<UInputAction> IA_Look;      // Axis2D: mouse
	UPROPERTY() TObjectPtr<UInputAction> IA_Sprint;
	UPROPERTY() TObjectPtr<UInputAction> IA_Attack;
	UPROPERTY() TObjectPtr<UInputAction> IA_Interact;
	UPROPERTY() TObjectPtr<UInputAction> IA_Flashlight;
	UPROPERTY() TObjectPtr<UInputAction> IA_Respawn;

	void BuildInputActions();

	/** Pushes the runtime-built mapping context onto the local player. */
	void ApplyMappingContext();

	void OnMove(const FInputActionValue& Value);
	void OnAscend(const FInputActionValue& Value);
	void OnLook(const FInputActionValue& Value);
	void OnSprintStart(const FInputActionValue& Value);
	void OnSprintStop(const FInputActionValue& Value);
	void OnAttack(const FInputActionValue& Value);
	void OnInteract(const FInputActionValue& Value);
	void OnToggleFlashlight(const FInputActionValue& Value);
	void OnRespawn(const FInputActionValue& Value);

	// --- State ----------------------------------------------------------------

	void UpdateOxygen(float DeltaSeconds);
	void UpdateFocus();
	void Die();

	UPROPERTY() TWeakObjectPtr<ASLScrapMetal> CarriedScrap;

	float Health = 100.f;
	float Oxygen = 90.f;
	float TimeSinceDamage = 999.f;
	float FocusCheckTimer = 0.f;

	bool bSprinting = false;
	bool bDead = false;

	FString FocusName;
};
