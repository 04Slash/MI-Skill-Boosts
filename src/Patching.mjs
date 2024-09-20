const { patch, settings, onModsLoaded } = mod.getContext(
		import.meta),
	player = game.combat.player,
	getSynergy = (set) => {
		if (!(set instanceof Equipment))
			return;
		return game.summoning.getSynergy(set.getItemInSlot('melvorD:Summon1'), set.getItemInSlot('melvorD:Summon2'));
	},
	addToRenderQueue = (item, category, types) => types.forEach((type) => skillBoosts.renderQueue[category][type].add(item)),
	getCategoryIcons = (category) => skillBoosts.getCategoryIcons(category),
	getSetting = settings.section('General').get,
	hasAoD = cloudManager.hasAoDEntitlementAndIsEnabled,
	hasItA = cloudManager.hasItAEntitlementAndIsEnabled,
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
	abyssalRealm = hasItA && game.realms.getObjectByID('melvorItA:Abyssal');

let oldEquipmentSet = player.selectedEquipmentSet,
	destroyedObstacles = [],
	isPetUnlocked, unequippedItem, lazyRenderer, fastRenderer, isRendering, previousSynergy, prevMarkLevel;


// Equipment Events
// Update after item equipped
player._events.on('itemEquipped', e => {
	if (getCategoryIcons('Equipment').includes(e.item))
		addToRenderQueue(e.item, 'equipment', ['bg']);
	else if (getCategoryIcons('Consumable').includes(e.item)) {
		addToRenderQueue(e.item, 'consumable', ['bg', 'qty']);
	}

	if (previousSynergy && previousSynergy.summons.some(x => x.product === e.item)) {
		addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
		previousSynergy = undefined;
	}
	let newSynergy = player.equippedSummoningSynergy;
	if (newSynergy && newSynergy.summons.some(x => x.product === e.item)) {
		addToRenderQueue(newSynergy, 'synergy', ['bg', 'qty']);
	}

	if (e.item instanceof WeaponItem)
		swapCombatRealm(e.item);

	if (skillBoosts.hasAgilityCostMod(e.item))
		skillBoosts.updateAllObstacles();
	if (skillBoosts.hasTravelCostMod(e.item))
		skillBoosts.updateAllPOIs();
});


// Consumable Events
// Update item charges
game.itemCharges._events.on('chargesChanged', e => {
	if (!game.itemCharges.charges.has(e.item))
		return;
	addToRenderQueue(e.item, 'equipment', ['charge']);
	addToRenderQueue(e.item, 'consumable', ['bg']);
});


// POI Events
if (hasAoD) {
	game.cartography.on('travel', e => skillBoosts.updateAllPOIs());

	game.cartography.on('poiDiscovered', e => {
		if (getCategoryIcons('POI').includes(e.poi))
			addToRenderQueue(e.poi, 'poi', ['bg']);
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.pois && y.pois.some(z => z === e.poi))).forEach(purchase => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
}

// Misc Events
// Update Shop Requirements on Dungeon Completion
game.combat._events.on('dungeonCompleted', e => {
	getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(x => x.dungeon === e.dungeon)).forEach(purchase => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update Shop Requirements on Abyss Completion
game.combat._events.on('abyssDepthCompleted', e => {
	getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(x => x.depth === e.depth)).forEach(purchase => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update after building a Building
game.township.on('buildingCountChanged', e => {
	getCategoryIcons('Purchase').filter(x => x.contains.pet && x.purchaseRequirements.some(y => y.building === e.building)).forEach(purchase => {
		addToRenderQueue(purchase, 'purchase', ['bg']);
	});
});

// Update Purchases with Museum Donation requirements
if (hasAoD) {
	game.archaeology.on('itemDonated', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.count === e.newCount)).forEach(purchase => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
}



// Update items with Level Requirements
[game.woodcutting, game.fishing, game.firemaking, game.cooking, game.mining, game.smithing, game.agility, game.cartography, game.archaeology].forEach(skill => {
	if (skill === undefined) return;
	skill.on('levelChanged', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.skill === e.skill && e.oldLevel < y.level && e.newLevel >= y.level)).forEach(purchase => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
});
[game.slayer, game.woodcutting, game.fishing, game.harvesting].forEach((skill) => {
	if (skill === undefined) return;
	skill.on('abyssalLevelChanged', e => {
		getCategoryIcons('Purchase').filter(x => x.purchaseRequirements.some(y => y.skill === e.skill && e.oldLevel < y.abyssalLevel && e.newLevel >= y.abyssalLevel)).forEach(purchase => {
			addToRenderQueue(purchase, 'purchase', ['bg']);
		});
	});
});

export function addLevelChangeEmitters() {
	skillBoosts.data.skills.forEach((skill) => {
		['level', 'abyssalLevel'].forEach(lvl => {
			let ucLvl = lvl.charAt(0).toUpperCase() + lvl.slice(1);

			if (skill === game.agility && skill[ucLvl] < skill[`max${ucLvl}Cap`]) {
				skill.on(`${lvl}Changed`, e => {
					getCategoryIcons('Obstacle').filter(x => x.slot[lvl] === e.newlevel).forEach(obstacle => addToRenderQueue(obstacle, 'obstacle', ['bg']));
				});
			} else if (skill[lvl] < skill[`max${ucLvl}Cap`]) {
				skill.on(`${lvl}Changed`, e => {
					getCategoryIcons('Obstacle').filter(x => x.skillRequirements && x.skillRequirements.some(y => y.skill === e.skill && e.oldLevel < y[lvl] && e.newLevel >= y[lvl])).forEach(obstacle => {
						addToRenderQueue(obstacle, 'obstacle', ['bg']);
					});
				});
			}
			if (skill === game.astrology && skill[lvl] < skill[`max${ucLvl}Cap`]) {
				skill.on(`${lvl}Changed`, e => {
					getCategoryIcons('Constellation').filter(x => x[lvl] === e.newLevel).forEach(constellation => { addToRenderQueue(constellation, 'constellation', ['bg']); });
				});
			}
		});
	});
}


// Class Patches
// Equipment Patches
// Update on equipment set change
patch(Player, 'changeEquipmentSet').before(function() {
	oldEquipmentSet = player.selectedEquipmentSet;
});
patch(Player, 'changeEquipmentSet').after(function(_, setID) {
	if (this.equipmentSets.length <= setID)
		return;
	try {
		let setsToUpdate = Array.from(new Set([oldEquipmentSet, setID]));
		setsToUpdate.forEach(set => {
			let eSet = player.equipmentSets[set];
			if (!eSet)
				return;
			let synergy = getSynergy(eSet.equipment);
			eSet.equipment.equippedArray.forEach(slot => {
				if (slot.isEmpty)
					return;
				if (['melvorD:Consumable', 'melvorD:Summon1', 'melvorD:Summon2'].includes(slot.id))
					addToRenderQueue(slot.item, 'consumable', ['bg', 'qty']);
				else
					addToRenderQueue(slot.item, 'equipment', ['bg']);

				if (synergy && synergy.summons.some(x => x.product === slot.item))
					addToRenderQueue(synergy, 'synergy', ['bg', 'qty']);

				if (slot.item instanceof WeaponItem)
					swapCombatRealm(slot.item);
			});
		});
		skillBoosts.render();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Player, 'equipItem').before(function(item, set, slot, quantity) {
	previousSynergy = getSynergy(this.equipmentSets[set].equipment);
});
patch(Equipment, 'unequipItem').before(function(slot) {
	unequippedItem = this.getItemInSlot(slot.id);
	previousSynergy = player.equippedSummoningSynergy;
});
patch(Equipment, 'unequipItem').after(function(_, slot) {
	try {
		if (getCategoryIcons('Equipment').includes(unequippedItem))
			addToRenderQueue(unequippedItem, 'equipment', ['bg']);
		else if (getCategoryIcons('Consumable').includes(unequippedItem)) {
			addToRenderQueue(unequippedItem, 'consumable', ['bg', 'qty']);
		}

		if (previousSynergy) {
			addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
			previousSynergy = undefined;
		}

		if (unequippedItem instanceof WeaponItem)
			swapCombatRealm();

		if (skillBoosts.hasTravelCostMod(unequippedItem))
			skillBoosts.updateAllPOIs();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});


// Potion Patches
// Update consumables and summons on use
patch(Player, 'consumeItemQuantities').after(function(_, e, equipped) {
	try {
		if (e instanceof CharacterAttackEvent && e.isPlayerMulti)
			return;
		if (['melvorD:Consumable', 'melvorD:Summon1', 'melvorD:Summon2'].includes(equipped.slot.id)) {
			addToRenderQueue(equipped.item, 'consumable', ['qty']);
			let synergies = game.summoning.synergiesByItem.get(equipped.item);
			if (synergies !== undefined)
				synergies.forEach(synergy => addToRenderQueue(synergy, 'synergy', ['qty']));
		}
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
// Update potions on use and when consumed
patch(PotionManager, 'usePotion').replace(function(o, potion, loadPotions) {
	try {
		let oldPotion = game.potions.activePotions.get(potion.action);
		if (this.game !== game || Math.max(game.bank.getQty(potion) - getSetting('allbutx'), 0) > 0)
			o(potion, loadPotions);
		else
			this.removePotion(potion.action, false);
		addToRenderQueue(potion, 'consumable', ['bg', 'qty']);
		if (oldPotion)
			addToRenderQueue(oldPotion.item, 'consumable', ['bg']);
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(PotionManager, 'removePotion').after(function(o, skill, loadPotions) {
	getCategoryIcons('Consumable').filter(potion => potion instanceof PotionItem && potion.action === skill).forEach(potion => {
		addToRenderQueue(potion, 'consumable', ['bg', 'qty']);
	});
});



// POI Patches
patch(Cartography, 'goToWorldMapOnClick').after(function(_, poi) { skillBoosts.updateAllPOIs(); });



// Obstacles Patches
// Modify obstacle costs when updating Backgrounds
patch(Agility, 'addSingleObstacleBuildCost').after(function(_, obstacle, costs) {
	try {
		if (!skillBoosts.agiCosts)
			return;
		skillBoosts.agiCosts = false;

		let agiSetting = skillBoosts.data.filteredItems.get('agi');
		if (agiSetting.length === 0 || obstacle.realm !== melvorRealm)
			return;

		let capeID = player.equipment.getItemInSlot('melvorD:Cape').id,
			cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95,
			isWearingSkillcape = capeID === 'melvorF:Agility_Skillcape',
			skillcape = !isWearingSkillcape && agiSetting.includes('melvorF:Agility_Skillcape') ? 20 : 0,
			superiorCape = capeID !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? isWearingSkillcape ? 10 : 30 : 0;

		obstacle.currencyCosts.forEach(({ currency, quantity }) => {
			let costModifier = this.getObstacleCostModifier(obstacle, currency);
			costModifier -= skillcape + superiorCape;
			let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
			if (cost > 0)
				costs._currencies.set(currency, cost);
		});

		let itemCostModifier = this.getObstacleItemCostModifier(obstacle);
		itemCostModifier -= skillcape + superiorCape;
		itemCostModifier -= player.equipment.equippedItems['melvorD:Consumable'].item.id !== 'melvorAoD:Agility_Lesser_Relic' && agiSetting.includes('melvorAoD:Agility_Lesser_Relic') ? 10 : 0;
		obstacle.itemCosts.forEach(({ item, quantity }) => {
			let cost = Math.floor(quantity * (1 + Math.max(itemCostModifier, -cap) / 100));
			if (cost > 0)
				costs._items.set(item, cost);
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Agility, 'addSinglePillarBuildCost').after(function(_, pillar, costs) {
	try {
		if (!skillBoosts.agiCosts)
			return;
		skillBoosts.agiCosts = false;

		let agiSetting = skillBoosts.data.filteredItems.get('agi');
		if (agiSetting.length === 0 || pillar.realm !== melvorRealm)
			return;

		let costModifier = this.game.modifiers.getValue("melvorD:agilityPillarCost", this.getActionModifierQuery(pillar)),
			cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95;
		costModifier -= player.equipment.getItemInSlot('melvorD:Cape').id !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? 20 : 0;

		pillar.currencyCosts.forEach(({ currency, quantity }) => {
			let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
			if (cost > 0)
				costs._currencies.set(currency, cost);
		});
		pillar.itemCosts.forEach(({ item, quantity }) => {
			let cost = Math.floor(quantity * (1 + Math.max(costModifier, -cap) / 100));
			if (cost > 0)
				costs._items.set(item, cost);
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
// Update Obstacle on Build
patch(Agility, 'buildObstacle').after(function(_, obstacle) {
	try {
		let obstacles = getCategoryIcons('Obstacle');
		if (obstacle.id === 'melvorTotH:ForestJog')
			return obstacles.forEach(obstacle => addToRenderQueue(obstacle, 'obstacle', ['bg']));
		obstacles.filter(x => x.category === obstacle.category).forEach(obst => addToRenderQueue(obst, 'obstacle', ['bg']));
		obstacles.filter(x => x instanceof AgilityPillar || x.category >= obstacle.category).forEach(obst => addToRenderQueue(obst, 'obstacle', ['active']));
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
// Grab the destroyed obstacle then update it after
patch(Agility, 'destroyObstacle').before(function(category) {
	try {
		this.courses.forEach((course) => {
			if (course.builtObstacles.has(category))
				destroyedObstacles.push(course.builtObstacles.get(category));
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Agility, 'destroyObstacle').after(function(_, category) {
	try {
		if (destroyedObstacles.length <= 0)
			return;
		let obstacles = getCategoryIcons('Obstacle');
		if (destroyedObstacles.some(x => x.id === 'melvorTotH:ForestJog'))
			return obstacles.forEach(obstacle => addToRenderQueue(obstacle, 'obstacle', ['bg']));
		destroyedObstacles.forEach(destroy => addToRenderQueue(destroy, 'obstacle', ['bg']));
		obstacles.filter(x => x instanceof AgilityPillar || x.category >= category).forEach(obst => addToRenderQueue(obst, 'obstacle', ['active']));
		destroyedObstacles = [];
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
// Update Pillars on Build
patch(Agility, 'buildPillar').before(function(pillar) {
	try {
		if (pillar.course.builtPillars.has(pillar.category))
			destroyedObstacles.push(pillar.course.builtPillars.get(pillar.category));
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Agility, 'buildPillar').after(function(_, pillar) {
	try {
		addToRenderQueue(pillar, 'obstacle', ['bg', 'active']);
		if (destroyedObstacles.length <= 0)
			return;
		destroyedObstacles.forEach(obstacle => addToRenderQueue(obstacle, 'obstacle', ['bg', 'active']));
		destroyedObstacles = [];
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Agility, 'destroyPillar').before(function(category) {
	try {
		this.courses.forEach((course) => {
			if (course.builtPillars.has(category))
				destroyedObstacles.push(course.builtPillars.get(category));
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Agility, 'destroyPillar').after(function(_, category) {
	try {
		if (destroyedObstacles.length <= 0)
			return;
		destroyedObstacles.forEach(destroy => addToRenderQueue(destroy, 'obstacle', ['bg', 'active']));
		destroyedObstacles = [];
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});



// Pet Patching
// Remove pet from list after acquired
patch(PetManager, 'unlockPet').before(function(pet) {
	isPetUnlocked = this.unlocked.has(pet);
});
patch(PetManager, 'unlockPet').after(function(_, pet) {
	if (isPetUnlocked)
		return;
	skillBoosts.removeIcon(pet);
});


patch(ShopMenu, 'updateItemPostPurchase').after(function(_, purchase) {
	try {
		skillBoosts.removeIcon(purchase);
		let nextUpgrade = game.shop.purchases.allObjects.find(x => x.unlockRequirements.some(y => y.purchase === purchase));
		if (nextUpgrade)
			addToRenderQueue(nextUpgrade, 'purchase', ['bg']);

		skillBoosts.renderPurchaseBg();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});


// Update Constellations
['upgradeStandardModifier', 'upgradeUniqueModifier', 'upgradeAbyssalModifier'].forEach((func) => {
	patch(Astrology, func).after(function(_, constellation, modID) {
		if (game.astrology.isConstellationComplete(constellation))
			skillBoosts.removeIcon(constellation);
	});
});


// Update Synergies
patch(Player, 'quickEquipSynergy').before(function(synergy) {
	previousSynergy = player.equippedSummoningSynergy;
});
patch(Player, 'quickEquipSynergy').after(function(_, synergy) {
	if (getCategoryIcons('Synergy').includes(synergy)) {
		addToRenderQueue(synergy, 'synergy', ['bg', 'qty']);
	}
	if (previousSynergy) {
		addToRenderQueue(previousSynergy, 'synergy', ['bg', 'qty']);
		previousSynergy = undefined;
	}
});
patch(Summoning, 'discoverMark').before(function(mark) {
	prevMarkLevel = this.getMarkLevel(mark);
});
patch(Summoning, 'discoverMark').after(function(_, mark) {
	if (this.getMarkLevel(mark) !== prevMarkLevel)
		getCategoryIcons('Synergy').filter(x => x.summons.includes(mark.product)).forEach(synergy => addToRenderQueue(synergy, 'synergy', ['locked']));
});
patch(Summoning, 'locateAncientRelic').after(function(_, relicSet, relic) {
	if (relicSet.isComplete)
		getCategoryIcons('Synergy').forEach(synergy => addToRenderQueue(synergy, 'synergy', ['locked']));
});



// Remove all negative obstacles after Agility Master Relic
patch(Agility, 'locateAncientRelic').after(function(_, relicSet, relic) {
	if (relicSet.isComplete) {
		skillBoosts.getAllIcons().filter(x => x.category === 'Obstacle' && x.elem === 3).forEach(icon => skillBoosts.removeIcon(icon.item, icon.elem));
		skillBoosts.reformatMenu();
	}
});
patch(Skill, 'locateAncientRelic').after(function(_, relicSet, relic) {
	skillBoosts.removeIcon(relic);
});


// Swap Realms for Artisan Skills
patch(CategoryMenuOptionElement, 'setOption').after(function(o, option, callbackFn) {
	if (option.skill !== undefined && option.realm !== undefined && skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms'))
		skillBoosts.onRealmChange(option.realm.id);
});
// Swap Realms for Firemaking
patch(Firemaking, 'selectLog').after(function(o, recipe) {
	if (recipe.realm !== undefined && skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms'))
		skillBoosts.onRealmChange(recipe.realm.id);
});
// Swap Realms for Township
patch(Township, 'setTownBiome').after(function(o, biome, jumpTo) {
	if (skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms')) {
		let realm = biome.abyssalTier ? abyssalRealm : melvorRealm;
		if (realm instanceof Realm)
			skillBoosts.onRealmChange(realm.id);
	}
});
// Swap Realms for Cooking
patch(Cooking, 'onRecipeSelectionOpenClick').after(function(o, category, realm) {
	if (skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms'))
		skillBoosts.onRealmChange(realm.id);
});
// Swap Realms for Farming
patch(FarmingSeedSelectElement, 'setSeedSelection').after(function(o, category, game, realm, plot) {
	if (skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms')) {
		const realmsWithMasteryInCategory = game.farming.getRealmsWithMasteryInCategory(category);
		if (realmsWithMasteryInCategory.length > 0 && !realmsWithMasteryInCategory.includes(realm))
			realm = realmsWithMasteryInCategory[0];
		skillBoosts.onRealmChange(realm.id);
	}
});
// Change the menu's realm when the skill's realm is changed
patch(Skill, 'selectRealm').after(function(o, realm) {
	if (skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms') && skillBoosts.data.realms.includes(realm) && skillBoosts.data.menus.has(this.id))
		skillBoosts.onRealmChange(realm.id, undefined, skillBoosts.data.menus.get(this.id), this.id);
});
// Swap realm when weapon damage type changes
function swapCombatRealm(item) {
	if (skillBoosts.data.realms.length >= 2 && getSetting('autoSwapRealms')) {
		let realmID = (!item || item.damageType === game.normalDamage) ? melvorRealm.id : abyssalRealm.id;
		skillBoosts.onRealmChange(realmID, undefined, skillBoosts.data.menus.get(game.attack.id), game.attack.id);
		skillBoosts.onRealmChange(realmID, undefined, skillBoosts.data.menus.get(game.thieving.id), game.thieving.id);
	}
}



//Update Purchase, Obstacle, and POI bgs on currency change
['add', 'remove', 'set'].forEach((func) => {
	patch(Currency, func).after(function(_, amount) {
		if (this === game.raidCoins)
			return;
		addToQueue('currency', this, amount);
	});
});
// Update on Item gain
['addItem', 'removeItemQuantity'].forEach((func) => {
	patch(Bank, func).after(function(success, item, quantity) {
		if (func === 'removeItemQuantity' && quantity > 0)
			success = true;
		if (success)
			addToQueue('items', item, quantity);
	});
});

function addToQueue(queue, obj, quantity = 1) {
	queue = skillBoosts.renderQueue[queue];
	if (queue.has(obj))
		queue.set(obj, queue.get(obj) + quantity);
	else
		queue.set(obj, quantity);
}

function updateCurrency() {
	if (skillBoosts.renderQueue.currency.size === 0)
		return;
	skillBoosts.renderQueue.currency.forEach((qty, currency) => {
		getCategoryIcons('Obstacle').forEach(obstacle => {
			let costs = skillBoosts.getObstacleCost(obstacle, true)._currencies.get(currency);
			if (!costs) return;
			if (currency.amount >= costs - qty && currency.amount <= costs + qty)
				addToRenderQueue(obstacle, 'obstacle', ['bg']);
		});
		getCategoryIcons('Purchase').forEach(purchase => {
			let costs = purchase.costs.currencies.find(x => x.currency === currency);
			if (!costs) return;
			if (currency.amount >= costs.cost - qty && currency.amount <= costs.cost + qty) {
				addToRenderQueue(purchase, 'purchase', ['bg']);
			}
		});
		getCategoryIcons('POI').forEach(poi => {
			let costs = skillBoosts.getTravelCosts(poi)._currencies.get(currency);
			if (!costs) return;
			if (currency.amount >= costs - qty && currency.amount <= costs + qty)
				addToRenderQueue(poi, 'poi', ['bg']);
		});
	});
	skillBoosts.renderQueue.currency.clear();
}

function updateItem() {
	if (skillBoosts.renderQueue.items.size === 0)
		return;
	let newSynergy = player.equippedSummoningSynergy;
	skillBoosts.renderQueue.items.forEach((qty, item) => {
		if (item instanceof EquipmentItem || item instanceof PotionItem) {
			if (getCategoryIcons('Consumable').includes(item))
				addToRenderQueue(item, 'consumable', ['bg', 'qty']);
			else if (getCategoryIcons('Equipment').includes(item))
				addToRenderQueue(item, 'equipment', ['bg']);
			else if (item.validSlots && item.validSlots[0] === game.equipmentSlots.getObjectByID('melvorD:Summon1'))
				getCategoryIcons('Synergy').filter(x => x.summons.some(y => y.product === item)).forEach(synergy => addToRenderQueue(synergy, 'synergy', ['bg', 'qty']));
		}

		let bankQty = game.bank.getQty(item);
		getCategoryIcons('Obstacle').filter(y => y.itemCosts.some(x => x.item === item)).forEach(obstacle => {
			skillBoosts.getObstacleCost(obstacle, true)._items.forEach(quantity => {
				if (bankQty >= quantity - qty && bankQty <= quantity + qty)
					addToRenderQueue(obstacle, 'obstacle', ['bg']);
			});
		});
		getCategoryIcons('Purchase').filter(y => y.costs.items.some(x => x.item === item)).forEach(purchase => {
			purchase.costs.items.forEach(({ quantity }) => {
				if (bankQty >= quantity - qty && bankQty <= quantity + qty) {
					addToRenderQueue(purchase, 'purchase', ['bg']);
				}
			});
		});
	});
	skillBoosts.renderQueue.items.clear();
}

function lazyRender() {
	updateCurrency();
	updateItem();
	skillBoosts.renderMenu();
}

export function startRenderer() {
	if (isRendering)
		return;
	lazyRenderer = window.setInterval(lazyRender, 2000);
	fastRenderer = window.setInterval(skillBoosts.render.bind(skillBoosts), 500);
	isRendering = true;
}

function clearRenderer() {
	clearInterval(lazyRenderer);
	clearInterval(fastRenderer);
	isRendering = false;
}

// Misc Patching
// Update the menu on new skill
patch(SidebarItem, 'click').after(function(o) {
	if (game.skillPageMap.has(game.skills.getObjectByID(this.id)))
		skillBoosts.onSkillChange(true);
	else if (game.pages.registeredObjects.has(this.id)) {
		skillBoosts.selectedSkillID = undefined;
		skillBoosts.menu = undefined;
	}
});
// Update the menu when a combat skill or the combat minibar is clicked
patch(BaseManager, 'onCombatPageChange').after(function(o) {
	skillBoosts.onSkillChange(true);
});
// Update menu on tutorial completion
patch(Tutorial, 'completeTutorial').after(function(o) {
	skillBoosts.onSkillChange(true);
});
// Introduce custom loops for renderQueue
game._events.on('offlineLoopExited', e => startRenderer());
game._events.on('offlineLoopEntered', e => clearRenderer());
patch(AgilityPillar, 'media').get(function(o) { return this._media; });
// Fix for black Cartography Map bug
patch(WorldMapDisplayElement, 'setViewportSize').replace(function() {
	if (this.offsetParent === null)
		return;
	this.viewport.resize(this.clientWidth, Math.max(this.clientHeight, 1));
	this.viewport.clampZoom({
		maxWidth: this.viewport.worldWidth,
		maxHeight: this.viewport.worldHeight,
		minWidth: this.clientWidth,
		minHeight: Math.max(this.clientHeight, 1),
	});
	this.computeViewportBorders();
	this.setViewportClamp();
});