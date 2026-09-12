using UnrealBuildTool;

public class StalkersLegion : ModuleRules
{
	public StalkersLegion(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[]
		{
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			"ProceduralMeshComponent"
		});

		PrivateDependencyModuleNames.AddRange(new string[]
		{
			"Slate",
			"SlateCore"
		});

		PublicIncludePaths.Add(ModuleDirectory + "/Public");
		PrivateIncludePaths.Add(ModuleDirectory + "/Private");
	}
}
