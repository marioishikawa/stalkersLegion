#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleInterface.h"

/**
 * Editor-only support module.
 *
 * Its whole job is to make sure the two materials the game renders with exist.
 * The project deliberately contains no binary assets, so rather than asking you
 * to build them by hand, this module generates them into /Game/Materials the
 * first time the editor loads the project.
 */
class FStalkersLegionEditorModule : public IModuleInterface
{
public:
	virtual void StartupModule() override;
	virtual void ShutdownModule() override;

private:
	/** Creates M_SLVertexColor and M_SLVertexColorGlow if they are missing. */
	static void EnsureMaterialsExist();

	FDelegateHandle PostEngineInitHandle;
};
