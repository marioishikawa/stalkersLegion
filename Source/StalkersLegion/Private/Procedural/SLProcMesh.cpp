#include "Procedural/SLProcMesh.h"

#include "ProceduralMeshComponent.h"

void FSLMeshData::Reset()
{
	Vertices.Reset();
	Triangles.Reset();
	Normals.Reset();
	UVs.Reset();
	Colors.Reset();
}

void FSLMeshData::Reserve(int32 VertexCount, int32 TriangleCount)
{
	Vertices.Reserve(Vertices.Num() + VertexCount);
	Normals.Reserve(Normals.Num() + VertexCount);
	UVs.Reserve(UVs.Num() + VertexCount);
	Colors.Reserve(Colors.Num() + VertexCount);
	Triangles.Reserve(Triangles.Num() + TriangleCount * 3);
}

int32 FSLMeshData::AddVertex(const FVector& Position, const FVector& Normal, const FVector2D& UV, const FLinearColor& Color)
{
	const int32 Index = Vertices.Add(Position);
	Normals.Add(Normal);
	UVs.Add(UV);
	Colors.Add(Color);
	return Index;
}

void FSLMeshData::AddTriangle(int32 A, int32 B, int32 C)
{
	Triangles.Add(A);
	Triangles.Add(B);
	Triangles.Add(C);
}

void FSLMeshData::AddQuad(int32 A, int32 B, int32 C, int32 D)
{
	AddTriangle(A, B, C);
	AddTriangle(A, C, D);
}

void FSLMeshData::Append(const FSLMeshData& Other, const FTransform& Xform)
{
	const int32 Base = Vertices.Num();
	Reserve(Other.Vertices.Num(), Other.Triangles.Num() / 3);

	for (int32 i = 0; i < Other.Vertices.Num(); ++i)
	{
		Vertices.Add(Xform.TransformPosition(Other.Vertices[i]));
		Normals.Add(Xform.TransformVectorNoScale(Other.Normals.IsValidIndex(i) ? Other.Normals[i] : FVector::UpVector));
		UVs.Add(Other.UVs.IsValidIndex(i) ? Other.UVs[i] : FVector2D::ZeroVector);
		Colors.Add(Other.Colors.IsValidIndex(i) ? Other.Colors[i] : FLinearColor::White);
	}

	for (int32 Index : Other.Triangles)
	{
		Triangles.Add(Base + Index);
	}
}

void FSLMeshData::RecalculateNormals()
{
	Normals.Init(FVector::ZeroVector, Vertices.Num());

	for (int32 i = 0; i + 2 < Triangles.Num(); i += 3)
	{
		const int32 I0 = Triangles[i];
		const int32 I1 = Triangles[i + 1];
		const int32 I2 = Triangles[i + 2];
		if (!Vertices.IsValidIndex(I0) || !Vertices.IsValidIndex(I1) || !Vertices.IsValidIndex(I2))
		{
			continue;
		}

		// Unnormalised cross product weights each face by its area.
		const FVector Face = FVector::CrossProduct(Vertices[I1] - Vertices[I0], Vertices[I2] - Vertices[I0]);
		Normals[I0] += Face;
		Normals[I1] += Face;
		Normals[I2] += Face;
	}

	for (FVector& Normal : Normals)
	{
		Normal = Normal.GetSafeNormal(KINDA_SMALL_NUMBER, FVector::UpVector);
	}
}

FBox FSLMeshData::Bounds() const
{
	FBox Box(ForceInit);
	for (const FVector& V : Vertices)
	{
		Box += V;
	}
	return Box;
}

namespace SLProcMesh
{
	void ApplyToComponent(UProceduralMeshComponent* Component, int32 SectionIndex, const FSLMeshData& Mesh, bool bCreateCollision)
	{
		if (!Component || Mesh.IsEmpty())
		{
			return;
		}

		const TArray<FProcMeshTangent> NoTangents;
		Component->CreateMeshSection_LinearColor(SectionIndex, Mesh.Vertices, Mesh.Triangles, Mesh.Normals,
			Mesh.UVs, Mesh.Colors, NoTangents, bCreateCollision);
	}

	void AddBox(FSLMeshData& Out, const FVector& Center, const FVector& Extent, const FLinearColor& Color)
	{
		static const FVector FaceNormals[6] = {
			FVector(1, 0, 0), FVector(-1, 0, 0), FVector(0, 1, 0),
			FVector(0, -1, 0), FVector(0, 0, 1), FVector(0, 0, -1)
		};

		for (const FVector& N : FaceNormals)
		{
			// Build an orthonormal basis for the face and emit one quad.
			const FVector Tangent = FMath::Abs(N.Z) > 0.9f ? FVector(1, 0, 0) : FVector(0, 0, 1);
			const FVector U = FVector::CrossProduct(N, Tangent).GetSafeNormal();
			const FVector V = FVector::CrossProduct(N, U).GetSafeNormal();

			const FVector FaceCenter = Center + N * Extent;
			const FVector Su = U * Extent;
			const FVector Sv = V * Extent;

			const int32 A = Out.AddVertex(FaceCenter - Su - Sv, N, FVector2D(0, 0), Color);
			const int32 B = Out.AddVertex(FaceCenter + Su - Sv, N, FVector2D(1, 0), Color);
			const int32 C = Out.AddVertex(FaceCenter + Su + Sv, N, FVector2D(1, 1), Color);
			const int32 D = Out.AddVertex(FaceCenter - Su + Sv, N, FVector2D(0, 1), Color);
			Out.AddQuad(A, B, C, D);
		}
	}

	void AddSphere(FSLMeshData& Out, const FVector& Center, float Radius, int32 Segments, const FLinearColor& Color)
	{
		Segments = FMath::Max(4, Segments);
		const int32 Rings = FMath::Max(3, Segments / 2);
		const int32 Base = Out.NumVerts();

		for (int32 Ring = 0; Ring <= Rings; ++Ring)
		{
			const float Phi = PI * Ring / Rings;
			const float SinPhi = FMath::Sin(Phi);
			const float CosPhi = FMath::Cos(Phi);

			for (int32 Seg = 0; Seg <= Segments; ++Seg)
			{
				const float Theta = 2.f * PI * Seg / Segments;
				const FVector Normal(SinPhi * FMath::Cos(Theta), SinPhi * FMath::Sin(Theta), CosPhi);
				Out.AddVertex(Center + Normal * Radius, Normal,
					FVector2D((float)Seg / Segments, (float)Ring / Rings), Color);
			}
		}

		const int32 Stride = Segments + 1;
		for (int32 Ring = 0; Ring < Rings; ++Ring)
		{
			for (int32 Seg = 0; Seg < Segments; ++Seg)
			{
				const int32 A = Base + Ring * Stride + Seg;
				Out.AddQuad(A, A + Stride, A + Stride + 1, A + 1);
			}
		}
	}

	void AddCone(FSLMeshData& Out, const FVector& Center, float Radius, float Height, int32 Sides,
		const FLinearColor& BaseColor, const FLinearColor& TipColor)
	{
		Sides = FMath::Max(3, Sides);
		const FVector Tip = Center + FVector(0, 0, Height);

		for (int32 i = 0; i < Sides; ++i)
		{
			const float T0 = 2.f * PI * i / Sides;
			const float T1 = 2.f * PI * (i + 1) / Sides;
			const FVector P0 = Center + FVector(FMath::Cos(T0) * Radius, FMath::Sin(T0) * Radius, 0.f);
			const FVector P1 = Center + FVector(FMath::Cos(T1) * Radius, FMath::Sin(T1) * Radius, 0.f);
			const FVector N = FVector::CrossProduct(P1 - P0, Tip - P0).GetSafeNormal();

			const int32 A = Out.AddVertex(P0, N, FVector2D(0, 0), BaseColor);
			const int32 B = Out.AddVertex(P1, N, FVector2D(1, 0), BaseColor);
			const int32 C = Out.AddVertex(Tip, N, FVector2D(0.5f, 1), TipColor);
			Out.AddTriangle(A, B, C);

			// Flat bottom cap so the cone reads solid from below.
			const int32 D = Out.AddVertex(P1, FVector(0, 0, -1), FVector2D(1, 0), BaseColor);
			const int32 E = Out.AddVertex(P0, FVector(0, 0, -1), FVector2D(0, 0), BaseColor);
			const int32 F = Out.AddVertex(Center, FVector(0, 0, -1), FVector2D(0.5f, 0.5f), BaseColor);
			Out.AddTriangle(D, E, F);
		}
	}

	void AddFin(FSLMeshData& Out, const FVector& A, const FVector& B, const FVector& C, const FLinearColor& Color)
	{
		const FVector N = FVector::CrossProduct(B - A, C - A).GetSafeNormal();

		const int32 I0 = Out.AddVertex(A, N, FVector2D(0, 0), Color);
		const int32 I1 = Out.AddVertex(B, N, FVector2D(1, 0), Color);
		const int32 I2 = Out.AddVertex(C, N, FVector2D(0.5f, 1), Color);
		Out.AddTriangle(I0, I1, I2);

		// Fins are paper thin, so mirror the winding to make them visible from both sides.
		const int32 J0 = Out.AddVertex(A, -N, FVector2D(0, 0), Color);
		const int32 J1 = Out.AddVertex(C, -N, FVector2D(0.5f, 1), Color);
		const int32 J2 = Out.AddVertex(B, -N, FVector2D(1, 0), Color);
		Out.AddTriangle(J0, J1, J2);
	}

	void AddQuadPoly(FSLMeshData& Out, const FVector& A, const FVector& B, const FVector& C, const FVector& D,
		const FLinearColor& Color, bool bTwoSided)
	{
		const FVector N = FVector::CrossProduct(B - A, C - A).GetSafeNormal();

		const int32 I0 = Out.AddVertex(A, N, FVector2D(0, 0), Color);
		const int32 I1 = Out.AddVertex(B, N, FVector2D(1, 0), Color);
		const int32 I2 = Out.AddVertex(C, N, FVector2D(1, 1), Color);
		const int32 I3 = Out.AddVertex(D, N, FVector2D(0, 1), Color);
		Out.AddQuad(I0, I1, I2, I3);

		if (bTwoSided)
		{
			const int32 J0 = Out.AddVertex(A, -N, FVector2D(0, 0), Color);
			const int32 J1 = Out.AddVertex(D, -N, FVector2D(0, 1), Color);
			const int32 J2 = Out.AddVertex(C, -N, FVector2D(1, 1), Color);
			const int32 J3 = Out.AddVertex(B, -N, FVector2D(1, 0), Color);
			Out.AddQuad(J0, J1, J2, J3);
		}
	}

	void AddLoft(FSLMeshData& Out, const TArray<FVector>& Spine, const TArray<float>& HalfWidths,
		const TArray<float>& HalfHeights, const TArray<FLinearColor>& RingColors, int32 RadialSegments,
		float CrossSectionPower, const FLinearColor& BellyTint, float BellyBlend)
	{
		const int32 RingCount = Spine.Num();
		if (RingCount < 2 || HalfWidths.Num() < RingCount || HalfHeights.Num() < RingCount)
		{
			return;
		}

		RadialSegments = FMath::Max(4, RadialSegments);
		const int32 Base = Out.NumVerts();
		const float Power = FMath::Max(0.5f, CrossSectionPower);
		const float InvPower = 2.f / Power;

		// Each ring gets its own frame built from the local spine tangent, so a
		// loft works whether it runs along a fish (+X) or up a kelp stalk (+Z).
		auto TangentAt = [&Spine, RingCount](int32 Ring) -> FVector
		{
			const int32 Prev = FMath::Max(0, Ring - 1);
			const int32 Next = FMath::Min(RingCount - 1, Ring + 1);
			const FVector Delta = Spine[Next] - Spine[Prev];
			return Delta.GetSafeNormal(KINDA_SMALL_NUMBER, FVector::ForwardVector);
		};

		for (int32 Ring = 0; Ring < RingCount; ++Ring)
		{
			const FLinearColor RingColor = RingColors.IsValidIndex(Ring) ? RingColors[Ring] : FLinearColor::White;

			const FVector Tangent = TangentAt(Ring);
			// Pick a reference up that is not parallel to the tangent.
			const FVector Reference = FMath::Abs(Tangent.Z) > 0.95f ? FVector::ForwardVector : FVector::UpVector;
			const FVector Right = FVector::CrossProduct(Reference, Tangent).GetSafeNormal(KINDA_SMALL_NUMBER, FVector::RightVector);
			const FVector Up = FVector::CrossProduct(Tangent, Right).GetSafeNormal(KINDA_SMALL_NUMBER, FVector::UpVector);

			for (int32 Seg = 0; Seg <= RadialSegments; ++Seg)
			{
				const float Theta = 2.f * PI * Seg / RadialSegments;
				const float CosT = FMath::Cos(Theta);
				const float SinT = FMath::Sin(Theta);

				// Superellipse: |cos|^(2/p) keeps the silhouette round at p=2 and
				// squares it off as p grows, which is what makes boxfish boxy.
				const float SX = FMath::Sign(CosT) * FMath::Pow(FMath::Abs(CosT), InvPower);
				const float SZ = FMath::Sign(SinT) * FMath::Pow(FMath::Abs(SinT), InvPower);

				const FVector Offset = Right * (SX * HalfWidths[Ring]) + Up * (SZ * HalfHeights[Ring]);
				const FVector Position = Spine[Ring] + Offset;

				// Countershading: light belly fading into the darker back.
				const float BellyMask = FMath::Clamp(-SZ, 0.f, 1.f) * BellyBlend;
				const FLinearColor Color = FMath::Lerp(RingColor, BellyTint, BellyMask);

				Out.AddVertex(Position, Offset.GetSafeNormal(KINDA_SMALL_NUMBER, Up),
					FVector2D((float)Seg / RadialSegments, (float)Ring / (RingCount - 1)), Color);
			}
		}

		const int32 Stride = RadialSegments + 1;
		for (int32 Ring = 0; Ring + 1 < RingCount; ++Ring)
		{
			for (int32 Seg = 0; Seg < RadialSegments; ++Seg)
			{
				const int32 A = Base + Ring * Stride + Seg;
				Out.AddQuad(A, A + 1, A + Stride + 1, A + Stride);
			}
		}

		// Caps: fan the first and last rings to their spine points.
		const FVector StartTangent = TangentAt(0);
		const int32 NoseIndex = Out.AddVertex(Spine[0], -StartTangent, FVector2D(0.5f, 0.f),
			RingColors.IsValidIndex(0) ? RingColors[0] : FLinearColor::White);
		for (int32 Seg = 0; Seg < RadialSegments; ++Seg)
		{
			Out.AddTriangle(NoseIndex, Base + Seg + 1, Base + Seg);
		}

		const int32 LastRingBase = Base + (RingCount - 1) * Stride;
		const FVector EndTangent = TangentAt(RingCount - 1);
		const int32 TailIndex = Out.AddVertex(Spine[RingCount - 1], EndTangent, FVector2D(0.5f, 1.f),
			RingColors.IsValidIndex(RingCount - 1) ? RingColors[RingCount - 1] : FLinearColor::White);
		for (int32 Seg = 0; Seg < RadialSegments; ++Seg)
		{
			Out.AddTriangle(TailIndex, LastRingBase + Seg, LastRingBase + Seg + 1);
		}
	}

	float HashToUnit(int32 A, int32 B, int32 Seed)
	{
		uint32 H = (uint32)A * 374761393u + (uint32)B * 668265263u + (uint32)Seed * 2246822519u;
		H = (H ^ (H >> 13)) * 1274126177u;
		H ^= (H >> 16);
		return (float)(H & 0x00FFFFFFu) / (float)0x01000000u;
	}

	float ValueNoise2D(float X, float Y, int32 Seed)
	{
		const float FloorX = FMath::FloorToFloat(X);
		const float FloorY = FMath::FloorToFloat(Y);
		const int32 IX = (int32)FloorX;
		const int32 IY = (int32)FloorY;
		const float FracX = X - FloorX;
		const float FracY = Y - FloorY;

		// Smoothstep the interpolants so the gradient is continuous across cells.
		const float U = FracX * FracX * (3.f - 2.f * FracX);
		const float V = FracY * FracY * (3.f - 2.f * FracY);

		const float C00 = HashToUnit(IX, IY, Seed);
		const float C10 = HashToUnit(IX + 1, IY, Seed);
		const float C01 = HashToUnit(IX, IY + 1, Seed);
		const float C11 = HashToUnit(IX + 1, IY + 1, Seed);

		const float Bottom = FMath::Lerp(C00, C10, U);
		const float Top = FMath::Lerp(C01, C11, U);
		return FMath::Lerp(Bottom, Top, V) * 2.f - 1.f;
	}

	float FBM(float X, float Y, int32 Octaves, float Frequency, float Lacunarity, float Gain, int32 Seed)
	{
		float Sum = 0.f;
		float Amplitude = 1.f;
		float Normaliser = 0.f;

		for (int32 i = 0; i < FMath::Max(1, Octaves); ++i)
		{
			Sum += ValueNoise2D(X * Frequency, Y * Frequency, Seed + i * 7919) * Amplitude;
			Normaliser += Amplitude;
			Frequency *= Lacunarity;
			Amplitude *= Gain;
		}

		return Normaliser > 0.f ? Sum / Normaliser : 0.f;
	}
}
