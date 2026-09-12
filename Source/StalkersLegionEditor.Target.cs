using UnrealBuildTool;

public class StalkersLegionEditorTarget : TargetRules
{
	public StalkersLegionEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.V4;
		IncludeOrderVersion = EngineIncludeOrderVersion.Unreal5_4;
		ExtraModuleNames.Add("StalkersLegion");
		ExtraModuleNames.Add("StalkersLegionEditor");
	}
}
