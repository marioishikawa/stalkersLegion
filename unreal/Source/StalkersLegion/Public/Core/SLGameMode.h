#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "SLGameMode.generated.h"

/**
 * Wires up the diver, the HUD, and the ocean itself.
 *
 * If the level does not already contain an SLOceanWorld, one is spawned, which
 * is what lets a completely empty level boot straight into a playable ocean.
 */
UCLASS()
class STALKERSLEGION_API ASLGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	ASLGameMode();

	virtual void StartPlay() override;

	/** Set false if your level places its own SLOceanWorld. */
	UPROPERTY(EditDefaultsOnly, Category = "Stalkers Legion")
	bool bAutoSpawnOcean = true;
};
