let noPreservation = ['melvorD:Attack', 'melvorD:Farming', 'melvorD:Township', 'melvorD:Woodcutting', 'melvorD:Fishing', 'melvorD:Mining', 'melvorD:Thieving', 'melvorD:Agility', 'melvorD:Astrology', 'melvorD:Magic', 'melvorAoD:Archaeology'],
	noMastery = ['melvorD:Attack', 'melvorD:Magic', 'melvorAoD:Cartography', 'melvorD:Township'],
	noSummon = ['melvorD:Farming', 'melvorD:Township', 'melvorD:Magic', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noPotion = ['melvorD:Township', 'melvorAoD:Cartography', 'melvorAoD:Archaeology'],
	noDoubling = ['melvorD:Township'],
	noInterval = ['melvorD:Township', 'melvorD:Attack'], // Combat intervals are added through isCombat
	noConsumable = ['melvorD:Township'],
	isCombat = ['melvorD:Attack'],
	isArtisan = ['melvorD:Cooking', 'melvorD:Smithing', 'melvorD:Fletching', 'melvorD:Runecrafting', 'melvorD:Herblore', 'melvorD:Summoning'];

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

function getCommonModifiers(skill) {
	let preservation = !noPreservation.some((x) => x === skill.id),
		mastery = !noMastery.some((x) => x === skill.id),
		summon = !noSummon.some((x) => x === skill.id),
		potion = !noPotion.some((x) => x === skill.id),
		double = !noDoubling.some((x) => x === skill.id),
		interval = !noInterval.some((x) => x === skill.id),
		consumable = !noConsumable.some((x) => x === skill.id),
		combat = isCombat.some((x) => x === skill.id),
		modifiers = ['allowSignetDrops', 'skillPetLocationChance', 'offItemChance', 'itemSaleCurrencyGain', 'currencyGainBasedOnProduct', 'additionalRandomGemChance'];

	if (!combat) modifiers.push('additionalRandomSkillItemChancePerInterval', 'additionalPrimaryProductChance', 'additional2PrimaryProductChance', 'additional3PrimaryProductChance', 'additional5PrimaryProductChance', 'additional8PrimaryProductChance', 'flatBasePrimaryProductQuantity', 'flatBasePrimaryProductQuantityChance', 'basePrimaryProductQuantity', 'randomProductChance', 'flatBaseRandomProductQuantity', 'additionalRandomSkillItemChance', 'flatAdditionalSkillItem', 'additionalItemBasedOnPrimaryQuantityChance', 'flatAdditionalPrimaryProductQuantity', 'skillItemDoublingChance', 'doubleItemsSkill');
	if (double) modifiers.push('globalItemDoublingChance');
	if (summon) modifiers.push('unlockAllSummoningSynergies', 'summoningChargePreservationChance');
	if (potion) modifiers.push('flatPotionCharges', 'potionCharges', 'potionChargePreservationChance');
	if (mastery) modifiers.push('masteryPoolCap', 'masteryXP', 'masteryPoolProgress');
	if (interval) modifiers.push('skillInterval', 'flatSkillInterval', 'halveSkillInterval');
	if (preservation) modifiers.push('bypassGlobalPreservationChance', 'skillPreservationChance');
	if (consumable) modifiers.push('consumablePreservationChance');

	if (!game.currentGamemode.disablePreservation)
		modifiers.push('skillPreservationCap'); // Not a disabled modifier so hide it
	if (game.currentGamemode.allowAncientRelicDrops)
		modifiers.push('ancientRelicLocationChance');

	switch (skill.id) {
		case 'melvorD:Attack': modifiers.push('maxHit', 'meleeMaxHit', 'rangedMaxHit', 'magicMaxHit', 'flatMaxHit', 'flatMeleeMaxHit', 'flatRangedMaxHit', 'flatMagicMaxHit', 'summoningMaxHit', 'meleeMaxHitAgainstRanged', 'rangedMaxHitAgainstMagic', 'magicMaxHitAgainstMelee', 'maxHitBasedOnTargetCurrentHitpoints', 'meleeAccuracyMaxHitPer8Strength', 'damageBasedOnMaxHitpoints', 'maxHitAgainstDamageType', 'minHitBasedOnMaxHit', 'flatMinHit', 'flatMagicMinHit', 'meleeMinHitBasedOnMaxHit', 'rangedMinHitBasedOnMaxHit', 'magicMinHitBasedOnMaxHit', 'meleeMinHitBasedOnMaxHitSlayerTask', 'rangedMinHitBasedOnMaxHitSlayerTask', 'magicMinHitBasedOnMaxHitSlayerTask', 'maxHitpoints', 'flatMaxHitpoints', 'maxHitpointsAgainstDamageType', 'damageBasedOnCurrentHitpoints', 'attackRolls', 'currentHPDamageTakenOnAttack', 'maxHPDamageTakenOnAttack', 'damageTaken', 'meleeCritChance', 'rangedCritChance', 'magicCritChance', 'meleeProtection', 'rangedProtection', 'magicProtection', 'flatTotalBleedDamage', 'stunDurationIncreaseChance', 'onHitSlowMagnitude', 'flatMeleeStrengthBonusPerAttackInterval', 'flatRangedStrengthBonusPerAttackInterval', 'doubleSlayerTaskKillChance', 'sleepDurationIncreaseChance', 'damageTakenPerAttack', 'flatMinMeteorShowerSpellDamage', 'rangedStrengthBonusPer8Ranged', 'meleeAttackInterval', 'bypassAmmoPreservationChance', 'bypassRunePreservationChance', 'damageDealtWith2Effects', 'unholyMarkOnHit', 'damageTakenBasedOnHP', 'curseOnHitWithUnholyMark', 'damageDealtPerEffect', 'summoningAttackInterval', 'critChance', 'damageTakenPerMissedAttack', 'cantMiss', 'critMultiplier', 'extraLacerationStackChance', 'damageDealtToBosses', 'damageDealtToSlayerTasks', 'damageDealtToCombatAreaMonsters', 'damageDealtToDungeonMonsters', 'damageDealtToAllMonsters', 'autoEatThreshold', 'flatMonsterRespawnInterval', 'dungeonEquipmentSwapping', 'equipmentSets', 'autoSlayerUnlocked', 'slayerTaskLength', 'slayerCoinsPerMagicDamageSlayerTask', 'meleeStrengthBonus', 'rangedStrengthBonus', 'magicDamageBonus', 'autoSwapFoodUnlocked', 'allowAttackAugmentingMagic', 'bypassAllSlayerItems', 'allowNonMagicCurses', 'allowUnholyPrayerUse', 'meleeStrengthBonusPer10EnemyDR', 'meleeStrengthBonusWith2HWeapon', 'rangedStrengthBonusWith2HWeapon', 'magicDamageBonusWith2HWeapon', 'slayerTaskExtensionCost', 'flatHiddenSkillLevel', 'flatHiddenSkillLevelPer2Levels', 'flatHiddenSkillLevelBasedOnLevels', 'flatMeleeStrengthBonusBasedOnSkillLevel', 'flatHiddenSkillLevelPer3Levels', 'flatCurrencyGain', 'currencyGain', 'currencyGainFromCombat', 'flatCurrencyGainOnEnemyHit', 'flatCurrencyGainOnHitOnSlayerTask', 'flatCurrencyGainWhenHitBasedOnResistance', 'currencyGainOnMonsterKillBasedOnEvasion', 'currencyGainPerDamageDealt', 'currencyGainPerMeleeDamageDealt', 'currencyGainPerRangedDamageDealt', 'currencyGainPerMagicDamageDealt', 'currencyGainPerMagicDamageDealtOnSlayerTask', 'currencyGainFromMonsterDrops', 'currencyGainFromSlayerTaskMonsterDrops', 'currencyGainPerDamageDealtBasedOnCurrencyAmount', 'minCurrencyMultiplierPerDamage', 'maxCurrencyMultiplierPerDamage', 'flatCurrencyGainOnMonsterKillBasedOnCombatLevel', 'flatResistance', 'flatResistanceAgainstMelee', 'flatResistanceAgainstRanged', 'flatResistanceAgainstMagic', 'flatResistanceAgainstBosses', 'flatResistanceAgainstSlayerTasks', 'flatResistanceWithMagic2HWeapon', 'flatResistancePer30Defence', 'doubleItemsChanceAgainstDamageType', 'damageDealtToDamageTypeSlayerTasks', 'attackInterval', 'flatAttackInterval', 'halveAttackInterval', 'rangedAttackInterval', 'magicAttackInterval', 'bypassSlayerItems', 'autoLooting', 'autoBurying', 'summoningChargePreservationChanceBypass', 'doubleRuneProvision', 'allowLootContainerStacking', 'flatMeleeStrengthBonus', 'flatRangedStrengthBonus', 'currencyGainFromSlayerTasks', 'flatSpellRuneCost', 'flatAttackSpellRuneCost', 'combatLootDoublingChance', 'prayerPointPreservationChancePerPoint', 'prayerPointPreservationChance', 'ammoPreservationChance', 'runePreservationChance', 'unholyPrayerPointPreservationChance'); break;
		case 'melvorD:Farming': modifiers.push('freeCompost', 'compostPreservationChance', 'farmingYield', 'flatFarmingYield', 'flatAllotmentSeedCost', 'farmingSeedCost', 'flatFarmingSeedCost', 'farmingCropsCannotDie', 'farmingSeedReturn', 'farmingDoubleHarvestChance'); break;
		// case 'melvorD:Township': modifiers.push(); break;
		case 'melvorD:Woodcutting': modifiers.push('treeCutLimit', 'doubleLogProduction'); break;
		case 'melvorD:Fishing': modifiers.push('fishingSpecialChance', 'bonusFishingSpecialChance', 'additionalFishChance', 'additionalSameAreaFishChance', 'fishingCookedChance', 'fishingAdditionalSpecialItemChance', 'cannotFishJunk', 'currencyGainFromRawFishSales', 'fishingCurrencyGainChance', 'fishingMasteryDoublingChance'); break;
		case 'melvorD:Firemaking': modifiers.push('flatCurrencyGain', 'currencyGain', 'freeBonfires', 'firemakingBonfireInterval', 'currencyGainFromLogSales', 'firemakingLogCurrencyGain'); break;
		case 'melvorD:Cooking': modifiers.push('flatCoalGainedOnCookingFailure', 'perfectCookChance', 'firePerfectCookChance', 'furnacePerfectCookChance', 'potPerfectCookChance', 'successfulCookChance', 'cookingSuccessCap', 'passiveCookingInterval', 'additionalPerfectItemChance', 'additionalSoupChance', 'cookingIntervalForBasicSoup'); break;
		case 'melvorD:Mining': modifiers.push('additionalMiningOreChance', 'flatAdditionalOresMining', 'flatMiningNodeHP', 'miningNodeRespawnInterval', 'miningGemChance', 'miningBarChance', 'oreDoublingChance'); break;
		case 'melvorD:Smithing': modifiers.push('smithingAdditionalBarChance'); break;
		case 'melvorD:Thieving': modifiers.push('autoEatThreshold', 'flatCurrencyGain', 'currencyGain', 'autoSwapFoodUnlocked', 'thievingAreaUniqueChance', 'thievingAreaUniqueChancePercent', 'thievingAutoSellPrice', 'thievingStealth', 'ignoreThievingDamageChance', 'noThievingDamageChance', 'thievingStunInterval', 'thievingStunAvoidanceChance', 'ignoreThievingDamage', 'flatThievingCurrencyGain', 'minThievingCurrencyGain', 'flatAdditionalThievingCommonDropQuantity'); break;
		case 'melvorD:Fletching': modifiers.push('fletchingItemToCurrencyChance'); break;
		case 'melvorD:Crafting': modifiers.push('baseCraftingConsumableProduction', 'craftingConsumableCost', 'crafting30CurrencyGainChance', 'doubleConsumablesCrafting', 'craftingJewelryPreservationChance'); break;
		case 'melvorD:Runecrafting': modifiers.push('additionalRunecraftCountRunes', 'flatRunecraftingRuneQuantity', 'runecraftingEssencePreservationChance', 'runecraftingStaveResourcePreservationChance'); break;
		case 'melvorD:Herblore': modifiers.push('flatAdditionalPotionsHerblore', 'randomHerblorePotionChance'); break;
		case 'melvorD:Agility': modifiers.push('flatCurrencyGain', 'currencyGain', 'agilityObstacleCost', 'agilityObstacleCurrencyCost', 'agilityObstacleItemCost', 'agilityPillarCost', 'agilityItemCostReductionCanReach100', 'removeDebuffsFromAgility', 'currencyGainFromNegativeObstacles', 'currencyGainFromAgilityPerActiveObstacle', 'summoningSynergy_Devil_Eagle'); break;
		case 'melvorD:Summoning': modifiers.push('flatBaseSummoningTabletQuantity', 'flatSummoningBaseQuantityForEquippedTablets', 'flatSummoningShardCost', 'summoningIntervalForEquippedTablets', 'flatTier1SummoningShardCost', 'flatTier2SummoningShardCost', 'flatTier3SummoningShardCost', 'nonShardCostForEquippedTablets', 'nonShardSummoningCostReduction'); break;
		case 'melvorD:Astrology': modifiers.push('astrologyModifierCost'); break;
		case 'melvorD:Magic': modifiers.push('currencyGain', 'doubleRuneProvision', 'flatSpellRuneCost', 'flatAttackSpellRuneCost', 'altMagicRunePreservationChance', 'runePreservationChance'); break;
	}
	return modifiers;
}


export function getMelvorModifiers(skill) {
	let combat = isCombat.some((x) => x === skill.id),
		mastery = !noMastery.some((x) => x === skill.id),
		modifiers = [...getCommonModifiers(skill), 'skillXP'];

	if (!combat) modifiers.push('nonCombatSkillXP');
	if (mastery) modifiers.push('flatMasteryTokens', 'xpFromMasteryTokens');

	switch (skill.id) {
		case 'melvorD:Attack': modifiers.push('enemyDamageReduction', 'flatSlayerAreaEffectNegation', 'damageDealtToSlayerAreaMonsters', 'flatPrayerPointsWhenHit', 'damageTakenAddedAsPrayerPoints', 'magicMaxHitWithActivePrayer', 'maxHitBasedOnPrayerCost', 'flatPrayerPointsPerMonsterKill', 'flatPrayerPointCost', 'prayerPointCost', 'flatPrayerPointsFromBurying', 'prayerPointsFromBurying', 'flatResistanceWithActivePrayer', 'flatBarrierSummonDamage', 'barrierSummonDamage', 'flatBarrierSummonDamageMelee', 'flatBarrierSummonDamageRanged', 'flatBarrierSummonDamageMagic', 'barrierSummonDamageIfSlayerTask', 'flatBarrierDamage', 'flatSummoningAttackInterval', 'cantRegenBarrier', 'doubleBoneDrops', 'prayerPointPreservationChancePerPoint', 'prayerPointPreservationChance', 'unholyPrayerPointPreservationChance'); break;
		case 'melvorD:Farming': modifiers.push('skillMasteryXPPerDeedree'); break;
		case 'melvorD:Township': modifiers.push('disableTownshipHealthDegradation', 'enableLemonSeason', 'enableNightfallSeason', 'enableSolarEclipseSeason', 'townshipBuildingCost', 'townshipGPProduction', 'townshipMaxStorage', 'townshipEducation', 'townshipHappiness', 'townshipHealth', 'townshipResourceProduction', 'townshipRepairCost', 'townshipTraderCost', 'minimumTownshipBuildingEfficiency', 'flatTownshipPopulation', 'flatTownshipHappiness', 'flatTownshipEducation', 'townshipBuildingProduction', 'townshipTaxPerCitizen', 'townshipDisableHunting', 'townshipCoalUsage', 'townshipBuildingHappinessPenalties', 'townshipFoodUsage', 'townshipTraderStock'); break;
		case 'melvorD:Woodcutting': modifiers.push('summoningSynergy_3_17', 'woodcuttingXPAddedAsFiremakingXP', 'woodcuttingArrowShaftChance', 'woodcuttingJewelryChance', 'skillMasteryXPPerDeedree'); break;
		case 'melvorD:Fishing': modifiers.push('summoningSynergy_4_5', 'lostChestChance', 'skillMasteryXPPerAmeria'); break;
		case 'melvorD:Firemaking': modifiers.push('skillMasteryXPPerAmeria'); break;
		case 'melvorD:Cooking': modifiers.push('skillMasteryXPPerVale'); break;
		case 'melvorD:Mining': modifiers.push('summoningSynergy_4_5', 'doubleSilverGoldMining', 'noMiningNodeDamageChance', 'bonusCoalMining', 'miningNodeHPWithPerfectSwing', 'additionalMeteoriteOreChance', 'qualitySuperiorGemChance', 'flatMeteoriteOre', 'gemVeinChance', 'doubleOresMining'); break;
		case 'melvorD:Smithing': modifiers.push('summoningSynergy_3_17', 'seeingGoldChance', 'smithingCoalCost', 'flatSmithingCoalCost', 'skillMasteryXPPerIridan', 'doubleSilverGoldSmithingWithSeeingGold', 'smithingDragonGearPreservationChance'); break;
		case 'melvorD:Thieving': modifiers.push('runeEssenceThievingMiner', 'thievingFarmerHerbSackChance', 'thievingMinerRandomBarChance', 'skillMasteryXPPerKo', 'summoningSynergy_Ent_Leprechaun', 'summoningSynergy_Octopus_Leprechaun', 'summoningSynergy_Leprechaun_Devil'); break;
		case 'melvorD:Fletching': modifiers.push('flatFletchingIntervalWithArrows', 'javelinResourceCost', 'skillMasteryXPPerSyllia'); break;
		case 'melvorD:Crafting': modifiers.push('craftingEnchantedUrnChance', 'craftingJewelryRandomGemChance', 'flatCraftingDragonhideCost', 'skillMasteryXPPerHyden', 'leatherDragonhideCraftingDoubleChance'); break;
		case 'melvorD:Runecrafting': modifiers.push('giveRandomComboRunesRunecrafting', 'runecraftingBaseXPForRunes', 'runecraftingStaveCost', 'runecraftingWandCost', 'runecraftingWaterComboRunes', 'runecraftingRuneCostReduction', 'combinationRuneProduction', 'elementalRuneChance', 'elementalRuneQuantity', 'fireRunesWhenMakingElementalRunes', 'standardRuneProduction', 'skillMasteryXPPerArachi'); break;
		case 'melvorD:Herblore': modifiers.push('deadlyToxinsFromHerblore', 'skillMasteryXPPerQimican'); break;
		case 'melvorD:Agility': modifiers.push('xpFromNegativeObstacles', 'masteryXPFromNegativeObstacles', 'halveAgilityObstacleNegatives'); break;
		case 'melvorD:Summoning': modifiers.push('disableSalamanderItemReduction', 'skillMasteryXPPerQimican'); break;
		case 'melvorD:Astrology': modifiers.push('meteoriteLocationChance', 'doubleModifiersInAstrologyForMaxedConstellations'); break;
		case 'melvorD:Magic': modifiers.push('altMagicSkillXP', 'gpFromItemAlchemy', 'flatAdditionalHolyDustFromBlessedOffering', 'bypassRunePreservationChance'); break;
		case 'melvorAoD:Archaeology': modifiers.push('melvorAoD:digSiteMapSlots', 'melvorAoD:artefactValue', 'archaeologyCommonItemSkillXP', 'minimumItemsFoundInArchaeology', 'brushToolLevel', 'shovelToolLevel', 'sieveToolLevel', 'trowelToolLevel', 'largeArtefactChance', 'largeArtefactValue', 'mediumArtefactChance', 'mediumArtefactValue', 'smallArtefactChance', 'smallArtefactValue', 'tinyArtefactChance', 'tinyArtefactValue', 'doubleConsumablesArchaeology', 'melvorAoD:mapChargePreservationChance', 'archaeologyVeryRareMapPreservation'); break;
		case 'melvorAoD:Cartography': modifiers.push('doubleActiveModifiersCartography', 'flatDigSiteMapCharges', 'cartographyTravelCost', 'cartographyMapUpgradeInterval', 'cartographyPaperMakingInterval', 'cartographySightRange', 'cartographySurveyInterval', 'cartographySurveyRange', 'cartographySurveyXP', 'initialMapArtefactValues', 'travelEventChance', 'mapUpgradeActions', 'mapRefinementCost', 'flatCurrencyGainPerArchaeologyLevelNoArtefact'); break;
	}

	modifiers.forEach((modifier, i) => {
		if (!modifier.startsWith('melvor'))
			modifiers[i] = 'melvorD:' + modifier;
	});
	return modifiers;
}

export function getAbyssalModifiers(skill) {
	let interval = !noInterval.some((x) => x === skill.id),
		combat = isCombat.some((x) => x === skill.id),
		artisan = isArtisan.some((x) => x === skill.id),
		modifiers = [...getCommonModifiers(skill), 'abyssalSkillXP'];

	if (!combat) modifiers.push('flatAdditionalPrimarySkillResource', 'flatAdditionalPrimarySkillResourceAbyssal', 'additionalSkillResourceChance', 'additionalPrimarySkillResourceGlobalAbyssal', 'additionalRandomAbyssalGemChance', 'additionalRandomAbyssalGemChancePerInterval');
	if (combat) modifiers.push('abyssalCombatSkillXP');
	if (interval && !combat) modifiers.push('abyssalSkillInterval', 'flatAbyssalSkillInterval');
	if (artisan) modifiers.push('itemCorruptionChance', 'skillCostReduction');

	switch (skill.id) {
		case 'melvorD:Attack': modifiers.push('flatAbyssalSlayerAreaEffectNegation', 'damageDealtToAbyssalSlayerAreaMonsters', 'bonusCorruptionChance', 'corruptionCounterRate', 'instantCorruptionChance', 'flatSoulPointsPerMonsterKill', 'flatSoulPointCost', 'maxHitWith2AbyssalPrayers', 'flatSoulPointsWhenHit', 'abyssalPrayerCost', 'flatCombatAXPAgainstCorruptedMonsters', 'permanentCorruptionCost', 'resistance', 'maxHitBasedOnResistance', 'maxHitBasedOnTargetResistance', 'meleeStrengthBonusPer10EnemyResistance', 'ignoreResistanceWhenAttackingChance', 'doubleSoulDropChance', 'soulPointPreservationChanceBypass', 'soulPointCost', 'flatSoulPointsFromReleasing', 'doubleSoulDrops', 'soulPointPreservationChance'); break;
		case 'melvorD:Farming': modifiers.push('regainAbyssalTreeSeedChance'); break;
		case 'melvorD:Township': modifiers.push('townshipMaxSoulStorage', 'abyssalWaveAPGain', 'abyssalWaveASCGain'); break;
		case 'melvorD:Woodcutting': modifiers.push('shadowRavenNestDropChance', 'shadowDrakeNestDropChance', 'woodcuttingAbyssalGemChancePerInterval', 'woodcuttingDrakeNestJewelryChance', 'woodcuttingAXPAddedAsFiremakingAXP'); break;
		case 'melvorD:Fishing': modifiers.push('useNoSummoningChargesAbyssalOctopus'); break;
		case 'melvorD:Firemaking': modifiers.push('firemakingVoidheartChancePerInterval', 'firemakingAXPWithControlledHeat'); break;
		case 'melvorD:Cooking': modifiers.push('cookingAdditionalAbyssalFishChance'); break;
		case 'melvorD:Mining': modifiers.push('abyssalGemChance', 'flatAbyssalEssenceFromMining', 'miningNodeRespawnInterval', 'abyssalGemVeinChanceIncrease', 'additionalAbyssalGemChance'); break;
		case 'melvorD:Smithing': modifiers.push('smithingAbyssalBarCost'); break;
		case 'melvorD:Thieving': modifiers.push('abyssalThievingStealth', 'flatDrakeNestsFromThievingTreant', 'abyssalGemWhenThievingGolemChance', 'flatAbyssalEssenceThievingWitheringRuins', 'randomBarThievingWitheringRuinsChance', 'abyssalThievingStunAvoidanceChance', 'summoningSynergy_Abyssal_Leprechaun_Devil'); break;
		//case 'melvorD:Fletching': modifiers.push(''); break;
		case 'melvorD:Crafting': modifiers.push('craftingJewelryRandomAbyssalGemChance', 'flatAdditionalAbyssalConsumables', 'craftingDoubleAbyssalArmourChance'); break;
		case 'melvorD:Runecrafting': modifiers.push('additional8AbyssalRunesChance', 'additional8AbyssalCombinationRunesChance', 'flatBaseAbyssalComboRunes', 'flatAdditionalAbyssalRunes'); break;
		//case 'melvorD:Herblore': modifiers.push(''); break;
		//case 'melvorD:Agility': modifiers.push(''); break;
		case 'melvorD:Summoning': modifiers.push('flatAbyssalSummoningCreationCharges', 'flatAbyssalSummoningShardCost'); break;
		case 'melvorD:Astrology': modifiers.push('starFallChance', 'flatBaseAbyssalStardustQuantity', 'abyssalStardustChance', 'starfallWitnessChance'); break;
		//case 'melvorD:Magic': modifiers.push(''); break;
		case 'melvorItA:Harvesting': modifiers.push('melvorItA:maxHarvestingIntensity', 'melvorItA:noHarvestingIntensityDecay', 'flatHarvestingIntensity', 'flatHarvestingBaseQuantity', 'harvestingAbyssalGemChance', 'minimumHarvestingIntensity', 'disableHarvestingVeinDegen', 'currencyFromHarvestingChanceBasedOnLevel', 'doubleHarvestingIntensityChance', 'summoningSynergy_Imp_Devil'); break;
	}

	modifiers.forEach((modifier, i) => {
		if (!modifier.startsWith('melvor'))
			modifiers[i] = 'melvorD:' + modifier;
	});
	return modifiers;
}