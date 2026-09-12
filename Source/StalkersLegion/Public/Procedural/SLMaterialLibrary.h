#pragma once

#include "CoreMinimal.h"

class UMaterialInterface;

/**
 * Resolves the two materials the game needs to display vertex-coloured
 * procedural meshes.
 *
 * The project ships no binary assets, so these are looked up by path with
 * fallbacks: first the project materials (generated automatically the first
 * time the editor loads - see StalkersLegionEditor), then engine materials that
 * already show vertex colour, and finally the default grid material so that a
 * missing asset degrades to grey geometry rather than to nothing at all.
 */
namespace SLMaterialLibrary
{
	/** Lit material that reads vertex colour as base colour. */
	STALKERSLEGION_API UMaterialInterface* GetSurfaceMaterial();

	/** Unlit/emissive material for bioluminescent creatures and glow pods. */
	STALKERSLEGION_API UMaterialInterface* GetGlowMaterial();

	/** Picks glow or surface based on a species' Glow value. */
	STALKERSLEGION_API UMaterialInterface* GetMaterialForGlow(float Glow);
}
