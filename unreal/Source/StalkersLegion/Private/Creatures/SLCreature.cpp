#include "Creatures/SLCreature.h"

#include "Components/BoxComponent.h"
#include "Engine/DamageEvents.h"
#include "ProceduralMeshComponent.h"
#include "Procedural/SLBodyBuilder.h"
#include "Procedural/SLMaterialLibrary.h"
#include "World/SLBiomeLibrary.h"

namespace
{
	/**
	 * Building a body costs a few hundred triangles of work, and a school of ten
	 * fish shares one shape, so mesh data is generated once per species and
	 * re-uploaded from the cache afterwards.
	 */
	FSLCreatureMesh& GetCachedMesh(const FSLSpeciesDef& Species)
	{
		static TMap<FName, FSLCreatureMesh> Cache;
		if (FSLCreatureMesh* Found = Cache.Find(Species.Id))
		{
			return *Found;
		}
		return Cache.Add(Species.Id, SLBodyBuilder::Build(Species));
	}
}

ASLCreature::ASLCreature()
{
	PrimaryActorTick.bCanEverTick = true;

	CollisionBox = CreateDefaultSubobject<UBoxComponent>(TEXT("CollisionBox"));
	CollisionBox->SetBoxExtent(FVector(25.f, 10.f, 10.f));
	CollisionBox->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	CollisionBox->SetCollisionObjectType(ECC_Pawn);
	CollisionBox->SetCollisionResponseToAllChannels(ECR_Ignore);
	// Blocking Visibility is what lets the survival knife's trace find creatures.
	CollisionBox->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	CollisionBox->SetCollisionResponseToChannel(ECC_Pawn, ECR_Overlap);
	CollisionBox->SetGenerateOverlapEvents(true);
	SetRootComponent(CollisionBox);

	BodyMesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("BodyMesh"));
	BodyMesh->SetupAttachment(CollisionBox);
	BodyMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	BodyMesh->SetCastShadow(false);

	TailMesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("TailMesh"));
	TailMesh->SetupAttachment(CollisionBox);
	TailMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	TailMesh->SetCastShadow(false);

	JawMesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("JawMesh"));
	JawMesh->SetupAttachment(CollisionBox);
	JawMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	JawMesh->SetCastShadow(false);

	AutoPossessPlayer = EAutoReceiveInput::Disabled;
	AutoPossessAI = EAutoPossessAI::Disabled;
	SetCanBeDamaged(true);
}

void ASLCreature::BeginPlay()
{
	Super::BeginPlay();

	if (!bBodyBuilt)
	{
		BuildBody();
	}

	Health = Species.MaxHealth;
	SwimPhase = FMath::FRandRange(0.f, 2.f * PI);

	if (TerritoryCenter.IsNearlyZero())
	{
		TerritoryCenter = GetActorLocation();
	}

	Velocity = GetActorForwardVector() * Species.CruiseSpeed;
}

void ASLCreature::InitializeSpecies(const FSLSpeciesDef& InSpecies)
{
	Species = InSpecies;
	Health = Species.MaxHealth;
	BuildBody();
}

void ASLCreature::SetTerritory(const FVector& Center, float Radius)
{
	TerritoryCenter = Center;
	TerritoryRadius = FMath::Max(200.f, Radius);
}

void ASLCreature::BuildBody()
{
	bBodyBuilt = true;

	const FSLCreatureMesh& Built = GetCachedMesh(Species);

	SLProcMesh::ApplyToComponent(BodyMesh, 0, Built.Body, false);
	SLProcMesh::ApplyToComponent(TailMesh, 0, Built.Tail, false);

	TailPivotLocal = Built.TailPivot;
	TailMesh->SetRelativeLocation(TailPivotLocal);

	if (!Built.Jaw.IsEmpty())
	{
		SLProcMesh::ApplyToComponent(JawMesh, 0, Built.Jaw, false);
		JawPivotLocal = Built.JawPivot;
		JawMesh->SetRelativeLocation(JawPivotLocal);
	}
	else
	{
		JawMesh->SetVisibility(false);
	}

	if (UMaterialInterface* Material = SLMaterialLibrary::GetMaterialForGlow(Species.Glow))
	{
		BodyMesh->SetMaterial(0, Material);
		TailMesh->SetMaterial(0, Material);
		JawMesh->SetMaterial(0, SLMaterialLibrary::GetSurfaceMaterial());
	}

	CollisionBox->SetBoxExtent(Built.HalfExtent, false);
}

float ASLCreature::FloorBelow() const
{
	const FVector Location = GetActorLocation();
	return SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y);
}

FVector ASLCreature::ApplyEnvironmentAvoidance(const FVector& DesiredVelocity) const
{
	FVector Result = DesiredVelocity;
	const FVector Location = GetActorLocation();
	const float Speed = FMath::Max(Species.CruiseSpeed, 1.f);

	// --- Sea floor: look ahead so fast swimmers pull up in time ---------------
	const FVector Ahead = Location + Result.GetSafeNormal() * FMath::Max(120.f, GetBodyLength() * 2.f);
	const float FloorHere = SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y);
	const float FloorAhead = SLBiomeLibrary::FloorHeightAt(Ahead.X, Ahead.Y);
	const float Clearance = FMath::Max(60.f, GetBodyLength() * 0.6f);
	const float WorstFloor = FMath::Max(FloorHere, FloorAhead);

	if (Location.Z < WorstFloor + Clearance)
	{
		const float Urgency = FMath::Clamp((float)(WorstFloor + Clearance - Location.Z) / Clearance, 0.f, 2.f);
		Result.Z += Speed * Urgency * 1.6f;
	}

	// --- Surface: nothing here breaches ---------------------------------------
	const float Ceiling = SLBiomeLibrary::WaterLevel - 120.f;
	if (Location.Z > Ceiling)
	{
		Result.Z -= Speed * FMath::Clamp((float)(Location.Z - Ceiling) / 200.f, 0.f, 2.f) * 1.6f;
	}

	// --- World bounds: turn back rather than swimming off the map --------------
	const float DistanceFromCenter = (float)FVector2D(Location.X, Location.Y).Size();
	if (DistanceFromCenter > SLBiomeLibrary::WorldExtent)
	{
		const FVector Inward = FVector(-Location.X, -Location.Y, 0.f).GetSafeNormal();
		const float Urgency = FMath::Clamp((DistanceFromCenter - SLBiomeLibrary::WorldExtent) / 800.f, 0.f, 1.f);
		Result = FMath::Lerp(Result, Inward * Speed, Urgency);
	}

	return Result;
}

void ASLCreature::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (bDead)
	{
		UpdateDeath(DeltaSeconds);
		return;
	}

	// --- Steering -------------------------------------------------------------
	FVector Desired = ComputeDesiredVelocity(DeltaSeconds);
	Desired = ApplyEnvironmentAvoidance(Desired);

	const float DesiredSpeed = (float)(Desired.Size());
	if (DesiredSpeed > KINDA_SMALL_NUMBER)
	{
		// Turn rate limits how quickly the velocity direction can rotate, which
		// is what gives each species its handling - darters snap, gulpers lumber.
		const FVector CurrentDir = Velocity.IsNearlyZero() ? GetActorForwardVector() : Velocity.GetSafeNormal();
		const FVector DesiredDir = Desired / DesiredSpeed;
		const FVector NewDir = FMath::VInterpNormalRotationTo(CurrentDir, DesiredDir, DeltaSeconds, Species.TurnRate);

		const float TargetSpeed = FMath::Min(DesiredSpeed, Species.SprintSpeed);
		const float CurrentSpeed = (float)(Velocity.Size());
		const float NewSpeed = FMath::FInterpTo(CurrentSpeed, TargetSpeed, DeltaSeconds, 2.5f);

		Velocity = NewDir * NewSpeed;
		Exertion = FMath::Clamp(NewSpeed / FMath::Max(Species.CruiseSpeed, 1.f), 0.2f, 2.2f);
	}
	else
	{
		Velocity = FMath::VInterpTo(Velocity, FVector::ZeroVector, DeltaSeconds, 1.2f);
		Exertion = FMath::FInterpTo(Exertion, 0.25f, DeltaSeconds, 2.f);
	}

	// --- Integrate ------------------------------------------------------------
	if (!Velocity.IsNearlyZero())
	{
		AddActorWorldOffset(Velocity * DeltaSeconds, false);

		// Face the direction of travel and bank into turns.
		FRotator Target = Velocity.Rotation();
		const FRotator Current = GetActorRotation();
		const float YawDelta = (float)FMath::FindDeltaAngleDegrees(Current.Yaw, Target.Yaw);
		Target.Roll = FMath::Clamp(-YawDelta * 1.4f, -35.f, 35.f);

		SetActorRotation(FMath::RInterpTo(Current, Target, DeltaSeconds, 4.f));
	}

	UpdateSwimAnimation(DeltaSeconds);
}

void ASLCreature::UpdateSwimAnimation(float DeltaSeconds)
{
	// No skeleton: the body yaws gently and the tail follows a beat behind,
	// which reads convincingly as swimming for a couple of pennies of CPU.
	SwimPhase += DeltaSeconds * Species.WagRate * FMath::Clamp(Exertion, 0.3f, 2.2f);

	const float BodyAmplitude = 4.f * FMath::Clamp(Exertion, 0.3f, 1.8f);
	const float TailAmplitude = 22.f * FMath::Clamp(Exertion, 0.3f, 1.8f);

	BodyMesh->SetRelativeRotation(FRotator(0.f, FMath::Sin(SwimPhase) * BodyAmplitude, 0.f));
	TailMesh->SetRelativeRotation(FRotator(0.f, FMath::Sin(SwimPhase - 0.9f) * TailAmplitude, 0.f));

	if (JawMesh->IsVisible())
	{
		// The jaw runs forward along +X, and positive pitch raises +X toward +Z,
		// so opening it downward takes a negative pitch.
		JawMesh->SetRelativeRotation(FRotator(-JawOpen * 32.f, 0.f, 0.f));
	}
}

float ASLCreature::TakeDamage(float DamageAmount, const FDamageEvent& DamageEvent, AController* EventInstigator, AActor* DamageCauser)
{
	const float Applied = Super::TakeDamage(DamageAmount, DamageEvent, EventInstigator, DamageCauser);
	if (bDead || DamageAmount <= 0.f)
	{
		return 0.f;
	}

	Health -= DamageAmount;

	// Knocked back along the hit direction, so knife strikes feel like they land.
	if (DamageCauser)
	{
		const FVector Push = (GetActorLocation() - DamageCauser->GetActorLocation()).GetSafeNormal();
		Velocity += Push * 260.f;
	}

	if (Health <= 0.f)
	{
		Health = 0.f;
		OnDeath(DamageCauser);
	}
	else
	{
		OnHurt(DamageAmount, DamageCauser);
	}

	return Applied + DamageAmount;
}

void ASLCreature::OnDeath(AActor* Killer)
{
	bDead = true;
	DeathTimer = 0.f;
	JawOpen = 0.f;

	CollisionBox->SetCollisionEnabled(ECollisionEnabled::NoCollision);
}

void ASLCreature::UpdateDeath(float DeltaSeconds)
{
	DeathTimer += DeltaSeconds;

	// Roll belly-up and sink, then clean up once out of sight.
	const FRotator Current = GetActorRotation();
	SetActorRotation(FMath::RInterpTo(Current, FRotator(Current.Pitch * 0.2f, Current.Yaw, 180.f), DeltaSeconds, 1.2f));

	const float SinkSpeed = FMath::Min(55.f, 18.f + DeathTimer * 14.f);
	const FVector Location = GetActorLocation();
	const float FloorZ = SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y);

	if (Location.Z > FloorZ + GetBodyLength() * 0.25f)
	{
		AddActorWorldOffset(FVector(0.f, 0.f, -SinkSpeed * DeltaSeconds), false);
	}

	if (DeathTimer > 14.f)
	{
		Destroy();
	}
}
