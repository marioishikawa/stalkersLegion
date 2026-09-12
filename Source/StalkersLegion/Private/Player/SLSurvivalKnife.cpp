#include "Player/SLSurvivalKnife.h"

#include "Creatures/SLCreature.h"
#include "Creatures/SLStalker.h"
#include "Engine/World.h"
#include "GameFramework/DamageType.h"
#include "Kismet/GameplayStatics.h"
#include "ProceduralMeshComponent.h"
#include "Procedural/SLMaterialLibrary.h"
#include "Procedural/SLProcMesh.h"
#include "World/SLScrapMetal.h"

USLSurvivalKnife::USLSurvivalKnife()
{
	PrimaryComponentTick.bCanEverTick = true;

	Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("KnifeMesh"));
	Mesh->SetupAttachment(this);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetCastShadow(false);
	// Drawn close to the camera, so keep it out of the depth fight with the world.
	Mesh->SetRenderCustomDepth(false);
}

void USLSurvivalKnife::BeginPlay()
{
	Super::BeginPlay();

	BuildKnifeMesh();
	SetRelativeLocationAndRotation(RestLocation, RestRotation);
}

void USLSurvivalKnife::BuildKnifeMesh()
{
	FSLMeshData MeshData;

	const FLinearColor BladeColor(0.78f, 0.80f, 0.84f);
	const FLinearColor EdgeColor(0.95f, 0.96f, 0.98f);
	const FLinearColor GripColor(0.14f, 0.16f, 0.18f);
	const FLinearColor GuardColor(0.35f, 0.33f, 0.30f);

	// Grip.
	SLProcMesh::AddBox(MeshData, FVector(-6.f, 0.f, 0.f), FVector(6.f, 1.6f, 2.2f), GripColor);
	// Guard.
	SLProcMesh::AddBox(MeshData, FVector(1.f, 0.f, 0.f), FVector(1.f, 3.f, 3.f), GuardColor);
	// Blade: a flat slab that tapers to a point.
	SLProcMesh::AddBox(MeshData, FVector(10.f, 0.f, 0.6f), FVector(9.f, 0.5f, 2.0f), BladeColor);
	SLProcMesh::AddFin(MeshData,
		FVector(19.f, -0.5f, 2.6f),
		FVector(19.f, -0.5f, -1.4f),
		FVector(26.f, -0.5f, 1.2f), EdgeColor);
	SLProcMesh::AddFin(MeshData,
		FVector(19.f, 0.5f, -1.4f),
		FVector(19.f, 0.5f, 2.6f),
		FVector(26.f, 0.5f, 1.2f), EdgeColor);
	// Serrations along the spine.
	for (int32 i = 0; i < 5; ++i)
	{
		const float X = 8.f + i * 2.4f;
		SLProcMesh::AddFin(MeshData,
			FVector(X, 0.f, 2.6f),
			FVector(X + 1.6f, 0.f, 2.6f),
			FVector(X + 0.8f, 0.f, 4.f), EdgeColor);
	}

	MeshData.RecalculateNormals();
	SLProcMesh::ApplyToComponent(Mesh, 0, MeshData, false);

	if (UMaterialInterface* Material = SLMaterialLibrary::GetSurfaceMaterial())
	{
		Mesh->SetMaterial(0, Material);
	}
}

bool USLSurvivalKnife::Swing()
{
	if (SwingTime > 0.f)
	{
		return false;
	}

	SwingTime = SwingDuration;
	bStrikeResolved = false;
	return true;
}

float USLSurvivalKnife::GetSwingAlpha() const
{
	return SwingDuration > 0.f ? 1.f - FMath::Clamp(SwingTime / SwingDuration, 0.f, 1.f) : 0.f;
}

void USLSurvivalKnife::ResolveStrike()
{
	AActor* Owner = GetOwner();
	UWorld* World = GetWorld();
	if (!Owner || !World)
	{
		return;
	}

	// Strike along the camera's view, not the knife's own wobble, so what is
	// under the crosshair is what gets cut.
	const FVector Start = GetComponentLocation();
	const FVector Direction = GetAttachParent() ? GetAttachParent()->GetForwardVector() : GetForwardVector();
	const FVector End = Start + Direction * Reach;

	FCollisionQueryParams Params(SCENE_QUERY_STAT(SLKnifeStrike), false, Owner);
	Params.AddIgnoredActor(Owner);

	TArray<FHitResult> Hits;
	World->SweepMultiByChannel(Hits, Start, End, FQuat::Identity, ECC_Visibility,
		FCollisionShape::MakeSphere(SweepRadius), Params);

	bool bHitSomething = false;

	for (const FHitResult& Hit : Hits)
	{
		AActor* HitActor = Hit.GetActor();
		if (!HitActor || HitActor == Owner)
		{
			continue;
		}

		if (ASLCreature* Creature = Cast<ASLCreature>(HitActor))
		{
			if (!Creature->IsAlive())
			{
				continue;
			}

			UGameplayStatics::ApplyPointDamage(Creature, Damage, Direction, Hit,
				Owner->GetInstigatorController(), Owner, UDamageType::StaticClass());

			// A stabbed stalker turns on you rather than shrugging it off.
			if (ASLStalker* Stalker = Cast<ASLStalker>(Creature))
			{
				if (Stalker->IsAlive())
				{
					Stalker->Provoke(Owner);
				}
			}

			LastHitName = Creature->GetDisplayName();
			TimeSinceHit = 0.f;
			bHitSomething = true;
			break;
		}

		// The knife also works on scrap, for prying pieces apart.
		if (ASLScrapMetal* Scrap = Cast<ASLScrapMetal>(HitActor))
		{
			Scrap->ApplyBite(Damage * 0.5f, Direction);
			LastHitName = TEXT("Scrap Metal");
			TimeSinceHit = 0.f;
			bHitSomething = true;
			break;
		}
	}

	if (!bHitSomething)
	{
		LastHitName.Reset();
	}
}

void USLSurvivalKnife::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	TimeSinceHit += DeltaTime;

	if (SwingTime <= 0.f)
	{
		// Idle bob so the knife feels held rather than welded to the camera.
		const float Time = GetWorld() ? GetWorld()->GetTimeSeconds() : 0.f;
		const FVector Bob(0.f, FMath::Sin(Time * 1.3f) * 0.7f, FMath::Sin(Time * 1.9f) * 0.9f);
		SetRelativeLocation(FMath::VInterpTo(GetRelativeLocation(), RestLocation + Bob, DeltaTime, 6.f));
		SetRelativeRotation(FMath::RInterpTo(GetRelativeRotation(), RestRotation, DeltaTime, 8.f));
		return;
	}

	SwingTime = FMath::Max(0.f, SwingTime - DeltaTime);
	const float Alpha = GetSwingAlpha();

	// Wind up across the first third, slash through the middle, recover after.
	const float Arc = Alpha < 0.3f
		? FMath::Lerp(0.f, -1.f, Alpha / 0.3f)			// pull back
		: FMath::Lerp(-1.f, 1.f, (Alpha - 0.3f) / 0.35f); // slash across
	const float Clamped = FMath::Clamp(Arc, -1.f, 1.f);

	const FVector SwingOffset(
		RestLocation.X + Clamped * 18.f,
		RestLocation.Y - Clamped * 34.f,
		RestLocation.Z + FMath::Abs(Clamped) * 10.f);
	const FRotator SwingRotation(
		RestRotation.Pitch + Clamped * 25.f,
		RestRotation.Yaw + Clamped * 55.f,
		RestRotation.Roll - Clamped * 40.f);

	SetRelativeLocation(FMath::VInterpTo(GetRelativeLocation(), SwingOffset, DeltaTime, 22.f));
	SetRelativeRotation(FMath::RInterpTo(GetRelativeRotation(), SwingRotation, DeltaTime, 22.f));

	// The blade connects partway through the slash, once, per swing.
	if (!bStrikeResolved && Alpha >= 0.42f)
	{
		bStrikeResolved = true;
		ResolveStrike();
	}
}
