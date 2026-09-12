#include "Creatures/SLSpeciesLibrary.h"

namespace
{
	/** Shared defaults so each entry below only states what makes it different. */
	FSLSpeciesDef MakeFish(const TCHAR* Id, const TCHAR* Name, ESLBiome Biome, ESLBodyProfile Profile)
	{
		FSLSpeciesDef Def;
		Def.Id = FName(Id);
		Def.DisplayName = Name;
		Def.HomeBiome = Biome;
		Def.BodyProfile = Profile;
		Def.Diet = ESLDiet::Grazer;
		Def.MaxHealth = 14.f;
		Def.CruiseSpeed = 170.f;
		Def.SprintSpeed = 420.f;
		Def.TurnRate = 140.f;
		Def.SenseRadius = 1100.f;
		Def.SchoolSize = 7;
		Def.GroupsPerBiome = 7;
		Def.PreferredAltitude = 350.f;
		Def.WagRate = 7.f;
		return Def;
	}

	TArray<FSLSpeciesDef> BuildRoster()
	{
		TArray<FSLSpeciesDef> R;

		// ---------------------------------------------------------------- Safe Shallows
		{
			// Small, quick, mirror-bright. The first fish you ever see.
			FSLSpeciesDef D = MakeFish(TEXT("Glimmerfin"), TEXT("Glimmerfin"), ESLBiome::SafeShallows, ESLBodyProfile::Torpedo);
			D.Shape.Length = 26.f;
			D.Shape.Height = 0.26f;
			D.Shape.Width = 0.11f;
			D.Shape.BellyPosition = 0.36f;
			D.Shape.NoseSharpness = 0.55f;
			D.Shape.TailHeight = 0.3f;
			D.Shape.TailSweep = 0.22f;
			D.Shape.TailFork = 0.55f;
			D.Shape.DorsalFin = 0.14f;
			D.Shape.SideFin = 0.11f;
			D.Shape.EyeSize = 0.055f;
			D.Shape.Stripes = 4;
			D.BackColor = FLinearColor(0.35f, 0.72f, 0.85f);
			D.BellyColor = FLinearColor(0.95f, 0.96f, 0.90f);
			D.FinColor = FLinearColor(0.95f, 0.78f, 0.30f);
			D.SchoolSize = 10;
			D.GroupsPerBiome = 9;
			R.Add(D);
		}
		{
			// Round, slow, comically wide-eyed. Easy knife practice.
			FSLSpeciesDef D = MakeFish(TEXT("Bubblepeep"), TEXT("Bubblepeep"), ESLBiome::SafeShallows, ESLBodyProfile::Bulb);
			D.Shape.Length = 34.f;
			D.Shape.Height = 0.34f;
			D.Shape.Width = 0.30f;
			D.Shape.BellyPosition = 0.34f;
			D.Shape.NoseSharpness = 0.1f;
			D.Shape.CrossSectionPower = 2.2f;
			D.Shape.TailHeight = 0.26f;
			D.Shape.TailSweep = 0.18f;
			D.Shape.TailFork = 0.15f;
			D.Shape.DorsalFin = 0.1f;
			D.Shape.SideFin = 0.16f;
			D.Shape.EyeSize = 0.095f;
			D.BackColor = FLinearColor(0.95f, 0.55f, 0.18f);
			D.BellyColor = FLinearColor(1.f, 0.92f, 0.70f);
			D.FinColor = FLinearColor(1.f, 0.80f, 0.45f);
			D.CruiseSpeed = 120.f;
			D.SprintSpeed = 300.f;
			D.SchoolSize = 4;
			D.WagRate = 5.f;
			R.Add(D);
		}

		// ----------------------------------------------------------------- Kelp Forest
		{
			// Tall, flat and green - hides edge-on between kelp stalks.
			FSLSpeciesDef D = MakeFish(TEXT("Bladefish"), TEXT("Bladefish"), ESLBiome::KelpForest, ESLBodyProfile::Ribbon);
			D.Shape.Length = 58.f;
			D.Shape.Height = 0.30f;
			D.Shape.Width = 0.045f;
			D.Shape.BellyPosition = 0.30f;
			D.Shape.NoseSharpness = 0.7f;
			D.Shape.TailHeight = 0.24f;
			D.Shape.TailSweep = 0.3f;
			D.Shape.TailFork = 0.1f;
			D.Shape.DorsalFin = 0.22f;
			D.Shape.VentralFin = 0.16f;
			D.Shape.SideFin = 0.08f;
			D.Shape.EyeSize = 0.035f;
			D.Shape.SpineSegments = 18;
			D.BackColor = FLinearColor(0.16f, 0.42f, 0.14f);
			D.BellyColor = FLinearColor(0.72f, 0.80f, 0.45f);
			D.FinColor = FLinearColor(0.28f, 0.55f, 0.20f);
			D.MaxHealth = 18.f;
			D.SchoolSize = 5;
			D.PreferredAltitude = 500.f;
			D.WagRate = 4.5f;
			R.Add(D);
		}
		{
			// Needle-nosed sprinter. Bolts the instant anything looks at it.
			FSLSpeciesDef D = MakeFish(TEXT("KelpDarter"), TEXT("Kelp Darter"), ESLBiome::KelpForest, ESLBodyProfile::Arrow);
			D.Shape.Length = 40.f;
			D.Shape.Height = 0.17f;
			D.Shape.Width = 0.10f;
			D.Shape.BellyPosition = 0.42f;
			D.Shape.NoseSharpness = 0.95f;
			D.Shape.TailHeight = 0.34f;
			D.Shape.TailSweep = 0.28f;
			D.Shape.TailFork = 0.75f;
			D.Shape.DorsalFin = 0.1f;
			D.Shape.SideFin = 0.1f;
			D.Shape.EyeSize = 0.04f;
			D.Shape.Stripes = 2;
			D.BackColor = FLinearColor(0.38f, 0.46f, 0.16f);
			D.BellyColor = FLinearColor(0.88f, 0.90f, 0.72f);
			D.FinColor = FLinearColor(0.55f, 0.62f, 0.25f);
			D.CruiseSpeed = 230.f;
			D.SprintSpeed = 560.f;
			D.TurnRate = 190.f;
			D.SchoolSize = 9;
			D.WagRate = 9.f;
			R.Add(D);
		}

		// -------------------------------------------------------------- Grassy Plateau
		{
			// Wafer-thin disc that turns sideways when it flees.
			FSLSpeciesDef D = MakeFish(TEXT("Spadefin"), TEXT("Spadefin"), ESLBiome::GrassyPlateau, ESLBodyProfile::Disc);
			D.Shape.Length = 44.f;
			D.Shape.Height = 0.52f;
			D.Shape.Width = 0.06f;
			D.Shape.BellyPosition = 0.42f;
			D.Shape.NoseSharpness = 0.35f;
			D.Shape.TailHeight = 0.28f;
			D.Shape.TailSweep = 0.2f;
			D.Shape.TailFork = 0.3f;
			D.Shape.DorsalFin = 0.26f;
			D.Shape.VentralFin = 0.24f;
			D.Shape.SideFin = 0.13f;
			D.Shape.EyeSize = 0.05f;
			D.Shape.Stripes = 3;
			D.BackColor = FLinearColor(0.12f, 0.55f, 0.55f);
			D.BellyColor = FLinearColor(0.93f, 0.95f, 0.88f);
			D.FinColor = FLinearColor(0.10f, 0.35f, 0.42f);
			D.SchoolSize = 6;
			R.Add(D);
		}
		{
			// Angular grazer with hard shoulders; noses through the grass.
			FSLSpeciesDef D = MakeFish(TEXT("GrassNibbler"), TEXT("Grass Nibbler"), ESLBiome::GrassyPlateau, ESLBodyProfile::Diamond);
			D.Shape.Length = 36.f;
			D.Shape.Height = 0.30f;
			D.Shape.Width = 0.18f;
			D.Shape.BellyPosition = 0.38f;
			D.Shape.NoseSharpness = 0.25f;
			D.Shape.CrossSectionPower = 2.6f;
			D.Shape.TailHeight = 0.3f;
			D.Shape.TailSweep = 0.22f;
			D.Shape.TailFork = 0.45f;
			D.Shape.DorsalFin = 0.2f;
			D.Shape.SideFin = 0.14f;
			D.Shape.EyeSize = 0.06f;
			D.BackColor = FLinearColor(0.45f, 0.25f, 0.62f);
			D.BellyColor = FLinearColor(0.90f, 0.82f, 0.95f);
			D.FinColor = FLinearColor(0.62f, 0.40f, 0.80f);
			D.MaxHealth = 20.f;
			D.CruiseSpeed = 140.f;
			D.PreferredAltitude = 180.f;
			R.Add(D);
		}

		// -------------------------------------------------------------- Red Coral Reef
		{
			// Hot-coloured reef fish with a deep forked tail.
			FSLSpeciesDef D = MakeFish(TEXT("Emberfin"), TEXT("Emberfin"), ESLBiome::RedCoralReef, ESLBodyProfile::Diamond);
			D.Shape.Length = 32.f;
			D.Shape.Height = 0.38f;
			D.Shape.Width = 0.10f;
			D.Shape.BellyPosition = 0.33f;
			D.Shape.NoseSharpness = 0.6f;
			D.Shape.TailHeight = 0.4f;
			D.Shape.TailSweep = 0.3f;
			D.Shape.TailFork = 0.8f;
			D.Shape.DorsalFin = 0.24f;
			D.Shape.VentralFin = 0.14f;
			D.Shape.SideFin = 0.1f;
			D.Shape.EyeSize = 0.055f;
			D.Shape.Stripes = 5;
			D.BackColor = FLinearColor(0.85f, 0.18f, 0.10f);
			D.BellyColor = FLinearColor(1.f, 0.78f, 0.40f);
			D.FinColor = FLinearColor(1.f, 0.45f, 0.08f);
			D.Glow = 0.15f;
			D.SchoolSize = 8;
			R.Add(D);
		}
		{
			// A swimming brick. Slow, armoured, unbothered.
			FSLSpeciesDef D = MakeFish(TEXT("CoralBoxfish"), TEXT("Coral Boxfish"), ESLBiome::RedCoralReef, ESLBodyProfile::Boxy);
			D.Shape.Length = 30.f;
			D.Shape.Height = 0.32f;
			D.Shape.Width = 0.28f;
			D.Shape.BellyPosition = 0.45f;
			D.Shape.NoseSharpness = 0.05f;
			D.Shape.CrossSectionPower = 5.f;
			D.Shape.TailHeight = 0.2f;
			D.Shape.TailSweep = 0.16f;
			D.Shape.TailFork = 0.f;
			D.Shape.DorsalFin = 0.08f;
			D.Shape.SideFin = 0.12f;
			D.Shape.EyeSize = 0.07f;
			D.Shape.Stripes = 6;
			D.Shape.RadialSegments = 8;
			D.BackColor = FLinearColor(0.95f, 0.82f, 0.15f);
			D.BellyColor = FLinearColor(0.98f, 0.95f, 0.75f);
			D.FinColor = FLinearColor(0.20f, 0.18f, 0.15f);
			D.MaxHealth = 30.f;
			D.CruiseSpeed = 95.f;
			D.SprintSpeed = 200.f;
			D.TurnRate = 80.f;
			D.SchoolSize = 3;
			D.WagRate = 4.f;
			R.Add(D);
		}

		// --------------------------------------------------------------- Boulder Field
		{
			// Heavy bottom-feeder with a huge round head.
			FSLSpeciesDef D = MakeFish(TEXT("StoneGulper"), TEXT("Stone Gulper"), ESLBiome::BoulderField, ESLBodyProfile::Bulb);
			D.Shape.Length = 72.f;
			D.Shape.Height = 0.30f;
			D.Shape.Width = 0.26f;
			D.Shape.BellyPosition = 0.28f;
			D.Shape.NoseSharpness = 0.08f;
			D.Shape.CrossSectionPower = 2.4f;
			D.Shape.TailHeight = 0.24f;
			D.Shape.TailSweep = 0.2f;
			D.Shape.TailFork = 0.2f;
			D.Shape.DorsalFin = 0.12f;
			D.Shape.SideFin = 0.18f;
			D.Shape.EyeSize = 0.045f;
			D.Shape.BackSpikes = 4;
			D.Shape.SpineSegments = 16;
			D.BackColor = FLinearColor(0.30f, 0.30f, 0.33f);
			D.BellyColor = FLinearColor(0.70f, 0.68f, 0.60f);
			D.FinColor = FLinearColor(0.42f, 0.40f, 0.38f);
			D.MaxHealth = 45.f;
			D.CruiseSpeed = 110.f;
			D.SprintSpeed = 240.f;
			D.TurnRate = 70.f;
			D.SchoolSize = 2;
			D.GroupsPerBiome = 8;
			D.PreferredAltitude = 150.f;
			D.WagRate = 3.5f;
			R.Add(D);
		}

		// ----------------------------------------------------------------- Deep Trench
		{
			// Bioluminescent eel. Often the only thing you can see down there.
			FSLSpeciesDef D = MakeFish(TEXT("Lanternjaw"), TEXT("Lanternjaw"), ESLBiome::DeepTrench, ESLBodyProfile::Eel);
			D.Shape.Length = 90.f;
			D.Shape.Height = 0.10f;
			D.Shape.Width = 0.075f;
			D.Shape.BellyPosition = 0.2f;
			D.Shape.NoseSharpness = 0.3f;
			D.Shape.TailHeight = 0.16f;
			D.Shape.TailSweep = 0.18f;
			D.Shape.TailFork = 0.f;
			D.Shape.DorsalFin = 0.07f;
			D.Shape.VentralFin = 0.05f;
			D.Shape.SideFin = 0.05f;
			D.Shape.EyeSize = 0.03f;
			D.Shape.SpineSegments = 22;
			D.Shape.RadialSegments = 8;
			D.BackColor = FLinearColor(0.10f, 0.55f, 0.60f);
			D.BellyColor = FLinearColor(0.35f, 0.95f, 0.90f);
			D.FinColor = FLinearColor(0.25f, 0.85f, 0.80f);
			D.EyeColor = FLinearColor(0.90f, 1.f, 0.55f);
			D.Glow = 1.f;
			D.MaxHealth = 26.f;
			D.CruiseSpeed = 130.f;
			D.SchoolSize = 3;
			D.GroupsPerBiome = 9;
			D.PreferredAltitude = 600.f;
			D.WagRate = 3.f;
			R.Add(D);
		}
		{
			// Long violet streamer that drifts in the dark.
			FSLSpeciesDef D = MakeFish(TEXT("AbyssRibbon"), TEXT("Abyss Ribbon"), ESLBiome::DeepTrench, ESLBodyProfile::Ribbon);
			D.Shape.Length = 120.f;
			D.Shape.Height = 0.16f;
			D.Shape.Width = 0.03f;
			D.Shape.BellyPosition = 0.22f;
			D.Shape.NoseSharpness = 0.4f;
			D.Shape.TailHeight = 0.12f;
			D.Shape.TailSweep = 0.4f;
			D.Shape.TailFork = 0.f;
			D.Shape.DorsalFin = 0.1f;
			D.Shape.VentralFin = 0.08f;
			D.Shape.SideFin = 0.f;
			D.Shape.EyeSize = 0.022f;
			D.Shape.SpineSegments = 24;
			D.BackColor = FLinearColor(0.30f, 0.10f, 0.45f);
			D.BellyColor = FLinearColor(0.65f, 0.40f, 0.95f);
			D.FinColor = FLinearColor(0.50f, 0.20f, 0.75f);
			D.Glow = 0.4f;
			D.MaxHealth = 22.f;
			D.CruiseSpeed = 105.f;
			D.SprintSpeed = 260.f;
			D.TurnRate = 60.f;
			D.SchoolSize = 2;
			D.PreferredAltitude = 900.f;
			D.WagRate = 2.2f;
			R.Add(D);
		}

		// -------------------------------------------------------------- The Stalker
		{
			FSLSpeciesDef D;
			D.Id = FName(TEXT("Stalker"));
			D.DisplayName = TEXT("Stalker");
			D.HomeBiome = ESLBiome::KelpForest;
			D.Diet = ESLDiet::Carnivore;
			D.BodyProfile = ESLBodyProfile::Eel;
			D.Shape.Length = 260.f;
			D.Shape.Height = 0.115f;
			D.Shape.Width = 0.085f;
			D.Shape.BellyPosition = 0.18f;
			D.Shape.NoseSharpness = 0.25f;
			D.Shape.CrossSectionPower = 2.3f;
			D.Shape.TailHeight = 0.20f;
			D.Shape.TailSweep = 0.22f;
			D.Shape.TailFork = 0.25f;
			D.Shape.DorsalFin = 0.09f;
			D.Shape.VentralFin = 0.05f;
			D.Shape.SideFin = 0.10f;
			D.Shape.EyeSize = 0.022f;
			D.Shape.JawLength = 0.17f;
			D.Shape.BackSpikes = 7;
			D.Shape.SpineSegments = 20;
			D.Shape.RadialSegments = 10;
			D.BackColor = FLinearColor(0.22f, 0.26f, 0.20f);
			D.BellyColor = FLinearColor(0.62f, 0.60f, 0.46f);
			D.FinColor = FLinearColor(0.30f, 0.34f, 0.24f);
			D.EyeColor = FLinearColor(0.95f, 0.85f, 0.15f);
			D.MaxHealth = 130.f;
			D.CruiseSpeed = 220.f;
			D.SprintSpeed = 620.f;
			D.TurnRate = 110.f;
			D.SenseRadius = 3000.f;
			D.BiteDamage = 22.f;
			D.BiteInterval = 1.8f;
			D.SchoolSize = 1;
			D.GroupsPerBiome = 0; // Placed by the biome's StalkerCount instead.
			D.PreferredAltitude = 450.f;
			D.WagRate = 2.6f;
			R.Add(D);
		}

		return R;
	}
}

namespace SLSpeciesLibrary
{
	const TArray<FSLSpeciesDef>& All()
	{
		static const TArray<FSLSpeciesDef> Roster = BuildRoster();
		return Roster;
	}

	const FSLSpeciesDef* Find(FName Id)
	{
		return All().FindByPredicate([Id](const FSLSpeciesDef& D) { return D.Id == Id; });
	}

	const FSLSpeciesDef& Stalker()
	{
		static const FSLSpeciesDef* Cached = Find(FName(TEXT("Stalker")));
		check(Cached);
		return *Cached;
	}

	TArray<const FSLSpeciesDef*> FishOfBiome(ESLBiome Biome)
	{
		TArray<const FSLSpeciesDef*> Out;
		for (const FSLSpeciesDef& Def : All())
		{
			if (Def.HomeBiome == Biome && Def.Diet != ESLDiet::Carnivore)
			{
				Out.Add(&Def);
			}
		}
		return Out;
	}
}
