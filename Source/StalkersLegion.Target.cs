using UnrealBuildTool;

public class StalkersLegionTarget : TargetRules
{
	public StalkersLegionTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.V4;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("StalkersLegion");
	}
}
