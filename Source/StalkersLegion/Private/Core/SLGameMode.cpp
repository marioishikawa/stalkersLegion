#include "Core/SLGameMode.h"

#include "Core/SLHUD.h"
#include "EngineUtils.h"
#include "GameFramework/PlayerState.h"
#include "Player/SLDiver.h"
#include "StalkersLegion.h"
#include "World/SLOceanWorld.h"

ASLGameMode::ASLGameMode()
{
	DefaultPawnClass = ASLDiver::StaticClass();
	HUDClass = ASLHUD::StaticClass();
	PlayerStateClass = APlayerState::StaticClass();
}

void ASLGameMode::StartPlay()
{
	Super::StartPlay();

	if (!bAutoSpawnOcean)
	{
		return;
	}

	UWorld* World = GetWorld();
	if (!World)
	{
		return;
	}

	// Only spawn one if the level does not already have its own.
	for (TActorIterator<ASLOceanWorld> It(World); It; ++It)
	{
		UE_LOG(LogStalkersLegion, Log, TEXT("Using the SLOceanWorld already present in the level."));
		return;
	}

	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	World->SpawnActor<ASLOceanWorld>(ASLOceanWorld::StaticClass(), FVector::ZeroVector, FRotator::ZeroRotator, Params);
}
