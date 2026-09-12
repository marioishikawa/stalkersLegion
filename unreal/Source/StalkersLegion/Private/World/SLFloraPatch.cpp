#include "World/SLFloraPatch.h"

#include "ProceduralMeshComponent.h"
#include "Procedural/SLMaterialLibrary.h"
#include "Procedural/SLProcMesh.h"

namespace
{
	using SLProcMesh::HashToUnit;

	/** A tall kelp stalk with a lazy curve and leaves running up it. */
	void BuildKelp(FSLMeshData& Out, int32 Seed, float Scale)
	{
		const float Height = FMath::Lerp(420.f, 980.f, HashToUnit(Seed, 1, 3)) * Scale;
		const float Radius = FMath::Lerp(5.f, 9.f, HashToUnit(Seed, 2, 3)) * Scale;
		const int32 Rings = 12;

		// The stalk leans and twists a little so no two plants match.
		const float LeanAngle = HashToUnit(Seed, 3, 3) * 2.f * PI;
		const float LeanAmount = FMath::Lerp(30.f, 140.f, HashToUnit(Seed, 4, 3));
		const float TwistRate = FMath::Lerp(0.6f, 2.2f, HashToUnit(Seed, 5, 3));

		TArray<FVector> Spine;
		TArray<float> Widths;
		TArray<float> Heights;
		TArray<FLinearColor> Colors;

		const FLinearColor Base(0.10f, 0.26f, 0.10f);
		const FLinearColor Tip(0.55f, 0.62f, 0.18f);

		for (int32 i = 0; i < Rings; ++i)
		{
			const float T = (float)i / (Rings - 1);
			const float Z = T * Height;

			// Sine sway baked into the geometry, growing toward the tip.
			const float Sway = FMath::Sin(T * PI * TwistRate) * LeanAmount * T;
			const FVector Offset(FMath::Cos(LeanAngle) * Sway, FMath::Sin(LeanAngle) * Sway, Z);

			Spine.Add(Offset);
			const float R = Radius * FMath::Lerp(1.f, 0.35f, T);
			Widths.Add(R);
			Heights.Add(R);
			Colors.Add(FMath::Lerp(Base, Tip, T));
		}

		// The loft runs along +X by convention, so build it upright by rotating.
		FSLMeshData Stalk;
		SLProcMesh::AddLoft(Stalk, Spine, Widths, Heights, Colors, 6, 2.f, Base, 0.f);
		Out.Append(Stalk, FTransform::Identity);

		// Leaves: broad blades hanging off alternating sides of the stalk.
		const int32 LeafCount = 5 + (int32)(HashToUnit(Seed, 6, 3) * 5.f);
		for (int32 i = 0; i < LeafCount; ++i)
		{
			const float T = FMath::Lerp(0.25f, 0.97f, (float)i / FMath::Max(1, LeafCount - 1));
			const int32 Ring = FMath::Clamp(FMath::RoundToInt(T * (Rings - 1)), 0, Rings - 1);
			const FVector Root = Spine[Ring];

			const float Angle = LeanAngle + i * 2.4f;
			const FVector Dir(FMath::Cos(Angle), FMath::Sin(Angle), 0.f);
			const float LeafLen = FMath::Lerp(60.f, 150.f, HashToUnit(Seed, 20 + i, 3)) * Scale;

			const FLinearColor LeafColor = FMath::Lerp(FLinearColor(0.14f, 0.34f, 0.12f),
				FLinearColor(0.42f, 0.55f, 0.16f), T);

			SLProcMesh::AddQuadPoly(Out,
				Root + FVector(0.f, 0.f, -8.f),
				Root + FVector(0.f, 0.f, 14.f),
				Root + Dir * LeafLen + FVector(0.f, 0.f, 20.f - LeafLen * 0.25f),
				Root + Dir * LeafLen + FVector(0.f, 0.f, -30.f - LeafLen * 0.25f),
				LeafColor, true);
		}
	}

	/** A tuft of thin blades. */
	void BuildSeaGrass(FSLMeshData& Out, int32 Seed, float Scale)
	{
		const int32 Blades = 6 + (int32)(HashToUnit(Seed, 1, 7) * 8.f);

		for (int32 i = 0; i < Blades; ++i)
		{
			const float Angle = HashToUnit(Seed, i * 2, 7) * 2.f * PI;
			const float Distance = HashToUnit(Seed, i * 2 + 1, 7) * 40.f * Scale;
			const FVector Root(FMath::Cos(Angle) * Distance, FMath::Sin(Angle) * Distance, 0.f);

			const float BladeHeight = FMath::Lerp(70.f, 190.f, HashToUnit(Seed, i + 40, 7)) * Scale;
			const float Width = FMath::Lerp(4.f, 9.f, HashToUnit(Seed, i + 80, 7)) * Scale;
			const float Lean = HashToUnit(Seed, i + 120, 7) * 2.f * PI;
			const FVector Tip = Root + FVector(FMath::Cos(Lean) * BladeHeight * 0.35f,
				FMath::Sin(Lean) * BladeHeight * 0.35f, BladeHeight);

			const FLinearColor Color = FMath::Lerp(FLinearColor(0.18f, 0.40f, 0.16f),
				FLinearColor(0.48f, 0.62f, 0.22f), HashToUnit(Seed, i, 11));

			SLProcMesh::AddQuadPoly(Out,
				Root + FVector(-Width, 0.f, 0.f),
				Root + FVector(Width, 0.f, 0.f),
				Tip + FVector(Width * 0.3f, 0.f, 0.f),
				Tip + FVector(-Width * 0.3f, 0.f, 0.f),
				Color, true);
		}
	}

	/** A flat, ribbed coral fan. */
	void BuildCoralFan(FSLMeshData& Out, int32 Seed, float Scale)
	{
		const float Radius = FMath::Lerp(90.f, 220.f, HashToUnit(Seed, 1, 13)) * Scale;
		const int32 Ribs = 7;
		const float Spread = FMath::Lerp(1.6f, 2.6f, HashToUnit(Seed, 2, 13));
		const float Facing = HashToUnit(Seed, 3, 13) * 2.f * PI;

		const FLinearColor Inner(0.55f, 0.10f, 0.12f);
		const FLinearColor Outer(0.95f, 0.35f, 0.28f);

		for (int32 i = 0; i < Ribs; ++i)
		{
			const float T0 = (float)i / Ribs;
			const float T1 = (float)(i + 1) / Ribs;
			const float A0 = Facing + (T0 - 0.5f) * Spread;
			const float A1 = Facing + (T1 - 0.5f) * Spread;

			// A shallow bowl: the fan curls forward at its edges.
			const FVector P0(FMath::Cos(A0) * Radius * 0.2f, FMath::Sin(A0) * Radius * 0.2f, Radius * 0.15f);
			const FVector P1(FMath::Cos(A0) * Radius, FMath::Sin(A0) * Radius, Radius * 1.1f);
			const FVector P2(FMath::Cos(A1) * Radius, FMath::Sin(A1) * Radius, Radius * 1.1f);
			const FVector P3(FMath::Cos(A1) * Radius * 0.2f, FMath::Sin(A1) * Radius * 0.2f, Radius * 0.15f);

			SLProcMesh::AddQuadPoly(Out, P0, P1, P2, P3, FMath::Lerp(Inner, Outer, T0), true);
		}
	}

	/** A cluster of coral tubes of uneven height. */
	void BuildCoralTube(FSLMeshData& Out, int32 Seed, float Scale)
	{
		const int32 Tubes = 3 + (int32)(HashToUnit(Seed, 1, 17) * 4.f);

		for (int32 i = 0; i < Tubes; ++i)
		{
			const float Angle = HashToUnit(Seed, i, 17) * 2.f * PI;
			const float Distance = HashToUnit(Seed, i + 10, 17) * 60.f * Scale;
			const FVector Base(FMath::Cos(Angle) * Distance, FMath::Sin(Angle) * Distance, 0.f);

			const float Height = FMath::Lerp(80.f, 260.f, HashToUnit(Seed, i + 20, 17)) * Scale;
			const float Radius = FMath::Lerp(14.f, 30.f, HashToUnit(Seed, i + 30, 17)) * Scale;

			const FLinearColor Color = FMath::Lerp(FLinearColor(0.85f, 0.25f, 0.30f),
				FLinearColor(0.95f, 0.55f, 0.20f), HashToUnit(Seed, i + 40, 17));

			TArray<FVector> Spine;
			TArray<float> Widths;
			TArray<float> Heights;
			TArray<FLinearColor> Colors;

			const int32 Rings = 5;
			for (int32 r = 0; r < Rings; ++r)
			{
				const float T = (float)r / (Rings - 1);
				Spine.Add(Base + FVector(0.f, 0.f, T * Height));
				const float Taper = FMath::Lerp(1.f, 0.7f, T);
				Widths.Add(Radius * Taper);
				Heights.Add(Radius * Taper);
				Colors.Add(Color * FMath::Lerp(0.75f, 1.15f, T));
			}

			FSLMeshData Tube;
			SLProcMesh::AddLoft(Tube, Spine, Widths, Heights, Colors, 7, 2.f, Color, 0.f);
			Out.Append(Tube, FTransform::Identity);
		}
	}

	/** A lumpy rock: a sphere with its vertices pushed around by noise. */
	void BuildBoulder(FSLMeshData& Out, int32 Seed, float Scale)
	{
		const float Radius = FMath::Lerp(90.f, 320.f, HashToUnit(Seed, 1, 19)) * Scale;

		FSLMeshData Rock;
		SLProcMesh::AddSphere(Rock, FVector::ZeroVector, Radius, 10, FLinearColor(0.30f, 0.30f, 0.32f));

		for (int32 i = 0; i < Rock.Vertices.Num(); ++i)
		{
			FVector& V = Rock.Vertices[i];
			const float Noise = SLProcMesh::FBM((float)V.X + Seed, (float)V.Y - Seed, 3, 0.012f, 2.1f, 0.5f, Seed);
			V *= 1.f + Noise * 0.28f;
			V.Z = FMath::Max(V.Z, -Radius * 0.25f); // Flatten the buried underside.

			const float Shade = 0.8f + Noise * 0.35f;
			Rock.Colors[i] = FLinearColor(0.30f, 0.30f, 0.33f) * Shade;
		}

		Rock.RecalculateNormals();
		Out.Append(Rock, FTransform(FVector(0.f, 0.f, Radius * 0.35f)));
	}

	/** A glowing pod on a thin stalk. Returns the glowing part separately. */
	void BuildGlowPod(FSLMeshData& Stalk, FSLMeshData& Glow, int32 Seed, float Scale)
	{
		const float Height = FMath::Lerp(90.f, 260.f, HashToUnit(Seed, 1, 23)) * Scale;
		const float PodRadius = FMath::Lerp(22.f, 46.f, HashToUnit(Seed, 2, 23)) * Scale;

		SLProcMesh::AddCone(Stalk, FVector::ZeroVector, 9.f * Scale, Height, 6,
			FLinearColor(0.10f, 0.14f, 0.12f), FLinearColor(0.16f, 0.24f, 0.20f));

		// The pod itself goes in the emissive section so it lights the dark.
		const FLinearColor PodColor = FMath::Lerp(
			FLinearColor(0.20f, 0.95f, 0.85f),
			FLinearColor(0.55f, 0.75f, 1.f),
			HashToUnit(Seed, 3, 23));
		SLProcMesh::AddSphere(Glow, FVector(0.f, 0.f, Height), PodRadius, 9, PodColor);
	}
}

ASLFloraPatch::ASLFloraPatch()
{
	PrimaryActorTick.bCanEverTick = false;

	Mesh = CreateDefaultSubobject<UProceduralMeshComponent>(TEXT("FloraMesh"));
	// Flora never blocks anything - creatures and the player swim right through it.
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->SetCastShadow(false);
	SetRootComponent(Mesh);
}

void ASLFloraPatch::BuildPatch(const TArray<FSLFloraInstance>& Instances)
{
	FSLMeshData Opaque;
	FSLMeshData Emissive;

	for (const FSLFloraInstance& Instance : Instances)
	{
		FSLMeshData Local;
		FSLMeshData LocalGlow;

		switch (Instance.Type)
		{
		case ESLFloraType::Kelp:		BuildKelp(Local, Instance.Seed, Instance.Scale); break;
		case ESLFloraType::SeaGrass:	BuildSeaGrass(Local, Instance.Seed, Instance.Scale); break;
		case ESLFloraType::CoralFan:	BuildCoralFan(Local, Instance.Seed, Instance.Scale); break;
		case ESLFloraType::CoralTube:	BuildCoralTube(Local, Instance.Seed, Instance.Scale); break;
		case ESLFloraType::Boulder:		BuildBoulder(Local, Instance.Seed, Instance.Scale); break;
		case ESLFloraType::GlowPod:		BuildGlowPod(Local, LocalGlow, Instance.Seed, Instance.Scale); break;
		}

		const FTransform Xform(FRotator(0.f, Instance.Yaw, 0.f), Instance.Location);
		Opaque.Append(Local, Xform);

		if (!LocalGlow.IsEmpty())
		{
			Emissive.Append(LocalGlow, Xform);
		}
	}

	if (!Opaque.IsEmpty())
	{
		Opaque.RecalculateNormals();
		SLProcMesh::ApplyToComponent(Mesh, 0, Opaque, false);
		Mesh->SetMaterial(0, SLMaterialLibrary::GetSurfaceMaterial());
	}

	if (!Emissive.IsEmpty())
	{
		Emissive.RecalculateNormals();
		SLProcMesh::ApplyToComponent(Mesh, 1, Emissive, false);
		Mesh->SetMaterial(1, SLMaterialLibrary::GetGlowMaterial());
	}
}
