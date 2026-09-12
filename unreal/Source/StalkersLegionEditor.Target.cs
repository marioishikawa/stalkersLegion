using UnrealBuildTool;

public class StalkersLegionEditorTarget : TargetRules
{
	public StalkersLegionEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("StalkersLegion");
		ExtraModuleNames.Add("StalkersLegionEditor");
	}
}
