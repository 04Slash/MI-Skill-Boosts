let noPreservation = ['melvorD:Attack', 'melvorD:Farming', 'melvorD:Township', 'melvorD:Woodcutting', 'melvorD:Fishing', 'melvorD:Mining', 'melvorD:Thieving', 'melvorD:Agility', 'melvorD:Astrology', 'melvorD:Magic', 'melvorAoD:Archaeology', 'melvorItA:Harvesting'],
	noMastery = ['melvorD:Attack', 'melvorD:Magic', 'melvorAoD:Cartography', 'melvorD:Township'],
	noSummon = ['melvorD:Farming', 'melvorD:Township', 'melvorD:Magic', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noPotion = ['melvorD:Township', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noDoubling = ['melvorD:Township', 'melvorD:Agility'],
	noInterval = ['melvorD:Township', 'melvorD:Attack'], // Combat intervals are added through isCombat
	noConsumable = ['melvorD:Township'],
	isCombat = ['melvorD:Attack'],
	isArtisan = ['melvorD:Cooking', 'melvorD:Smithing', 'melvorD:Fletching', 'melvorD:Crafting', 'melvorD:Runecrafting', 'melvorD:Herblore', 'melvorD:Summoning'];

export function sortModdedSkill(data) {
	if (data.noPreservation) noPreservation.push(data.skill.id);
	if (data.noMastery) noMastery.push(data.skill.id);
	if (data.noSummon) noSummon.push(data.skill.id);
	if (data.noPotion) noPotion.push(data.skill.id);
	if (data.noDoubling) noDoubling.push(data.skill.id);
	if (data.noInterval) noInterval.push(data.skill.id);
	if (data.noConsumable) noConsumable.push(data.skill.id);
	if (data.isCombat) isCombat.push(data.skill.id);
	if (data.isArtisan) isArtisan.push(data.skill.id);
}

export function getCommonModifiers(skillID) {
	let preservation = !noPreservation.some((x) => x === skillID),
		mastery = !noMastery.some((x) => x === skillID),
		summon = !noSummon.some((x) => x === skillID),
		potion = !noPotion.some((x) => x === skillID),
		double = !noDoubling.some((x) => x === skillID),
		interval = !noInterval.some((x) => x === skillID),
		consumable = !noConsumable.some((x) => x === skillID),
		combat = isCombat.some((x) => x === skillID),
		artisan = isArtisan.some((x) => x === skillID),
		modifiers = ['skillPetLocationChance', 'offItemChance', 'itemSaleCurrencyGain', 'currencyGainBasedOnProduct', 'additionalRandomGemChance'];

	if (!combat && double) modifiers.push('additionalRandomSkillItemChancePerInterval', 'additionalPrimaryProductChance', 'additional2PrimaryProductChance', 'additional3PrimaryProductChance', 'additional5PrimaryProductChance', 'additional8PrimaryProductChance', 'flatBasePrimaryProductQuantity', 'flatBasePrimaryProductQuantityChance', 'basePrimaryProductQuantity', 'randomProductChance', 'flatBaseRandomProductQuantity', 'additionalRandomSkillItemChance', 'flatAdditionalSkillItem', 'additionalItemBasedOnPrimaryQuantityChance', 'flatAdditionalPrimaryProductQuantity', 'skillItemDoublingChance', 'doubleItemsSkill');
	if (double) modifiers.push('globalItemDoublingChance', 'bypassDoubleItemsSkill');
	if (summon) modifiers.push('unlockAllSummoningSynergies', 'summoningChargePreservationChance');
	if (potion) modifiers.push('flatPotionCharges', 'potionCharges', 'potionChargePreservationChance');
	if (mastery) modifiers.push('masteryPoolCap', 'masteryXP', 'masteryPoolProgress');
	if (interval) modifiers.push('skillInterval', 'flatSkillInterval', 'halveSkillInterval');
	if (preservation) modifiers.push('bypassGlobalPreservationChance', 'skillPreservationChance');
	if (consumable) modifiers.push('consumablePreservationChance');
	if (artisan) modifiers.push('skillCostReduction');

	if (!game.currentGamemode.disablePreservation)
		modifiers.push('skillPreservationCap'); // Not a disabled modifier so hide it
	if (game.currentGamemode.allowAncientRelicDrops)
		modifiers.push('ancientRelicLocationChance');

	switch (skillID) {
		case 'melvorD:Attack': modifiers.push('maxHit', 'meleeMaxHit', 'rangedMaxHit', 'magicMaxHit', 'flatMaxHit', 'flatMeleeMaxHit', 'flatRangedMaxHit', 'flatMagicMaxHit', 'summoningMaxHit', 'meleeMaxHitAgainstRanged', 'rangedMaxHitAgainstMagic', 'magicMaxHitAgainstMelee', 'maxHitBasedOnTargetCurrentHitpoints', 'meleeAccuracyMaxHitPer8Strength', 'damageBasedOnMaxHitpoints', 'maxHitAgainstDamageType', 'minHitBasedOnMaxHit', 'flatMinHit', 'flatMagicMinHit', 'meleeMinHitBasedOnMaxHit', 'rangedMinHitBasedOnMaxHit', 'magicMinHitBasedOnMaxHit', 'meleeMinHitBasedOnMaxHitSlayerTask', 'rangedMinHitBasedOnMaxHitSlayerTask', 'magicMinHitBasedOnMaxHitSlayerTask', 'maxHitpoints', 'flatMaxHitpoints', 'maxHitpointsAgainstDamageType', 'damageBasedOnCurrentHitpoints', 'attackRolls', 'currentHPDamageTakenOnAttack', 'maxHPDamageTakenOnAttack', 'damageTaken', 'meleeCritChance', 'rangedCritChance', 'magicCritChance', 'meleeProtection', 'rangedProtection', 'magicProtection', 'flatTotalBleedDamage', 'stunDurationIncreaseChance', 'onHitSlowMagnitude', 'flatMeleeStrengthBonusPerAttackInterval', 'flatRangedStrengthBonusPerAttackInterval', 'doubleSlayerTaskKillChance', 'sleepDurationIncreaseChance', 'damageTakenPerAttack', 'flatMinMeteorShowerSpellDamage', 'rangedStrengthBonusPer8Ranged', 'meleeAttackInterval', 'bypassAmmoPreservationChance', 'bypassRunePreservationChance', 'damageDealtWith2Effects', 'unholyMarkOnHit', 'damageTakenBasedOnHP', 'curseOnHitWithUnholyMark', 'damageDealtPerEffect', 'summoningAttackInterval', 'critChance', 'damageTakenPerMissedAttack', 'cantMiss', 'critMultiplier', 'extraLacerationStackChance', 'damageDealtToMonstersInArea', 'damageDealtToBosses', 'damageDealtToSlayerTasks', 'damageDealtToAllMonsters', 'damageDealtToDamageTypeSlayerTasks', 'autoEatThreshold', 'flatMonsterRespawnInterval', 'dungeonEquipmentSwapping', 'equipmentSets', 'autoSlayerUnlocked', 'slayerTaskLength', 'slayerCoinsPerMagicDamageSlayerTask', 'meleeStrengthBonus', 'rangedStrengthBonus', 'magicDamageBonus', 'autoSwapFoodUnlocked', 'allowAttackAugmentingMagic', 'bypassAllSlayerItems', 'allowNonMagicCurses', 'allowUnholyPrayerUse', 'meleeStrengthBonusPer10EnemyDR', 'meleeStrengthBonusWith2HWeapon', 'rangedStrengthBonusWith2HWeapon', 'magicDamageBonusWith2HWeapon', 'slayerTaskExtensionCost', 'flatHiddenSkillLevel', 'flatHiddenSkillLevelPer2Levels', 'flatHiddenSkillLevelBasedOnLevels', 'flatMeleeStrengthBonusBasedOnSkillLevel', 'flatHiddenSkillLevelPer3Levels', 'flatCurrencyGain', 'currencyGain', 'currencyGainFromCombat', 'flatCurrencyGainOnEnemyHit', 'flatCurrencyGainOnHitOnSlayerTask', 'flatCurrencyGainWhenHitBasedOnResistance', 'currencyGainOnMonsterKillBasedOnEvasion', 'currencyGainPerDamageDealt', 'currencyGainPerMeleeDamageDealt', 'currencyGainPerRangedDamageDealt', 'currencyGainPerMagicDamageDealt', 'currencyGainPerMagicDamageDealtOnSlayerTask', 'currencyGainFromMonsterDrops', 'currencyGainFromSlayerTaskMonsterDrops', 'currencyGainPerDamageDealtBasedOnCurrencyAmount', 'minCurrencyMultiplierPerDamage', 'maxCurrencyMultiplierPerDamage', 'flatCurrencyGainOnMonsterKillBasedOnCombatLevel', 'flatResistance', 'flatResistanceAgainstMelee', 'flatResistanceAgainstRanged', 'flatResistanceAgainstMagic', 'flatResistanceAgainstBosses', 'flatResistanceAgainstSlayerTasks', 'flatResistanceWithMagic2HWeapon', 'flatResistancePer30Defence', 'doubleItemsChanceAgainstDamageType', 'attackInterval', 'flatAttackInterval', 'halveAttackInterval', 'rangedAttackInterval', 'magicAttackInterval', 'bypassSlayerItems', 'autoLooting', 'autoBurying', 'summoningChargePreservationChanceBypass', 'doubleRuneProvision', 'allowLootContainerStacking', 'flatMeleeStrengthBonus', 'flatRangedStrengthBonus', 'currencyGainFromSlayerTasks', 'flatSpellRuneCost', 'flatAttackSpellRuneCost', 'combatLootDoublingChance', 'prayerPointPreservationChancePerPoint', 'prayerPointPreservationChance', 'ammoPreservationChance', 'runePreservationChance', 'unholyPrayerPointPreservationChance', 'effectIgnoreChance', 'convertMissIntoHit', 'strongholdEquipmentSwapping', 'flatStabAttackBonus', 'flatSlashAttackBonus', 'flatBlockAttackBonus', 'flatRangedAttackBonus', 'flatMagicAttackBonus', 'slayerTaskCost', 'slashAttackBonus', 'accuracyRating', 'meleeAccuracyRating', 'rangedAccuracyRating', 'magicAccuracyRating', 'reflectDamage', 'dragonBreathDamage', 'flatReflectDamage', 'rolledReflectDamage', 'damageDealt', 'lifesteal', 'meleeLifesteal', 'rangedLifesteal', 'magicLifesteal', 'bleedLifesteal', 'burnLifesteal', 'poisonLifesteal', 'effectImmunity', 'sleepImmunity', 'rebirthChance', 'otherStyleImmunity', 'meleeImmunity', 'rangedImmunity', 'magicImmunity', 'flatMeleeAccuracyBonusPerAttackInterval', 'flatRangedAccuracyBonusPerAttackInterval', 'flatMagicAccuracyBonusPerAttackInterval', 'accuracyRatingHPScaling', 'stunAvoidChance', 'frostburnDamage', 'curseLifesteal', 'doubleLifesteal', 'maxHPBurnDamage', 'disableLifesteal', 'burnDOTDamageTaken', 'bleedDOTDamageTaken', 'poisonDOTDamageTaken', 'deadlyPoisonDOTDamageTaken', 'disableAttackDamage', 'cleansed', 'dodgeChance', 'lifestealDamageBasedOnCurrentHitpoints', 'cantAttack', 'cantEvade', 'cantSpecialAttack', 'lacerationLifesteal', 'rawReflectDamage', 'ablazeDOTDamageTakenIfCorrupted', 'dotDamageTaken', 'damageBasedOnMaxHitpointsSelf', 'toxinDOTDamageTaken', 'ablazeDOTDamageTaken', 'ablazeLifesteal', 'toxinLifesteal', 'lacerationDOTDamageTaken', 'voidburstDOTDamageTaken', 'seedDropConversionChance', 'summoningAttackLifesteal', 'itemProtection', 'redemptionThreshold', 'redemptionHealing', 'freeProtectItem', 'meleeAccuracyRatingWith2H', 'accuracyRatingAgainstDamageType', 'flatCurrencyGainFromMonsterDrops', 'currencyGainFromLifesteal', 'currencyGainFromMonsterDropsBasedOnDebuffs', 'flatCurrencyGainFromMeleeSlayerTasksBasedOnCombatLevel', 'flatCurrencyGainFromRangedSlayerTasksBasedOnCombatLevel', 'flatCurrencyGainFromMagicSlayerTasksBasedOnCombatLevel', 'currencyGainBasedOnSummonDamage', 'currencyGainBasedOnBarrierDamage', 'flatCurrencyGainOnEnemyHitBasedOnCombatLevel', 'currencyGainPerPoisonDamage'); break;
		case 'melvorD:Farming': modifiers.push('bypassCompostPreservationChance', 'skillMasteryXPPerDeedree', 'freeCompost', 'compostPreservationChance', 'farmingSeedCost', 'flatFarmingSeedCost', 'farmingCropsCannotDie', 'farmingSeedReturn'); break;
		case 'melvorD:Woodcutting': modifiers.push('skillMasteryXPPerDeedree', 'treeCutLimit'); break;
		case 'melvorD:Fishing': modifiers.push('skillMasteryXPPerAmeria', 'fishingSpecialChance', 'bonusFishingSpecialChance', 'additionalSameAreaFishChance', 'fishingCookedChance', 'fishingAdditionalSpecialItemChance', 'cannotFishJunk', 'currencyGainFromRawFishSales', 'fishingCurrencyGainChance', 'fishingMasteryDoublingChance'); break;
		case 'melvorD:Firemaking': modifiers.push('skillMasteryXPPerAmeria', 'flatCurrencyGain', 'currencyGain', 'freeBonfires', 'firemakingBonfireInterval', 'currencyGainFromLogSales', 'firemakingLogCurrencyGain'); break;
		case 'melvorD:Cooking': modifiers.push('skillMasteryXPPerVale', 'flatCoalGainedOnCookingFailure', 'perfectCookChance', 'successfulCookChance', 'cookingSuccessCap', 'passiveCookingInterval', 'additionalPerfectItemChance'); break;
		case 'melvorD:Mining': modifiers.push('flatMiningNodeHP', 'miningNodeRespawnInterval', 'miningGemChance', 'miningBarChance'); break;
		case 'melvorD:Smithing': modifiers.push('skillMasteryXPPerIridan'); break;
		case 'melvorD:Thieving': modifiers.push('maxHitpoints', 'flatMaxHitpoints', 'skillMasteryXPPerKo', 'autoEatThreshold', 'flatCurrencyGain', 'currencyGain', 'autoSwapFoodUnlocked', 'thievingAreaUniqueChance', 'thievingAreaUniqueChancePercent', 'thievingAutoSellPrice', 'thievingStealth', 'ignoreThievingDamageChance', 'thievingStunInterval', 'thievingStunAvoidanceChance', 'ignoreThievingDamage', 'flatThievingCurrencyGain', 'minThievingCurrencyGain', 'flatAdditionalThievingCommonDropQuantity'); break;
		case 'melvorD:Fletching': modifiers.push('skillMasteryXPPerSyllia', 'fletchingItemToCurrencyChance'); break;
		case 'melvorD:Crafting': modifiers.push('skillMasteryXPPerHyden', 'crafting30CurrencyGainChance'); break;
		case 'melvorD:Runecrafting': modifiers.push('skillMasteryXPPerArachi'); break;
		case 'melvorD:Herblore': modifiers.push('skillMasteryXPPerQimican', 'randomHerblorePotionChance'); break;
		case 'melvorD:Agility': modifiers.push('flatCurrencyGain', 'currencyGain', 'agilityObstacleCost', 'agilityObstacleCurrencyCost', 'agilityObstacleItemCost', 'agilityPillarCost', 'agilityItemCostReductionCanReach100', 'removeDebuffsFromAgility', 'currencyGainFromNegativeObstacles', 'currencyGainFromAgilityPerActiveObstacle', 'summoningSynergy_Devil_Eagle'); break;
		case 'melvorD:Summoning': modifiers.push('skillMasteryXPPerQimican', 'flatSummoningShardCost', 'flatTier1SummoningShardCost', 'flatTier2SummoningShardCost', 'flatTier3SummoningShardCost', 'nonShardSummoningCostReduction'); break;
		case 'melvorD:Astrology': modifiers.push('astrologyModifierCost'); break;
		case 'melvorD:Magic': modifiers.push('currencyGain', 'doubleRuneProvision', 'flatSpellRuneCost', 'flatAttackSpellRuneCost', 'altMagicRunePreservationChance', 'runePreservationChance'); break;
	}
	modifiers.forEach((modifier, i) => {
		if (!modifier.startsWith('melvor'))
			modifiers[i] = 'melvorD:' + modifier;
	});
	return modifiers;
}


export function getMelvorModifiers(skillID) {
	let combat = isCombat.some((x) => x === skillID),
		mastery = !noMastery.some((x) => x === skillID),
		modifiers = ['allowSignetDrops', 'skillXP'];

	if (!combat) modifiers.push('nonCombatSkillXP');
	if (mastery) modifiers.push('flatMasteryTokens', 'xpFromMasteryTokens');

	switch (skillID) {
		case 'melvorD:Attack': modifiers.push('flatSlayerAreaEffectNegation', 'flatPrayerPointsWhenHit', 'damageTakenAddedAsPrayerPoints', 'magicMaxHitWithActivePrayer', 'maxHitBasedOnPrayerCost', 'flatPrayerPointsPerMonsterKill', 'flatPrayerPointCost', 'prayerPointCost', 'flatPrayerPointsFromBurying', 'prayerPointsFromBurying', 'flatResistanceWithActivePrayer', 'flatBarrierSummonDamage', 'barrierSummonDamage', 'flatBarrierSummonDamageMelee', 'flatBarrierSummonDamageRanged', 'flatBarrierSummonDamageMagic', 'barrierSummonDamageIfSlayerTask', 'flatBarrierDamage', 'flatSummoningAttackInterval', 'cantRegenBarrier', 'doubleBoneDrops', 'prayerPointPreservationChancePerPoint', 'prayerPointPreservationChance', 'unholyPrayerPointPreservationChance'); break;
		case 'melvorD:Township': modifiers.push('disableTownshipHealthDegradation', 'enableLemonSeason', 'enableNightfallSeason', 'enableSolarEclipseSeason', 'townshipBuildingCost', 'townshipGPProduction', 'townshipMaxStorage', 'townshipHealth', 'townshipResourceProduction', 'townshipRepairCost', 'townshipTraderCost', 'minimumTownshipBuildingEfficiency', 'flatTownshipPopulation', 'flatTownshipHappiness', 'flatTownshipEducation', 'townshipBuildingProduction', 'townshipTaxPerCitizen', 'townshipDisableHunting', 'townshipCoalUsage', 'townshipBuildingHappinessPenalties', 'townshipFoodUsage', 'townshipTraderStock'); break;
		case 'melvorD:Woodcutting': modifiers.push('woodcuttingXPAddedAsFiremakingXP', 'woodcuttingArrowShaftChance', 'woodcuttingJewelryChance'); break;
		case 'melvorD:Fishing': modifiers.push('summoningSynergy_4_5'); break;
		case 'melvorD:Mining': modifiers.push('summoningSynergy_4_5', 'noMiningNodeDamageChance', 'bonusCoalMining', 'qualitySuperiorGemChance', 'gemVeinChance'); break;
		case 'melvorD:Smithing': modifiers.push('smithingCoalCost', 'flatSmithingCoalCost', 'removeSmithingCoalCosts'); break;
		case 'melvorD:Thieving': modifiers.push('thievingFarmerHerbSackChance', 'thievingMinerRandomBarChance', 'summoningSynergy_Ent_Leprechaun', 'summoningSynergy_Octopus_Leprechaun', 'summoningSynergy_Leprechaun_Devil'); break;
		case 'melvorD:Crafting': modifiers.push('craftingEnchantedUrnChance', 'flatCraftingDragonhideCost'); break;
		case 'melvorD:Runecrafting': modifiers.push('giveRandomComboRunesRunecrafting', 'runecraftingBaseXPForRunes', 'runecraftingRuneCostReduction', 'elementalRuneChance', 'elementalRuneQuantity'); break;
		case 'melvorD:Agility': modifiers.push('xpFromNegativeObstacles', 'masteryXPFromNegativeObstacles', 'halveAgilityObstacleNegatives'); break;
		case 'melvorD:Summoning': modifiers.push('disableSalamanderItemReduction'); break;
		case 'melvorD:Astrology': modifiers.push('meteoriteLocationChance', 'doubleModifiersInAstrologyForMaxedConstellations'); break;
		case 'melvorD:Magic': modifiers.push('altMagicSkillXP', 'gpFromItemAlchemy', 'flatAdditionalHolyDustFromBlessedOffering', 'bypassRunePreservationChance'); break;
		case 'melvorAoD:Archaeology': modifiers.push('melvorAoD:digSiteMapSlots', 'melvorAoD:artefactValue', 'melvorAoD:mapChargePreservationChance', 'archaeologyCommonItemSkillXP', 'brushToolLevel', 'shovelToolLevel', 'sieveToolLevel', 'trowelToolLevel', 'largeArtefactChance', 'largeArtefactValue', 'mediumArtefactChance', 'mediumArtefactValue', 'smallArtefactChance', 'smallArtefactValue', 'tinyArtefactChance', 'tinyArtefactValue', 'doubleConsumablesArchaeology', 'archaeologyVeryRareMapPreservation'); break;
		case 'melvorAoD:Cartography': modifiers.push('doubleActiveModifiersCartography', 'flatDigSiteMapCharges', 'cartographyTravelCost', 'cartographyMapUpgradeInterval', 'cartographyPaperMakingInterval', 'cartographySightRange', 'cartographySurveyInterval', 'cartographySurveyRange', 'cartographySurveyXP', 'initialMapArtefactValues', 'travelEventChance', 'mapUpgradeActions', 'mapRefinementCost', 'flatCurrencyGainPerArchaeologyLevelNoArtefact'); break;
	}
	modifiers.forEach((modifier, i) => {
		if (!modifier.startsWith('melvor'))
			modifiers[i] = 'melvorD:' + modifier;
	});
	return modifiers;
}

export function getAbyssalModifiers(skillID) {
	let combat = isCombat.some((x) => x === skillID),
		modifiers = ['abyssalSkillXP'];

	if (!combat) modifiers.push('additionalRandomAbyssalGemChance', 'additionalRandomAbyssalGemChancePerInterval');
	else if (combat) modifiers.push('abyssalCombatSkillXP');

	switch (skillID) {
		case 'melvorD:Attack': modifiers.push('flatAbyssalSlayerAreaEffectNegation', 'bonusCorruptionChance', 'corruptionCounterRate', 'instantCorruptionChance', 'flatSoulPointsPerMonsterKill', 'flatSoulPointCost', 'maxHitWith2AbyssalPrayers', 'flatSoulPointsWhenHit', 'abyssalPrayerCost', 'flatCombatAXPAgainstCorruptedMonsters', 'permanentCorruptionCost', 'resistance', 'maxHitBasedOnResistance', 'maxHitBasedOnTargetResistance', 'meleeStrengthBonusPer10EnemyResistance', 'ignoreResistanceWhenAttackingChance', 'doubleSoulDropChance', 'soulPointPreservationChanceBypass', 'soulPointCost', 'flatSoulPointsFromReleasing', 'doubleSoulDrops', 'soulPointPreservationChance', 'extraCorruptions'); break;
		case 'melvorD:Farming': modifiers.push('regainAbyssalTreeSeedChance'); break;
		case 'melvorD:Township': modifiers.push('townshipMaxSoulStorage', 'abyssalWaveAPGain', 'abyssalWaveASCGain', 'enableEternalDarknessSeason'); break;
		case 'melvorD:Woodcutting': modifiers.push('woodcuttingDrakeNestJewelryChance', 'woodcuttingAXPAddedAsFiremakingAXP'); break;
		case 'melvorD:Fishing': modifiers.push('useNoSummoningChargesAbyssalOctopus'); break;
		case 'melvorD:Firemaking': modifiers.push('additionalRandomFragmentChance', 'additionalRandomFiremakingOilChance'); break;
		case 'melvorD:Cooking': modifiers.push('flatAbyssalGemsGainedOnCookingFailure'); break;
		case 'melvorD:Mining': modifiers.push('abyssalGemChance', 'miningNodeRespawnInterval', 'abyssalGemVeinChanceIncrease', 'additionalAbyssalGemChance'); break;
		case 'melvorD:Thieving': modifiers.push('flatDrakeNestsFromThievingTreant', 'randomBarThievingWitheringRuinsChance', 'summoningSynergy_Abyssal_Leprechaun_Devil'); break;
		case 'melvorD:Runecrafting': modifiers.push('runecraftingBaseAXPForRunes'); break;
		case 'melvorD:Astrology': modifiers.push('starFallChance'); break;
		case 'melvorItA:Harvesting': modifiers.push('melvorItA:maxHarvestingIntensity', 'melvorItA:noHarvestingIntensityDecay', 'flatHarvestingIntensity', 'minimumHarvestingIntensity', 'disableHarvestingVeinDegen', 'currencyFromHarvestingChanceBasedOnLevel', 'doubleHarvestingIntensityChance', 'summoningSynergy_Imp_Devil', 'harvestingUniqueProductChance'); break;
	}
	modifiers.forEach((modifier, i) => {
		if (!modifier.startsWith('melvor'))
			modifiers[i] = 'melvorD:' + modifier;
	});
	return modifiers;
}