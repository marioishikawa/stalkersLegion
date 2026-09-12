#pragma once

#include "CoreMinimal.h"

class UProceduralMeshComponent;

/**
 * A CPU-side triangle soup with vertex colours. Every visual in Stalkers Legion
 * (terrain, fish, kelp, scrap) is assembled into one of these and then pushed to
 * a UProceduralMeshComponent, so the project needs no imported art assets.
 */
struct STALKERSLEGION_API FSLMeshData
{
	TArray<FVector> Vertices;
	TArray<int32> Triangles;
	TArray<FVector> Normals;
	TArray<FVector2D> UVs;
	TArray<FLinearColor> Colors;

	int32 NumVerts() const { return Vertices.Num(); }
	bool IsEmpty() const { return Vertices.Num() == 0 || Triangles.Num() == 0; }

	void Reset();
	void Reserve(int32 VertexCount, int32 TriangleCount);

	/** Adds a vertex and returns its index. Normals may be left at zero and recomputed later. */
	int32 AddVertex(const FVector& Position, const FVector& Normal, const FVector2D& UV, const FLinearColor& Color);

	void AddTriangle(int32 A, int32 B, int32 C);

	/** Quad wound A-B-C, A-C-D. */
	void AddQuad(int32 A, int32 B, int32 C, int32 D);

	/** Appends another mesh, transformed into this one's space. */
	void Append(const FSLMeshData& Other, const FTransform& Xform);

	/** Area-weighted smooth normals. Call once a mesh is fully assembled. */
	void RecalculateNormals();

	FBox Bounds() const;
};

namespace SLProcMesh
{
	/** Uploads mesh data into a section of a procedural mesh component. */
	STALKERSLEGION_API void ApplyToComponent(UProceduralMeshComponent* Component, int32 SectionIndex,
		const FSLMeshData& Mesh, bool bCreateCollision);

	/** Axis-aligned box centred on the origin. */
	STALKERSLEGION_API void AddBox(FSLMeshData& Out, const FVector& Center, const FVector& Extent,
		const FLinearColor& Color);

	/** UV sphere centred on the origin. */
	STALKERSLEGION_API void AddSphere(FSLMeshData& Out, const FVector& Center, float Radius, int32 Segments,
		const FLinearColor& Color);

	/** Cone pointing down +Z, base at Center. */
	STALKERSLEGION_API void AddCone(FSLMeshData& Out, const FVector& Center, float Radius, float Height,
		int32 Sides, const FLinearColor& BaseColor, const FLinearColor& TipColor);

	/** Double-sided flat triangle - used for fins and grass blades. */
	STALKERSLEGION_API void AddFin(FSLMeshData& Out, const FVector& A, const FVector& B, const FVector& C,
		const FLinearColor& Color);

	/** Double-sided quad. */
	STALKERSLEGION_API void AddQuadPoly(FSLMeshData& Out, const FVector& A, const FVector& B, const FVector& C,
		const FVector& D, const FLinearColor& Color, bool bTwoSided);

	/**
	 * Lofts a closed tube along a spine. Each spine point has a half-width, a
	 * half-height and a colour; CrossSectionPower controls squareness
	 * (2 = ellipse, 4 = boxy). Caps both ends.
	 */
	STALKERSLEGION_API void AddLoft(FSLMeshData& Out, const TArray<FVector>& Spine, const TArray<float>& HalfWidths,
		const TArray<float>& HalfHeights, const TArray<FLinearColor>& RingColors, int32 RadialSegments,
		float CrossSectionPower, const FLinearColor& BellyTint, float BellyBlend);

	/** Deterministic hash noise in [-1,1]. */
	STALKERSLEGION_API float ValueNoise2D(float X, float Y, int32 Seed);

	/** Fractal brownian motion built on ValueNoise2D, in roughly [-1,1]. */
	STALKERSLEGION_API float FBM(float X, float Y, int32 Octaves, float Frequency, float Lacunarity, float Gain, int32 Seed);

	/** Stable pseudo-random float in [0,1) from an integer key. */
	STALKERSLEGION_API float HashToUnit(int32 A, int32 B, int32 Seed);
}
