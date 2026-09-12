#include "World/SLScrapMetal.h"

#include "ProceduralMeshComponent.h"
#include "Procedural/SLMaterialLibrary.h"
#include "Procedural/SLProcMesh.h"
#include "World/SLBiomeLibrary.h"

TArray<TWeakObjectPtr<ASLScrapMetal>> ASLScrapMetal::Registry;

ASLScrapMetal::ASLScrapMetal()
{
	PrimaryActorTick.bCanEverTick = true;
	PrimaryActorTick.TickInterval = 0.f;

	Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("ScrapMesh"));
	Mesh->SetCollisionEnabled(ECollisionEnabled::QueryOnly);
	Mesh->SetCollisionObjectType(ECC_WorldDynamic);
	Mesh->SetCollisionResponseToAllChannels(ECR_Ignore);
	Mesh->SetCollisionResponseToChannel(ECC_Visibility, ECR_Block);
	Mesh->bUseAsyncCooking = true;
	SetRootComponent(Mesh);
}

const TArray<TWeakObjectPtr<ASLScrapMetal>>& ASLScrapMetal::GetAll()
{
	return Registry;
}

ASLScrapMetal* ASLScrapMetal::FindNearest(const UObject* WorldContext, const FVector& Location, float Radius)
{
	const UWorld* World = WorldContext ? WorldContext->GetWorld() : nullptr;

	ASLScrapMetal* Best = nullptr;
	float BestScore = -FLT_MAX;
	const float RadiusSq = Radius * Radius;

	for (const TWeakObjectPtr<ASLScrapMetal>& Weak : Registry)
	{
		ASLScrapMetal* Scrap = Weak.Get();
		if (!Scrap || Scrap->IsHeld() || Scrap->GetWorld() != World)
		{
			continue;
		}

		const float DistSq = (float)(FVector::DistSquared(Scrap->GetActorLocation(), Location));
		if (DistSq > RadiusSq)
		{
			continue;
		}

		// Prefer close scrap, but a piece that was just disturbed wins out.
		const float Score = -FMath::Sqrt(DistSq) + Scrap->GetLureStrength() * 1500.f;
		if (Score > BestScore)
		{
			BestScore = Score;
			Best = Scrap;
		}
	}

	return Best;
}

void ASLScrapMetal::BeginPlay()
{
	Super::BeginPlay();

	Registry.Add(this);

	if (!bBuilt)
	{
		BuildScrap((int32)GetUniqueID());
	}

	RestRotation = GetActorRotation();
}

void ASLScrapMetal::EndPlay(const EEndPlayReason::Type Reason)
{
	Registry.RemoveAll([this](const TWeakObjectPtr<ASLScrapMetal>& Weak)
	{
		return !Weak.IsValid() || Weak.Get() == this;
	});

	Super::EndPlay(Reason);
}

void ASLScrapMetal::BuildScrap(int32 Seed)
{
	BuildSeed = Seed;
	bBuilt = true;

	FSLMeshData MeshData;

	// Scrap is a welded cluster of plates and bars: a few boxes at odd angles,
	// each tinted a slightly different shade of rusted steel.
	const int32 PieceCount = 2 + (int32)(SLProcMesh::HashToUnit(Seed, 1, 77) * 4.f);
	const float Scale = FMath::Lerp(0.7f, 1.6f, SLProcMesh::HashToUnit(Seed, 2, 91));

	for (int32 i = 0; i < PieceCount; ++i)
	{
		const float R1 = SLProcMesh::HashToUnit(Seed, i * 3 + 10, 5);
		const float R2 = SLProcMesh::HashToUnit(Seed, i * 3 + 11, 5);
		const float R3 = SLProcMesh::HashToUnit(Seed, i * 3 + 12, 5);
		const float R4 = SLProcMesh::HashToUnit(Seed, i * 3 + 13, 5);
		const float R5 = SLProcMesh::HashToUnit(Seed, i * 3 + 14, 5);

		// Mostly flat plates, with the occasional chunky bar.
		const bool bBar = R5 > 0.72f;
		const FVector Extent = bBar
			? FVector(FMath::Lerp(18.f, 42.f, R1), FMath::Lerp(4.f, 8.f, R2), FMath::Lerp(4.f, 9.f, R3)) * Scale
			: FVector(FMath::Lerp(14.f, 34.f, R1), FMath::Lerp(10.f, 26.f, R2), FMath::Lerp(1.5f, 4.f, R3)) * Scale;

		const FVector Offset(
			(R2 - 0.5f) * 34.f * Scale,
			(R3 - 0.5f) * 34.f * Scale,
			i * 5.f * Scale);

		// Rust: grey steel drifting toward orange as the piece corrodes.
		const float Rust = R4;
		const FLinearColor Color = FMath::Lerp(
			FLinearColor(0.42f, 0.44f, 0.47f),
			FLinearColor(0.46f, 0.22f, 0.09f),
			Rust * 0.85f);

		FSLMeshData Piece;
		SLProcMesh::AddBox(Piece, FVector::ZeroVector, Extent, Color);

		const FRotator PieceRotation(
			(R1 - 0.5f) * 50.f,
			R2 * 360.f,
			(R3 - 0.5f) * 40.f);
		MeshData.Append(Piece, FTransform(PieceRotation, Offset));
	}

	MeshData.RecalculateNormals();
	SLProcMesh::ApplyToComponent(Mesh, 0, MeshData, false);

	if (UMaterialInterface* Material = SLMaterialLibrary::GetSurfaceMaterial())
	{
		Mesh->SetMaterial(0, Material);
	}

	// Bigger pieces take longer to chew through.
	MaxIntegrity = 60.f + 40.f * Scale;
	Integrity = MaxIntegrity;
}

float ASLScrapMetal::GetLureStrength() const
{
	// A piece being actively chewed or freshly thrown is the loudest thing around.
	return FMath::Clamp(0.35f + Disturbance, 0.f, 2.f);
}

bool ASLScrapMetal::ApplyBite(float BiteDamage, const FVector& FromDirection)
{
	Integrity -= FMath::Max(0.f, BiteDamage);
	Disturbance = FMath::Min(Disturbance + 0.8f, 1.6f);
	ShakeTime = 0.35f;

	// Shove the piece a little in the direction of the bite.
	if (!IsHeld() && !FromDirection.IsNearlyZero())
	{
		AddActorWorldOffset(FromDirection.GetSafeNormal() * 6.f, false);
	}

	if (Integrity <= 0.f)
	{
		Destroy();
		return true;
	}

	return false;
}

void ASLScrapMetal::SetCarriedBy(AActor* NewCarrier, USceneComponent* AttachTo, FName SocketName)
{
	Carrier = NewCarrier;
	bFalling = false;
	FallVelocity = FVector::ZeroVector;
	Disturbance = FMath::Max(Disturbance, 0.6f);

	if (AttachTo)
	{
		AttachToComponent(AttachTo, FAttachmentTransformRules::SnapToTargetIncludingScale, SocketName);
		SetActorRelativeRotation(FRotator(0.f, 0.f, 0.f));
	}
}

void ASLScrapMetal::Drop(const FVector& TossVelocity)
{
	Carrier = nullptr;
	DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);

	bFalling = true;
	FallVelocity = TossVelocity;
	Disturbance = FMath::Min(Disturbance + 1.f, 2.f);
}

void ASLScrapMetal::SettleToFloor()
{
	const FVector Location = GetActorLocation();
	const float FloorZ = SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y);

	SetActorLocation(FVector(Location.X, Location.Y, FloorZ + 12.f));
	bFalling = false;
	FallVelocity = FVector::ZeroVector;

	// Land at a believable angle rather than perfectly flat.
	RestRotation = FRotator(
		(SLProcMesh::HashToUnit((int32)Location.X, (int32)Location.Y, 3) - 0.5f) * 24.f,
		SLProcMesh::HashToUnit((int32)Location.Y, (int32)Location.X, 9) * 360.f,
		(SLProcMesh::HashToUnit((int32)Location.X, 7, 11) - 0.5f) * 24.f);
	SetActorRotation(RestRotation);
}

void ASLScrapMetal::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	Disturbance = FMath::FInterpTo(Disturbance, 0.f, DeltaSeconds, 0.35f);

	// Still attached to something but with no living carrier means the carrier
	// was destroyed mid-carry (a stalker killed while hauling a plate away).
	// Without this the scrap would hang in the water, attached to nothing.
	if (!Carrier.IsValid() && GetRootComponent() && GetRootComponent()->GetAttachParent() != nullptr)
	{
		Drop(FVector::ZeroVector);
	}

	if (bFalling)
	{
		// Water-damped fall: gravity, heavy drag, and a slow tumble.
		FallVelocity.Z -= 420.f * DeltaSeconds;
		FallVelocity -= FallVelocity * FMath::Min(1.f, 1.4f * DeltaSeconds);
		AddActorWorldOffset(FallVelocity * DeltaSeconds, false);
		AddActorLocalRotation(FRotator(60.f * DeltaSeconds, 90.f * DeltaSeconds, 0.f));

		const FVector Location = GetActorLocation();
		if (Location.Z <= SLBiomeLibrary::FloorHeightAt(Location.X, Location.Y) + 12.f)
		{
			SettleToFloor();
		}
		return;
	}

	if (ShakeTime > 0.f && !IsHeld())
	{
		// Rattle in place while a stalker works on it.
		ShakeTime -= DeltaSeconds;
		const float Amount = FMath::Max(0.f, ShakeTime) * 30.f;
		const float Wobble = FMath::Sin(GetWorld()->GetTimeSeconds() * 45.f) * Amount;
		SetActorRotation(RestRotation + FRotator(Wobble * 0.4f, Wobble, Wobble * 0.25f));

		if (ShakeTime <= 0.f)
		{
			SetActorRotation(RestRotation);
		}
	}
}
