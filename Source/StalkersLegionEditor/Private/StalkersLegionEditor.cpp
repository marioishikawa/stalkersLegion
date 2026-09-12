#include "StalkersLegionEditor.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "Factories/MaterialFactoryNew.h"
#include "MaterialEditingLibrary.h"
#include "Materials/Material.h"
#include "Materials/MaterialExpressionVertexColor.h"
#include "Misc/PackageName.h"
#include "StalkersLegion.h"
#include "UObject/Package.h"
#include "UObject/SavePackage.h"

IMPLEMENT_MODULE(FStalkersLegionEditorModule, StalkersLegionEditor);

namespace
{
	/**
	 * Builds one material whose vertex colour feeds a single property, saves it,
	 * and registers it with the asset registry.
	 */
	UMaterial* CreateVertexColorMaterial(const FString& PackagePath, const FString& AssetName,
		EMaterialProperty TargetProperty, EBlendMode BlendMode, EMaterialShadingModel ShadingModel)
	{
		const FString FullPath = PackagePath / AssetName;

		if (UMaterial* Existing = LoadObject<UMaterial>(nullptr, *FullPath))
		{
			return Existing;
		}

		UPackage* Package = CreatePackage(*FullPath);
		if (!Package)
		{
			return nullptr;
		}

		UMaterialFactoryNew* Factory = NewObject<UMaterialFactoryNew>();
		UMaterial* Material = Cast<UMaterial>(Factory->FactoryCreateNew(
			UMaterial::StaticClass(), Package, *AssetName, RF_Standalone | RF_Public, nullptr, GWarn));

		if (!Material)
		{
			return nullptr;
		}

		Material->SetShadingModel(ShadingModel);
		Material->BlendMode = BlendMode;
		// Procedural meshes are drawn from both sides in places (fins, kelp leaves).
		Material->TwoSided = true;

		UMaterialExpressionVertexColor* VertexColor =
			Cast<UMaterialExpressionVertexColor>(UMaterialEditingLibrary::CreateMaterialExpression(
				Material, UMaterialExpressionVertexColor::StaticClass(), -350, 0));

		if (VertexColor)
		{
			UMaterialEditingLibrary::ConnectMaterialProperty(VertexColor, TEXT(""), TargetProperty);
		}

		UMaterialEditingLibrary::RecompileMaterial(Material);

		Material->MarkPackageDirty();
		FAssetRegistryModule::AssetCreated(Material);

		const FString FileName = FPackageName::LongPackageNameToFilename(FullPath, FPackageName::GetAssetPackageExtension());
		FSavePackageArgs SaveArgs;
		SaveArgs.TopLevelFlags = RF_Standalone | RF_Public;
		SaveArgs.Error = GWarn;
		UPackage::SavePackage(Package, Material, *FileName, SaveArgs);

		UE_LOG(LogStalkersLegion, Log, TEXT("Generated material %s."), *FullPath);
		return Material;
	}
}

void FStalkersLegionEditorModule::EnsureMaterialsExist()
{
	// Lit: vertex colour drives base colour. Used by terrain, fish and scrap.
	CreateVertexColorMaterial(TEXT("/Game/Materials"), TEXT("M_SLVertexColor"),
		MP_BaseColor, BLEND_Opaque, MSM_DefaultLit);

	// Unlit: vertex colour drives emissive, so bioluminescence and the water
	// surface stay visible when there is no light left at all.
	CreateVertexColorMaterial(TEXT("/Game/Materials"), TEXT("M_SLVertexColorGlow"),
		MP_EmissiveColor, BLEND_Opaque, MSM_Unlit);
}

void FStalkersLegionEditorModule::StartupModule()
{
	// Deferred until the asset registry has finished its initial scan, otherwise
	// the existence check can miss materials that are present but not yet indexed.
	PostEngineInitHandle = FCoreDelegates::OnPostEngineInit.AddStatic(&FStalkersLegionEditorModule::EnsureMaterialsExist);
}

void FStalkersLegionEditorModule::ShutdownModule()
{
	if (PostEngineInitHandle.IsValid())
	{
		FCoreDelegates::OnPostEngineInit.Remove(PostEngineInitHandle);
		PostEngineInitHandle.Reset();
	}
}
