#include "Creatures/SLStalker.h"

#include "Creatures/SLFish.h"
#include "Engine/DamageEvents.h"
#include "EngineUtils.h"
#include "GameFramework/DamageType.h"
#include "GameFramework/PlayerController.h"
#include "Kismet/GameplayStatics.h"
#include "World/SLBiomeLibrary.h"
#include "World/SLScrapMetal.h"

namespace
{
	/** How many bites a stalker takes before it decides to haul the scrap away. */
	constexpr int32 BitesBeforeCarry = 3;

	/** Damage a stalker does to a piece of scrap per bite. */
	constexpr float ScrapBiteDamage = 14.f;
}

ASLStalker::ASLStalker()
{
	PrimaryActorTick.bCanEverTick = true;
}

void ASLStalker::BeginPlay()
{
	Super::BeginPlay();

	SenseTimer = FMath::FRandRange(0.f, 0.3f);
	PatrolTarget = GetActorLocation();
	EnterState(ESLStalkerState::Patrol);
}

FString ASLStalker::GetStateLabel() const
{
	switch (State)
	{
	case ESLStalkerState::Patrol:		return TEXT("patrolling");
	case ESLStalkerState::SeekScrap:	return TEXT("drawn to scrap");
	case ESLStalkerState::ChewScrap:	return TEXT("chewing metal");
	case ESLStalkerState::CarryScrap:	return TEXT("carrying scrap");
	case ESLStalkerState::HuntFish:		return TEXT("hunting");
	case ESLStalkerState::Feed:			return TEXT("feeding");
	case ESLStalkerState::AttackPlayer:	return TEXT("attacking you");
	case ESLStalkerState::Retreat:		return TEXT("retreating");
	default:							return TEXT("");
	}
}

float ASLStalker::BiteReach() const
{
	return GetBodyLength() * 0.75f + 90.f;
}

void ASLStalker::EnterState(ESLStalkerState NewState)
{
	if (State == NewState)
	{
		return;
	}

	State = NewState;
	StateTimer = 0.f;

	if (NewState == ESLStalkerState::CarryScrap)
	{
		// Pick somewhere else in the territory to dump the piece.
		const float Angle = FMath::FRandRange(0.f, 2.f * PI);
		const float Distance = FMath::FRandRange(TerritoryRadius * 0.4f, TerritoryRadius);
		const float X = (float)(TerritoryCenter.X + FMath::Cos(Angle) * Distance);
		const float Y = (float)(TerritoryCenter.Y + FMath::Sin(Angle) * Distance);
		CarryDestination = FVector(X, Y, SLBiomeLibrary::FloorHeightAt(X, Y) + 260.f);
	}
}

void ASLStalker::Provoke(AActor* Threat)
{
	if (!Threat || !IsAlive())
	{
		return;
	}

	ThreatActor = Threat;
	AggroTimer = FMath::Max(AggroTimer, 12.f);

	// Dropping whatever it was chewing is what sells the switch to aggression.
	if (CarriedScrap.IsValid())
	{
		ReleaseScrap(FVector(0.f, 0.f, -40.f));
	}

	EnterState(ESLStalkerState::AttackPlayer);
}

void ASLStalker::OnHurt(float Damage, AActor* Causer)
{
	// Badly hurt stalkers break off; otherwise they turn on whoever hit them.
	if (Health < Species.MaxHealth * 0.25f)
	{
		ThreatActor = Causer;
		EnterState(ESLStalkerState::Retreat);
		return;
	}

	if (Causer && Causer->IsA<APawn>())
	{
		Provoke(Causer);
	}
}

void ASLStalker::OnDeath(AActor* Killer)
{
	if (CarriedScrap.IsValid())
	{
		ReleaseScrap(FVector::ZeroVector);
	}

	Super::OnDeath(Killer);
}

void ASLStalker::GrabScrap(ASLScrapMetal* Scrap)
{
	if (!Scrap || Scrap->IsHeld())
	{
		return;
	}

	CarriedScrap = Scrap;
	// Carried in the jaws, just in front of the head.
	Scrap->SetCarriedBy(this, JawMesh, NAME_None);
	Scrap->SetActorRelativeLocation(FVector(-GetBodyLength() * 0.12f, 0.f, 0.f));
	JawOpen = 0.45f;
}

void ASLStalker::ReleaseScrap(const FVector& TossVelocity)
{
	if (ASLScrapMetal* Scrap = CarriedScrap.Get())
	{
		Scrap->Drop(TossVelocity);
	}

	CarriedScrap = nullptr;
	TargetScrap = nullptr;
	ScrapBites = 0;
	JawOpen = 0.f;
}

void ASLStalker::UpdateSenses()
{
	const FVector Location = GetActorLocation();

	// --- 1. An active threat outranks everything ------------------------------
	if (AggroTimer > 0.f && ThreatActor.IsValid())
	{
		const float Distance = (float)(FVector::Dist(ThreatActor->GetActorLocation(), Location));
		if (Distance < Species.SenseRadius * 1.5f)
		{
			if (State != ESLStalkerState::Retreat)
			{
				EnterState(ESLStalkerState::AttackPlayer);
			}
			return;
		}

		// Lost it.
		AggroTimer = 0.f;
		ThreatActor = nullptr;
	}

	// --- 2. Busy states run to completion -------------------------------------
	if (State == ESLStalkerState::ChewScrap || State == ESLStalkerState::CarryScrap
		|| State == ESLStalkerState::Feed || State == ESLStalkerState::Retreat)
	{
		return;
	}

	// --- 3. The player, if close and in the open ------------------------------
	if (const APlayerController* PC = UGameplayStatics::GetPlayerController(this, 0))
	{
		if (APawn* Player = PC->GetPawn())
		{
			const float Distance = (float)(FVector::Dist(Player->GetActorLocation(), Location));
			// Stalkers investigate the player well before they commit to a bite.
			if (Distance < Species.SenseRadius * 0.45f)
			{
				ThreatActor = Player;
				AggroTimer = 8.f;
				EnterState(ESLStalkerState::AttackPlayer);
				return;
			}
		}
	}

	// --- 4. Scrap metal: the obsession ----------------------------------------
	if (ASLScrapMetal* Scrap = ASLScrapMetal::FindNearest(this, Location, Species.SenseRadius * 1.6f))
	{
		TargetScrap = Scrap;
		EnterState(ESLStalkerState::SeekScrap);
		return;
	}

	// --- 5. Prey ---------------------------------------------------------------
	ASLFish* ClosestFish = nullptr;
	float ClosestDistSq = FMath::Square(Species.SenseRadius);

	for (TActorIterator<ASLFish> It(GetWorld()); It; ++It)
	{
		ASLFish* Fish = *It;
		if (!Fish || !Fish->IsAlive())
		{
			continue;
		}

		const float DistSq = (float)(FVector::DistSquared(Fish->GetActorLocation(), Location));
		if (DistSq < ClosestDistSq)
		{
			ClosestDistSq = DistSq;
			ClosestFish = Fish;
		}
	}

	if (ClosestFish)
	{
		TargetFish = ClosestFish;
		EnterState(ESLStalkerState::HuntFish);
		return;
	}

	EnterState(ESLStalkerState::Patrol);
}

void ASLStalker::BiteTarget(AActor* Target)
{
	if (!Target || BiteCooldown > 0.f)
	{
		return;
	}

	BiteCooldown = Species.BiteInterval;
	SnapTimer = 0.35f;

	UGameplayStatics::ApplyDamage(Target, Species.BiteDamage, GetInstigatorController(), this,
		UDamageType::StaticClass());

	// Lunge through the target so the bite has weight.
	const FVector Toward = (Target->GetActorLocation() - GetActorLocation()).GetSafeNormal();
	Velocity += Toward * 200.f;
}

FVector ASLStalker::SteerTo(const FVector& Target, float Speed) const
{
	const FVector ToTarget = Target - GetActorLocation();
	if (ToTarget.IsNearlyZero())
	{
		return GetActorForwardVector() * Speed;
	}

	return ToTarget.GetSafeNormal() * Speed;
}

FVector ASLStalker::ComputeDesiredVelocity(float DeltaSeconds)
{
	const FVector Location = GetActorLocation();

	SenseTimer -= DeltaSeconds;
	if (SenseTimer <= 0.f)
	{
		SenseTimer = 0.35f;
		UpdateSenses();
	}

	StateTimer += DeltaSeconds;
	AggroTimer = FMath::Max(0.f, AggroTimer - DeltaSeconds);
	BiteCooldown = FMath::Max(0.f, BiteCooldown - DeltaSeconds);

	switch (State)
	{
	// ------------------------------------------------------------------ Patrol
	case ESLStalkerState::Patrol:
	{
		if (FVector::DistSquared(PatrolTarget, Location) < FMath::Square(400.f) || StateTimer > 14.f)
		{
			StateTimer = 0.f;
			const float Angle = FMath::FRandRange(0.f, 2.f * PI);
			const float Distance = FMath::FRandRange(TerritoryRadius * 0.3f, TerritoryRadius);
			const float X = (float)(TerritoryCenter.X + FMath::Cos(Angle) * Distance);
			const float Y = (float)(TerritoryCenter.Y + FMath::Sin(Angle) * Distance);
			PatrolTarget = FVector(X, Y, SLBiomeLibrary::FloorHeightAt(X, Y) + FMath::FRandRange(200.f, 700.f));
		}

		return SteerTo(PatrolTarget, Species.CruiseSpeed);
	}

	// --------------------------------------------------------------- Seek scrap
	case ESLStalkerState::SeekScrap:
	{
		ASLScrapMetal* Scrap = TargetScrap.Get();
		if (!Scrap || Scrap->IsHeld())
		{
			TargetScrap = nullptr;
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		const FVector ScrapLocation = Scrap->GetActorLocation();
		const float Distance = (float)(FVector::Dist(ScrapLocation, Location));

		// Jaws start opening on the approach.
		JawOpen = FMath::FInterpTo(JawOpen, Distance < 500.f ? 0.7f : 0.15f, DeltaSeconds, 4.f);

		if (Distance < BiteReach())
		{
			EnterState(ESLStalkerState::ChewScrap);
			return FVector::ZeroVector;
		}

		// Approach from slightly above, the way a real ambusher would.
		const FVector Approach = ScrapLocation + FVector(0.f, 0.f, GetBodyLength() * 0.25f);
		return SteerTo(Approach, FMath::Lerp(Species.CruiseSpeed, Species.SprintSpeed, 0.5f));
	}

	// --------------------------------------------------------------- Chew scrap
	case ESLStalkerState::ChewScrap:
	{
		ASLScrapMetal* Scrap = TargetScrap.Get();
		if (!Scrap)
		{
			ScrapBites = 0;
			EnterState(ESLStalkerState::Patrol);
			return FVector::ZeroVector;
		}

		const FVector ScrapLocation = Scrap->GetActorLocation();
		const float Distance = (float)(FVector::Dist(ScrapLocation, Location));

		if (Distance > BiteReach() * 1.6f)
		{
			EnterState(ESLStalkerState::SeekScrap);
			return SteerTo(ScrapLocation, Species.CruiseSpeed);
		}

		// Worry at the metal: bite, shake, bite again.
		JawOpen = 0.5f + 0.5f * FMath::Sin(GetWorld()->GetTimeSeconds() * 9.f);

		if (BiteCooldown <= 0.f)
		{
			BiteCooldown = 0.85f;
			SnapTimer = 0.3f;
			++ScrapBites;

			const FVector BiteDir = (ScrapLocation - Location).GetSafeNormal();
			if (Scrap->ApplyBite(ScrapBiteDamage, BiteDir))
			{
				// Chewed straight through it.
				TargetScrap = nullptr;
				ScrapBites = 0;
				EnterState(ESLStalkerState::Patrol);
				return FVector::ZeroVector;
			}

			if (ScrapBites >= BitesBeforeCarry)
			{
				GrabScrap(Scrap);
				EnterState(ESLStalkerState::CarryScrap);
			}
		}

		// Hold station on the scrap, nosing into it.
		return SteerTo(ScrapLocation, Species.CruiseSpeed * 0.4f);
	}

	// --------------------------------------------------------------- Carry scrap
	case ESLStalkerState::CarryScrap:
	{
		if (!CarriedScrap.IsValid())
		{
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		JawOpen = 0.35f;

		const bool bArrived = FVector::DistSquared(CarryDestination, Location) < FMath::Square(500.f);
		if (bArrived || StateTimer > 22.f)
		{
			// Drop it and lose interest for a while.
			ReleaseScrap(GetActorForwardVector() * 120.f + FVector(0.f, 0.f, -60.f));
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		return SteerTo(CarryDestination, Species.CruiseSpeed * 1.1f);
	}

	// ----------------------------------------------------------------- Hunt fish
	case ESLStalkerState::HuntFish:
	{
		ASLFish* Fish = TargetFish.Get();
		if (!Fish || !Fish->IsAlive())
		{
			TargetFish = nullptr;
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		const FVector FishLocation = Fish->GetActorLocation();
		const float Distance = (float)(FVector::Dist(FishLocation, Location));

		if (Distance > Species.SenseRadius * 1.6f || StateTimer > 18.f)
		{
			TargetFish = nullptr;
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		JawOpen = FMath::FInterpTo(JawOpen, Distance < 400.f ? 1.f : 0.2f, DeltaSeconds, 5.f);

		if (Distance < BiteReach())
		{
			// A stalker's bite kills a fish outright.
			SnapTimer = 0.4f;
			Fish->TakeDamage(9999.f, FDamageEvent(), GetInstigatorController(), this);
			TargetFish = nullptr;
			EnterState(ESLStalkerState::Feed);
			return FVector::ZeroVector;
		}

		// Intercept: aim where the fish is going, not where it is.
		const FVector Lead = FishLocation + Fish->GetVelocity() * FMath::Min(Distance / Species.SprintSpeed, 1.2f);
		return SteerTo(Lead, Species.SprintSpeed);
	}

	// --------------------------------------------------------------------- Feed
	case ESLStalkerState::Feed:
	{
		// Thrash in place for a moment after a kill.
		JawOpen = 0.5f + 0.5f * FMath::Sin(GetWorld()->GetTimeSeconds() * 12.f);

		if (StateTimer > 2.5f)
		{
			EnterState(ESLStalkerState::Patrol);
		}

		return GetActorForwardVector() * Species.CruiseSpeed * 0.25f;
	}

	// ------------------------------------------------------------ Attack player
	case ESLStalkerState::AttackPlayer:
	{
		AActor* Threat = ThreatActor.Get();
		if (!Threat)
		{
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		const FVector ThreatLocation = Threat->GetActorLocation();
		const float Distance = (float)(FVector::Dist(ThreatLocation, Location));

		if (Distance > Species.SenseRadius * 1.6f)
		{
			ThreatActor = nullptr;
			AggroTimer = 0.f;
			EnterState(ESLStalkerState::Patrol);
			return SteerTo(PatrolTarget, Species.CruiseSpeed);
		}

		JawOpen = FMath::FInterpTo(JawOpen, Distance < 500.f ? 1.f : 0.3f, DeltaSeconds, 5.f);

		if (Distance < BiteReach())
		{
			BiteTarget(Threat);

			// Veer off after biting instead of grinding into the player.
			const FVector Past = ThreatLocation + (ThreatLocation - Location).GetSafeNormal() * 600.f;
			return SteerTo(Past, Species.SprintSpeed);
		}

		return SteerTo(ThreatLocation, Species.SprintSpeed);
	}

	// ------------------------------------------------------------------ Retreat
	case ESLStalkerState::Retreat:
	default:
	{
		JawOpen = FMath::FInterpTo(JawOpen, 0.f, DeltaSeconds, 3.f);

		if (StateTimer > 10.f)
		{
			AggroTimer = 0.f;
			ThreatActor = nullptr;
			EnterState(ESLStalkerState::Patrol);
		}

		const FVector From = ThreatActor.IsValid() ? ThreatActor->GetActorLocation() : Location + GetActorForwardVector() * -100.f;
		const FVector Away = (Location - From).GetSafeNormal();
		return Away * Species.SprintSpeed * 0.9f;
	}
	}
}

void ASLStalker::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	if (SnapTimer > 0.f)
	{
		// Snap the jaw shut hard, then let the state machine reopen it.
		SnapTimer -= DeltaSeconds;
		JawOpen = FMath::Max(0.f, JawOpen - DeltaSeconds * 6.f);
	}
}
