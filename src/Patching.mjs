const { patch, settings } = mod.getContext(
	import.meta);
const player = game.combat.player;
let oldEquipmentSet = player.selectedEquipmentSet,
	playerEvents = player._events,
	oldPillar, pillarFuncs = ['destroyPillar', 'buildPillar'],
	pillarFunctions = [...pillarFuncs, 'buildElitePillar', 'destroyElitePillar'],
	get = settings.section('General').get,
	isPetUnlocked, destroyedObstacle, oldPotion, unequippedItem, itemAndCurrencyInterval, renderingInterval, oldPage;


function updateConsumableBg(consumable) { skillBoosts.renderQueue.consumable.bg.add(consumable); };

function updateConsumableQty(consumable) { skillBoosts.renderQueue.consumable.qty.add(consumable); };

function updatePOIBg(poi) { skillBoosts.renderQueue.poi.bg.add(poi); };

function updateEquipmentBg(item) { skillBoosts.renderQueue.equipment.bg.add(item); };

function updateObstacleBg(obstacle) { skillBoosts.renderQueue.obstacle.bg.add(obstacle); };

function updateObstacleActive(obstacle) { skillBoosts.renderQueue.obstacle.active.add(obstacle); };

function updatePurchaseBg(purchase) { skillBoosts.renderQueue.purchase.bg.add(purchase); };

function updatePurchaseCost(purchase) { skillBoosts.renderQueue.purchase.cost.add(purchase); };

function updatePurchaseRequirements(purchase) { skillBoosts.renderQueue.purchase.requirements.add(purchase); };

function getIconsFromMap(category) { return skillBoosts.getCategoryIcons(category); };


//Equipment Patches
//Update on equipment set change
patch(Player, 'changeEquipmentSet').before(function() {
	oldEquipmentSet = player.selectedEquipmentSet;
});
patch(Player, 'changeEquipmentSet').after(function(_, setID) {
	try {
		let setsToUpdate = [oldEquipmentSet, setID];
		setsToUpdate.forEach((set) => {
			let eSet = player.equipmentSets[set];
			if (!eSet)
				return;
			eSet.equipment.slotArray.forEach((slot) => {
				if (slot.isEmpty)
					return;
				if (slot.type === 'Consumable' || slot.type === 'Summon1' || slot.item.consumesChargesOn) {
					updateConsumableQty(slot.item);
					updateConsumableBg(slot.item);
				} else
					updateEquipmentBg(slot.item);
			});
		});
		skillBoosts.render();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
//Update after item equipped
playerEvents.on('itemEquipped', e => updateOnEquipItem(e.item, e.quantity));

function updateOnEquipItem(item, quantity) {
	if (getIconsFromMap('Equipment').includes(item))
		updateEquipmentBg(item);
	else if (getIconsFromMap('Consumable').includes(item)) {
		updateConsumableBg(item);
		updateConsumableQty(item);
	}
	if (item.modifiers !== undefined && (item.modifiers.decreasedAgilityPillarCost || item.modifiers.decreasedAgilityObstacleCost || item.modifiers.decreasedAgilityObstacleItemCost))
		skillBoosts.updateAllObstacles();
	if (item.modifiers !== undefined && item.modifiers.decreasedHexTravelCost !== undefined)
		skillBoosts.updateAllPOIs();
	notifyPlayer(item, templateLangString('TOASTS_ITEM_EQUIPPED', { itemName: item.name }), 'success', quantity);
}

patch(Equipment, 'unequipItem').before(function(slot) {
	unequippedItem = player.equipment.slots[player.equipment.getRootSlot(slot)].item;
});
patch(Equipment, 'unequipItem').after(function(_, slot) {
	try {
		if (getIconsFromMap('Equipment').includes(unequippedItem))
			updateEquipmentBg(unequippedItem);
		else if (getIconsFromMap('Consumable').includes(unequippedItem)) {
			updateConsumableQty(unequippedItem);
			updateConsumableBg(unequippedItem);
		}
		player.updateForEquipmentChange();
		if (unequippedItem.modifiers !== undefined && unequippedItem.modifiers.decreasedHexTravelCost !== undefined)
			skillBoosts.updateAllPOIs();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});



//Consumable Patches
//Update item charges
patch(ItemCharges, 'addCharges').after(function(_, item, amount) {
	updateConsumableQty(item);
	if (this.getCharges(item) - amount <= 0)
		updateConsumableBg(item);
});
patch(ItemCharges, 'removeCharges').after(function(_, item, amount) {
	updateConsumableQty(item);
	if (this.getCharges(item) <= 0)
		updateConsumableBg(item);
});
//Update consumables and summons on use
patch(Player, 'consumeItemQuantities').after(function(_, e, slot) {
	if ((e instanceof CharacterAttackEvent && e.isPlayerMulti))
		return;
	if (['Consumable', 'Summon1', 'Summon2'].includes(slot.type))
		updateConsumableQty(slot.item);
});

//Update potions on use and when consumed
patch(PotionManager, 'usePotion').before(function(potion, loadPotions) {
	let currentPot = game.potions.activePotions.get(potion.action);
	if (currentPot === undefined)
		return;
	oldPotion = currentPot.item;
});
patch(PotionManager, 'usePotion').after(function(o, potion, loadPotions) {
	if (oldPotion !== undefined)
		updateConsumableBg(oldPotion);
	updateConsumableBg(potion);
	updateConsumableQty(potion);
});
patch(PotionManager, 'removePotion').after(function(o, skill, loadPotions) {
	getIconsFromMap('Consumable').filter(potion => potion instanceof PotionItem && potion.action === skill).forEach((potion) => {
		updateConsumableQty(potion);
		updateConsumableBg(potion);
	});
});
//Stop re-using Potions based on 'allbutx' setting
patch(Bank, 'hasItem').after(function(o, item) {
	if (!skillBoosts.wasClicked || !(item instanceof PotionItem))
		return o;
	skillBoosts.wasClicked = false;
	let qty = Math.max(this.getQty(item) - get('allbutx'), 0);
	return qty > 0;
});



//POI Patches
patch(Cartography, 'movePlayer').after(function(_, path, ignoreCosts) {
	try {
		skillBoosts.updateAllPOIs();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Cartography, 'discoverPOI').after(function(_, poi) {
	try {
		if (getIconsFromMap('POI').includes(poi))
			updatePOIBg(poi);
		getIconsFromMap('Purchase').filter(x => x.purchaseRequirements[0] !== undefined && x.purchaseRequirements[0].pois !== undefined && x.purchaseRequirements[0].pois[0] === poi).forEach((purchase) => {
			updatePurchaseBg(purchase);
			updatePurchaseRequirements(purchase);
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Cartography, 'goToWorldMapOnClick').after(function(_, poi) {
	try {
		skillBoosts.updateAllPOIs();
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
patch(Cartography, 'awardMasteryBonus').after(function(_, map, bonus) {
	if (bonus.pets === undefined)
		return;
	try {
		bonus.pets.forEach((pet) => {
			if (pet.id !== 'melvorAoD:MapMasteryPet')
				return;
			getIconsFromMap('POI').forEach((icon) => {
				icon.setTooltip(skillBoosts.createPOITooltips(icon.item));
			});
		});
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});



//Obstacles Patches
//Modify obstacle costs when updating Backgrounds
patch(Agility, 'getObstacleCostModifier').after(function(modifier, obstacle) {
	let agiSetting = skillBoosts.data.filteredItems.get('agi');
	if (!skillBoosts.agiCosts || agiSetting.length === 0)
		return modifier;
	skillBoosts.agiCosts = false;
	let capeID = player.equipment.slots['Cape'].item.id,
		cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95;
	modifier -= capeID !== 'melvorF:Agility_Skillcape' && agiSetting.includes('melvorF:Agility_Skillcape') ? 20 : 0;
	modifier -= capeID !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? agiSetting.includes('melvorF:Agility_Skillcape') ? 10 : 30 : 0;
	return Math.max(modifier, -cap);
});
patch(Agility, 'getObstacleItemCostModifier').after(function(modifier, obstacle) {
	let agiSetting = skillBoosts.data.filteredItems.get('agi');
	if (!skillBoosts.agiCosts || agiSetting.length === 0)
		return modifier;
	skillBoosts.agiCosts = false;
	let cap = game.modifiers.agilityItemCostReductionCanReach100 > 0 ? 100 : 95;
	modifier -= player.equipment.slots['Consumable'].item.id !== 'melvorAoD:Agility_Lesser_Relic' && agiSetting.includes('melvorAoD:Agility_Lesser_Relic') ? 10 : 0;
	return Math.max(modifier, -cap);
});
patch(Agility, 'getPillarBuildCosts').after(function(costs, pillar) {
	let agiSetting = skillBoosts.data.filteredItems.get('agi'),
		costModifier = player.equipment.slots['Cape'].item.id !== 'melvorTotH:Superior_Agility_Skillcape' && agiSetting.includes('melvorTotH:Superior_Agility_Skillcape') ? 20 : 0;
	if (!skillBoosts.agiCosts || agiSetting.length === 0 || costModifier === 0)
		return costs;
	skillBoosts.agiCosts = false;
	if (pillar.gpCost > 0)
		costs._gp = Math.max(costs._gp - (Math.floor(pillar.gpCost * (costModifier / 100))), 0);
	if (pillar.scCost > 0)
		costs._sc = Math.max(costs._sc - (Math.floor(pillar.scCost * (costModifier / 100))), 0);
	pillar.itemCosts.forEach(({ item, quantity }) => {
		const costQty = Math.floor(quantity * (costModifier / 100));
		let itemQty = costs._items.get(item);
		let newQty = Math.max(itemQty - Math.floor(quantity * (costModifier / 100)), 0);
		if (newQty > 0)
			costs._items.set(item, newQty);
	});
	return costs;
});


//Update Obstacles and Purchases onLevelUp
patch(Skill, 'onLevelUp').after(function(_, oldLevel, newLevel) {
	try {
		getIconsFromMap('Purchase').filter(x => x.purchaseRequirements.some(y => y.level === newLevel && y.skill === this)).forEach((purchase) => {
			updatePurchaseRequirements(purchase);
			updatePurchaseBg(purchase);
		});
		getIconsFromMap('Obstacle').filter(x => x.skillRequirements !== undefined && x.skillRequirements.some(y => y.level === newLevel && y.skill === this)).forEach((obstacle) => {
			updateObstacleBg(obstacle);
		});
		if (this === game.agility) {
			if (this.obstacleUnlockLevels.includes(newLevel)) {
				getIconsFromMap('Obstacle').filter(x => x.category === this.obstacleUnlockLevels.indexOf(this.level)).forEach((obstacle) => { updateObstacleBg(obstacle); });
			} else if (newLevel === 99)
				game.agility.pillars.forEach((pillar) => { updateObstacleBg(pillar); });
			else if (newLevel === 120 && cloudManager.hasTotHEntitlement)
				game.agility.elitePillars.forEach((pillar) => { updateObstacleBg(pillar); });
		}
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
//Update obstacles in tier
patch(Agility, 'buildObstacle').after(function(_, obstacle) {
	let obstalces = getIconsFromMap('Obstacle');
	obstalces.filter(x => x.category === obstacle.category).forEach((obst) => { updateObstacleBg(obst); });
	obstalces.filter(x => x instanceof AgilityPillar || x.category >= obstacle.category).forEach((obst) => { updateObstacleActive(obst); });
});
//Grab the destroyed obstacle then update it after
patch(Agility, 'destroyObstacle').before(function(category) {
	destroyedObstacle = game.agility.builtObstacles.get(category);
});
patch(Agility, 'destroyObstacle').after(function(_, category) {
	if (destroyedObstacle === undefined)
		return;
	let obstacles = getIconsFromMap('Obstacle');
	if (destroyedObstacle.id === 'melvorTotH:ForestJog')
		obstacles.forEach((obstacle) => { updateObstacleBg(obstacle); });
	else if (obstacles.includes(destroyedObstacle))
		updateObstacleBg(destroyedObstacle);
	obstacles.filter(x => x instanceof AgilityPillar || x.category >= destroyedObstacle.category).forEach((obst) => { updateObstacleActive(obst); });
});
//Update Pillars and Elite Pillers
pillarFunctions.forEach((func) => {
	patch(Agility, func).before(function() {
		oldPillar = pillarFuncs.includes(func) ? this.builtPassivePillar : this.builtElitePassivePillar;
	});
});
pillarFunctions.forEach((func) => {
	patch(Agility, func).after(function(_) {
		let newPillar = pillarFuncs.includes(func) ? this.builtPassivePillar : this.builtElitePassivePillar;
		if (newPillar !== undefined) {
			updateObstacleBg(newPillar);
			updateObstacleActive(newPillar);
		}
		if (oldPillar !== undefined) {
			updateObstacleBg(oldPillar);
			updateObstacleActive(oldPillar);
		}
	});
});



//Pet Patching
//Remove pet from list after acquired
patch(PetManager, 'unlockPet').before(function(pet) {
	if (this.unlocked.has(pet))
		isPetUnlocked = true;
	else
		isPetUnlocked = false;
});
patch(PetManager, 'unlockPet').after(function(_, pet) {
	if (isPetUnlocked)
		return;
	if (getIconsFromMap('Pet').includes(pet))
		skillBoosts.removeIconsFromMap(pet);
});



//Purchase Patching
//Remove purchase from list after buying
patch(Shop, 'buyItemOnClick').after(function(_, purchase, confirmed) {
	try {
		let costs = this.getPurchaseCosts(purchase, 1);
		let canBuy = costs.checkIfOwned() && this.game.checkRequirements(purchase.purchaseRequirements);
		if (confirmed === undefined && canBuy)
			confirmed = true;
		if (confirmed) {
			getIconsFromMap('Purchase').filter(x => x.unlockRequirements[0] !== undefined && x.unlockRequirements[0].purchase === purchase).forEach((purchases) => {
				updatePurchaseBg(purchases);
			});
			skillBoosts.renderPurhcaseBg();
			if (getIconsFromMap('Purchase').includes(purchase))
				skillBoosts.removeIconsFromMap(purchase);
			if (purchase.contains.pet !== undefined && getIconsFromMap('Pet').includes(purchase.contains.pet))
				skillBoosts.removeIconsFromMap(purchase.contains.pet);
		}
	} catch (e) {
		console.error(`[Skill Boosts]: ${e}`);
	}
});
//Update shop requirements on dungeon completion
patch(CombatManager, 'addDungeonCompletion').after(function(_, dungeon) {
	getIconsFromMap('Purchase').filter(x => x.purchaseRequirements[0] !== undefined && x.purchaseRequirements[0].dungeon === dungeon).forEach((purchase) => {
		updatePurchaseRequirements(purchase);
		updatePurchaseBg(purchase);
	});
});
//Update after building a building
patch(Township, 'buildBuilding').after(function(_, building) {
	if (!this.canBuildTierOfBuilding(building, true))
		return;
	getIconsFromMap('Purchase').filter(x => x.contains.pet !== undefined && x.purchaseRequirements.some(y => y.building === building)).forEach((purchase) => {
		updatePurchaseBg(purchase);
		updatePurchaseRequirements(purchase);
	});
});



//Update GP/SC in Tooltips for Purchases
['add', 'remove'].forEach((func) => {
	patch(Currency, func).after(function(_, amount) {
		if (this === game.raidCoins)
			return;
		let currencyQueue = skillBoosts.renderQueue.currency;
		if (currencyQueue.get(this) !== undefined)
			currencyQueue.set(this, currencyQueue.get(this) + amount);
		else
			currencyQueue.set(this, amount);
	});
});
//Update on Item gain
['addItem', 'removeItemQuantity'].forEach((func) => {
	patch(Bank, func).after(function(success, item, quantity) {
		if (func === 'removeItemQuantity' && quantity > 0)
			success = true;
		if (success) {
			let itemQueue = skillBoosts.renderQueue.items;
			if (itemQueue.has(item))
				itemQueue.set(item, itemQueue.get(item) + quantity);
			else
				itemQueue.set(item, quantity);
		}
	});
});


function updateCurrency() {
	if (!game.loopStarted || this.renderQueue.currency.size === 0)
		return;
	let currentAmount, purchaseCost, obstacleCost;
	this.renderQueue.currency.forEach((qty, currency) => {
		if (currency instanceof GP)
			currentAmount = game.gp.amount, purchaseCost = 'gp', obstacleCost = 'gp';
		else if (currency instanceof SlayerCoins)
			currentAmount = game.slayerCoins.amount, purchaseCost = 'slayerCoins', obstacleCost = 'sc';

		getIconsFromMap('Obstacle').forEach((obstacle) => {
			let costs = this.getObstacleCost(obstacle, true)[obstacleCost];
			if (currentAmount >= costs - qty && currentAmount <= costs + qty)
				updateObstacleBg(obstacle);
		});
		getIconsFromMap('Purchase').forEach((purchase) => {
			let costs = purchase.costs[purchaseCost].cost;
			if (currentAmount >= costs - qty && currentAmount <= costs + qty) {
				updatePurchaseCost(purchase);
				updatePurchaseBg(purchase);
			}
		});
		getIconsFromMap('POI').forEach((poi) => {
			let costs = this.getTravelCosts(poi)[obstacleCost];
			if (currentAmount >= costs - qty && currentAmount <= costs + qty)
				updatePOIBg(poi);
		});
	});
	this.renderQueue.currency.clear();
}

function updateItem() {
	if (!game.loopStarted || this.renderQueue.items.size === 0)
		return;
	this.renderQueue.items.forEach((qty, item) => {
		if (getIconsFromMap('Consumable').includes(item)) {
			updateConsumableBg(item);
			updateConsumableQty(item);
		} else if (getIconsFromMap('Equipment').includes(item))
			updateEquipmentBg(item);

		let bankQty = game.bank.getQty(item);
		getIconsFromMap('Obstacle').filter(y => y.itemCosts.some(x => x.item === item)).forEach((obstacle) => {
			let costs = this.getObstacleCost(obstacle, true)._items;
			costs.forEach((costQty, costItem) => {
				if (bankQty >= costQty - qty && bankQty <= costQty + qty)
					updateObstacleBg(obstacle);
			});
		});
		getIconsFromMap('Purchase').filter(y => y.costs.items.some(x => x.item === item)).forEach((purchase) => {
			purchase.costs.items.forEach(({ item, quantity }) => {
				if (bankQty >= quantity - qty && bankQty <= quantity + qty) {
					updatePurchaseCost(purchase);
					updatePurchaseBg(purchase);
				}
			});
		});
	});
	this.renderQueue.items.clear();
}

function updateItemAndCurrency() {
	updateCurrency.bind(this)();
	updateItem.bind(this)();
}

//Misc Patching
//Move the Menu with the Player
patch(SidebarItem, 'click').before(function() {
	let action = game.openPage.action;
	if (action)
		oldPage = action.id;
	else
		oldPage = null;
});
patch(SidebarItem, 'click').after(function() {
	skillBoosts.skillPage = this.id;
	skillBoosts.updateForSkillChange(skillBoosts.skillPage, true, oldPage);
});
// Introduce custom loops for renderQueue
patch(Game, 'startMainLoop').before(function() {
	if (this.loopStarted)
		return;
	itemAndCurrencyInterval = window.setInterval(updateItemAndCurrency.bind(skillBoosts), 2000);
	renderingInterval = window.setInterval(skillBoosts.render.bind(skillBoosts), 500);
});
patch(Game, 'stopMainLoop').before(function() {
	if (!this.loopStarted)
		return;
	clearInterval(itemAndCurrencyInterval);
	clearInterval(renderingInterval);
});
//Fix for black Cartography Map bug
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