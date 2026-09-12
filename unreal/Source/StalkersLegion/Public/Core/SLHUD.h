#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "SLHUD.generated.h"

class ASLDiver;

/**
 * Canvas-drawn HUD: health, oxygen, depth, current biome, the crosshair and the
 * stalker proximity warning.
 *
 * Drawn in code rather than UMG so the interface ships as source with no widget
 * blueprints to open, merge or break.
 */
UCLASS()
class STALKERSLEGION_API ASLHUD : public AHUD
{
	GENERATED_BODY()

public:
	ASLHUD();

	virtual void DrawHUD() override;

private:
	void DrawBar(float X, float Y, float Width, float Height, float Fraction, const FLinearColor& Fill,
		const FString& Label);
	void DrawCrosshair(const ASLDiver* Diver);
	void DrawStatus(const ASLDiver* Diver);
	void DrawDamageVignette(const ASLDiver* Diver);
	void DrawStalkerWarning(const ASLDiver* Diver);
	void DrawDeathScreen();
	void DrawControlsHint();

	/** Seconds the controls hint stays up at the start of a run. */
	UPROPERTY(EditAnywhere, Category = "HUD")
	float HintDuration = 22.f;

	UPROPERTY()
	TObjectPtr<UFont> HudFont;
};
