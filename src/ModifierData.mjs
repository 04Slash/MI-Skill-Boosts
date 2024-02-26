let noPreservation = ['melvorD:Farming', 'melvorD:Township', 'melvorD:Woodcutting', 'melvorD:Fishing', 'melvorD:Mining', 'melvorD:Thieving', 'melvorD:Agility', 'melvorD:Astrology', 'melvorD:Magic', 'melvorAoD:Archaeology'],
	noMastery = ['melvorD:Magic', 'melvorAoD:Cartography', 'melvorD:Township'],
	noSummon = ['melvorD:Farming', 'melvorD:Township', 'melvorD:Magic', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noPotion = ['melvorD:Township', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noDoubling = ['melvorD:Township'],
	noInterval = ['melvorD:Township'],
	noConsumable = ['melvorD:Township'];

export function sortModdedSkill(data) {
	if (data.noPreservation)
		noPreservation.push(data.skill.id);
	if (data.noMastery)
		noMastery.push(data.skill.id);
	if (data.noSummon)
		noSummon.push(data.skill.id);
	if (data.noPotion)
		noPotion.push(data.skill.id);
	if (data.noDoubling)
		noDoubling.push(data.skill.id);
	if (data.noInterval)
		noInterval.push(data.skill.id);
	if (data.noConsumable)
		noConsumable.push(data.skill.id);
}

//Modifiers that effect skills globally
export function getGlobalModifiers(type, skill) {
	let modifiers = [],
		relic = game.currentGamemode.id === 'melvorAoD:AncientRelics',
		preservation = !noPreservation.some((x) => x === skill.id),
		mastery = !noMastery.some((x) => x === skill.id),
		summon = !noSummon.some((x) => x === skill.id),
		potion = !noPotion.some((x) => x === skill.id),
		double = !noDoubling.some((x) => x === skill.id),
		interval = !noInterval.some((x) => x === skill.id),
		consumable = !noConsumable.some((x) => x === skill.id),
		prefix = type === 'Positive' ? 'increased' : 'decreased';

	if (type === 'Positive') {
		modifiers.push('allowSignetDrops', 'increasedOffItemChance');
		if (interval) modifiers.push('decreasedGlobalSkillIntervalPercent');
		if (mastery) modifiers.push('increasedMasteryTokens', 'increasedXPFromMasteryTokens');
	} else if (type === 'Negative') {
		if (interval) modifiers.push('increasedGlobalSkillIntervalPercent');
	}

	modifiers.push(`${prefix}GlobalSkillXP`, `${prefix}NonCombatSkillXP`, `${prefix}ChanceToLocateSkillPet`, `${prefix}MasteryPoolProgress`);
	if (consumable) modifiers.push(`${prefix}ChanceToPreserveConsumable`);
	if (mastery) modifiers.push(`${prefix}MasteryPoolCap`, `${prefix}GlobalMasteryXP`);
	if (!relic) {
		if (double) modifiers.push(`${prefix}ChanceToDoubleItemsGlobal`);
		if (preservation) modifiers.push(`${prefix}GlobalPreservationChance`);
		if (summon) modifiers.push(`${prefix}SummoningChargePreservation`);
		if (potion) modifiers.push(`${prefix}ChanceToPreservePotionCharge`, `${prefix}PotionChargesFlat`);
	} else
		modifiers.push(`${prefix}ChanceToLocateAncientRelic`, `${prefix}GlobalPreservationChanceBypass`);
	return modifiers;
}
//Modifiers that are in Maps
export function getMappedModifiers(type, skill) {
	let modifiers = [],
		relic = game.currentGamemode.id === 'melvorAoD:AncientRelics',
		preservation = !noPreservation.some((x) => x === skill.id),
		mastery = !noMastery.some((x) => x === skill.id),
		double = !noDoubling.some((x) => x === skill.id),
		prefix = type === 'Positive' ? 'increased' : 'decreased';

	if (type === 'Positive') {
		modifiers.push('decreasedSkillInterval', 'decreasedSkillIntervalPercent', 'increasedSkillMasteryXPPerAmeria', 'increasedSkillMasteryXPPerArachi', 'increasedSkillMasteryXPPerDeedree', 'increasedSkillMasteryXPPerHyden', 'increasedSkillMasteryXPPerIridan', 'increasedSkillMasteryXPPerKo', 'increasedSkillMasteryXPPerQimican', 'increasedSkillMasteryXPPerSyllia', 'increasedSkillMasteryXPPerVale');
		if (!relic) {
			modifiers.push('doubleItemsSkill');
		}
	} else if (type === 'Negative') modifiers.push('increasedSkillInterval', 'increasedSkillIntervalPercent');

	modifiers.push(`${prefix}SkillXP`, `${prefix}ChanceAdditionalSkillResource`);
	if (mastery) modifiers.push(`${prefix}MasteryXP`);
	if (!relic) {
		if (double) modifiers.push(`${prefix}ChanceToDoubleItemsSkill`);
		if (preservation) modifiers.push(`${prefix}SkillPreservationChance`, `${prefix}SkillPreservationCap`);
	}
	return modifiers;
}
//Modifiers that effect specific skills
export function getSkillModifiers(type, skill) {
	let modifiers = [],
		relic = game.currentGamemode.id === 'melvorAoD:AncientRelics',
		inc, dec;
	if (type === 'Positive') {
		inc = `increased`;
		dec = `decreased`;
	} else {
		inc = `decreased`;
		dec = `increased`;
	}
	switch (skill.id) {
		case 'melvorD:Farming': {
			if (type === 'Positive') modifiers.push('freeCompost');
			modifiers.push(`${inc}FarmingYield`, `${dec}AllotmentSeedCost`, `${inc}FlatFarmingYield`, `${inc}CompostPreservationChance`);
		} break;
		case 'melvorD:Township': {
			if (type === 'Positive') modifiers.push('disableTownshipHealthDegradation', 'enableLemonSeason', 'enableNightfallSeason', 'enableSolarEclipseSeason');
			modifiers.push(`${dec}TownshipBuildingCost`, `${inc}TownshipGPProduction`, `${inc}TownshipMaxStorage`, `${inc}TownshipEducation`, `${inc}TownshipHappiness`, `${inc}TownshipHealth`, `${inc}TownshipResourceProduction`, `${dec}TownshipRepairCost`, `${dec}TownshipTraderCost`, `${inc}MinimumTownshipBuildingEfficiency`);
		} break;
		case 'melvorD:Woodcutting': {
			if (type === 'Positive') modifiers.push('summoningSynergy_3_17', 'summoningSynergy_3_19');
			modifiers.push(`${inc}BirdNestDropRate`, `${inc}ChanceForArrowShaftsWoodcutting`, `${inc}ChanceForAshInWoodcutting`, `${inc}ChanceStardustCuttingMagicLogs`, `${inc}ChanceToFindMushroomWoodcutting`, `${inc}MinBirdNestQuantity`, `${inc}MinimumBirdNestsWhenPotionActive`, `${inc}WoodcuttingGemChance`, `${inc}WoodcuttingJewelryChance`, `${inc}WoodcuttingXPAddedAsFiremakingXP`, `${inc}ChanceForChestOfGemsInWoodcutting`, `${inc}TreeCutLimit`);
		} break;
		case 'melvorD:Fishing': {
			if (type === 'Positive') modifiers.push('summoningSynergy_4_5');
			modifiers.push(`${inc}FishingSpecialChance`, `${dec}FishingSpecialChance`, `${inc}BonusFishingSpecialChance`, `${inc}ChanceForOneExtraFish`, `${inc}ChanceToFindLostChest`, `${inc}FishingCookedChance`, `${inc}ChanceToCatchExtraSameAreaFish`, `${inc}ChanceForGPFromFishing`, `${inc}FishermansPotionCharges`);
		} break;
		case 'melvorD:Firemaking': {
			if (type === 'Positive') modifiers.push('freeBonfires', 'summoningSynergy_4_19');
			modifiers.push(`${inc}GPFlat`, `${inc}GPGlobal`, `${inc}GPFromFiremaking`, `${dec}GPFromFiremaking`, `${inc}AdditionalAshInFiremaking`, `${inc}ChanceForAshInFiremaking`, `${inc}ChanceForCharcoalInFiremaking`, `${inc}ChanceForStardustInFiremaking`, `${inc}FiremakingCoalChance`, `${inc}ChanceForDiamondFiremaking`, `${inc}FiremakingLogGP`);
		} break;
		case 'melvorD:Cooking': {
			if (type === 'Positive') modifiers.push('coalGainedOnCookingFailure', 'autoEquipFoodUnlocked', 'summoningSynergy_3_9', 'summoningSynergy_9_17');
			modifiers.push(`${inc}ChancePerfectCookFire`, `${inc}ChancePerfectCookFurnace`, `${inc}ChancePerfectCookGlobal`, `${inc}ChancePerfectCookPot`, `${inc}ChanceSuccessfulCook`, `${dec}FoodBurnChance`, `${inc}CookingSuccessCap`, `${inc}GenerousCookPotionCharges`, `${dec}PassiveCookInterval`, `${dec}SecondaryFoodBurnChance`, `${inc}ChanceAdditionalPerfectItem`, `${inc}ChanceAdditionalSoup`, `${dec}CookingIntervalForBasicSoup`, `${dec}CookingSuccessCap`);
		} break;
		case 'melvorD:Mining': {
			if (type === 'Positive') modifiers.push('summoningSynergy_4_5', 'doubleRuneEssenceMining', 'doubleSilverGoldMining');
			modifiers.push(`${inc}EssenceFromMining`, `${inc}ChanceNoDamageMining`, `${inc}MiningNodeHP`, `${inc}BonusCoalMining`, `${inc}MiningGemChance`, `${inc}ChanceExtraMeteoriteOre`, `${inc}ChanceForOneExtraOre`, `${inc}ChanceForQualitySuperiorGem`, `${inc}GemVeinChance`, `${inc}MeteoriteOre`, `${inc}MiningBarChance`, `${inc}MiningNodeHPWithPerfectSwing`);
		} break;
		case 'melvorD:Smithing': {
			if (type === 'Positive') modifiers.push('summoningSynergy_10_17', 'summoningSynergy_3_17', 'summoningSynergy_9_17');
			modifiers.push(`${inc}SeeingGoldChance`, `${dec}SmithingCoalCost`, `${inc}ChanceAdditionalBarSmithing`, `${dec}FlatSmithingCoalCost`);
		} break;
		case 'melvorD:Thieving': {
			if (type === 'Positive') modifiers.push('autoSwapFoodUnlocked', 'thievingChefNoDamage', 'noDamageFromThievingNPCs');
			modifiers.push(`${inc}GPFlat`, `${inc}GPGlobal`, `${inc}GPFromThievingFlat`, `${inc}MinThievingGP`, `${inc}GPFromThieving`, `${inc}ThievingStealth`, `${dec}ThievingStunIntervalPercent`, `${inc}ThievingAreaUniqueChance`, `${inc}ChanceToAvoidThievingStuns`, `${inc}HerbSackChanceThievingFarmer`, `${inc}RandomBarChanceThievingMiner`, `${inc}RuneEssenceThievingMiner`, `${inc}ThievingAutoSellPrice`, `${inc}FlatMaxHitpoints`, `${inc}AutoEatEfficiency`, `${inc}AutoEatThreshold`, `${inc}MaxHitpoints`, `${inc}FoodHealingValue`);
		} break;
		case 'melvorD:Fletching': {
			modifiers.push(`${inc}BoltProduction`, `${inc}ChanceExtraArrows`, `${inc}ChanceExtraCrossbows`, `${inc}ChanceExtraJavelins`, `${inc}ChanceExtraUnstrungBows`, `${inc}ChanceItemToGoldFletching`, `${inc}FletchingBoltQuantity`, `${dec}FletchingIntervalWithArrows`, `${inc}JavelinProduction`, `${dec}JavelinResourceCost`, `${inc}ArrowProduction`);
		} break;
		case 'melvorD:Crafting': {
			modifiers.push(`${inc}CraftingJewelryRandomGemChance`, `${inc}CraftingPotionCharges`, `${dec}FlatCraftingDragonhideCost`, `${inc}ChanceForGoldFromCrafting30`, `${inc}ChanceForEnchantedUrnInCrafting`, `${inc}BaseCraftingConsumableProduction`);
		} break;
		case 'melvorD:Runecrafting': {
			if (type === 'Positive') modifiers.push('giveRandomComboRunesRunecrafting', 'summoningSynergy_10_17');
			modifiers.push(`${inc}AdditionalRunecraftCountRunes`, `${inc}ElementalRuneGain`, `${inc}ChanceForElementalRune`, `${inc}FireRunesWhenMakingElementalRunes`, `${inc}RunecraftingWaterComboRunes`, `${inc}CombinationRuneProduction`, `${inc}StandardRuneProduction`);
		} break;
		case 'melvorD:Herblore': {
			modifiers.push(`${inc}ChanceRandomPotionHerblore`, `${inc}DeadlyToxinsFromHerblore`, `${inc}PotionsHerblore`, `${inc}SkillMasteryXPPerQimican`);
		} break;
		case 'melvorD:Agility': {
			if (type === 'Positive') modifiers.push('agilityItemCostReductionCanReach100', 'removeDebuffsFromAgility');
			modifiers.push(`${inc}GPFlat`, `${inc}GPGlobal`, `${inc}GPFromAgility`, `${dec}AgilityObstacleCost`, `${dec}AgilityPillarCost`, `${inc}GPFromAgilityPerActiveObstacle`, `${inc}GPFromNegativeObstacles`, `${inc}MasteryXPFromNegativeObstacles`, `${inc}XPFromNegativeObstacles`, `${dec}AgilityObstacleItemCost`);
		} break;
		case 'melvorD:Summoning': {
			if (type === 'Positive') modifiers.push('unlockAllSummoningSynergies', 'disableSalamanderItemReduction');
			modifiers.push(`${dec}SummoningShardCost`, `${inc}SummoningCreationCharges`, `${inc}CyclopsCreationCharges`, `${inc}LeprechaunCreationCharges`, `${dec}NonShardCostForEquippedTablets`, `${inc}SalamanderCreationCharges`, `${inc}SummoningCreationChargesForEquippedTablets`, `${dec}SummoningIntervalForOctopus`, `${dec}SummoningIntervalPercentForEquippedTablets`);
		} break;
		case 'melvorD:Astrology': {
			if (type === 'Positive') modifiers.push('doubleModifiersInAstrologyForMaxedConstellations');
			modifiers.push(`${inc}BaseStardustDropQty`, `${inc}ChanceGoldenStardust`, `${inc}ChanceStardust`, `${inc}ChanceToFindMeteorite`);
		} break;
		case 'melvorD:Magic': {
			modifiers.push(`${inc}GPFromItemAlchemy`, `${inc}GPGlobal`, `${inc}AltMagicSkillXP`, `${inc}RuneProvision`);
		} break;
		case 'melvorAoD:Archaeology': {
			modifiers.push(`${inc}DigSiteMapSlots`, `${inc}ArchaeologyCommonItemSkillXP`, `${inc}BrushToolLevel`, `${inc}ShovelToolLevel`, `${inc}SieveToolLevel`, `${inc}TrowelToolLevel`, `${inc}GPPerArchaeologyLevelNoArtefact`, `${inc}LargeArtefactChance`, `${inc}LargeArtefactValue`, `${inc}MediumArtefactChance`, `${inc}MediumArtefactValue`, `${inc}MinimumItemsFoundInArchaeology`, `${inc}SmallArtefactChance`, `${inc}SmallArtefactValue`, `${inc}TinyArtefactChance`, `${inc}TinyArtefactValue`, `${dec}InitialMapArtefactValues`, `${dec}LargeArtefactValue`, `${dec}MediumArtefactValue`, `${dec}SmallArtefactValue`, `${dec}TinyArtefactValue`);
		} break;
		case 'melvorAoD:Cartography': {
			if (type === 'Positive') modifiers.push('doubleActiveModifiersCartography');
			modifiers.push(`${inc}DigSiteMapCharges`, `${dec}HexTravelCost`, `${inc}InitialMapArtefactValues`, `${dec}MapRefinementCost`, `${inc}MapUpgradeActions`, `${dec}MapUpgradeInterval`, `${dec}PaperMakingInterval`, `${inc}SightRange`, `${dec}SurveyInterval`, `${inc}SurveyRange`, `${inc}SurveyXP`, `${inc}TravelEventChance`);
		} break;
	}
	if (!relic) {
		switch (skill.id) {
			case 'melvorD:Woodcutting': {
				if (type === 'Positive') modifiers.push('doubleLogProduction');
			} break;
			case 'melvorD:Mining': {
				if (type === 'Positive') modifiers.push('doubleOresMining');
				modifiers.push(`${inc}ChanceToDoubleOres`);
			} break;
			case 'melvorD:Smithing': {
				if (type === 'Positive') modifiers.push('doubleSilverGoldSmithingWithSeeingGold');
				modifiers.push(`${inc}SmithingDragonGearPreservation`);
			} break;
			case 'melvorD:Thieving': {
				modifiers.push(`${inc}ChanceToDoubleLootThieving`);
			} break;
			case 'melvorD:Farming': {
				modifiers.push(`${inc}ChanceDoubleHarvest`);
			} break;
			case 'melvorD:Crafting': {
				modifiers.push(`${inc}CraftingJewelryPreservation`, `${inc}ChanceToDoubleLeatherDragonhideCrafting`);
			} break;
			case 'melvorD:Runecrafting': {
				modifiers.push(`${inc}RunecraftingEssencePreservation`, `${inc}RunecraftingStavePreservation`);
			} break;
			case 'melvorD:Magic': {
				modifiers.push(`${inc}AltMagicRunePreservation`, `${inc}RunePreservation`);
			} break;
			case 'melvorAoD:Archaeology': {
				if (type === 'Positive') modifiers.push('archaeologyVeryRareMapPreservation', 'doubleConsumablesArchaeology');
				modifiers.push(`${inc}ChanceToPreserveMapCharges`);
			} break;
		}
	} else {
		switch (skill.id) {
			case 'melvorD:Magic': modifiers.push(`${inc}RunePreservationBypass`);
				break;
		}
	}
	return modifiers;
}

export function hasMappedModifier(itemMods, skill, type) {
	let checkMods = skillBoosts.data.modifierMap.get('Mapped', type, skill.id);
	if (!checkMods)
		return;
	for (var i = 0; i < checkMods.length; i++) {
		if (itemMods[checkMods[i]] !== undefined && itemMods[checkMods[i]].some(x => x.skill === skill))
			return true;
	}
}