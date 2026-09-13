#include "Procedural/SLBodyBuilder.h"

namespace
{
	/** Smooth bump that peaks at Peak and falls to zero at 0 and 1. */
	float Bump(float T, float Peak, float Sharpness)
	{
		const float Span = T < Peak ? FMath::Max(Peak, KINDA_SMALL_NUMBER) : FMath::Max(1.f - Peak, KINDA_SMALL_NUMBER);
		const float D = FMath::Clamp(FMath::Abs(T - Peak) / Span, 0.f, 1.f);
		return FMath::Pow(1.f - D, Sharpness);
	}
}

namespace SLBodyBuilder
{
	void EvaluateProfile(ESLBodyProfile Profile, float T, float BellyPosition, float& OutWidthScale, float& OutHeightScale)
	{
		T = FMath::Clamp(T, 0.f, 1.f);
		const float Peak = FMath::Clamp(BellyPosition, 0.05f, 0.95f);

		switch (Profile)
		{
		case ESLBodyProfile::Torpedo:
			// Even spindle: fat amidships, tapering smoothly to both ends.
			OutWidthScale = Bump(T, Peak, 0.65f);
			OutHeightScale = Bump(T, Peak, 0.6f);
			break;

		case ESLBodyProfile::Disc:
			// Tall coin. Height stays near maximum across most of the body.
			OutWidthScale = Bump(T, Peak, 0.9f);
			OutHeightScale = FMath::Sin(PI * FMath::Pow(T, 0.75f));
			OutHeightScale = FMath::Pow(OutHeightScale, 0.45f);
			break;

		case ESLBodyProfile::Ribbon:
			// Long flat band that barely narrows until the very tail.
			OutWidthScale = Bump(T, 0.3f, 1.2f) * 0.8f + 0.2f * (1.f - T);
			OutHeightScale = FMath::Clamp(1.f - FMath::Pow(T, 3.f), 0.15f, 1.f) * (0.4f + 0.6f * FMath::Sin(PI * FMath::Min(T * 3.f, 1.f)));
			break;

		case ESLBodyProfile::Boxy:
			// Blunt brick: near-constant section, abrupt taper at the tail root.
			OutWidthScale = T < 0.7f ? FMath::Sin(PI * FMath::Min(T / 0.7f, 1.f) * 0.5f + 0.35f) : FMath::Lerp(0.93f, 0.12f, (T - 0.7f) / 0.3f);
			OutHeightScale = OutWidthScale * 1.05f;
			break;

		case ESLBodyProfile::Eel:
			// Near-cylindrical over the full length with a rounded snout.
			OutWidthScale = FMath::Min(1.f, FMath::Sin(PI * FMath::Min(T * 4.f, 1.f) * 0.5f) * 1.f) * FMath::Lerp(1.f, 0.25f, FMath::Pow(T, 2.2f));
			OutHeightScale = OutWidthScale * 1.15f;
			break;

		case ESLBodyProfile::Diamond:
			// Angular: straight ramp up to sharp shoulders, straight ramp down.
			OutWidthScale = T < Peak ? T / Peak : 1.f - (T - Peak) / (1.f - Peak);
			OutHeightScale = FMath::Pow(OutWidthScale, 0.7f);
			OutWidthScale = FMath::Pow(OutWidthScale, 0.9f);
			break;

		case ESLBodyProfile::Arrow:
			// Needle nose that flares hard into broad shoulders, then tapers slowly.
			OutWidthScale = T <= Peak
				? FMath::Pow(T / Peak, 1.8f)
				: FMath::Pow(1.f - (T - Peak) / (1.f - Peak), 0.55f);
			OutHeightScale = OutWidthScale * 0.95f;
			break;

		case ESLBodyProfile::Bulb:
		default:
			// Fat round head with a thin whip of a tail.
			OutWidthScale = T < Peak ? FMath::Sin(PI * 0.5f * T / Peak) : FMath::Pow(1.f - (T - Peak) / (1.f - Peak), 1.6f);
			OutHeightScale = OutWidthScale;
			break;
		}

		OutWidthScale = FMath::Clamp(OutWidthScale, 0.02f, 1.f);
		OutHeightScale = FMath::Clamp(OutHeightScale, 0.02f, 1.f);
	}

	FSLCreatureMesh Build(const FSLSpeciesDef& Species)
	{
		const FSLBodyShape& S = Species.Shape;
		FSLCreatureMesh Result;

		const int32 RingCount = FMath::Clamp(S.SpineSegments, 5, 40);
		const float Length = FMath::Max(4.f, S.Length);
		const float MaxHalfHeight = Length * FMath::Max(0.01f, S.Height);
		const float MaxHalfWidth = Length * FMath::Max(0.01f, S.Width);

		TArray<FVector> Spine;
		TArray<float> HalfWidths;
		TArray<float> HalfHeights;
		TArray<FLinearColor> RingColors;
		Spine.Reserve(RingCount);
		HalfWidths.Reserve(RingCount);
		HalfHeights.Reserve(RingCount);
		RingColors.Reserve(RingCount);

		for (int32 Ring = 0; Ring < RingCount; ++Ring)
		{
			const float T = (float)Ring / (RingCount - 1);

			float WidthScale = 0.f;
			float HeightScale = 0.f;
			EvaluateProfile(Species.BodyProfile, T, S.BellyPosition, WidthScale, HeightScale);

			// Sharpen the snout by pulling in the first fifth of the body.
			const float NoseT = FMath::Min(T / 0.2f, 1.f);
			const float NoseTaper = FMath::Pow(NoseT, 0.35f + S.NoseSharpness * 0.9f);

			Spine.Add(FVector(T * Length, 0.f, 0.f));
			HalfWidths.Add(MaxHalfWidth * WidthScale * NoseTaper);
			HalfHeights.Add(MaxHalfHeight * HeightScale * NoseTaper);

			// Stripes darken bands of rings; the whole body is tinted by BackColor.
			float StripeMask = 0.f;
			if (S.Stripes > 0)
			{
				StripeMask = FMath::Pow(FMath::Abs(FMath::Sin(T * PI * S.Stripes)), 6.f);
			}
			RingColors.Add(FMath::Lerp(Species.BackColor, Species.BackColor * 0.25f, StripeMask));
		}

		SLProcMesh::AddLoft(Result.Body, Spine, HalfWidths, HalfHeights, RingColors,
			FMath::Clamp(S.RadialSegments, 5, 24), S.CrossSectionPower, Species.BellyColor, 0.85f);

		// --- Dorsal fin: a swept triangle riding the back ---------------------
		if (S.DorsalFin > 0.001f)
		{
			const float FrontT = 0.34f;
			const float BackT = 0.72f;
			const int32 FrontRing = FMath::Clamp(FMath::RoundToInt(FrontT * (RingCount - 1)), 0, RingCount - 1);
			const int32 BackRing = FMath::Clamp(FMath::RoundToInt(BackT * (RingCount - 1)), 0, RingCount - 1);

			const FVector Front(Spine[FrontRing].X, 0.f, HalfHeights[FrontRing] * 0.9f);
			const FVector Back(Spine[BackRing].X, 0.f, HalfHeights[BackRing] * 0.9f);
			const FVector Peak((Front.X + Back.X) * 0.5f, 0.f, FMath::Max(Front.Z, Back.Z) + Length * S.DorsalFin);
			SLProcMesh::AddFin(Result.Body, Front, Back, Peak, Species.FinColor);
		}

		// --- Ventral fin ------------------------------------------------------
		if (S.VentralFin > 0.001f)
		{
			const int32 FrontRing = FMath::Clamp(FMath::RoundToInt(0.45f * (RingCount - 1)), 0, RingCount - 1);
			const int32 BackRing = FMath::Clamp(FMath::RoundToInt(0.75f * (RingCount - 1)), 0, RingCount - 1);

			const FVector Front(Spine[FrontRing].X, 0.f, -HalfHeights[FrontRing] * 0.9f);
			const FVector Back(Spine[BackRing].X, 0.f, -HalfHeights[BackRing] * 0.9f);
			const FVector Peak((Front.X + Back.X) * 0.5f, 0.f, FMath::Min(Front.Z, Back.Z) - Length * S.VentralFin);
			SLProcMesh::AddFin(Result.Body, Back, Front, Peak, Species.FinColor);
		}

		// --- Pectoral fins: one per side, angled back -------------------------
		if (S.SideFin > 0.001f)
		{
			const int32 Ring = FMath::Clamp(FMath::RoundToInt(0.32f * (RingCount - 1)), 0, RingCount - 1);
			const float FinLen = Length * S.SideFin;

			for (int32 Side = 0; Side < 2; ++Side)
			{
				const float Sign = Side == 0 ? 1.f : -1.f;
				const FVector Root(Spine[Ring].X, Sign * HalfWidths[Ring] * 0.85f, 0.f);
				const FVector Tip(Root.X - FinLen * 0.7f, Sign * (HalfWidths[Ring] + FinLen), -FinLen * 0.35f);
				const FVector Back(Root.X + FinLen * 0.45f, Sign * HalfWidths[Ring] * 0.85f, 0.f);
				SLProcMesh::AddFin(Result.Body, Root, Back, Tip, Species.FinColor);
			}
		}

		// --- Back spikes ------------------------------------------------------
		for (int32 i = 0; i < S.BackSpikes; ++i)
		{
			const float T = FMath::Lerp(0.25f, 0.8f, S.BackSpikes > 1 ? (float)i / (S.BackSpikes - 1) : 0.5f);
			const int32 Ring = FMath::Clamp(FMath::RoundToInt(T * (RingCount - 1)), 0, RingCount - 1);
			const float SpikeLen = Length * 0.09f;

			const FVector Root(Spine[Ring].X, 0.f, HalfHeights[Ring] * 0.95f);
			SLProcMesh::AddFin(Result.Body,
				Root + FVector(-SpikeLen * 0.4f, 0.f, 0.f),
				Root + FVector(SpikeLen * 0.4f, 0.f, 0.f),
				Root + FVector(-SpikeLen * 0.3f, 0.f, SpikeLen),
				Species.FinColor * 0.7f);
		}

		// --- Eyes -------------------------------------------------------------
		if (S.EyeSize > 0.001f)
		{
			const int32 Ring = FMath::Clamp(FMath::RoundToInt(0.14f * (RingCount - 1)), 1, RingCount - 1);
			const float EyeRadius = Length * S.EyeSize;

			for (int32 Side = 0; Side < 2; ++Side)
			{
				const float Sign = Side == 0 ? 1.f : -1.f;
				const FVector EyePos(Spine[Ring].X, Sign * HalfWidths[Ring] * 0.75f, HalfHeights[Ring] * 0.45f);
				SLProcMesh::AddSphere(Result.Body, EyePos, EyeRadius, 7, Species.EyeColor);
			}
		}

		// --- Tail fin: its own mesh so it can wag -----------------------------
		{
			const float TailSpan = Length * FMath::Max(0.02f, S.TailSweep);
			const float TailHalfHeight = Length * FMath::Max(0.02f, S.TailHeight);
			Result.TailPivot = FVector(Length * 0.97f, 0.f, 0.f);

			// Built around the origin; the component sits at TailPivot.
			const FVector Root(0.f, 0.f, 0.f);
			const FVector TopTip(-TailSpan, 0.f, TailHalfHeight);
			const FVector BottomTip(-TailSpan, 0.f, -TailHalfHeight);
			const FVector Notch(-TailSpan * (1.f - FMath::Clamp(S.TailFork, 0.f, 0.95f)), 0.f, 0.f);

			SLProcMesh::AddFin(Result.Tail, Root, Notch, TopTip, Species.FinColor);
			SLProcMesh::AddFin(Result.Tail, Notch, Root, BottomTip, Species.FinColor);
		}

		// --- Hinged lower jaw for predators -----------------------------------
		if (S.JawLength > 0.001f)
		{
			const float JawLen = Length * S.JawLength;
			const int32 JawRing = FMath::Clamp(FMath::RoundToInt(0.2f * (RingCount - 1)), 1, RingCount - 1);
			Result.JawPivot = FVector(Spine[JawRing].X, 0.f, -HalfHeights[JawRing] * 0.35f);

			const float JawHalfWidth = HalfWidths[JawRing] * 0.85f;
			const FLinearColor JawColor = Species.BackColor * 0.6f;

			// A wedge running forward from the hinge, toward the snout at +X.
			SLProcMesh::AddQuadPoly(Result.Jaw,
				FVector(0.f, -JawHalfWidth, 0.f),
				FVector(0.f, JawHalfWidth, 0.f),
				FVector(JawLen, JawHalfWidth * 0.35f, -JawLen * 0.12f),
				FVector(JawLen, -JawHalfWidth * 0.35f, -JawLen * 0.12f),
				JawColor, true);

			// Teeth along both edges of the jaw.
			const int32 ToothCount = 6;
			for (int32 i = 0; i < ToothCount; ++i)
			{
				const float T = (float)i / (ToothCount - 1);
				const float X = FMath::Lerp(JawLen * 0.9f, JawLen * 0.1f, T);
				const float HalfW = FMath::Lerp(JawHalfWidth * 0.4f, JawHalfWidth * 0.9f, T);
				const float ToothLen = JawLen * 0.22f * FMath::Lerp(1.f, 0.6f, T);

				for (int32 Side = 0; Side < 2; ++Side)
				{
					const float Sign = Side == 0 ? 1.f : -1.f;
					SLProcMesh::AddFin(Result.Jaw,
						FVector(X - ToothLen * 0.3f, Sign * HalfW, 0.f),
						FVector(X + ToothLen * 0.3f, Sign * HalfW, 0.f),
						FVector(X, Sign * HalfW * 0.9f, ToothLen),
						FLinearColor(0.92f, 0.90f, 0.82f));
				}
			}
		}

		Result.Body.RecalculateNormals();
		Result.Tail.RecalculateNormals();
		if (!Result.Jaw.IsEmpty())
		{
			Result.Jaw.RecalculateNormals();
		}

		// Collision box sized from the body, not counting the fins' reach.
		Result.HalfExtent = FVector(Length * 0.5f, FMath::Max(MaxHalfWidth, Length * 0.06f), MaxHalfHeight);

		// The loft grows nose-at-origin toward +X, but an actor's forward vector
		// is +X - so a body used as built swims tail-first. Turn it end for end
		// and recentre, which puts the nose at +X and the tail root at -X with
		// the actor pivoting mid-body.
		//
		// The tail and jaw are separate components placed at the pivots below,
		// and both are authored along this corrected axis: the tail fin sweeps
		// back toward -X, the jaw runs forward toward +X.
		const FTransform Recentre(FRotator(0.f, 180.f, 0.f), FVector(Length * 0.5f, 0.f, 0.f));
		FSLMeshData Centred;
		Centred.Append(Result.Body, Recentre);
		Result.Body = MoveTemp(Centred);
		Result.TailPivot = Recentre.TransformPosition(Result.TailPivot);
		Result.JawPivot = Recentre.TransformPosition(Result.JawPivot);

		return Result;
	}
}
