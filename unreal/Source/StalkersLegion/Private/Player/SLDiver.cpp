#include "Player/SLDiver.h"

#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/SpotLightComponent.h"
#include "Creatures/SLCreature.h"
#include "Engine/DamageEvents.h"
#include "Engine/World.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"
#include "Player/SLSurvivalKnife.h"
#include "StalkersLegion.h"
#include "World/SLBiomeLibrary.h"
#include "World/SLScrapMetal.h"

ASLDiver::ASLDiver()
{
	PrimaryActorTick.bCanEverTick = true;

	Capsule = CreateDefaultSubobject<UCapsuleComponent>(TEXT("Capsule"));
	Capsule->InitCapsuleSize(34.f, 88.f);
	Capsule->SetCollisionEnabled(ECollisionEnabled::QueryAndPhysics);
	Capsule->SetCollisionObjectType(ECC_Pawn);
	Capsule->SetCollisionResponseToAllChannels(ECR_Block);
	Capsule->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
	SetRootComponent(Capsule);

	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(Capsule);
	Camera->SetRelativeLocation(FVector(0.f, 0.f, 40.f));
	Camera->bUsePawnControlRotation = true;

	Knife = CreateDefaultSubobject<USLSurvivalKnife>(TEXT("SurvivalKnife"));
	Knife->SetupAttachment(Camera);

	Flashlight = CreateDefaultSubobject<USpotLightComponent>(TEXT("Flashlight"));
	Flashlight->SetupAttachment(Camera);
	Flashlight->SetRelativeLocation(FVector(20.f, 0.f, -8.f));
	Flashlight->SetIntensity(28000.f);
	Flashlight->SetAttenuationRadius(4500.f);
	Flashlight->SetInnerConeAngle(16.f);
	Flashlight->SetOuterConeAngle(34.f);
	Flashlight->SetLightColor(FLinearColor(0.85f, 0.95f, 1.f));
	Flashlight->SetCastShadows(false);
	Flashlight->SetVisibility(false);

	CarryPoint = CreateDefaultSubobject<USceneComponent>(TEXT("CarryPoint"));
	CarryPoint->SetupAttachment(Camera);
	CarryPoint->SetRelativeLocation(FVector(90.f, -34.f, -34.f));

	Movement = CreateDefaultSubobject<UFloatingPawnMovement>(TEXT("Movement"));
	Movement->UpdatedComponent = Capsule;
	Movement->MaxSpeed = SwimSpeed;
	// Water: quick to get going, quick to stop. No inertia slides.
	Movement->Acceleration = 2400.f;
	Movement->Deceleration = 1800.f;

	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;

	AutoPossessPlayer = EAutoReceiveInput::Player0;
	SetCanBeDamaged(true);
}

void ASLDiver::BeginPlay()
{
	Super::BeginPlay();

	Health = MaxHealth;
	Oxygen = MaxOxygen;

	BuildInputActions();
	ApplyMappingContext();
}

void ASLDiver::ApplyMappingContext()
{
	const APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC)
	{
		return;
	}

	if (UEnhancedInputLocalPlayerSubsystem* Subsystem =
		ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
	{
		Subsystem->AddMappingContext(MappingContext, 0);
	}
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

void ASLDiver::BuildInputActions()
{
	if (MappingContext)
	{
		return;
	}

	MappingContext = NewObject<UInputMappingContext>(this, TEXT("SLMappingContext"));

	auto MakeAction = [this](const TCHAR* Name, EInputActionValueType Type) -> UInputAction*
	{
		UInputAction* Action = NewObject<UInputAction>(this, Name);
		Action->ValueType = Type;
		return Action;
	};

	IA_Move = MakeAction(TEXT("IA_Move"), EInputActionValueType::Axis2D);
	IA_Ascend = MakeAction(TEXT("IA_Ascend"), EInputActionValueType::Axis1D);
	IA_Look = MakeAction(TEXT("IA_Look"), EInputActionValueType::Axis2D);
	IA_Sprint = MakeAction(TEXT("IA_Sprint"), EInputActionValueType::Boolean);
	IA_Attack = MakeAction(TEXT("IA_Attack"), EInputActionValueType::Boolean);
	IA_Interact = MakeAction(TEXT("IA_Interact"), EInputActionValueType::Boolean);
	IA_Flashlight = MakeAction(TEXT("IA_Flashlight"), EInputActionValueType::Boolean);
	IA_Respawn = MakeAction(TEXT("IA_Respawn"), EInputActionValueType::Boolean);

	// WASD feeds an Axis2D: X is forward/back, Y is right/left. A digital key
	// mapped to an axis yields 1.0, so "back" and "left" just get negated.
	auto MapMove = [this](FKey Key, bool bNegate, bool bSwizzleToY)
	{
		FEnhancedActionKeyMapping& Mapping = MappingContext->MapKey(IA_Move, Key);
		if (bSwizzleToY)
		{
			// Moves the value from the X channel into Y (strafe).
			UInputModifierSwizzleAxis* Swizzle = NewObject<UInputModifierSwizzleAxis>(this);
			Swizzle->Order = EInputAxisSwizzle::YXZ;
			Mapping.Modifiers.Add(Swizzle);
		}
		if (bNegate)
		{
			Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(this));
		}
	};

	MapMove(EKeys::W, false, false);
	MapMove(EKeys::S, true, false);
	MapMove(EKeys::D, false, true);
	MapMove(EKeys::A, true, true);

	// Space rises, Ctrl sinks.
	MappingContext->MapKey(IA_Ascend, EKeys::SpaceBar);
	{
		FEnhancedActionKeyMapping& Mapping = MappingContext->MapKey(IA_Ascend, EKeys::LeftControl);
		Mapping.Modifiers.Add(NewObject<UInputModifierNegate>(this));
	}

	MappingContext->MapKey(IA_Look, EKeys::Mouse2D);

	MappingContext->MapKey(IA_Sprint, EKeys::LeftShift);
	MappingContext->MapKey(IA_Attack, EKeys::LeftMouseButton);
	MappingContext->MapKey(IA_Interact, EKeys::E);
	MappingContext->MapKey(IA_Flashlight, EKeys::F);
	MappingContext->MapKey(IA_Respawn, EKeys::R);
}

void ASLDiver::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);

	// Possession can happen either side of BeginPlay, so make sure the actions
	// exist and the context is applied whichever came first.
	BuildInputActions();
	ApplyMappingContext();

	UEnhancedInputComponent* Input = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!Input)
	{
		UE_LOG(LogStalkersLegion, Error,
			TEXT("Enhanced Input is not active. Check DefaultInputComponentClass in Config/DefaultInput.ini."));
		return;
	}

	Input->BindAction(IA_Move, ETriggerEvent::Triggered, this, &ASLDiver::OnMove);
	Input->BindAction(IA_Ascend, ETriggerEvent::Triggered, this, &ASLDiver::OnAscend);
	Input->BindAction(IA_Look, ETriggerEvent::Triggered, this, &ASLDiver::OnLook);
	Input->BindAction(IA_Sprint, ETriggerEvent::Started, this, &ASLDiver::OnSprintStart);
	Input->BindAction(IA_Sprint, ETriggerEvent::Completed, this, &ASLDiver::OnSprintStop);
	Input->BindAction(IA_Attack, ETriggerEvent::Started, this, &ASLDiver::OnAttack);
	Input->BindAction(IA_Interact, ETriggerEvent::Started, this, &ASLDiver::OnInteract);
	Input->BindAction(IA_Flashlight, ETriggerEvent::Started, this, &ASLDiver::OnToggleFlashlight);
	Input->BindAction(IA_Respawn, ETriggerEvent::Started, this, &ASLDiver::OnRespawn);
}

void ASLDiver::OnMove(const FInputActionValue& Value)
{
	if (bDead)
	{
		return;
	}

	const FVector2D Axis = Value.Get<FVector2D>();
	if (Axis.IsNearlyZero())
	{
		return;
	}

	// Swim where you look: forward follows the full camera rotation, including
	// pitch, so you dive by looking down and pushing forward.
	const FRotator ViewRotation = GetControlRotation();
	const FVector Forward = ViewRotation.Vector();
	const FVector Right = FRotationMatrix(FRotator(0.f, ViewRotation.Yaw, 0.f)).GetUnitAxis(EAxis::Y);

	AddMovementInput(Forward, Axis.X);
	AddMovementInput(Right, Axis.Y);
}

void ASLDiver::OnAscend(const FInputActionValue& Value)
{
	if (bDead)
	{
		return;
	}

	const float Axis = Value.Get<float>();
	if (!FMath::IsNearlyZero(Axis))
	{
		AddMovementInput(FVector::UpVector, Axis);
	}
}

void ASLDiver::OnLook(const FInputActionValue& Value)
{
	if (bDead)
	{
		return;
	}

	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(Axis.X * MouseSensitivity);
	AddControllerPitchInput(-Axis.Y * MouseSensitivity);
}

void ASLDiver::OnSprintStart(const FInputActionValue& Value)
{
	bSprinting = true;
}

void ASLDiver::OnSprintStop(const FInputActionValue& Value)
{
	bSprinting = false;
}

void ASLDiver::OnAttack(const FInputActionValue& Value)
{
	if (bDead || !Knife)
	{
		return;
	}

	Knife->Swing();
}

void ASLDiver::OnInteract(const FInputActionValue& Value)
{
	if (bDead)
	{
		return;
	}

	// Holding something? Throw it. Scrap in flight is the best stalker bait
	// in the game: they chase the noise, not you.
	if (ASLScrapMetal* Held = CarriedScrap.Get())
	{
		const FVector Toss = GetControlRotation().Vector() * 900.f + FVector(0.f, 0.f, 120.f);
		Held->Drop(Toss);
		CarriedScrap = nullptr;
		return;
	}

	if (ASLScrapMetal* Nearby = ASLScrapMetal::FindNearest(this, GetActorLocation(), 320.f))
	{
		Nearby->SetCarriedBy(this, CarryPoint, NAME_None);
		CarriedScrap = Nearby;
	}
}

void ASLDiver::OnToggleFlashlight(const FInputActionValue& Value)
{
	if (Flashlight)
	{
		Flashlight->SetVisibility(!Flashlight->IsVisible());
	}
}

void ASLDiver::OnRespawn(const FInputActionValue& Value)
{
	if (bDead)
	{
		Respawn();
	}
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

bool ASLDiver::IsAtSurface() const
{
	return GetActorLocation().Z > SLBiomeLibrary::WaterLevel - 90.f;
}

float ASLDiver::GetDepthMeters() const
{
	return FMath::Max(0.f, (float)(SLBiomeLibrary::WaterLevel - GetActorLocation().Z)) / 100.f;
}

ESLBiome ASLDiver::GetCurrentBiome() const
{
	const FVector Location = GetActorLocation();
	return SLBiomeLibrary::BiomeAt(Location.X, Location.Y);
}

ASLScrapMetal* ASLDiver::GetCarriedScrap() const
{
	return CarriedScrap.Get();
}

void ASLDiver::UpdateOxygen(float DeltaSeconds)
{
	if (IsAtSurface())
	{
		// Breaking the surface refills fast - the surface is always safety.
		Oxygen = FMath::Min(MaxOxygen, Oxygen + DeltaSeconds * 28.f);
		return;
	}

	float Drain = DeltaSeconds;
	if (bSprinting && !Movement->Velocity.IsNearlyZero())
	{
		Drain += DeltaSeconds * SprintOxygenDrain;
	}

	Oxygen = FMath::Max(0.f, Oxygen - Drain);

	if (Oxygen <= 0.f && !bDead)
	{
		Health -= DrowningDamage * DeltaSeconds;
		TimeSinceDamage = 0.f;

		if (Health <= 0.f)
		{
			Die();
		}
	}
}

void ASLDiver::UpdateFocus()
{
	FocusName.Reset();

	UWorld* World = GetWorld();
	if (!World || !Camera)
	{
		return;
	}

	const FVector Start = Camera->GetComponentLocation();
	const FVector End = Start + Camera->GetForwardVector() * 600.f;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(SLDiverFocus), false, this);
	FHitResult Hit;

	if (World->SweepSingleByChannel(Hit, Start, End, FQuat::Identity, ECC_Visibility,
		FCollisionShape::MakeSphere(24.f), Params))
	{
		if (const ASLCreature* Creature = Cast<ASLCreature>(Hit.GetActor()))
		{
			FocusName = Creature->GetDisplayName();
		}
		else if (Hit.GetActor() && Hit.GetActor()->IsA<ASLScrapMetal>())
		{
			FocusName = CarriedScrap.IsValid() ? TEXT("Scrap Metal") : TEXT("Scrap Metal  [E] pick up");
		}
	}
}

float ASLDiver::TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (bDead || DamageAmount <= 0.f)
	{
		return 0.f;
	}

	Health -= DamageAmount;
	TimeSinceDamage = 0.f;

	// Knocked back by the hit, which is what makes a stalker bite frightening.
	if (DamageCauser && Movement)
	{
		const FVector Push = (GetActorLocation() - DamageCauser->GetActorLocation()).GetSafeNormal();
		Movement->Velocity += Push * 520.f + FVector(0.f, 0.f, 60.f);
	}

	// A bitten diver drops whatever they were holding.
	if (ASLScrapMetal* Held = CarriedScrap.Get())
	{
		Held->Drop(FVector(0.f, 0.f, -50.f));
		CarriedScrap = nullptr;
	}

	if (Health <= 0.f)
	{
		Die();
	}

	return Applied + DamageAmount;
}

void ASLDiver::Die()
{
	if (bDead)
	{
		return;
	}

	bDead = true;
	Health = 0.f;
	bSprinting = false;

	if (ASLScrapMetal* Held = CarriedScrap.Get())
	{
		Held->Drop(FVector::ZeroVector);
		CarriedScrap = nullptr;
	}
}

void ASLDiver::Respawn()
{
	bDead = false;
	Health = MaxHealth;
	Oxygen = MaxOxygen;
	TimeSinceDamage = 999.f;

	// Back at the surface above the Safe Shallows.
	SetActorLocation(FVector(0.f, 0.f, SLBiomeLibrary::WaterLevel - 120.f), false, nullptr, ETeleportType::TeleportPhysics);

	if (Movement)
	{
		Movement->Velocity = FVector::ZeroVector;
	}

	if (AController* C = GetController())
	{
		C->SetControlRotation(FRotator(-15.f, 0.f, 0.f));
	}
}

void ASLDiver::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	TimeSinceDamage += DeltaSeconds;

	if (bDead)
	{
		// Sink gently while dead.
		if (Movement)
		{
			Movement->Velocity = FMath::VInterpTo(Movement->Velocity, FVector(0.f, 0.f, -60.f), DeltaSeconds, 1.f);
		}
		return;
	}

	Movement->MaxSpeed = bSprinting ? SwimSpeed * SprintMultiplier : SwimSpeed;

	// You can break the surface but not leave the water: past the water line the
	// diver is pushed back down, so you bob instead of flying off into the sky.
	const float AboveSurface = (float)(GetActorLocation().Z - SLBiomeLibrary::WaterLevel);
	if (AboveSurface > 0.f)
	{
		const float Push = FMath::Min(AboveSurface * 4.f, 600.f);
		Movement->Velocity.Z = FMath::Min(Movement->Velocity.Z, 0.f) - Push * DeltaSeconds;
	}

	UpdateOxygen(DeltaSeconds);

	// Slow recovery once nothing has bitten you for a while. Without it a game
	// with no medkits would be a one-way trip.
	if (TimeSinceDamage > RegenDelay && Health < MaxHealth && Oxygen > 0.f)
	{
		Health = FMath::Min(MaxHealth, Health + RegenRate * DeltaSeconds);
	}

	FocusCheckTimer -= DeltaSeconds;
	if (FocusCheckTimer <= 0.f)
	{
		FocusCheckTimer = 0.15f;
		UpdateFocus();
	}
}
