#include "Creatures/SLFish.h"

#include "Creatures/SLStalker.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "World/SLBiomeLibrary.h"

ASLFish::ASLFish()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASLFish::BeginPlay()
{
	Super::BeginPlay();

	NoiseOffset = FMath::FRandRange(0.f, 1000.f);
	SenseTimer = FMath::FRandRange(0.f, 0.4f);
	ChooseWanderTarget();
}

void ASLFish::SetSchoolLeader(ASLFish* Leader, const FVector& SlotOffset)
{
	SchoolLeader = Leader;
	SchoolSlot = SlotOffset;
}

void ASLFish::Startle(const FVector& ThreatLocation, float Duration)
{
	if (!IsAlive())
	{
		return;
	}

	FleeFrom = ThreatLocation;
	FleeTimer = FMath::Max(FleeTimer, Duration);
	State = ESLFishState::Flee;
}

void ASLFish::OnHurt(float Damage, AActor* Causer)
{
	if (Causer)
	{
		Startle(Causer->GetActorLocation(), 6.f);
	}
}

void ASLFish::SenseThreats()
{
	const FVector Location = GetActorLocation();
	const float Radius = Species.SenseRadius;
	const float RadiusSq = Radius * Radius;

	// Stalkers are the thing fish actually fear.
	for (TActorIterator<ASLStalker> It(GetWorld()); It; ++It)
	{
		ASLStalker* Stalker = *It;
		if (!Stalker || !Stalker->IsAlive())
		{
			continue;
		}

		if (FVector::DistSquared(Stalker->GetActorLocation(), Location) < RadiusSq)
		{
			Startle(Stalker->GetActorLocation(), 3.5f);
			return;
		}
	}

	// The player counts as a threat, but only up close - otherwise the shallows
	// would empty out the moment you arrived.
	if (const APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (const APawn* Player = PC->GetPawn())
		{
			const float PlayerDistSq = (float)(FVector::DistSquared(Player->GetActorLocation(), Location));
			const float Personal = Radius * 0.3f;
			if (PlayerDistSq < Personal * Personal)
			{
				Startle(Player->GetActorLocation(), 2.f);
			}
		}
	}
}

void ASLFish::ChooseWanderTarget()
{
	// A point somewhere in the territory, at the species' preferred altitude.
	const float Angle = FMath::FRandRange(0.f, 2.f * PI);
	const float Distance = FMath::FRandRange(TerritoryRadius * 0.2f, TerritoryRadius);

	const float X = (float)(TerritoryCenter.X + FMath::Cos(Angle) * Distance);
	const float Y = (float)(TerritoryCenter.Y + FMath::Sin(Angle) * Distance);
	const float FloorZ = SLBiomeLibrary::FloorHeightAt(X, Y);

	const float Altitude = Species.PreferredAltitude * FMath::FRandRange(0.6f, 1.5f);
	WanderTarget = FVector(X, Y, FMath::Min(FloorZ + Altitude, SLBiomeLibrary::WaterLevel - 250.f));
}

FVector ASLFish::ComputeDesiredVelocity(float DeltaSeconds)
{
	const FVector Location = GetActorLocation();

	SenseTimer -= DeltaSeconds;
	if (SenseTimer <= 0.f)
	{
		SenseTimer = FMath::FRandRange(0.3f, 0.6f);
		SenseThreats();
	}

	StateTimer += DeltaSeconds;

	// ---------------------------------------------------------------- Fleeing
	if (FleeTimer > 0.f)
	{
		FleeTimer -= DeltaSeconds;
		State = ESLFishState::Flee;

		FVector Away = (Location - FleeFrom);
		Away.Z += 60.f; // Prey tends to break upward as well as away.
		Away = Away.GetSafeNormal();

		// Weave while fleeing so the escape is not a straight, easy line.
		const float Weave = FMath::Sin(GetWorld()->GetTimeSeconds() * 6.f + NoiseOffset);
		const FVector Side = FVector::CrossProduct(Away, FVector::UpVector).GetSafeNormal();

		if (FleeTimer <= 0.f)
		{
			State = ESLFishState::Cruise;
			ChooseWanderTarget();
			StateTimer = 0.f;
		}

		return (Away + Side * Weave * 0.45f).GetSafeNormal() * Species.SprintSpeed;
	}

	// ------------------------------------------------------- Following a leader
	if (ASLFish* Leader = SchoolLeader.Get())
	{
		if (Leader->IsAlive())
		{
			// Hold a slot behind and beside the leader, in the leader's frame.
			const FVector SlotWorld = Leader->GetActorLocation() + Leader->GetActorRotation().RotateVector(SchoolSlot);
			const FVector ToSlot = SlotWorld - Location;
			const float Distance = (float)(ToSlot.Size());

			// Close the gap quickly when far behind; cruise when in formation.
			const float Catchup = FMath::Clamp((float)(Distance - 60.f) / 840.f, 0.f, 1.f);
			const float Speed = FMath::Lerp(Species.CruiseSpeed * 0.55f, Species.SprintSpeed, Catchup);

			// A little independent drift keeps the school from looking rigid.
			const float Time = GetWorld()->GetTimeSeconds();
			const FVector Drift(
				FMath::Sin(Time * 0.9f + NoiseOffset),
				FMath::Cos(Time * 0.7f + NoiseOffset * 1.3f),
				FMath::Sin(Time * 1.3f + NoiseOffset * 0.6f) * 0.5f);

			return (ToSlot.GetSafeNormal() * Speed) + Drift * 40.f;
		}

		// Leader is gone - this fish is on its own now.
		SchoolLeader = nullptr;
		ChooseWanderTarget();
	}

	// --------------------------------------------------------------- Wandering
	const FVector ToTarget = WanderTarget - Location;
	if (ToTarget.SizeSquared() < FMath::Square(180.f) || StateTimer > 12.f)
	{
		StateTimer = 0.f;

		// Grazers periodically drop to the floor to pick at it.
		if (State != ESLFishState::Graze && FMath::FRand() < 0.35f)
		{
			State = ESLFishState::Graze;
			const float FloorZ = SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y);
			WanderTarget = FVector(
				Location.X + FMath::FRandRange(-300.f, 300.f),
				Location.Y + FMath::FRandRange(-300.f, 300.f),
				FloorZ + FMath::FRandRange(40.f, 110.f));
		}
		else
		{
			State = ESLFishState::Cruise;
			ChooseWanderTarget();
		}
	}

	const float CruiseSpeed = State == ESLFishState::Graze ? Species.CruiseSpeed * 0.45f : Species.CruiseSpeed;
	return ToTarget.GetSafeNormal() * CruiseSpeed;
}
