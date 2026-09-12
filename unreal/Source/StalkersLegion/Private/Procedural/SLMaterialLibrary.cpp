#include "Procedural/SLMaterialLibrary.h"

#include "Materials/MaterialInterface.h"
#include "StalkersLegion.h"
#include "UObject/ConstructorHelpers.h"

namespace
{
	/** Tries each path in turn and returns the first material that loads. */
	UMaterialInterface* LoadFirstAvailable(const TArray<FString>& Paths, const TCHAR* DebugName)
	{
		for (const FString& Path : Paths)
		{
			if (UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *Path))
			{
				return Material;
			}
		}

		UE_LOG(LogStalkersLegion, Warning,
			TEXT("Could not resolve the %s material. Procedural meshes will render untinted. ")
			TEXT("Open the project in the editor once to have the material generated, or create ")
			TEXT("/Game/Materials/M_SLVertexColor manually (VertexColor -> Base Color)."), DebugName);
		return nullptr;
	}
}

namespace SLMaterialLibrary
{
	UMaterialInterface* GetSurfaceMaterial()
	{
		static UMaterialInterface* Cached = nullptr;
		static bool bResolved = false;

		if (!bResolved)
		{
			bResolved = true;
			Cached = LoadFirstAvailable({
				TEXT("/Game/Materials/M_SLVertexColor.M_SLVertexColor"),
				TEXT("/Engine/EngineDebugMaterials/VertexColorViewMode_ColorOnly.VertexColorViewMode_ColorOnly"),
				TEXT("/Engine/EngineMaterials/WorldGridMaterial.WorldGridMaterial")
			}, TEXT("surface"));

			// The cache is a raw pointer into a UObject, so keep it referenced.
			if (Cached)
			{
				Cached->AddToRoot();
			}
		}

		return Cached;
	}

	UMaterialInterface* GetGlowMaterial()
	{
		static UMaterialInterface* Cached = nullptr;
		static bool bResolved = false;

		if (!bResolved)
		{
			bResolved = true;
			Cached = LoadFirstAvailable({
				TEXT("/Game/Materials/M_SLVertexColorGlow.M_SLVertexColorGlow"),
				TEXT("/Engine/EngineDebugMaterials/VertexColorViewMode_ColorOnly.VertexColorViewMode_ColorOnly"),
				TEXT("/Engine/EngineMaterials/WorldGridMaterial.WorldGridMaterial")
			}, TEXT("glow"));

			if (Cached)
			{
				Cached->AddToRoot();
			}
		}

		return Cached;
	}

	UMaterialInterface* GetMaterialForGlow(float Glow)
	{
		return Glow > 0.35f ? GetGlowMaterial() : GetSurfaceMaterial();
	}
}
