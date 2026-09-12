#include "Core/SLHUD.h"

#include "Creatures/SLStalker.h"
#include "Engine/Canvas.h"
#include "Engine/Engine.h"
#include "EngineUtils.h"
#include "Player/SLDiver.h"
#include "Player/SLSurvivalKnife.h"
#include "World/SLBiomeLibrary.h"

namespace
{
	const FLinearColor PanelColor(0.f, 0.f, 0.f, 0.35f);
	const FLinearColor TextColor(0.92f, 0.96f, 0.98f, 1.f);
	const FLinearColor HealthColor(0.85f, 0.22f, 0.20f, 0.95f);
	const FLinearColor OxygenColor(0.25f, 0.75f, 0.95f, 0.95f);
}

ASLHUD::ASLHUD()
{
	HudFont = GEngine ? GEngine->GetMediumFont() : nullptr;
}

void ASLHUD::DrawBar(float X, float Y, float Width, float Height, float Fraction, const FLinearColor& Fill, const FString& Label)
{
	Fraction = FMath::Clamp(Fraction, 0.f, 1.f);

	DrawRect(PanelColor, X - 2.f, Y - 2.f, Width + 4.f, Height + 4.f);
	DrawRect(FLinearColor(0.08f, 0.10f, 0.12f, 0.75f), X, Y, Width, Height);
	DrawRect(Fill, X, Y, Width * Fraction, Height);

	if (!Label.IsEmpty())
	{
		DrawText(Label, TextColor, X, Y - 20.f, HudFont, 1.f, false);
	}
}

void ASLHUD::DrawCrosshair(const ASLDiver* Diver)
{
	const float CenterX = Canvas->SizeX * 0.5f;
	const float CenterY = Canvas->SizeY * 0.5f;

	// The crosshair opens up while the knife is mid-swing.
	const float Swing = (Diver && Diver->GetKnife() && Diver->GetKnife()->IsSwinging()) ? 6.f : 0.f;
	const float Gap = 5.f + Swing;
	const float Length = 8.f;
	const float Thickness = 2.f;

	const FLinearColor Color(1.f, 1.f, 1.f, 0.7f);
	DrawRect(Color, CenterX - Gap - Length, CenterY - Thickness * 0.5f, Length, Thickness);
	DrawRect(Color, CenterX + Gap, CenterY - Thickness * 0.5f, Length, Thickness);
	DrawRect(Color, CenterX - Thickness * 0.5f, CenterY - Gap - Length, Thickness, Length);
	DrawRect(Color, CenterX - Thickness * 0.5f, CenterY + Gap, Thickness, Length);

	// What the crosshair is over.
	if (Diver && !Diver->GetFocusName().IsEmpty())
	{
		float TextWidth = 0.f;
		float TextHeight = 0.f;
		GetTextSize(Diver->GetFocusName(), TextWidth, TextHeight, HudFont, 1.f);
		DrawText(Diver->GetFocusName(), FLinearColor(0.85f, 0.9f, 0.95f, 0.85f),
			CenterX - TextWidth * 0.5f, CenterY + 34.f, HudFont, 1.f, false);
	}
}

void ASLHUD::DrawStatus(const ASLDiver* Diver)
{
	if (!Diver)
	{
		return;
	}

	const float Margin = 34.f;
	const float BarWidth = 240.f;
	const float BarHeight = 16.f;
	const float Bottom = Canvas->SizeY - Margin;

	// Health and oxygen, bottom left.
	DrawBar(Margin, Bottom - BarHeight, BarWidth, BarHeight,
		Diver->GetHealth() / FMath::Max(1.f, Diver->GetMaxHealth()), HealthColor,
		FString::Printf(TEXT("HEALTH  %d"), FMath::CeilToInt(Diver->GetHealth())));

	const float OxygenFraction = Diver->GetOxygen() / FMath::Max(1.f, Diver->GetMaxOxygen());
	// The oxygen bar pulses red once the air is nearly gone.
	FLinearColor OxygenFill = OxygenColor;
	if (OxygenFraction < 0.25f)
	{
		const float Pulse = 0.5f + 0.5f * FMath::Sin(GetWorld()->GetTimeSeconds() * 9.f);
		OxygenFill = FMath::Lerp(OxygenColor, FLinearColor(1.f, 0.25f, 0.15f, 1.f), Pulse);
	}

	DrawBar(Margin, Bottom - BarHeight * 3.f - 22.f, BarWidth, BarHeight, OxygenFraction, OxygenFill,
		FString::Printf(TEXT("OXYGEN  %ds"), FMath::CeilToInt(Diver->GetOxygen())));

	// Depth and biome, bottom right.
	const FSLBiomeDef& Biome = SLBiomeLibrary::Get(Diver->GetCurrentBiome());
	const FString DepthText = FString::Printf(TEXT("%.0f m"), Diver->GetDepthMeters());

	float Width = 0.f;
	float Height = 0.f;
	GetTextSize(Biome.DisplayName, Width, Height, HudFont, 1.2f);
	DrawText(Biome.DisplayName, TextColor, Canvas->SizeX - Margin - Width, Bottom - 46.f, HudFont, 1.2f, false);

	GetTextSize(DepthText, Width, Height, HudFont, 1.f);
	DrawText(DepthText, FLinearColor(0.7f, 0.85f, 0.95f, 0.9f),
		Canvas->SizeX - Margin - Width, Bottom - 22.f, HudFont, 1.f, false);

	// Carried scrap indicator.
	if (Diver->GetCarriedScrap())
	{
		const FString CarryText = TEXT("Carrying scrap metal   [E] throw");
		GetTextSize(CarryText, Width, Height, HudFont, 1.f);
		DrawText(CarryText, FLinearColor(0.95f, 0.75f, 0.35f, 0.95f),
			(Canvas->SizeX - Width) * 0.5f, Canvas->SizeY - 110.f, HudFont, 1.f, false);
	}
}

void ASLHUD::DrawDamageVignette(const ASLDiver* Diver)
{
	if (!Diver)
	{
		return;
	}

	const float Since = Diver->GetTimeSinceDamage();
	if (Since > 0.8f)
	{
		return;
	}

	// A red wash that fades out over the second after a bite lands.
	const float Alpha = (1.f - Since / 0.8f) * 0.32f;
	DrawRect(FLinearColor(0.75f, 0.05f, 0.05f, Alpha), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);
}

void ASLHUD::DrawStalkerWarning(const ASLDiver* Diver)
{
	if (!Diver || Diver->IsDead())
	{
		return;
	}

	// Find the closest stalker that is actually interested in the player.
	const FVector PlayerLocation = Diver->GetActorLocation();
	const ASLStalker* Closest = nullptr;
	float ClosestDistance = 2600.f;

	for (TActorIterator<ASLStalker> It(GetWorld()); It; ++It)
	{
		const ASLStalker* Stalker = *It;
		if (!Stalker || !Stalker->IsAlive())
		{
			continue;
		}

		const float Distance = (float)(FVector::Dist(Stalker->GetActorLocation(), PlayerLocation));
		if (Distance < ClosestDistance)
		{
			ClosestDistance = Distance;
			Closest = Stalker;
		}
	}

	if (!Closest)
	{
		return;
	}

	const float Proximity = 1.f - FMath::Clamp(ClosestDistance / 2600.f, 0.f, 1.f);
	const float Pulse = 0.5f + 0.5f * FMath::Sin(GetWorld()->GetTimeSeconds() * (3.f + Proximity * 8.f));

	const FString Text = FString::Printf(TEXT("STALKER  %.0fm  -  %s"),
		ClosestDistance / 100.f, *Closest->GetStateLabel());

	float Width = 0.f;
	float Height = 0.f;
	GetTextSize(Text, Width, Height, HudFont, 1.f);

	DrawText(Text, FLinearColor(1.f, 0.45f + 0.3f * (1.f - Proximity), 0.2f, 0.35f + Proximity * 0.65f * Pulse),
		(Canvas->SizeX - Width) * 0.5f, 42.f, HudFont, 1.f, false);
}

void ASLHUD::DrawDeathScreen()
{
	DrawRect(FLinearColor(0.25f, 0.f, 0.f, 0.45f), 0.f, 0.f, Canvas->SizeX, Canvas->SizeY);

	const FString Title = TEXT("YOU DIED");
	const FString Prompt = TEXT("Press  R  to wake up at the surface");

	float Width = 0.f;
	float Height = 0.f;

	GetTextSize(Title, Width, Height, HudFont, 3.f);
	DrawText(Title, FLinearColor(1.f, 0.85f, 0.8f, 1.f),
		(Canvas->SizeX - Width) * 0.5f, Canvas->SizeY * 0.42f, HudFont, 3.f, false);

	GetTextSize(Prompt, Width, Height, HudFont, 1.2f);
	DrawText(Prompt, FLinearColor(0.9f, 0.9f, 0.9f, 0.9f),
		(Canvas->SizeX - Width) * 0.5f, Canvas->SizeY * 0.42f + 60.f, HudFont, 1.2f, false);
}

void ASLHUD::DrawControlsHint()
{
	if (GetWorld()->GetTimeSeconds() > HintDuration)
	{
		return;
	}

	// Fades out over the last three seconds.
	const float Remaining = HintDuration - GetWorld()->GetTimeSeconds();
	const float Alpha = FMath::Clamp(Remaining / 3.f, 0.f, 1.f) * 0.85f;

	static const TArray<FString> Lines = {
		TEXT("WASD swim    SPACE / CTRL  rise & sink    SHIFT sprint"),
		TEXT("LMB  survival knife    E  pick up / throw scrap    F  flashlight"),
		TEXT("Air refills at the surface. Scrap metal draws stalkers - use it.")
	};

	float Y = 96.f;
	for (const FString& Line : Lines)
	{
		float Width = 0.f;
		float Height = 0.f;
		GetTextSize(Line, Width, Height, HudFont, 1.f);
		DrawText(Line, FLinearColor(0.85f, 0.92f, 0.96f, Alpha), (Canvas->SizeX - Width) * 0.5f, Y, HudFont, 1.f, false);
		Y += 22.f;
	}
}

void ASLHUD::DrawHUD()
{
	Super::DrawHUD();

	if (!Canvas)
	{
		return;
	}

	if (!HudFont)
	{
		HudFont = GEngine ? GEngine->GetMediumFont() : nullptr;
	}

	const ASLDiver* Diver = Cast<ASLDiver>(GetOwningPawn());

	DrawDamageVignette(Diver);

	if (Diver && Diver->IsDead())
	{
		DrawDeathScreen();
		return;
	}

	DrawCrosshair(Diver);
	DrawStatus(Diver);
	DrawStalkerWarning(Diver);
	DrawControlsHint();
}
