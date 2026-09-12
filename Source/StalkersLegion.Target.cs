using UnrealBuildTool;

public class StalkersLegionTarget : TargetRules
{
	public StalkersLegionTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("StalkersLegion");
	}
}
