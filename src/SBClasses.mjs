const { getResourceUrl, settings, characterStorage, patch } = mod.getContext(
		import.meta),
	generalSettings = settings.section('General'),
	get = generalSettings.get,
	player = game.combat.player,
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
	inactiveIcon = getResourceUrl('assets/inactive.png');

let dataDecoded = false;

// A modified version of Melvor's InfoIcon
class SkillBoostsIconElement extends HTMLElement {
	constructor(category, item) {
		super();
		this.item = item;
		this.category = category;
		this._content = new DocumentFragment();
		this.container = this._content.appendChild(createElement('div', { attributes: [['data-sbMainTooltip', '']] }));
		if ((item instanceof EquipmentItem && this.item.validSlots.length > 2) || this.category === 'Obstacle')
			this.container.setAttribute('data-sbAltTooltip', '');
		if (['Consumable', 'POI', 'Astrology', 'Synergy'].includes(this.category) || this.item.consumesChargesOn) {
			this.text = createElement('div', {
				className: `pill-center`,
			}).appendChild(createElement('small', {
				className: `badge-pill bg-secondary`,
				text: 0
			}));
		}
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	setText(qty) {
		this.text.textContent = formatNumber(qty, 2);
	}
	destroy() {
		this.container.remove();
	}
	hide() {
		if (!this.container.classList.contains('d-none'))
			hideElement(this.container);
	}
	show() {
		if (this.container.classList.contains('d-none'))
			showElement(this.container);
	}
	setBg(hexColor) {
		if (this.bgColor === hexColor)
			return;
		this.bgColor = hexColor; // Value is auto converted to rbg so save the Hex color
		this.container.style.backgroundColor = hexColor;
	}
	setPillbox(style) {
		if (this.text.className.includes(style))
			return;
		this.text.classList.remove('bg-secondary', 'bg-warning', 'bg-danger');
		this.text.classList.add(style);
	}
}

class SkillBoostsIcon extends SkillBoostsIconElement {
	constructor(category, item, media, basicTooltip = false, size = 40) {
		super(category, item);
		this.basicTooltip = basicTooltip;
		this.container.className = `sb-icon m-1 resize-${size}`;
		this.image = this.container.appendChild(createElement('img', {
			className: `p-1 resize-${size}`,
		}));
		if (basicTooltip)
			this.tooltip = createElement('div', { attributes: [['data-sbTooltipContent', '']] }).appendChild(createElement('div', { className: 'font-size-sm' })).parentElement;
		if (media)
			this.setImage(media);
		if (this.category === 'Obstacle') {
			this.inactiveIcon = this.container.appendChild(createElement('img', {
				className: 'inactive-sb d-none',
				attributes: [['src', inactiveIcon]]
			}));
		}
		if (this.text)
			this.container.append(this.text.parentElement);
	}
	setImage(media) {
		this.image.src = media;
	}
	setTooltip(text) {
		this.tooltip.children[0].textContent = text;
	}
}
window.customElements.define('skillboosts-icon', SkillBoostsIcon);

class SkillBoostsSynergy extends SkillBoostsIconElement {
	constructor(category, synergy) {
		super(category, synergy);
		this.container.className = `sb-synergy-icon`;
		this.iconContainer = this.container.appendChild(createElement('div', {
			className: `d-inline-flex`,
		}));
		this.summon1Image = this.iconContainer.appendChild(createElement('div', {
			className: `mr-1`,
		})).appendChild(createElement('img', {
			className: `p-1 resize-40`,
		}));
		this.summon2Image = this.iconContainer.appendChild(createElement('div', {
			className: `ml-1`,
		})).appendChild(createElement('img', {
			className: `p-1 resize-40`,
		}));
		if (!game.summoning.isSynergyUnlocked(synergy)) {
			this.synergyLocked = this.container.appendChild(createElement('img', {
				className: 'synergy-locked d-none',
				attributes: [['src', assets.getURI('assets/media/skills/summoning/synergy_locked.svg')]]
			}));
		}
		if (this.text)
			this.container.append(this.text.parentElement);
	}
	setText(qty1, qty2) {
		this.text.textContent = `${formatNumber(qty1, 2)} | ${formatNumber(qty2, 2)}`;
	}
	setImage() {
		this.summon1Image.src = this.item.summons[0].media;
		this.summon2Image.src = this.item.summons[1].media;
	}
}
window.customElements.define('skillboosts-synergy', SkillBoostsSynergy);

class SBAgilitySelect extends HTMLElement {
	constructor(built, destroy, iconArr) {
		super();
		this.built = built;
		this.destroyed = destroy;
		this.iconArr = iconArr;
		this.iconMap = new Map();
		this._content = new DocumentFragment();
		this._content.append(getTemplateNode('SkillBoosts-Agility-Selection'));
		const getElem = (id) => getAnyElementFromFragment(this._content, id);
		this.builtContainer = getElem('SB-Built-Container');
		this.builtName = getElem('SB-Built-Name');
		this.builtCosts = getElem('SB-Built-Cost');
		this.requirements = getElem('SB-Built-Requirements');
		this.builtPassives = getElem('SB-Built-Passives');
		this.destroyedContainer = getElem('SB-Destroy-Container');
		this.destroyedName = getElem('SB-Destroy-Name');
		this.destroyedCosts = getElem('SB-Destroy-Cost');
		this.destroyedPassives = getElem('SB-Destroy-Passives');
		this.tiersContainer = getElem('SB-Agi-Tiers');
		this.boostsContainer = getElem('SB-Agi-Boosts');

		this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
		if (this.destroyed) {
			this.destroyedName.textContent = `${getLangString('MENU_TEXT_DESTROY')} ${this.destroyed.name}?`;
			showElement(this.destroyedContainer);
		}
		if (this.built === this.destroyed)
			hideElements([this.builtContainer, this.destroyedContainer])
		this.built instanceof AgilityObstacle ? this.setObstacles() : this.setPillars();

		if (this.built.realm === melvorRealm) {
			this.costReductionItems();
			this.updateBgs();
		}
		this.createAllTierIcons();
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	createAllTierIcons() {
		let type = skillBoosts.getObstacleType(this.built) === 'Obstacle';
		let obstacles = type ? game.agility.sortedMasteryActions : game.agility.pillars.allObjects;
		let sortedObstacles = obstacles.filter(x => x.category === this.built.category && x.realm === this.built.realm && this.built.slot.obstacleCount === x.slot.obstacleCount);
		sortedObstacles.forEach(obstacle => {
			if (obstacle === this.destroyed)
				return;
			let icon = new SkillBoostsIcon('', obstacle, obstacle.media, false);
			skillBoosts.mainTooltipController.init(icon.container);
			icon.container.onclick = () => {
				this.built = obstacle;
				this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
				type ? this.setObstacles(false) : this.setPillars(false);
				this.updateBuildButton();
			};
			this.tiersContainer.append(icon);
			skillBoosts.updateObstacleBg(obstacle, icon, false);
		});
	}
	setObstacles(updateDestroyed = true) {
		this.setObstacle(this.built, this.builtCosts, this.builtPassives, this.requirements);
		if (this.destroyed && updateDestroyed)
			this.setObstacle(this.destroyed, this.destroyedCosts, this.destroyedPassives);
	}
	setPillars(updateDestroyed = true) {
		this.setPillar(this.built, this.builtCosts, this.builtPassives);
		if (this.destroyed && updateDestroyed)
			this.setPillar(this.destroyed, this.destroyedCosts, this.destroyedPassives);
	}
	buildObstacle() {
		let type = skillBoosts.getObstacleType(this.built) === 'Obstacle';
		if (!skillBoosts.canBuildObstacle(this.built) || this.built === this.destroyed)
			return;
		type ? game.agility.buildObstacle(this.built) : game.agility.buildPillar(this.built);
		skillBoosts.renderObstacleBg();
	}
	updateCosts() {
		let costs = skillBoosts.getObstacleCost(this.built);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), this.builtCosts, true);
		if (this.destroyed) {
			let dcosts = skillBoosts.getObstacleCost(this.destroyed);
			skillBoosts.setObstacleCosts(dcosts.getItemQuantityArray(), dcosts.getCurrencyQuantityArray(), this.destroyedCosts, true);
		}
	}
	costReductionItems() {
		let fragment = new DocumentFragment();
		this.iconArr.forEach((item) => {
			let icon = new SkillBoostsIcon('Equipment', item, item.media);
			skillBoosts.mainTooltipController.init(icon.container);
			fragment.append(icon);
			icon.container.onclick = () => {
				if (game.bank.getQty(item) !== 0) {
					player.equipItem(item, player.selectedEquipmentSet, item.validSlots[0], game.bank.getQty(item));
					this.updateBgs();
					this.updateCosts();
					this.updateBuildButton();
				}
			};
			this.iconMap.set(icon, item);
		});
		this.boostsContainer.append(fragment);
	}
	updateBuildButton() {
		let buildBtn = SwalLocale.getConfirmButton();
		if (skillBoosts.canBuildObstacle(this.built) && !this.built.isBuilt)
			buildBtn.style = ``;
		else
			buildBtn.style = `display: none;`;
		showElement(this.builtContainer);
		if (this.destroyed)
			showElement(this.destroyedContainer);
	}
	updateBgs() {
		this.iconMap.forEach((item, icon) => {
			if (item instanceof EquipmentItem) {
				if (player.equipment.checkForItem(item))
					icon.setBg(get('colorBgs')[0]);
				else if (game.bank.getQty(item) !== 0)
					icon.setBg(get('colorBgs')[3]);
				else if (skillBoosts.checkOtherEquipmentSets(item))
					icon.setBg(get('colorBgs')[1]);
				else
					icon.setBg(get('colorBgs')[2]);
			}
		});
	};
	setPassives(obstacle, passivesElem, negMult = 1) {
		const createElem = (desc, textClass) => {
			return createElement('h5', {
				className: `${textClass} font-size-sm font-w400 m-1`,
				text: desc,
				parent: passivesElem,
			});
		};
		passivesElem.innerHTML = '';
		passivesElem.append(...skillBoosts.getModifierNodes(obstacle, negMult, 1, false));
	}
	setObstacle(obstacle, costsElem, passivesElem, requiresElem) {
		if (requiresElem)
			requiresElem.textContent = getLangString('MENU_TEXT_REQUIRES');
		const costs = skillBoosts.getObstacleCost(obstacle);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), costsElem, true);
		if (requiresElem) {
			let levelReq = [new SkillLevelRequirement({ skillID: game.agility.id, level: obstacle.slot.level }, game)];
			if (obstacle.abyssalLevel > 0)
				levelReq.push(new AbyssalLevelRequirement({ skillID: game.agility.id, level: obstacle.slot.abyssalLevel }, game));
				[...levelReq, ...obstacle.skillRequirements].forEach((requirement) => {
				const textClass = game.checkRequirement(requirement, false) ? 'text-success' : 'text-danger';
				let type = requirement.type === 'SkillLevel' ? 'MENU_TEXT_LEVEL' : 'MENU_TEXT_ABYSSAL_LEVEL';
				let newReq = skillBoosts.createInlineRequirement(requirement.skill.media, templateLangString(type, { level: `${requirement.level}` }), textClass);
				skillBoosts.createImageTooltip(newReq.children[0], requirement.skill.name);
				requiresElem.append(newReq);
			});
		}
		this.setPassives(obstacle, passivesElem, game.agility.getObstacleNegMult(obstacle));
	}
	setPillar(pillar, costsElem, passivesElem) {
		const costs = game.agility.getPillarBuildCosts(pillar);
		skillBoosts.setObstacleCosts(costs.getItemQuantityArray(), costs.getCurrencyQuantityArray(), costsElem, true);
		this.setPassives(pillar, passivesElem);
	}
}
window.customElements.define('sb-agility-select', SBAgilitySelect);

class SBColorSetting extends HTMLElement {
	constructor() {
		super();
		this._content = new DocumentFragment();
		this.parent = this._content.appendChild(createElement('div', { className: 'text-center' }));
		this.warning = createElement('span', {
			text: `${langString['SETTING_HEX_FORMAT'][setLang]} #rrggbb`,
			className: 'd-none justify-content-center alert-danger'
		});
		this.container = createElement('div', {
			className: 'row no-gutters text-center justify-content-around',
		});
		for (let i = 1; i < 6; i++) {
			let setting = this.colorSettingElem(),
				input = setting.querySelector('#input'),
				picker = setting.querySelector('#SB-picker');
			input.addEventListener('change', () => {
				if (input.value[0] !== '#') {
					this.warning.classList.replace('d-none', 'd-flex');
					this.load();
					return;
				}
				this.warning.classList.replace('d-flex', 'd-none');
				this.save('#input');
			});
			picker.addEventListener('change', () => {
				input.value = `${picker.value}`;
				this.warning.classList.replace('d-flex', 'd-none');
				this.save('#SB-picker');
			});
			this.container.append(setting);
		};
		this.parent.append(this.warning, this.container);
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	colorSettingElem() {
		return createElement('div', {
			attributes: [['style', 'width:92px']],
			children: [
				createElement('div', {
					children: [
						createElement('input', {
							id: 'SB-picker',
							className: 'btn-light sb-picker',
							attributes: [['type', 'color']]
						}),
						createElement('input', {
							id: 'input',
							className: 'form-control form-control-sm text-center sb-input',
							attributes: [['type', 'text']]
						})
					]
				})
			]
		});
	}
	load() {
		get('colorBgs').forEach((value, i) => {
			this.container.querySelectorAll('#SB-picker')[i].value = value;
			this.container.querySelectorAll('#input')[i].value = value;
		});
	}
	save(id) {
		let values = [];
		this.container.querySelectorAll(id).forEach((elem) => { values.push(elem.value); });
		generalSettings.set('colorBgs', values);
		this.load();
		skillBoosts.updateBackgrounds(values);
		agiCostSetting.updateBgs();
	}
}
window.customElements.define('sb-color-setting', SBColorSetting);

class AgilityCostSetting extends HTMLElement {
	constructor() {
		super();
		this._content = new DocumentFragment();
		this.parent = this._content.appendChild(createElement('div', { className: 'text-center' }));
		this.items = ['melvorF:Agility_Skillcape'];
		this.icons = new Map();
		this.label = createElement('span', {
			className: 'font-weight-normal',
			text: langString['SETTING_AGILITY_COST'][setLang]
		});
		this.itemsContainer = createElement('div', {
			className: `row no-gutters justify-content-center`
		});
		this.parent.append(this.label, this.itemsContainer);
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	init() {
		if (cloudManager.hasTotHEntitlementAndIsEnabled)
			this.items.push('melvorTotH:Superior_Agility_Skillcape');
		if (game.currentGamemode.id === 'melvorAoD:AncientRelics')
			this.items.push('melvorAoD:Agility_Lesser_Relic');
		this.items.forEach((itemID) => { this.createIcons(itemID), this.updateBgs(itemID, false); });
	}
	createIcons(itemID) {
		let item = game.items.getObjectByID(itemID),
			icon = new SkillBoostsIcon('Equipment', item, item.media, true);
		icon.setTooltip(item.name);
		skillBoosts.mainTooltipController.init(icon.container);
		this.itemsContainer.append(icon);
		icon.container.onclick = () => { this.updateBgs(itemID, true); };
		this.icons.set(itemID, icon);
	}
	updateBgs(itemID, save) {
		let items = skillBoosts.data.saveData.get('Skill_Boosts:Settings'),
			icons = [this.icons.get(itemID)];
		if (icons[0] === undefined)
			icons = this.icons;
		icons.forEach((icon) => {
			if (items.includes(icon.item.id))
				icon.setBg(get('colorBgs')[save ? 2 : 0]);
			else
				icon.setBg(get('colorBgs')[save ? 0 : 2]);
		});
		if (save) {
			items.includes(itemID) ? items.splice(items.indexOf(itemID), 1) : items.push(itemID);
			skillBoosts.updateAllObstacles();
		}
	}
}
window.customElements.define('sb-agility-setting', AgilityCostSetting);

// Credits to Psycast (Equipment Presents) for the following "SBSaving" crc32 system
// https://mod.io/g/melvoridle/m/psy-equipment-presets
class SBSaving {
	constructor() {
		this.crcTable = [];
		this.crcFrom;
		this.oldDataMap = new Map([['0', 'Skill_Boosts:Menu_Closed'], ['1', 'Skill_Boosts:Menu_Opened'], ['agi', 'Skill_Boosts:Settings'], ['Default Sorting', 'Skill_Boosts:No_Realm'], ['mf', 'Skill_Boosts:Mass_Filter']]);
		this.SAVE_VERSION = 3;
	}
	initAndLoad() {
		this.load();
		delete this.crcFrom;
		delete this.reader;
		delete this.oldDataMap;
	}
	makeCRCTable() {
		var c;
		for (var n = 0; n < 256; n++) {
			c = n;
			for (var k = 0; k < 8; k++) {
				c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
			}
			this.crcTable[n] = c;
		}
	}
	crc32(str) {
		var crc = 0 ^ (-1);
		for (var i = 0; i < str.length; i++) {
			crc = (crc >>> 8) ^ this.crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
		}
		return (crc ^ (-1)) >>> 0;
	}
	crcCreateMapID() {
		const crcStrings = [
			...game.skills.allObjects,
			...game.realms.allObjects,
			...game.items.equipment.allObjects,
			...game.items.potions.allObjects,
			...game.agility.actions.allObjects,
			...game.agility.pillars.allObjects,
			...game.pets.allObjects,
			...game.shop.purchases.allObjects,
			...game.astrology.actions.allObjects,
			...game.summoning.actions.allObjects
		];
		if (cloudManager.hasAoDEntitlementAndIsEnabled) {
			game.cartography.worldMaps.forEach(map => crcStrings.push(...map.pointsOfInterest.allObjects));
		};
		let mappedIDs = [...crcStrings.map(item => item.id), ...this.oldDataMap.keys()];
		const items = [...new Set(mappedIDs)]; // deduplicate
		this.crcFrom = new Map(items.map(item => [this.crc32(item), item]));

		if (items.length !== this.crcFrom.size) {
			console.warn(`[Skill Boosts] CRC Array length doesn't match Map sizes, possible duplicate!`);
		}
	}
	readMapping(crc) {
		if (crc === 0x0)
			return null;

		const item = this.crcFrom.get(crc);
		if (!item) {
			//console.warn(`[Skill Boosts] Decoded CRC had no matching item: 0x${crc.toString(16)}`);
			return null;
		}
		return item;
	}
	load() {
		const compressedData = characterStorage.getItem('saveData');
		if (compressedData)
			this.decode(this.reader, compressedData);
	}
	save(writer) {
		const compressedData = this.encode(writer);
		try {
			characterStorage.setItem('saveData', compressedData);
		} catch (e) {
			notifyPlayer(game.combat, `[Skill Boosts]: ${e}`, 'danger');
		}
	}
	decode(reader, saveString) {
		let data = skillBoosts.data.saveData;
		try {
			reader.setRawData(fflate.unzlibSync(fflate.strToU8(atob(saveString), true)).buffer);

			let MAGIC = reader.getString();
			if (MAGIC !== 'PLMV') {
				console.error("[Skill Boosts] Invalid Preset Config Magic:", MAGIC.substr(0, 4));
				return [];
			}

			let version = reader.getUint16();
			if (version > this.SAVE_VERSION)
				throw new Error('[Skill Boosts] Save version higher then script version.');

			if (version < 3) {
				game.summoning.synergies.forEach(synergy => {
					this.oldDataMap.set(`${synergy.summons[0].id}+${synergy.summons[1].id}`, skillBoosts.getSynergyID(synergy));
				});

				this.makeCRCTable();
				this.crcCreateMapID();

				let len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skillID = this.readMapping(reader.getUint32());
					let lenItems = reader.getUint16();
					let itemIDs = [];
					for (let i = 0; i < lenItems; i++) {
						let itemID = this.readMapping(reader.getUint32());
						if (itemID !== null)
							itemIDs.push(itemID);
					}
					if (this.oldDataMap.has(skillID))
						skillID = this.oldDataMap.get(skillID);
					if (skillID === 'Skill_Boosts:Settings')
						data.set(skillID, itemIDs);
					else if (skillID !== null)
						itemIDs.forEach(itemID => skillBoosts.addValueToMap(data, itemID, skillID));
				}

				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = this.readMapping(reader.getUint32());
					let state = this.readMapping(reader.getUint32());
					if (this.oldDataMap.has(state))
						state = this.oldDataMap.get(state);
					if (skill !== null && state !== null && skill !== 'mf')
						skillBoosts.addValueToMap(data, skill, state);
				}

				if (version >= 2) {
					len = reader.getUint16();
					for (let i = 0; i < len; i++) {
						let skill = this.readMapping(reader.getUint32());
						let realm = this.readMapping(reader.getUint32());
						if (this.oldDataMap.has(realm))
							realm = this.oldDataMap.get(realm);
						if (skill !== null && realm !== null)
							skillBoosts.addValueToMap(data, skill, realm);
					}
				}
			} else {
				let len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let key = reader.getNamespacedObjectId();
					let lenData = reader.getUint16();
					let valueArr = [];
					for (let i = 0; i < lenData; i++) {
						let val = reader.getNamespacedObjectId();
						if (val !== undefined)
							valueArr.push(val);
					};
					if (key !== undefined)
						data.set(key, valueArr);
				}
			}
			dataDecoded = true;
		} catch (_a) {
			console.error("[Skill Boosts] Config Reader Error", _a);
		}
	}
	encode(writer) {
		let data = skillBoosts.data.saveData;

		writer.writeString('PLMV');
		writer.writeUint16(this.SAVE_VERSION);

		writer.writeUint16(data.size);
		data.forEach((valueArr, key) => {
			writer.writeNamespacedObject(key);
			writer.writeUint16(valueArr.length);
			valueArr.forEach(val => writer.writeNamespacedObject(val));
		});

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	};
}

// Save System V2.0 //
patch(Game, 'decode').after(function(_, reader, version) {
	if (dataDecoded)
		return;
	let modWriter = new ExternalSaveWriter('Read', 1, reader);
	SBSave.reader = modWriter;
});
patch(Game, 'encode').before(function(writer) {
	if (!dataDecoded)
		return;
	let modWriter = new ExternalSaveWriter('Write', 128, writer);
	SBSave.save(modWriter);
});

class ExternalSaveWriter extends SaveWriter {
	constructor(mode, dataExtensionLength, externalSaveWriter) {
		super(mode, dataExtensionLength);
		this.externalSaveWriter = externalSaveWriter;
	}
	writeNamespacedObject(objectID) {
		const [namespace, localID] = objectID.split(':');
		let nameMap = this.externalSaveWriter.namespaceMap.get(namespace);
		if (nameMap === undefined) {
			nameMap = new Map();
			this.externalSaveWriter.namespaceMap.set(namespace, nameMap);
		}
		let numericID = nameMap.get(localID);
		if (numericID === undefined) {
			numericID = this.externalSaveWriter.nextNumericID;
			this.externalSaveWriter.nextNumericID++;
			nameMap.set(localID, numericID);
		}
		this.writeUint16(numericID);
	}
	getNamespacedObjectId() {
		const numericID = this.getUint16();
		const id = this.externalSaveWriter.numericToStringIDMap.get(numericID);
		if (id === undefined)
			throw new Error(`[Skill Boosts]: No namespaced id exists for numeric ID: ${numericID}`);
		return id;
	}
}

const langString = {
	'SETTING_HEX_FORMAT': {
		'en': 'Format:',
		'zh-CN': '格式：',
		'zh-TW': '格式：',
		'fr': 'Format:',
		'de': 'Format:',
		'it': 'Formato:',
		'ko': '체재:',
		'ja': 'フォーマット：',
		'pt': 'Formatar:',
		'pt-br': 'Formatar:',
		'es': 'Formato:',
		'ru': 'Формат:',
		'tr': 'Biçim:',
	},
	'SETTING_AGILITY_COST': {
		'en': 'Use these when updating Obstacle Backgrounds?',
		'zh-CN': '更新障碍物背景时使用这些吗？',
		'zh-TW': '更新障礙物背景時要使用這些嗎？',
		'fr': 'Les utiliser lors de la mise à jour des arrière-plans d\'obstacles ?',
		'de': 'Verwenden Sie diese beim Aktualisieren von Hindernishintergründen?',
		'it': 'Usarli quando aggiorni gli sfondi degli ostacoli?',
		'ko': '장애물 배경을 업데이트할 때 이것을 사용하시겠습니까?',
		'ja': '障害物の背景を更新するときにこれらを使用しますか?',
		'pt': 'Use-os ao atualizar Fundos de Obstáculos?',
		'pt-br': 'Use-os ao atualizar Fundos de Obstáculos?',
		'es': '¿Utilizarlos al actualizar los fondos de obstáculos?',
		'ru': 'Использовать их при обновлении фона препятствий?',
		'tr': 'Engel Arka Planlarını güncellerken bunlar kullanılsın mı?',
	},
}

let SBSave = new SBSaving();
let customColorSetting = new SBColorSetting();
let agiCostSetting = new AgilityCostSetting();

export { SBSave, SkillBoostsIcon, SkillBoostsSynergy, SBAgilitySelect, customColorSetting, agiCostSetting };