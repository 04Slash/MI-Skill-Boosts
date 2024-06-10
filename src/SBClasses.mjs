const { getResourceUrl, settings, characterStorage } = mod.getContext(
		import.meta),
	generalSettings = settings.section('General'),
	get = generalSettings.get,
	player = game.combat.player,
	melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
	inactiveIcon = getResourceUrl('assets/inactive.png');

// A modified version of Melvor's InfoIcon
class SkillBoostsIconElement extends HTMLElement {
	constructor(category, item, tooltip) {
		super();
		this.item = item;
		this.category = category;
		this._content = new DocumentFragment();
		this.container = this._content.appendChild(createElement('div'));
		if (['Consumable', 'POI', 'Astrology', 'Synergy'].includes(this.category) || this.item.consumesChargesOn) {
			this.text = createElement('div', {
				className: `pill-center`,
			}).appendChild(createElement('small', {
				className: `badge-pill bg-secondary`,
				text: 0
			}));
		}
		if (tooltip !== undefined)
			return this.createTooltip(tooltip);
		this.tooltip = tippy(this.container, {
			content: '',
			placement: 'top',
			allowHTML: true,
			interactive: false,
			animation: false,
			onShow: (instance) => {
				if (this.item !== undefined)
					instance.setContent(skillBoosts.createTooltip(this, this.item));
			},
		});
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	createTooltip(tooltip) {
		this.tooltip = tippy(this.container, {
			content: tooltip,
			placement: 'top',
			allowHTML: true,
			interactive: false,
			animation: false,
		});
	}
	setText(qty) {
		this.text.textContent = formatNumber(qty, game.settings.formatNumberSetting ? 2 : 0);
	}
	setTooltip(content) {
		this.tooltip.setContent(content);
	}
	destroy() {
		this.tooltip.destroy();
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
	constructor(category, item, media, tooltip, size = 40) {
		super(category, item, tooltip);
		this.container.className = `sb-icon m-1 resize-${size}`;
		this.image = this.container.appendChild(createElement('img', {
			className: `p-1 resize-${size}`,
		}));
		this.image.src = media;
		if (item instanceof AgilityObstacle || item instanceof AgilityPillar) {
			this.inactiveIcon = this.container.appendChild(createElement('img', {
				className: 'inactive-sb d-none',
				attributes: [['src', inactiveIcon]]
			}));
		}
		if (this.text)
			this.container.append(this.text.parentElement);
	}
}
window.customElements.define('skillboosts-icon', SkillBoostsIcon);

class SkillBoostsSynergy extends SkillBoostsIconElement {
	constructor(category, synergy, tooltip) {
		super(category, synergy, tooltip);
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
		this.summon1Image.src = this.item.summons[0].media;
		this.summon2Image.src = this.item.summons[1].media;
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
		let decimals = game.settings.formatNumberSetting ? 2 : 0;
		this.text.textContent = `${formatNumber(qty1, decimals)} | ${formatNumber(qty2, decimals)}`;
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
		this.builtName = getElem('SB-Built-Name');
		this.builtCosts = getElem('SB-Built-Cost');
		this.requirements = getElem('SB-Built-Requirements');
		this.builtPassives = getElem('SB-Built-Passives');
		this.destroyedName = getElem('SB-Destroy-Name');
		this.destroyedCosts = getElem('SB-Destroy-Cost');
		this.destroyedPassives = getElem('SB-Destroy-Passives');
		this.boostsContainer = getElem('SB-Agi-Boosts');

		this.builtName.textContent = `${getLangString('MENU_TEXT_BUILD')} ${this.built.name}?`;
		if (this.destroyed) {
			this.destroyedName.textContent = `${getLangString('MENU_TEXT_DESTROY')} ${this.destroyed.name}?`;
			showElement(getElem('SB-Destroy-Container'));
		}

		if (this.built instanceof AgilityObstacle)
			this.setObstacles();
		else
			this.setPillars();

		if (this.built.realm === melvorRealm) {
			this.costReductionItems();
			this.updateBgs();
		}
	}
	connectedCallback() {
		this.appendChild(this._content);
	}
	setObstacles() {
		this.setObstacle(this.built, this.builtCosts, this.builtPassives, this.requirements);
		if (this.destroyed)
			this.setObstacle(this.destroyed, this.destroyedCosts, this.destroyedPassives);
	}
	setPillars() {
		this.setPillar(this.built, this.builtCosts, this.builtPassives);
		if (this.destroyed)
			this.setPillar(this.destroyed, this.destroyedCosts, this.destroyedPassives);
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
			fragment.append(icon);
			icon.container.onclick = () => {
				if (game.bank.getQty(item) !== 0) {
					player.equipItem(item, player.selectedEquipmentSet, item.validSlots[0], game.bank.getQty(item));
					this.updateBgs();
					this.updateCosts();
					let buildBtn = SwalLocale.getConfirmButton();
					if (skillBoosts.canBuildObstacle(this.built))
						buildBtn.style = ``;
					else
						buildBtn.style = `display: none;`;
				}
			};
			this.iconMap.set(icon, item);
		});
		this.boostsContainer.append(fragment);
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
			icon = new SkillBoostsIcon('Equipment', itemID, item.media, item.name);
		this.itemsContainer.append(icon);
		icon.container.onclick = () => { this.updateBgs(itemID, true); };
		this.icons.set(itemID, icon);
	}
	updateBgs(itemID, save) {
		let items = skillBoosts.data.filteredItems.get('agi'),
			icons = [this.icons.get(itemID)];
		if (icons[0] === undefined)
			icons = this.icons;
		icons.forEach((icon) => {
			if (items.includes(icon.item))
				icon.setBg(get('colorBgs')[save ? 2 : 0]);
			else
				icon.setBg(get('colorBgs')[save ? 0 : 2]);
		});
		if (save) {
			items.includes(itemID) ? items.splice(items.indexOf(itemID), 1) : items.push(itemID);
			skillBoosts.updateAllObstacles();
			SBSave.save();
		}
	}
}
window.customElements.define('sb-agility-setting', AgilityCostSetting);

// Credits to Psycast (Equipment Presents) for the following "SBSaving" system
// https://mod.io/g/melvoridle/m/psy-equipment-presets
// crc32
class SBSaving {
	constructor() {
		this.crcTable = [];
		this.crcMap;
		this.SAVE_VERSION = 2;
	}
	initAndLoad() {
		this.makeCRCTable();
		this.crcCreateMapID();
		this.load();
		delete this.crcMap.from;
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
			...game.summoning.actions.allObjects,
			...game.modifierRegistry.allObjects
		];
		if (cloudManager.hasAoDEntitlementAndIsEnabled) {
			game.cartography.worldMaps.forEach((map) => {
				crcStrings.push(...map.pointsOfInterest.allObjects);
			});
		};
		let mappedIDs = crcStrings.map(item => item.id);
		mappedIDs.push('0', '1', 'mf', 'agi');
		game.summoning.synergies.forEach(({ summons }) => {
			mappedIDs.push(`${summons[0].id}+${summons[1].id}`);
		});
		const items = [...new Set(mappedIDs)]; // deduplicate
		const crcFrom = new Map(items.map(item => [this.crc32(item), item]));
		const crcTo = new Map(items.map(item => [item, this.crc32(item)]));

		if (items.length !== crcFrom.size || items.length !== crcTo.size) {
			console.warn(`[Skill Boosts] CRC Array length doesn't match Map sizes, possible duplicate!`);
		}
		this.crcMap = {
			from: crcFrom,
			to: crcTo
		};
	};
	readMapping(crc) {
		if (crc === 0x0)
			return null;

		const item = this.crcMap.from.get(crc);
		if (!item) {
			//console.warn(`[Skill Boosts] Decoded CRC had no matching item: 0x${crc.toString(16)}`);
			return null;
		}
		return item;
	};
	load() {
		const compressedData = characterStorage.getItem('saveData');
		if (compressedData)
			this.decode(compressedData, skillBoosts.data);
	}
	save() {
		const compressedData = this.encode(skillBoosts.data);
		try {
			characterStorage.setItem('saveData', compressedData);
		} catch (e) {
			notifyPlayer(game.combat, `[Skill Boosts]: ${e}`, 'danger');
		}
	}
	decode(saveString, data) {
		const reader = new SaveWriter('Read', 1);
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

			let len = reader.getUint16();
			for (let i = 0; i < len; i++) {
				let item = this.readMapping(reader.getUint32());
				let lenSkill = reader.getUint16();
				let skills = [];
				for (let i = 0; i < lenSkill; i++) {
					let skill = this.readMapping(reader.getUint32());
					if (skill !== null)
						skills.push(skill);
				};
				if (item !== null)
					data.filteredItems.set(item, skills);
			}
			len = reader.getUint16();
			for (let i = 0; i < len; i++) {
				let skill = this.readMapping(reader.getUint32());
				let state = this.readMapping(reader.getUint32());
				if (skill !== null && state !== null)
					data.menuStates.set(skill, state);
			}
			if (version >= 2) {
				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = this.readMapping(reader.getUint32());
					let realm = this.readMapping(reader.getUint32());
					if (skill !== null && realm !== null)
						data.realmStates.set(skill, realm);
				}
				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = this.readMapping(reader.getUint32());
					let lenMods = reader.getUint16();
					let mods = [];
					for (let i = 0; i < lenMods; i++) {
						let modifier = this.readMapping(reader.getUint32());
						if (modifier !== null)
							mods.push(modifier);
					};
					if (skill !== null)
						data.hiddenModifiers.set(skill, mods);
				}
			}
		} catch (_a) {
			console.error("[Skill Boosts] Config Reader Error", _a);
		}
	}
	encode(data) {
		const writeUint32 = (value) => writer.writeUint32(this.crcMap.to.get(value) || 0);
		let writer = new SaveWriter('Write', 128);

		writer.writeString('PLMV');
		writer.writeUint16(this.SAVE_VERSION);

		writer.writeUint16(data.filteredItems.size);
		data.filteredItems.forEach((skillArr, item) => {
			writeUint32(item);
			writer.writeUint16(skillArr.length);
			skillArr.forEach((skill) => {
				writeUint32(skill);
			});
		});

		writer.writeUint16(data.menuStates.size);
		data.menuStates.forEach((state, skill) => {
			writeUint32(skill);
			writeUint32(state);
		});

		writer.writeUint16(data.realmStates.size);
		data.realmStates.forEach((realm, skill) => {
			writeUint32(skill);
			writeUint32(realm);
		});

		writer.writeUint16(data.hiddenModifiers.size);
		data.hiddenModifiers.forEach((modArr, skill) => {
			writeUint32(skill);
			writer.writeUint16(modArr.length);
			modArr.forEach((mod) => {
				writeUint32(mod);
			});
		});

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	};
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