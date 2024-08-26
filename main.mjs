export async function setup({ settings, loadModule, loadTemplates, onModsLoaded, onInterfaceReady, onCharacterLoaded, getResourceUrl, characterStorage }) {
	await loadTemplates('template.html');
	const getSlot = (id) => game.equipmentSlots.getObjectByID(id),
		filterSetting = (x) => !filterByIDSetting.some(y => y !== '' && x.id.toLowerCase().includes(y)),
		{ lang } = await loadModule('localization.mjs'),
		{ addLevelChangeEmitters, startRenderer } = await loadModule('src/Patching.mjs'),
		{ SBSave, SkillBoostsIcon, SkillBoostsSynergy, SBAgilitySelect, customColorSetting, agiCostSetting } = await loadModule('src/SBClasses.mjs'),
		{ getCommonModifiers, getMelvorModifiers, getAbyssalModifiers, sortModdedSkill } = await loadModule('src/ModifierData.mjs'),
		{ MainTooltipController, AltTooltipController } = await loadModule('src/Tooltips.mjs'),
		{ ImageLoader } = await loadModule('src/ImageLoader.mjs'),
		getLang = (key) => {
			if (!lang[key]) {
				return `SkillBoosts: Undefined Lang`;
			}
			return lang[key][setLang] ? lang[key][setLang] : lang[key]['en'];
		},
		generalSettings = settings.section('General'),
		get = (setting) => generalSettings.get(setting),
		player = game.combat.player,
		hasTotH = cloudManager.hasTotHEntitlementAndIsEnabled,
		hasAoD = cloudManager.hasAoDEntitlementAndIsEnabled,
		hasItA = cloudManager.hasItAEntitlementAndIsEnabled,
		defaultRealm = { id: 'Skill_Boosts:No_Realm', name: getLang('NO_REALM'), media: assets.getURI('assets/media/main/skill_tree.svg') },
		melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
		abyssalRealm = hasItA && game.realms.getObjectByID('melvorItA:Abyssal'),
		eternalRealm = hasItA && game.realms.getObjectByID('melvorItA:Eternal'),
		slotTypes = ['melvorD:Weapon', 'melvorD:Shield', 'melvorD:Helmet', 'melvorD:Platebody', 'melvorD:Platelegs', 'melvorD:Boots', 'melvorD:Gloves', 'melvorD:Cape', 'melvorD:Amulet', 'melvorD:Ring', 'melvorD:Gem', 'melvorD:Enhancement1', 'melvorD:Enhancement2', 'melvorD:Enhancement3', 'melvorD:Quiver', 'melvorD:Summon1', 'melvorD:Consumable'],
		providedRunes = ['melvorD:Air_Rune', 'melvorD:Water_Rune', 'melvorD:Earth_Rune', 'melvorD:Fire_Rune', 'melvorF:Nature_Rune', 'melvorF:Spirit_Rune', 'melvorF:Lava_Rune', 'melvorF:Mud_Rune', 'melvorTotH:Soul_Rune', 'melvorTotH:Infernal_Rune'],
		itemsByRealm = new Map([
			[melvorRealm.id, ['melvorF:Stardust', 'melvorF:Golden_Stardust', 'melvorD:Bird_Nest', 'melvorF:Ash', 'melvorD:Coal_Ore', 'melvorTotH:Charcoal']],
			[abyssalRealm.id, ['melvorItA:Abyssal_Stardust', 'melvorItA:Shadow_Raven_Nest', 'melvorItA:Shadow_Drake_Nest', 'melvorItA:Withered_Ash']]
		]),
		namespaceByRealm = new Map([
			[melvorRealm.id, ['melvorD', 'melvorF', 'melvorTotH', 'melvorAoD']],
			[abyssalRealm.id, ['melvorItA']]
		]),
		catOverrides = ['melvorD:Allotment', 'melvorD:Herb', 'melvorD:Tree', 'melvorD:Fish', 'melvorD:Soup', 'melvorF:Consumables', 'melvorF:Runes', 'melvorF:Wands', 'melvorD:Synergies'];


	let filterMode = 0,
		settingID = 0,
		debugEnabled = false,
		dustItems = [],
		tempSkills = [],
		filteredPets = [],
		filterByIDSetting = [],
		elementValueMap = new Map(),
		greenBg, yellowBg, redBg, defaultBg, filteredBg,
		presetSettings, pGet,
		windowWidth,
		lockedSynergyImg = assets.getURI('assets/media/skills/summoning/synergy_locked.svg'),
		passiveImg = getResourceUrl('assets/passive_slot_filled.png'),
		passiveIcon = createImgNode(passiveImg, 'inactive-sb'),
		infotips = generateInfotips();

	game.agility.pillars.forEach(pillar => {
		if (!pillar.isModded) {
			pillar._media = getResourceUrl(`assets/${pillar.localID}.png`);
		} else {
			let count = pillar.slot.obstacleCount;
			if (count === 10)
				pillar._media = getResourceUrl('assets/pillar.png');
			else if (count === 15)
				pillar._media = getResourceUrl('assets/elite_pillar.png');
			else if (count === 12)
				pillar._media = getResourceUrl('assets/abyssal_pillar.png');
		}
	});

	function createInfotip(text, bg, colorClass = '') {
		let template = createElement('div');
		let textNode = createElement('span', { text: text, className: 'ml-1' });
		let icon = createElement('span', { text: '[ . ]' });
		if (bg)
			icon.style = `background-color: ${bg};color: ${bg}`;
		else if (colorClass !== '')
			icon.className = [`badge-pill bg-${colorClass} text-${colorClass} font-size-xs`];
		else
			textNode.textContent = `•${textNode.textContent}`;
		if (bg || colorClass !== '')
			template.append(icon);
		template.append(textNode);
		return template;
	}

	function createImgNode(src, cls, text, returnNodes) {
		let container = createElement('div');
		let img = createElement('img', { attributes: [['src', src]], className: cls });
		if (text) createElement('span', { text: text });
		if (!returnNodes && text) container.append(img, text);
		return returnNodes ? [img, text] : text ? container : img;
	}

	function generateInfotips() {
		let colors = [greenBg, defaultBg, yellowBg, redBg, filteredBg],
			textClass = 'font-w600 d-flex justify-content-center text-info font-size-h6 mb-1 border-bottom',
			filteredTT = createInfotip(getLang('FILTERED_ICON'), filteredBg);

		let baseTooltip = createElement('div');
		for (let i = 1; i < 5; i++) { baseTooltip.append(createInfotip(getLang(`ITEM_DESC_${i}`), colors[i - 1])); }
		baseTooltip.append(filteredTT.cloneNode(true));

		const addContainer = (elem) => createElement('div', { className: 'font-w400 font-size-sm' }).appendChild(elem).parentElement;

		let filterInfotip = addContainer(createElement('div', { className: 'sb-pre-line', text: `${getLang('FILTERING_DESC_1')}\n${getLang('FILTERING_DESC_2')}\n${getLang('FILTERING_DESC_3')}` }));

		let equipmentInfotip = addContainer(createElement('div', { className: textClass, text: getLangString('COMBAT_MISC_18') }));
		equipmentInfotip.append(baseTooltip.cloneNode(true), createInfotip(getLang('POI_DESC_1'), null, 'danger'), createImgNode(passiveImg, 'skill-icon-xxs', getLang('PASSIVE')));
		for (let i = 6; i < 8; i++) { equipmentInfotip.append(createInfotip(getLang(`ITEM_DESC_${i}`))); };

		let consumableInfotip = addContainer(createElement('div', { className: textClass, text: getLangString('EQUIP_SLOT_Consumable') }));
		consumableInfotip.append(baseTooltip.cloneNode(true), createInfotip(getLang('ITEM_DESC_5'), null, 'warning'), createImgNode(lockedSynergyImg, 'skill-icon-xxs', getLang('LOCKED_SYNERGY')), createInfotip(getLang('ITEM_DESC_6')));

		let obstacleInfotip = addContainer(createElement('div', { className: textClass, text: getLangString('GAME_GUIDE_142') }));
		for (let i = 1; i < 5; i++) { obstacleInfotip.append(createInfotip(getLang(`OBSTACLE_DESC_${i}`), colors[i - 1])); };
		obstacleInfotip.append(filteredTT.cloneNode(true), createImgNode(getResourceUrl('assets/inactive.png'), 'skill-icon-xxs', getLang('INACTIVE')));
		for (let i = 5; i < 7; i++) { obstacleInfotip.append(createInfotip(getLang(`OBSTACLE_DESC_${i}`))); };

		let otherInfotip = addContainer(createElement('div', { className: textClass, text: getLang('OTHERS') }));
		otherInfotip.append(createInfotip(getLang('PURCHASE_DESC_1'), greenBg), createInfotip(getLang('OBSTACLE_DESC_3'), yellowBg), createInfotip(getLang('OTHER_DESC_1'), redBg), filteredTT.cloneNode(true), createInfotip(getLang('PURCHASE_DESC_2')), createInfotip(getLang('AUTOMATICALLY_HIDE')));

		return [filterInfotip, equipmentInfotip, consumableInfotip, obstacleInfotip, otherInfotip];
	}

	class SBRenderQueue {
		constructor() {
			this.equipment = {
				bg: new Set(),
				charge: new Set()
			};
			this.consumable = {
				bg: new Set(),
				qty: new Set()
			};
			this.obstacle = {
				bg: new Set(),
				active: new Set()
			};
			this.poi = {
				bg: new Set(),
				cost: new Set()
			};
			this.pet = {
				bg: new Set()
			};
			this.purchase = {
				bg: new Set()
			};
			this.constellation = {
				bg: new Set()
			};
			this.synergy = {
				bg: new Set(),
				qty: new Set(),
				locked: new Set()
			};
			this.items = new Map();
			this.currency = new Map();
			this.menu = false;
		}
	}

	class SkillBoostMenu extends HTMLElement {
		constructor(skill) {
			super();
			this.skill = skill;
			this._content = new DocumentFragment();
			this._content.append(getTemplateNode('SkillBoosts-Menu-Template'));
			const getElem = (id) => getAnyElementFromFragment(this._content, id);
			this.container = getElem('SB-Menu-Container');
			this.iconMenu = getElem('SB-Icon-Menu');
			this.skillDropdown = getElem('SB-Skill-Dropdown');
			this.dropDownSkills = getElem('SB-Dropdown-Skills');
			this.realmContainer = getElem('SB-Realm-Container');
			this.filterBtn = getElem('SB-Filter-Btn');
			this.boostsBtn = getElem('SB-Boosts-Btn');
			this.presetsBtn = getElem('SB-Presets-Btn');
			this.debugBtn = getElem('SB-Debug-Btn');
			this.alert = getElem('SB-Alert');
			this.searchBar = getElem('SB-Modifier-Search');
			this.clearSearchBtn = getElem('SB-Clear-Search-Btn');
			this.massFilterToggle = this._content.getElementById('SB-Mass-Filtering'); // This ID needs to exist
			this.realmIcons = [];
			this.iconContainers = [];
			this.iconParents = [];
			['Equipment', 'Consumable', 'Positive', 'Negative', 'Other'].forEach(category => {
				let container = getElem(`SB-${category}-Icons`);
				container.classList.add('row', 'no-gutters', 'justify-content-center', 'text-white');
				this.iconContainers.push(container);
				let parent = getElem(`SB-${category}-Parent`);
				parent.classList.add('sb-category');
				parent.children[0].classList.add('bg-dark-bank-block-header', 'sb-header');
				this.iconParents.push(parent);
			});
			this.massFilterToggle.id = `SB-Mass-Filtering-${settingID}`;
			this.massFilterToggle.parentElement.children[4].setAttribute('for', `SB-Mass-Filtering-${settingID}`);
			settingID++;

			this.filterBtn.onclick = () => this.toggleFilterModeOnClick();
			this.boostsBtn.onclick = () => this.toggleMenu(false);
			this.presetsBtn.onclick = () => this.openPresetMenu();
			this.debugBtn.onclick = () => this.toggleDebug();
			this.massFilterToggle.onclick = () => this.toggleMassFiltering(this.massFilterToggle.checked);
			this.searchBar.onkeyup = () => this.onSearchChange(this.searchBar.value);
			this.clearSearchBtn.onclick = () => { this.searchBar.value = '', this.onSearchChange(''); };

			this.initMenu();
		}
		connectedCallback() {
			this.appendChild(this._content);
		}
		get totalIcons() {
			let icons = skillBoosts.getRealmIcons(true, !filterMode);
			return icons.reduce((a, { category }) => a + (category === 'Synergy' ? 2 : 1), 0);
		}
		get shownIcons() {
			let icons = skillBoosts.getRealmIcons(true, !filterMode);
			return icons.reduce((a, { elem, category }) => {
				a[elem] = (a[elem] || 0) + (category === 'Synergy' ? 2 : 1);
				return a;
			}, [0, 0, 0, 0, 0]);
		}
		initMenu() {
			skillBoosts.data.skills.forEach(skill => this.dropDownSkills.append(this.createDropdownItem(skill)));
			this.skillDropdown.append(createImgNode((this.skill === game.attack ? game.combat.media : this.skill.media), 'resize-28 p-1'), this.getSkillName(this.skill));
			let realmOptions = skillBoosts.data.skillRealms.get(this.skill.id);
			if (realmOptions.includes(melvorRealm.id) && realmOptions.includes(abyssalRealm.id)) {
				skillBoosts.data.realms.forEach(realm => {
					let icon = new SkillBoostsIcon('', realm, realm.media, true, 28);
					icon.setTooltip(realm.name);
					icon.container.onclick = () => skillBoosts.onRealmChange(realm.id);
					icon.setBg('#6C757D');
					icon.container.classList.replace('m-1', 'mx-1');
					this.realmIcons.push(icon);
					this.realmContainer.append(icon);
				});
			} else {
				this.currentRealm = this.skill.currentRealm.id;
				skillBoosts.hideElement(this.realmContainer);
			}

			if (game.agility.hasMasterRelic(melvorRealm))
				this.iconParents[4].classList.replace('sb-other', 'sb-right');
			if (this.skill === game.attack) {
				this.container.classList.replace('sb-menu', 'sb-combat-menu');
				// this.appendCombatMenu();
			}
			if (mod.manager.getLoadedModList().includes('Equipment Presets') && pGet('showPresetBtn'))
				showElement(this.presetsBtn);

			this.translate(this.container);
			this.createTooltips();
			this.toggleMassFiltering(skillBoosts.data.saveData.get('Skill_Boosts:Settings').includes('Skill_Boosts:Mass_Filter'));
			this.skill = this.skill.id;
		}
		appendCombatMenu() {
			let _content = new DocumentFragment();
			let container = _content.appendChild(createElement('div', { className: 'd-flex justify-content-center btn-group' }));
			let btnClasses = ['btn-primary', 'btn-success', 'btn-info', 'btn-warning', 'btn-secondary', 'btn-danger'];
			let skills = [game.attack, game.ranged, game.altMagic, game.prayer, game.slayer];
			if (hasItA) skills.push(game.corruption);
			skills.forEach((skill, i) => {
				let btn = createElement('button', { className: `btn sb-btn ${btnClasses[i]} my-1 p-1`, text: skill.name });
				btn.onclick = () => this.updateCombatSkill(skills);
				container.append(btn);
			});
			this.iconMenu.before(_content);
		}
		updateCombatSkill(skills) {
			skillBoosts.getRealmIcons(true).forEach(icon => {
				if (icon.skill.some(x => skills.includes(x)))
					icon.snow();
				else
					icon.hide();
			});
		}
		onSearchChange(query) {
			let icons = skillBoosts.getRealmIcons(false, false);
			if (query === '') {
				icons.forEach(icon => {
					if (!icon.realms.includes(this.currentRealm) || (icon.isFiltered && !filterMode) || icon.isHidden || (icon.bgColor === redBg && get('hideRedBgs').includes(icon.category)))
						icon.hide();
					else
						icon.show();
				});
				this.setSearchNormal();
			} else {
				let searchKeys = ['slots', 'name'];
				if (['melvorD:Melvor', 'Skill_Boosts:No_Realm'].includes(this.currentRealm))
					searchKeys.push('melvorMods', 'melvorText');
				if (['melvorItA:Abyssal', 'Skill_Boosts:No_Realm'].includes(this.currentRealm))
					searchKeys.push('abyssalMods', 'abyssalText');
				const options = {
					shouldSort: false,
					tokenize: true,
					matchAllTokens: true,
					findAllMatches: true,
					threshold: 0.1,
					location: 0,
					distance: 100,
					maxPatternLength: 32,
					minMatchCharLength: 1,
					keys: searchKeys,
				};
				const fuse = new Fuse(icons, options);
				const result = fuse.search(query);
				icons.forEach(icon => { result.includes(icon) ? icon.show() : icon.hide(); });
				if (result.length === 0) {
					this.setSearchNone();
				} else {
					this.setSearchNormal();
				}
			}
		}
		setSearchNone() {
			this.searchBar.classList.add('text-danger');
		}
		setSearchNormal() {
			this.searchBar.classList.remove('text-danger');
		}
		translate(element) {
			element.getElementsByTagName('sb-lang').forEach(elem => {
				let id = elem.getAttribute('sb-lang-id');
				elem.textContent = getLang(id);
			});
			this.searchBar.placeholder = `${getLang('SEARCH')}...`;
		}
		createTooltips() {
			this.container.querySelectorAll('#SB-Info').forEach((info, i) => {
				let elem = info.querySelector("[data-sbTooltipContent]");
				if (elem == null)
					return;
				elem.innerHTML = '';
				elem.append(infotips[i].cloneNode(true));
			});
		}
		createDropdownItem(object) {
			const item = createElement('a', { className: 'dropdown-item pointer-enabled' });
			item.append(createImgNode((object === game.attack ? game.combat.media : object.media), 'resize-28 p-1'));
			item.append(this.getSkillName(object));
			item.onclick = () => skillBoosts.onSkillChange(false, object.id);
			return item;
		}
		getSkillName(object) {
			return (object === game.attack ? getLangString('PAGE_NAME_Combat') : object.name);
		}
		updateSelectedRealm(newRealm) {
			let oldRealmIcon = this.realmIcons.find(x => x.item.id === this.currentRealm);
			if (oldRealmIcon !== undefined)
				oldRealmIcon.setBg('#6C757D');
			let newRealmIcon = this.realmIcons.find(x => x.item.id === newRealm);
			if (newRealmIcon !== undefined)
				newRealmIcon.setBg(greenBg);
			this.currentRealm = newRealm;
		}
		toggleMenu(onLoad) {
			if (!skillBoosts.skillPage)
				return;
			let state = skillBoosts.data.saveData.get('Skill_Boosts:Menu_Opened').includes(skillBoosts.skillPage);
			if (onLoad)
				state = !state;
			else {
				let oldValue = skillBoosts.findValueInMap(skillBoosts.data.saveData, skillBoosts.skillPage, ['Skill_Boosts:Menu_Closed', 'Skill_Boosts:Menu_Opened']);
				skillBoosts.removeValueFromMap(skillBoosts.data.saveData, oldValue, skillBoosts.skillPage);
				skillBoosts.addValueToMap(skillBoosts.data.saveData, `${state ? 'Skill_Boosts:Menu_Closed' : 'Skill_Boosts:Menu_Opened'}`, skillBoosts.skillPage);
			}
			state ? skillBoosts.hideElement(this.iconMenu) : skillBoosts.showElement(this.iconMenu);
			if (skillBoosts.skillPage === 'melvorAoD:Cartography')
				skillBoosts.updateCartographyMap();
		}
		toggleMassFiltering(checked) {
			let toggle = checked ? skillBoosts.addValueToMap : skillBoosts.removeValueFromMap;
			toggle(skillBoosts.data.saveData, 'Skill_Boosts:Settings', 'Skill_Boosts:Mass_Filter');
			skillBoosts.data.menus.forEach(menu => menu.massFilterToggle.checked = checked);
		}
		toggleFilterAlert() {
			filterMode ? skillBoosts.showElement(this.alert) : skillBoosts.hideElement(this.alert);
		}
		toggleFilterModeOnClick() {
			filterMode = 1 - filterMode;
			this.toggleFilterAlert();
			this.toggleAllFilteredIcons();
			skillBoosts.setClassByLength();
		}
		toggleAllFilteredIcons() {
			skillBoosts.getSkillIcons().filter(x => x.isFiltered && (!filterMode || x.realms.includes(this.currentRealm))).forEach(icon => {
				filterMode ? icon.show() : icon.hide();
			});
		}
		updateIcon(icon) {
			if (!icon || !icon.category)
				return;
			if (icon.isFiltered)
				return skillBoosts.toggleFilterState(icon, icon.isFiltered, filterMode);

			let queue = skillBoosts.renderQueue[icon.category.toLowerCase()];
			queue.bg.add(icon.item);

			if (['Equipment', 'Pet', 'Purchase', 'Constellation'].includes(icon.category))
				return;
			else if (icon.category === 'Consumable')
				queue.qty.add(icon.item);
			else if (icon.category === 'Obstacle')
				queue.active.add(icon.item);
			else if (icon.category === 'Synergy') {
				queue.qty.add(icon.item);
				queue.locked.add(icon.item);
			} else if (icon.category === 'POI')
				queue.cost.add(icon.item);
			else
				console.warn(`[Skill Boosts]: ${icon.category} for ${icon.item.id} was not found. Updating icon failed.`);
		}
		createPresetSwal(presets, presetAPI) {
			let container = createElement('div', { className: 'block block-rounded-extra mb-0 p-3' });

			let createPreset = container.appendChild(createElement('button', { className: 'btn btn-primary col-12 mb-2', text: getLang('CREATE_PRESET') }));
			createPreset.onclick = () => presetAPI.uiShowCreate();

			let presetContainer = container.appendChild(createElement('div'));
			presets.forEach(preset => {
				let presetElem = skillBoosts.createDividerElem(presetContainer, ' d-flex border-bottom');
				presetElem.classList.replace('border-dark', 'border-secondary');

				let equipBtn = presetElem.appendChild(createElement('button', { className: 'btn btn-sm btn-success col-2 my-2', text: getLangString('TUTORIAL_TASK_PREFIX_2') }));
				equipBtn.onclick = () => presetAPI.equipPresetByGID(preset.gid);

				let textContainer = presetElem.appendChild(createElement('div', { className: 'col-8 text-left my-2 font-size-base' }));
				textContainer.appendChild(createImgNode(presetAPI.uiGetPresetIcon(preset).media, 'resize-28 p-1'));
				textContainer.append(preset.title);

				let editBtn = presetElem.appendChild(createElement('button', { className: 'btn btn-sm btn-info col-2 my-2', text: getLang('EDIT') }));
				editBtn.onclick = () => presetAPI.uiShowEditByGID(preset.gid);
			});

			SwalLocale.fire({ html: container });
		}
		openPresetMenu() {
			if (!mod.manager.getLoadedModList().includes('Equipment Presets'))
				return;
			let presetAPI = mod.api.equipmentPresets;
			let presets = presetAPI.getPresets();
			if (presets === undefined)
				return;
			let skill = skillBoosts.data.skills.find(x => x.id === skillBoosts.selectedSkillID),
				filterType = pGet('presetFilter'),
				skillPresets;

			if (filterType === 0)
				skillPresets = presets.filter(x => x.type === 0 || x.type === (skill === game.attack ? 1 : 2));
			else if (filterType === 1)
				skillPresets = presets.filter(x => x.type === (skill === game.attack ? 1 : 2));
			else if (filterType === 2)
				skillPresets = presets.filter(x => x.minibar.includes(skillBoosts.selectedSkillID) || (skill === game.attack && x.type === 1));

			if (pGet('noPreset') && skillPresets.length < 1)
				presetAPI.uiShowCreate();
			else if (pGet('onePreset') && skillPresets.length === 1)
				presetAPI.uiShowEditByGID(skillPresets[0].gid);
			else
				this.createPresetSwal(skillPresets, presetAPI);
		}
		toggleAllDebugBtns() {
			skillBoosts.data.menus.forEach(menu => {
				menu.debugBtn.classList.contains('d-none') ? showElement(menu.debugBtn) : hideElement(menu.debugBtn);
			});
		}
		toggleDebug() {
			debugEnabled = !debugEnabled;
			skillBoosts.data.menus.forEach(menu => {
				if (debugEnabled)
					menu.debugBtn.classList.replace('btn-secondary', 'btn-danger');
				else
					menu.debugBtn.classList.replace('btn-danger', 'btn-secondary');
			});
		}
	}
	window.customElements.define('skillboost-menu', SkillBoostMenu);

	class SkillBoosts {
		constructor() {
			this.renderQueue = new SBRenderQueue();
			this.mainTooltipController = MainTooltipController;
			this.data = { skills: [], realms: [defaultRealm, melvorRealm, abyssalRealm], modifierMap: new MultiMap(2), menus: new Map(), icons: new Map(), skillRealms: new Map(), headers: new Map(), saveData: new Map([['Skill_Boosts:Settings', []], ['Skill_Boosts:Menu_Closed', []], ['Skill_Boosts:Menu_Opened', []]]), moddedModifiers: [], agiSelectArr: [] };
			this.agiCosts = false;
		}
		get skillPage() {
			if (game.openPage.skills !== undefined && this.data.skills.some(x => game.openPage.skills.includes(x)))
				return this.data.skills.find(x => game.openPage.skills.includes(x)).id;
			this.selectedSkillID = undefined;
			this.menu = undefined;
		}
		initSB() {
			// Init Settings
			this.initSettings();
			// Init Data
			this.initSkills();
			this.createMenus();
			this.initModifiers();
			// Filter everything
			this.filterEquipment();
			this.filterPotions();
			if (hasAoD)
				this.filterPOIs();
			this.filterObstacles();
			this.filterPurchases();
			this.filterPets();
			this.filterConstellations();
			this.filterSynergies();
		}
		initSettings() {
			this.updateBackgrounds(get('colorBgs'), true);

			filterByIDSetting = get('filter').toLowerCase().replace(/\s/g, '').split(",");

			this.data.realms.forEach(realm => {
				if (!this.data.saveData.has(realm.id))
					this.data.saveData.set(realm.id, []);
			});

			if (get('instaBuildObstacle') === true && !characterStorage.getItem('ibo')) {
				generalSettings.set('obstacleMenu', 'never');
				characterStorage.setItem('ibo', 1);
			}
		}
		initSkills() {
			let sidebarItems = [{ id: 'melvorD:Attack' }, ...sidebar.category('Passive').items(), ...sidebar.category('Non-Combat').items()];
			sidebarItems.forEach(item => {
				let skill = game.skills.find(x => x.id === item.id);
				if (!skill)
					skill = tempSkills.find(x => x.namespace === item.id.substr(0, item.id.indexOf(':')));
				if (skill === undefined)
					return console.warn(`[Skill Boosts]: ${item.id} was not recognised as a valid Skill Boosts skill. The Sidebar's ID OR Namespace must match the skill's ID OR Namespace. If you are not trying to add a skill into Skill Boosts, you can ignore this.`);
				if (!skill.isModded || this.data.headers.has(item.id))
					this.data.skills.push(skill);
				if (!skill.isModded)
					this.data.skillRealms.set(skill.id, skill.getRealmOptions().filter(x => x !== eternalRealm).map(x => x.id));
			});
			let realms = hasItA ? [melvorRealm.id, abyssalRealm.id] : [melvorRealm.id];
			['melvorD:Attack', 'melvorD:Township'].forEach(skillID => this.data.skillRealms.set(skillID, realms));
			['melvorD:Magic', 'melvorAoD:Cartography'].forEach(skillID => this.data.skillRealms.set(skillID, [melvorRealm.id]));
			this.data.headers.set(game.attack.id, combatAreaMenus.categoryMenu.parentElement.lastElementChild);
		}
		createMenus() {
			let realmIDs = this.data.realms.map(x => x.id);
			this.data.skills.forEach(skill => {
				let menu = new SkillBoostMenu(skill);
				this.data.menus.set(skill.id, menu);
				this.moveMenu(skill.id, menu);

				let menuState = get('state');
				if (menuState === 1) {
					this.addValueToMap(this.data.saveData, 'Skill_Boosts:Menu_Closed', skill.id);
					hideElement(menu.iconMenu);
				} else if (menuState === 2) {
					this.addValueToMap(this.data.saveData, 'Skill_Boosts:Menu_Opened', skill.id);
					showElement(menu.iconMenu);
				} else
					menu.toggleMenu(true);

				if (!this.findValueInMap(this.data.saveData, skill.id, realmIDs))
					this.addValueToMap(this.data.saveData, skill.currentRealm.id, skill.id);
			});
			if (hasItA && !this.findValueInMap(this.data.saveData, game.harvesting.id, realmIDs))
				this.addValueToMap(this.data.saveData, abyssalRealm.id, game.harvesting.id);
		}
		initModifiers() {
			this.data.skills.forEach(skill => {
				this.addModifiersToMap(melvorRealm.id, skill.id, getMelvorModifiers(skill.id));
				if (hasItA)
					this.addModifiersToMap(abyssalRealm.id, skill.id, getAbyssalModifiers(skill.id));
			});
			this.data.moddedModifiers.forEach(data => {
				data.skills = data.skills === undefined ? this.data.skills : Array.from(data.skills);
				if (data.melvorModifiers.length > 0)
					data.skills.forEach(skill => this.addModifiersToMap(melvorRealm.id, skill.id, data.melvorModifiers));
				if (hasItA && data.abyssalModifiers.length > 0)
					data.skills.forEach(skill => this.addModifiersToMap(abyssalRealm.id, skill.id, data.abyssalModifiers));
			});
		}
		resizeMenu() {
			this.renderQueue.menu = true;
		}
		updateBackgrounds(colors, onLoad) {
			[greenBg, yellowBg, redBg, defaultBg, filteredBg] = colors;
			infotips = generateInfotips();
			if (!onLoad) {
				this.getSkillIcons().forEach(icon => this.menu.updateIcon(icon));
				this.data.menus.forEach(menu => menu.createTooltips());
			}
		}
		render() {
			this.renderEquipmentBg();
			this.renderEquipmentCharge();
			this.renderConsumableBg();
			this.renderConsumableQty();
			this.renderObstacleBg();
			this.renderObstacleActive();
			this.renderPOIBg();
			this.renderPOICost();
			this.renderPetBg();
			this.renderPurchaseBg();
			this.renderConstellationBg();
			this.renderSynergyBg();
			this.renderSynergyQty();
			this.renderSynergyLocked();
		}
		renderEquipmentBg() {
			if (this.renderQueue.equipment.bg.size === 0)
				return;
			this.renderQueue.equipment.bg.forEach(item => this.updateEquipmentBg(item));
			this.setIconSearch();
			this.renderQueue.equipment.bg.clear();
		}
		renderEquipmentCharge() {
			if (this.renderQueue.equipment.charge.size === 0)
				return;
			this.renderQueue.equipment.charge.forEach(item => this.updateChargeItem(item));
			this.renderQueue.equipment.charge.clear();
		}
		renderConsumableBg() {
			if (this.renderQueue.consumable.bg.size === 0)
				return;
			this.renderQueue.consumable.bg.forEach(consumable => this.updateConsumableBg(consumable));
			this.setIconSearch();
			this.renderQueue.consumable.bg.clear();
		}
		renderConsumableQty() {
			if (this.renderQueue.consumable.qty.size === 0)
				return;
			this.renderQueue.consumable.qty.forEach(consumable => this.updateConsumableQty(consumable));
			this.renderQueue.consumable.qty.clear();
		}
		renderObstacleBg() {
			if (this.renderQueue.obstacle.bg.size === 0)
				return;
			this.renderQueue.obstacle.bg.forEach(obstacle => this.updateObstacleBg(obstacle));
			this.setIconSearch();
			this.renderQueue.obstacle.bg.clear();
		}
		renderObstacleActive() {
			if (this.renderQueue.obstacle.active.size === 0)
				return;
			this.renderQueue.obstacle.active.forEach(obstacle => this.updateObstacleActive(obstacle));
			this.renderQueue.obstacle.active.clear();
		}
		renderPOIBg() {
			if (this.renderQueue.poi.bg.size === 0)
				return;
			this.renderQueue.poi.bg.forEach(poi => this.updatePOIBg(poi));
			this.setIconSearch();
			this.renderQueue.poi.bg.clear();
		}
		renderPOICost() {
			if (this.renderQueue.poi.cost.size === 0)
				return;
			this.renderQueue.poi.cost.forEach(poi => this.updatePOICosts(poi));
			this.renderQueue.poi.cost.clear();
		}
		renderPetBg() {
			if (this.renderQueue.pet.bg.size === 0)
				return;
			this.renderQueue.pet.bg.forEach(pet => this.updatePetBg(pet));
			this.setIconSearch();
			this.renderQueue.pet.bg.clear();
		}
		renderPurchaseBg() {
			if (this.renderQueue.purchase.bg.size === 0)
				return;
			this.renderQueue.purchase.bg.forEach(purchase => this.updatePurchaseBg(purchase));
			this.setIconSearch();
			this.renderQueue.purchase.bg.clear();
		}
		renderConstellationBg() {
			if (this.renderQueue.constellation.bg.size === 0)
				return;
			this.renderQueue.constellation.bg.forEach(constellation => this.updateConstellationBg(constellation));
			this.setIconSearch();
			this.renderQueue.constellation.bg.clear();
		}
		renderSynergyBg() {
			if (this.renderQueue.synergy.bg.size === 0)
				return;
			this.renderQueue.synergy.bg.forEach(synergy => this.updateSynergyBg(synergy));
			this.setIconSearch();
			this.renderQueue.synergy.bg.clear();
		}
		renderSynergyQty() {
			if (this.renderQueue.synergy.qty.size === 0)
				return;
			this.renderQueue.synergy.qty.forEach(synergy => this.updateSynergyQty(synergy));
			this.renderQueue.synergy.qty.clear();
		}
		renderSynergyLocked() {
			if (this.renderQueue.synergy.locked.size === 0)
				return;
			this.renderQueue.synergy.locked.forEach(synergy => this.updateSynergyLocked(synergy));
			this.renderQueue.synergy.locked.clear();
		}
		renderMenu() {
			if (!this.renderQueue.menu)
				return;
			windowWidth = window.innerWidth;
			this.setClassByLength();
			this.renderQueue.menu = false;
		}
		setIconSearch(menu = this.menu) {
			if (menu !== undefined && menu.searchBar.value !== '')
				menu.onSearchChange(menu.searchBar.value);
		}
		updateMenu(newSkillID) {
			this.selectedSkillID = newSkillID;
			if (this.menu === undefined)
				this.menu = this.data.menus.get(newSkillID);
			this.menu.toggleMenu(true);
			this.menu.toggleFilterAlert();
			let icons = this.getSkillIcons();
			this.updateForRealmChange(this.menu.currentRealm, icons);
			icons.forEach(icon => this.menu.updateIcon(icon));
			this.setIconSearch();
			this.render();
		}
		updateForSkillChange(newSkillID, isNewPage) {
			if (!this.data.skills.some(x => x.id === newSkillID && ((!isNewPage && !x.isUnlocked) || x.isUnlocked)))
				return;
			let oldMenu = this.menu;
			this.menu = this.data.menus.get(newSkillID);

			if (!oldMenu)
				return this.updateMenu(newSkillID);

			if (!isNewPage && (oldMenu === this.menu || this.selectedSkillID === newSkillID))
				return; // Don't update when using the dropdown and selecting the same skill
			if (isNewPage && oldMenu.skillPage === this.menu.skillPage && this.menu.skillPage === this.skillPage)
				return; // Don't update when clicking the same skill in the sidebar

			this.updateMenu(newSkillID);

			if (isNewPage && oldMenu.skillPage !== oldMenu.skill) {
				oldMenu.remove(); // Remove the old menu if it's not on the correct skill page otherwise you get 2 menus on 1 page
				oldMenu.skillPage = null;
			}

			if (isNewPage && this.skillPage === this.menu.skillPage)
				return; // Only move the menu if the new menu isn't on the new page
			if (!this.moveMenu(isNewPage ? newSkillID : this.skillPage))
				return;

			if (oldMenu !== this.menu && oldMenu.skillPage !== null) {
				oldMenu.remove(); // If a menu was moved, the old menu must be removed
				oldMenu.skillPage = null;
			}
		}
		onSkillChange(isNewPage, skillID = this.skillPage) {
			this.updateForSkillChange(skillID, isNewPage);
			this.setClassByLength();
			this.setIconSearch();
		}
		updateForRealmChange(newRealmID, icons, menu = this.menu, skillID = this.selectedSkillID) {
			if (!hasItA || (!this.data.realms.some(x => x.id === newRealmID) && newRealmID !== undefined))
				return;

			let realmState = get('realmStates');
			if (newRealmID === undefined)
				newRealmID = realmState === 'Auto' ? this.findValueInMap(this.data.saveData, skillID, this.data.realms.map(x => x.id)) : realmState;

			if (menu === undefined || newRealmID === menu.currentRealm || this.data.skillRealms.get(skillID).length <= 1)
				return;

			if (!icons)
				icons = this.getSkillIcons(false, false, false, skillID);

			icons.forEach(icon => {
				if (!icon.realms.includes(newRealmID) || (icon.isFiltered && !filterMode) || icon.isHidden || (icon.bgColor === redBg && get('hideRedBgs').includes(icon.category)))
					icon.hide();
				else
					icon.show();
			});
			let oldRealmID = menu.currentRealm;
			menu.updateSelectedRealm(newRealmID);
			if (realmState === 'Auto') {
				this.removeValueFromMap(this.data.saveData, oldRealmID, skillID);
				this.addValueToMap(this.data.saveData, newRealmID, skillID);
			}
		}
		onRealmChange(realmID, icons, menu, skillID) {
			this.updateForRealmChange(realmID, icons, menu, skillID);
			this.setClassByLength(menu);
			this.setIconSearch(menu);
		}
		moveMenu(skillID, menu = this.menu) {
			let skill = game.skills.getObjectByID(skillID),
				header;
			if (skill !== undefined)
				header = skill.header;
			if (header == undefined)
				header = this.data.headers.get(skillID);
			if (header == null)
				return console.warn(`[Skill Boosts] No Skill Header found for: ${skillID}`);
			menu.skillPage = skillID;
			skillID === 'melvorD:Attack' ? header.before(menu) : header.children[0].append(menu);
			return true;
		}
		createIcon(item, modifiers, realms, skill, elem, category) {
			let icon;
			if (category === 'Synergy') {
				icon = new SkillBoostsSynergy(category, item);
				icon.slots = ['Summon1', 'Summon2'];
			} else {
				icon = new SkillBoostsIcon(category, item);
			}
			if (game.openPage.skills && game.openPage.skills[0] === skill && realms.includes(this.findValueInMap(this.data.saveData, skill.id, this.data.realms.map(x => x.id))))
				icon.setImage(item.media);

			if (item instanceof EquipmentItem)
				icon.slots = item.validSlots.map(x => x.localID);
			if (item.name !== undefined)
				icon.name = item.name;
			if (modifiers !== undefined) {
				if (modifiers.melvorText.length > 0 || modifiers.melvorMods.length > 0) {
					icon.melvorText = modifiers.melvorText;
					icon.melvorMods = modifiers.melvorMods;
				}
				if (modifiers.abyssalText.length > 0 || modifiers.abyssalMods.length > 0) {
					icon.abyssalText = modifiers.abyssalText;
					icon.abyssalMods = modifiers.abyssalMods;
				}
			}
			if (modifiers === undefined || [...modifiers.melvorText, ...modifiers.abyssalText].length <= 0) {
				if (realms.includes('melvorD:Melvor'))
					icon.melvorText = [item.description];
				if (realms.includes('melvorItA:Abyssal'))
					icon.abyssalText = [item.description];
			}

			icon.elem = elem;
			icon.skill = skill.id;
			icon.realms = [...realms, defaultRealm.id];
			this.data.menus.get(skill.id).iconContainers[elem].appendChild(icon);
			let id = category === 'Synergy' ? this.getSynergyID(item) : item.id;

			if (this.data.saveData.has(skill.id) && this.data.saveData.get(skill.id).includes(id)) {
				this.toggleFilterState(icon, undefined, false);
			} else
				icon.isFiltered = false;

			if (category === 'Equipment')
				this.equipmentOnClick(item, icon);
			else if (category === 'Obstacle')
				this.obstacleOnClick(item, icon);
			else if (category === 'Consumable')
				this.consumableOnClick(item, icon);
			else if (category === 'Synergy')
				this.synergyOnClick(item, icon);
			else if (category === 'Purchase')
				this.purchaseOnClick(item, icon);
			else if (category === 'POI')
				this.poiOnClick(item, icon);
			else if (category === 'Pet')
				this.petOnClick(icon);
			else if (category === 'Constellation')
				this.constellationOnClick(item, icon);

			this.addValueToMap(this.data.icons, skill.id, icon);
		}
		getAllIcons(exclude) {
			let icons = [];
			this.data.icons.forEach((iconArr, skill) => {
				if (skill !== exclude)
					icons.push(...iconArr);
			});
			return icons;
		}
		getSkillIcons(removeRedBgs, removeFiltered, removeHidden, skillID = this.selectedSkillID) {
			if (skillID === undefined) return [];
			let icons = this.data.icons.get(skillID);
			if (icons === undefined) return [];
			if (removeFiltered && !filterMode)
				icons = icons.filter(x => !x.isFiltered);
			if (removeHidden)
				icons = icons.filter(x => !x.isHidden);
			if (removeRedBgs && get('hideRedBgs').length > 0)
				icons = icons.filter(x => !(x.bgColor === redBg && get('hideRedBgs').includes(x.category)));
			return icons;
		}
		getRealmIcons(removeRedBgs, removeFiltered = true) {
			let realm = this.menu !== undefined && (this.menu.currentRealm);
			if (!realm) return [];
			return this.getSkillIcons(removeRedBgs, removeFiltered, true).filter(x => x.realms.includes(realm));
		}
		getItemIcon(item, removeRedBgs) {
			return this.getSkillIcons(removeRedBgs, true, true).find(x => x.item === item);
		}
		getCategoryIcons(category, removeRedBgs) {
			return this.getSkillIcons(removeRedBgs, true, true).filter(x => x.category === category).map(x => x.item);
		}
		filterIcon(oIcon) {
			let isFiltered = oIcon.isFiltered,
				icons = this.menu.massFilterToggle.checked ? this.getAllIcons().filter(x => x.item === oIcon.item) : [oIcon];

			icons.forEach(icon => {
				this.toggleFilterState(icon, !isFiltered, true);
				if (!icon.isFiltered)
					this.menu.updateIcon(icon);
			});

			this.saveFilteredIcon(icons, isFiltered);
			this.render();
		}
		toggleFilterState(icon, setState, showIcon) {
			icon.isFiltered = setState || !icon.isFiltered;
			if (icon.isFiltered)
				icon.setBg(filteredBg);
			showIcon ? icon.show() : icon.hide();
		}
		saveFilteredIcon(icons, remove) {
			icons.forEach(icon => {
				let id = icon.category === 'Synergy' ? this.getSynergyID(icon.item) : icon.item.id;
				let saveIcon = remove ? this.removeValueFromMap : this.addValueToMap;
				saveIcon(this.data.saveData, icon.skill, id);
			});
		}
		hideUndiscoveredIcons(icon, shouldHide, category) {
			if (shouldHide && get('hideRedBgs').includes(category) || icon.isFiltered)
				icon.hide();
			else if (this.menu !== undefined && icon.realms.includes(this.menu.currentRealm))
				icon.show();
		}
		getItemMods(object) {
			let modifiers = [];

			if (object.modifiers !== undefined)
				object.modifiers.forEach(mod => modifiers.push({ mod: mod, inverted: false }));

			if (object.combatEffects !== undefined) {
				object.combatEffects.forEach(effect => {
					if (effect.effect !== undefined) {
						let statGroup = effect.effect.statGroups;
						if (statGroup.stacks !== undefined) {
							if (statGroup.stacks.modifiers !== undefined)
								statGroup.stacks.modifiers.forEach(mod => modifiers.push({ mod: mod, inverted: (effect.effect.target === 'Target') }));
							if (statGroup.stacks.combatEffects !== undefined)
								statGroup.stacks.combatEffects.forEach(mod => modifiers.push({ mod: mod, inverted: true }));
						}
						if (statGroup.debuff !== undefined) {
							if (statGroup.debuff.modifiers !== undefined)
								statGroup.debuff.modifiers.forEach(mod => modifiers.push({ mod: mod, inverted: true }));
						}
					}
				});
			}

			if (object.playerModifiers !== undefined)
				object.playerModifiers.forEach(mod => modifiers.push({ mod: mod, inverted: false }));

			if (object.enemyModifiers !== undefined)
				object.enemyModifiers.forEach(mod => modifiers.push({ mod: mod, inverted: true }));

			if (object.conditionalModifiers !== undefined) {
				object.conditionalModifiers.forEach(mods => {
					if (mods.modifiers !== undefined)
						mods.modifiers.forEach(mod => modifiers.push({ mod: mod, inverted: false, conditionals: (mods.condition.conditions || [mods.condition]) }));
					if (mods.enemyModifiers !== undefined)
						mods.enemyModifiers.forEach(mod => modifiers.push({ mod: mod, inverted: true, conditionals: (mods.condition.conditions || [mods.condition]) }));
				});
			}
			return modifiers;
		}
		hasModifiers(isNeg, skill, itemModifiers, item) {
			let realms = [],
				modifiers = { melvorMods: [], melvorText: [], abyssalMods: [], abyssalText: [] };
			if (itemModifiers.length <= 0 || (isNeg && (item instanceof AgilityObstacle || item instanceof AgilityPillar) && game.agility.hasMasterRelic(melvorRealm)))
				return { realms, modifiers };

			this.data.realms.forEach(realm => {
				if (!this.data.skillRealms.get(skill.id).includes(realm.id))
					return;
				const isMelvor = realm === melvorRealm,
					hasDamageType = (obj) => (!obj || !obj.damageType || (obj.damageType.id === 'melvorItA:Abyssal' && !isMelvor) || (obj.damageType.id === 'melvorD:Normal' && isMelvor));
				if (item instanceof WeaponItem && (skill.isCombat || skill === game.thieving) && !hasDamageType(item))
					return;
				if (!isMelvor && (item instanceof EquipmentItem && ['melvorD:Mining_Gloves', 'melvorD:Gem_Gloves', 'melvorF:Scroll_Of_Essence'].includes(item.id)))
					return;
				if (item && item.consumesOn && (item.consumesOn.some(x => x && ((x.realms && !x.realms.has(realm)) || (x.actions && [...x.actions].some(y => y.realm !== realm))))))
					return;
				const searchMods = [...getCommonModifiers(skill.id), ...this.data.modifierMap.get(realm.id, skill.id)],
					gpCurr = isMelvor ? game.gp : game.abyssalPieces,
					scCurr = isMelvor ? game.slayerCoins : game.abyssalSlayerCoins,
					isApplicable = (m, inverted) => (m.modifier && m.isNegative === (inverted ? !isNeg : isNeg) && (!inverted || skill === game.attack) && !m.modifier.disabled),
					isCorrupted = (m) => (!m || !m.group || (m.group.id === 'melvorItA:Corruption' && !isMelvor)),
					hasRealm = (x) => (!x.realm || x.realm === realm),
					hasSkill = (x) => (!x.skill || x.skill === skill || (x.skill.isCombat && skill === game.attack)),
					hasCategory = (m, cat) => (!m[cat] || namespaceByRealm.get(realm.id).includes(m[cat].namespace) || (!isMelvor && catOverrides.includes(m[cat].id))),
					hasAction = (m) => (!m.action || (m.action.realm === realm && ((m.action.potions && m.action.potions[0].action === skill) || (!m.action.skill || (!m.action.potions && m.action.skill === skill)) || item.id === 'melvorTotH:Toxic_Maker_Gloves'))),
					hasCurrency = (m) => (!m.currency || m.currency === gpCurr || (skill === game.attack && m.currency === scCurr)),
					hasItem = (m) => (!m.item || ![...itemsByRealm.values()].flat().includes(m.item.id) || itemsByRealm.get(realm.id).includes(m.item.id)),
					foundMods = itemModifiers.filter(({ mod, inverted, conditionals }) => isApplicable(mod, inverted) && hasRealm(mod) && hasSkill(mod) && hasCategory(mod, 'category') && hasCategory(mod, 'subcategory') && hasAction(mod) && hasCurrency(mod) && hasDamageType(mod) && (!conditionals || conditionals.every(x => hasDamageType(x) && isCorrupted(x))) && hasItem(mod) && searchMods.some(y => y === mod.modifier.id));
				if (foundMods.length > 0) {
					realms.push(realm.id);
					let realmMods = realm.id === 'melvorD:Melvor' ? 'melvorMods' : 'abyssalMods';
					modifiers[realmMods].push(foundMods.map(x => x.mod));
				}
			});
			if (modifiers.melvorMods) {
				modifiers.melvorText = Array.from(new Set(getPlainModifierDescriptions(modifiers.melvorMods.flat())));
				modifiers.melvorMods = Array.from(new Set(modifiers.melvorMods.flat().map(x => x.modifier.localID)));
			}
			if (modifiers.abyssalMods) {
				modifiers.abyssalText = Array.from(new Set(getPlainModifierDescriptions(modifiers.abyssalMods.flat())));
				modifiers.abyssalMods = Array.from(new Set(modifiers.abyssalMods.flat().map(x => x.modifier.localID)));
			}
			return { realms, modifiers };
		}
		filterEquipment() {
			let specialItems = [{ itemID: 'melvorD:Barbarian_Gloves', skill: game.fishing, realms: [melvorRealm.id] }, { itemID: 'melvorF:Jesters_Hat', skill: game.thieving, realms: [melvorRealm.id, abyssalRealm.id] }, { itemID: 'melvorF:Sailors_Top', skill: game.fishing, realms: [melvorRealm.id, abyssalRealm.id] }];
			if (mod.manager.getLoadedModList().includes('[Myth] Music'))
				specialItems.push({ itemID: 'mythMusic:Concert_Pass', skill: game.music, realms: [melvorRealm.id] });
			let hasModifiers = (x) => (x.modifiers && x.modifiers.length > 0) || (x.conditionalModifiers && x.conditionalModifiers.length > 0),
				allEquipment = game.items.equipment.filter(x => x.providedRunes.length > 0 || filterSetting(x) && (hasModifiers(x) && !['Golbin Raid', 'Events'].includes(x.category))),
				lesserRelicDrops = game.woodcutting.rareDrops.filter(x => x.item.id.includes('_Lesser_Relic'));

			specialItems.forEach(({ itemID }) => {
				let item = game.items.getObjectByID(itemID);
				if (!hasModifiers(item))
					allEquipment.push(item);
			});
			this.sortEquipment(allEquipment);

			allEquipment.forEach(item => {
				if (item.id.includes('_Lesser_Relic') && !lesserRelicDrops.some(x => x.gamemodes.includes(game.currentGamemode)))
					return;
				let isConsumable = item.validSlots.some(x => ['melvorD:Consumable', 'melvorD:Summon1'].includes(x.id)),
					specialItem = specialItems.find(x => x.itemID === item.id),
					itemMods = this.getItemMods(item);

				if (game.itemSynergies.has(item))
					game.itemSynergies.get(item).forEach(itemSynergy => itemMods.push(...this.getItemMods(itemSynergy)));

				if (specialItem !== undefined) {
					itemMods = itemMods.filter(x => !x.mod.isNegative);
					let modifiers = { melvorMods: itemMods.map(x => x.mod && x.mod.modifier.localID), melvorText: getPlainModifierDescriptions(itemMods.map(x => x.mod)), abyssalMods: [], abyssalText: [] };
					if (specialItem.realms.includes(abyssalRealm.id)) {
						modifiers.abyssalMods = modifiers.melvorMods;
						modifiers.abyssalText = modifiers.melvorText;
					}
					return this.createIcon(item, modifiers, specialItem.realms, specialItem.skill, 0, 'Equipment');
				}

				if (item.providedRunes.some(({ item }) => providedRunes.includes(item.id)))
					return this.createIcon(item, undefined, [melvorRealm.id], game.altMagic, isConsumable ? 1 : 0, isConsumable ? 'Consumable' : 'Equipment');

				if (this.hasAgilityCostMod(item) && !this.data.agiSelectArr.includes(item))
					this.data.agiSelectArr.push(item);

				if (itemMods.length <= 0)
					return;

				for (var i = 0; i < this.data.skills.length; i++) {
					if (this.data.skills[i] === game.attack && !['melvorD:Enhancement1', 'melvorD:Enhancement2', 'melvorD:Enhancement3', 'melvorD:Consumable', 'melvorD:Summon1'].some(x => item.validSlots.some(y => y.id === x)))
						continue;
					if (this.data.skills[i] === game.altMagic && itemMods.some(x => x.mod.modifier && x.mod.modifier.id === 'melvorD:altMagicSkillXP' && x.mod.isNegative))
						continue;
					if (this.data.skills[i] === game.thieving && item.id === 'melvorItA:Netherite_Gloves')
						continue;
					let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], itemMods, item);
					if (realms.length > 0)
						this.createIcon(item, modifiers, realms, this.data.skills[i], isConsumable ? 1 : 0, isConsumable ? 'Consumable' : 'Equipment');
				}
			});
		}
		equipmentOnClick(item, icon) {
			icon.container.onclick = () => this.equipmentCallback(icon, item, item.validSlots[0]);
			if (item.validSlots.length <= 2) {
				if (nativeManager.isMobile)
					this.onLongPress(icon.container, () => this.equipmentCallback(icon, item, getSlot('melvorD:Passive')));
				else
					icon.container.oncontextmenu = (e) => { e.preventDefault(), this.equipmentCallback(icon, item, getSlot('melvorD:Passive')); };
			}
		}
		equipmentCallback(icon, item, slot, ignore = false) {
			if (filterMode && !ignore)
				this.filterIcon(icon);
			else if (debugEnabled && !ignore)
				console.dir(icon);
			else if (player.isEquipmentSlotUnlocked(slot) && item.validSlots.includes(slot)) {
				let isConsumable = item.validSlots.some(x => x.id === 'melvorD:Consumable' || x.id === 'melvorD:Summon1'),
					isEquipped = player.equipment.getSlotOfItem(item);

				if (isEquipped && isEquipped !== slot)
					player.unequipItem(player.selectedEquipmentSet, isEquipped);

				let qty = game.bank.getQty(item);
				if (isConsumable)
					qty -= Math.floor(get('allbutx'));

				if (qty > 0) {
					player.equipItem(item, player.selectedEquipmentSet, slot, qty);
					if (isConsumable) {
						this.renderConsumableBg();
						this.renderConsumableQty();
					} else
						this.renderEquipmentBg();
				}

			}
		}
		checkOtherEquipmentSets(item) {
			return player.equipmentSets.some(({ equipment }) => {
				if (equipment === player.equipment)
					return;
				return equipment.checkForItem(item);
			});
		}
		updateEquipmentBg(item) {
			if (item.consumesChargesOn)
				this.updateChargeItem(item);
			let icon = this.getItemIcon(item);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (icon.passiveIcon) {
				icon.passiveIcon.remove();
				delete icon.passiveIcon;
			}
			if (icon.enhancementIcon) {
				icon.enhancementIcon.remove();
				delete icon.enhancementIcon;
			}
			if (player.equipment.itemSlotMap.has(item)) {
				icon.setBg(greenBg);
				let itemSlot = player.equipment.getSlotOfItem(item);
				if (itemSlot.id === 'melvorD:Passive') {
					icon.passiveIcon = passiveIcon;
					icon.container.append(passiveIcon);
				}
				if (['melvorD:Enhancement1', 'melvorD:Enhancement2', 'melvorD:Enhancement3'].includes(itemSlot.id)) {
					let enhancementIcon = createImgNode(itemSlot.emptyMedia, 'inactive-sb');
					icon.enhancementIcon = enhancementIcon;
					icon.container.append(enhancementIcon);
				}
			} else if (game.bank.getQty(item) > 0)
				icon.setBg(defaultBg);
			else if (this.checkOtherEquipmentSets(item))
				icon.setBg(yellowBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Equipment');
		}
		filterPotions() {
			game.items.potions.filter(x => this.data.skills.includes(x.action) && filterSetting(x)).forEach(potion => {
				let { realms, modifiers } = this.hasModifiers(false, potion.action, this.getItemMods(potion.stats), potion);
				if (realms.length > 0)
					this.createIcon(potion, modifiers, realms, potion.action, 1, 'Consumable');
			});
		}
		consumableOnClick(consumable, icon) {
			if (consumable.type === 'Potion') {
				icon.container.onclick = () => {
					let potion = game.potions.activePotions.get(consumable.action);
					if (filterMode)
						this.filterIcon(icon);
					else if (debugEnabled)
						console.dir(icon);
					else if (game.bank.getQty(consumable) - get('allbutx') > 0 && (potion === undefined || potion.item !== consumable)) {
						game.potions.usePotion(consumable, false);
						this.renderConsumableBg();
						this.renderConsumableQty();
					}
				};
			} else {
				icon.container.onclick = () => { this.equipmentCallback(icon, consumable, consumable.validSlots[0]); };
			}
			if (consumable.type === 'Familiar') {
				if (nativeManager.isMobile)
					this.onLongPress(icon.container, () => { this.equipmentCallback(icon, consumable, getSlot('melvorD:Summon2')); });
				else
					icon.container.oncontextmenu = (e) => { e.preventDefault(), this.equipmentCallback(icon, consumable, getSlot('melvorD:Summon2')); };
			}
		}
		updateConsumableBg(consumable) {
			let qty = game.bank.getQty(consumable);
			let icon = this.getItemIcon(consumable);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (player.equipment.checkForItem(consumable) || game.potions.isPotionActive(consumable))
				icon.setBg(greenBg);
			else if (Math.max(qty - get('allbutx'), 0))
				icon.setBg(defaultBg);
			else if (this.checkOtherEquipmentSets(consumable))
				icon.setBg(yellowBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Consumable');
		}
		updateConsumableQty(consumable) {
			let qty = Math.max(game.bank.getQty(consumable) - get('allbutx'), 0);
			let icon = this.getItemIcon(consumable, true);
			if (icon === undefined)
				return;
			icon.setPillbox('bg-secondary');
			if (player.equipment.checkForItem(consumable)) {
				icon.setText(player.equipment.getQuantityOfItem(consumable));
				if (qty > 0)
					icon.setPillbox('bg-warning');
			} else if (qty > 0)
				icon.setText(qty);
			else if (this.checkOtherEquipmentSets(consumable)) {
				let totalQty = 0;
				player.equipmentSets.forEach(({ equipment }) => {
					if (equipment !== player.equipment && equipment.checkForItem(consumable))
						totalQty += equipment.equippedArray.find(x => x.item === consumable).quantity;
				});
				icon.setText(totalQty);
			} else
				icon.setText(0);
		}
		updateChargeItem(item) {
			let icon = this.getItemIcon(item, true);
			if (icon === undefined)
				return;
			icon.setText(game.itemCharges.getCharges(item));
		}
		filterPOIs() {
			game.cartography.worldMaps.forEach(map => {
				map.pointsOfInterest.filter(x => x.activeStats.hasStats && filterSetting(x)).forEach(poi => {
					for (var i = 0; i < this.data.skills.length; i++) {
						let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], this.getItemMods(poi.activeStats));
						if (realms.length > 0)
							this.createIcon(poi, modifiers, realms, this.data.skills[i], 0, 'POI');
					}
				});
			});
		}
		poiOnClick(poi, icon) {
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (debugEnabled)
					console.dir(icon);
				else if (poi.hex.map === game.cartography.activeMap && poi.hex.isMastered && this.getTravelCosts(poi).checkIfOwned()) {
					if (cartographyMap._initialized)
						game.cartography.onHexTap(poi.hex);
					poi.hex.map.selectHex(poi.hex);
					game.cartography.travelOnClick();
					this.renderPOIBg();
					this.renderPOICost();
				}
			};
		}
		getTravelCosts(poi, returnGP) {
			let path = poi.hex.map.computePath(poi.hex.map.playerPosition, poi.hex),
				costs = path ? game.cartography.getTravelCosts(path) : new Costs(game);
			if (!costs._currencies.has(game.gp))
				costs.addCurrency(game.gp, 0);
			return returnGP ? costs._currencies.get(game.gp) : costs;
		}
		updatePOICosts(poi) {
			let gpCost = this.getTravelCosts(poi, true);
			let icon = this.getItemIcon(poi, true);
			if (icon === undefined)
				return;
			if (gpCost === undefined || poi.hex.map !== game.cartography.activeMap)
				return icon.setText(0);
			icon.setText(gpCost);
		}
		updatePOIBg(poi) {
			let icon = this.getItemIcon(poi);
			if (icon === undefined)
				return;
			if (poi.hex.map !== game.cartography.activeMap) {
				icon.setPillbox('bg-danger');
				icon.setBg(redBg);
				return;
			} else
				icon.setPillbox('bg-secondary');

			let shouldHide = false;
			if (poi.hex.isPlayerHere)
				icon.setBg(greenBg);
			else if (!poi.hex.isMastered) {
				shouldHide = true;
				icon.setBg(redBg);
			} else if (!this.getTravelCosts(poi).checkIfOwned())
				icon.setBg(yellowBg);
			else
				icon.setBg(defaultBg);
			this.hideUndiscoveredIcons(icon, shouldHide, 'POI');
		}
		filterObstacles() {
			// Sort ItA obstacles to the end of the list
			let sortedObstacles = game.agility.sortedMasteryActions.sort((a, b) => (a.abyssalLevel - b.abyssalLevel));
			let obstacles = [...sortedObstacles, ...game.agility.pillars.allObjects];
			obstacles.filter(x => filterSetting(x)).forEach(obstacle => {
				for (var i = 0; i < this.data.skills.length; i++) {
					let obstacleMods = this.getItemMods(obstacle);
					if (get('showAllObstacles') && this.data.skills[i] === game.agility) {
						let posModifiers = obstacleMods.filter(x => (!x.mod.isNegative && !x.inverted) || (x.mod.isNegative && x.inverted)).map(x => x.mod);
						let modifiers;
						if (obstacle.realm === melvorRealm)
							modifiers = { melvorText: Array.from(getPlainModifierDescriptions(posModifiers)), melvorMods: posModifiers.map(x => x.localID), abyssalMods: [], abyssalText: [] };
						else
							modifiers = { abyssalText: Array.from(getPlainModifierDescriptions(posModifiers)), abyssalMods: posModifiers.map(x => x.localID), melvorMods: [], melvorText: [] };
						this.createIcon(obstacle, modifiers, [obstacle.realm.id], game.agility, 2, 'Obstacle');
					} else {
						let isPositive = this.hasModifiers(false, this.data.skills[i], obstacleMods),
							realms = isPositive.realms.length > 0 ? isPositive : this.hasModifiers(true, this.data.skills[i], obstacleMods, obstacle);
						if (realms.realms.length > 0)
							this.createIcon(obstacle, realms.modifiers, realms.realms, this.data.skills[i], isPositive.realms.length > 0 ? 2 : 3, 'Obstacle');
					}

				}
			});
		}
		obstacleOnClick(obstacle, icon) {
			icon.container.onclick = () => this.obstacleCallback(obstacle, icon);
		}
		obstacleCallback(obstacle, icon, tinyMenu = false) {
			if (filterMode && !tinyMenu)
				this.filterIcon(icon);
			else if (debugEnabled && !tinyMenu)
				console.dir(icon);
			else {
				let buildMenu = get('obstacleMenu');
				let skipBuildMenu = (buildMenu === 'never' || (buildMenu === 'lClick' && tinyMenu) || (buildMenu === 'rClick' && !tinyMenu))
				if (!game.agility.isUnlocked || (skipBuildMenu && obstacle.isBuilt))
					return;
				let type = this.getObstacleType(obstacle);
				let agiSelection = this.createObstacleSelect(obstacle, type);
				if (skipBuildMenu)
					agiSelection.buildObstacle();
				else {
					SwalLocale.fire({
						html: agiSelection,
						showConfirmButton: this.canBuildObstacle(obstacle) && !obstacle.isBuilt,
						confirmButtonText: getLangString('MENU_TEXT_BUILD'),
						showCancelButton: true,
					}).then((result) => {
						if (result.value)
							agiSelection.buildObstacle();
					});
				}
			}
		}
		createInlineRequirement(media, text, textClass) {
			let inlineContainer = createElement('span', { className: `no-wrap m-2` });
			inlineContainer.innerHTML = `<img src=${media} class='icon-xs-sb mr-1'/><span class="sb-font-sm font-w400 ${textClass}">${text}</span>`;
			return inlineContainer;
		}
		setObstacleCosts(items, currencies, costsElem, tooltip) {
			if (tooltip)
				costsElem.textContent = getLangString('MENU_TEXT_COST');
			const addReq = (media, qty, name, currentQty, item = null) => {
				let text;
				if (item)
					text = `${formatNumber(currentQty, 2)} / ${formatNumber(qty, 2)}`;
				else
					text = formatNumber(qty, 2);
				let newReq = this.createInlineRequirement(media, text, currentQty >= qty ? 'text-success' : 'text-danger');
				if (tooltip)
					this.createImageTooltip(newReq.children[0], name);
				costsElem.append(newReq);
			};
			items.forEach(({ item, quantity }) => {
				addReq(item.media, quantity, item.name, game.bank.getQty(item), item);
			});
			currencies.forEach(({ currency, quantity }) => {
				addReq(currency.media, quantity, currency.name, currency.amount);
			});
		}
		createImageTooltip(parent, text) {
			parent.setAttribute('data-sbMainTooltip', '');
			let tooltipContent = createElement('div', { attributes: [['data-sbTooltipContent', '']], parent });
			createElement('div', { className: 'font-size-sm', parent: tooltipContent, text });
			MainTooltipController.init(parent);
		}
		getObstacleType(obstacle) {
			return obstacle instanceof AgilityObstacle ? 'Obstacle' : 'Pillar';
		}
		getObstacleCost(obstacle, agiSetting = false) {
			this.agiCosts = agiSetting;
			let costs = this.getObstacleType(obstacle) === 'Obstacle' ? game.agility.getObstacleBuildCosts(obstacle) : game.agility.getPillarBuildCosts(obstacle);
			return costs;
		}
		hasObstacleRequirements(obstacle) {
			return (game.agility.isSlotUnlocked(obstacle.slot) && (!obstacle.skillRequirements || game.checkRequirements(obstacle.skillRequirements)));
		}
		canBuildObstacle(obstacle) {
			return this.getObstacleCost(obstacle).checkIfOwned() && this.hasObstacleRequirements(obstacle);
		}
		createObstacleSelect(obstacle, type) {
			let course = game.agility.courses.get(obstacle.realm),
				destroy = type === 'Obstacle' ? course.builtObstacles.get(obstacle.category) : course.builtPillars.get(obstacle.category);
			let agilitySelect = new SBAgilitySelect(obstacle, destroy, this.data.agiSelectArr);
			return agilitySelect;
		}
		updateObstacleBg(obstacle, icon, hideIcon = true) {
			let hasRequirements = this.hasObstacleRequirements(obstacle),
				cost = this.getObstacleCost(obstacle, true);
			if (icon === undefined)
				icon = this.getItemIcon(obstacle);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (obstacle.isBuilt)
				icon.setBg(greenBg);
			else if (hasRequirements) {
				if (!cost.checkIfOwned())
					icon.setBg(yellowBg);
				else
					icon.setBg(defaultBg);
			} else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			if (hideIcon)
				this.hideUndiscoveredIcons(icon, shouldHide, 'Obstacle');
		}
		updateObstacleActive(obstacle) {
			let requirement = this.getObstacleType(obstacle) === 'Obstacle' ? obstacle.category : obstacle.slot.obstacleCount;
			let icon = this.getItemIcon(obstacle, true);
			if (icon === undefined)
				return;
			if (!obstacle.isBuilt)
				return this.hideElement(icon.inactiveIcon);
			game.agility.courses.get(obstacle.realm).activeObstacleCount < requirement ? this.showElement(icon.inactiveIcon) : this.hideElement(icon.inactiveIcon);

		}
		filterPets() {
			game.pets.filter(x => !filteredPets.includes(x) && !game.petManager.unlocked.has(x) && !x.ignoreCompletion && filterSetting(x)).forEach(pet => {
				for (var i = 0; i < this.data.skills.length; i++) {
					let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], this.getItemMods(pet.stats));
					if (realms.length > 0)
						this.createIcon(pet, modifiers, realms, this.data.skills[i], 4, 'Pet');
				}
			});
		}
		updatePetBg(pet) {
			let icon = this.getItemIcon(pet);
			if (icon === undefined)
				return;
			icon.setBg(redBg);
			this.hideUndiscoveredIcons(icon, true, 'Pet');
		}
		petOnClick(icon) {
			icon.setBg(redBg);
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (debugEnabled)
					console.dir(icon);
			};
		}
		filterPurchases() {
			let purchases = game.shop.purchases.filter(x => x.category.id !== 'melvorD:GolbinRaid' && !game.shop.upgradesPurchased.has(x) && filterSetting(x));
			for (var i = 0; i < this.data.skills.length; i++) {
				purchases.filter(x => x.contains.stats !== undefined).forEach(purchase => {
					let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], this.getItemMods(purchase.contains.stats));
					if (realms.length > 0)
						this.createIcon(purchase, modifiers, realms, this.data.skills[i], 4, 'Purchase');
				});
				purchases.filter(x => x.contains.pet !== undefined).forEach(purchase => {
					let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], this.getItemMods(purchase.contains.pet.stats));
					if (realms.length > 0) {
						this.createIcon(purchase, modifiers, realms, this.data.skills[i], 4, 'Purchase');
						filteredPets.push(purchase.contains.pet);
					}
				});
			}
		}
		purchaseOnClick(purchase, icon) {
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (debugEnabled)
					console.dir(icon);
				else if (game.shop.getPurchaseCosts(purchase, 1).checkIfOwned() && game.checkRequirements(purchase.purchaseRequirements) && game.checkRequirements(purchase.unlockRequirements)) {
					if (!game.settings.showShopConfirmations)
						game.shop.buyItemOnClick(purchase, true);
					else
						shopMenu.showConfirmBuyPrompt(purchase);
				}
			};
		}
		updatePurchaseBg(purchase) {
			let hasRequirements = (game.checkRequirements(purchase.purchaseRequirements) && game.checkRequirements(purchase.unlockRequirements)),
				canPurchase = game.shop.getPurchaseCosts(purchase, 1).checkIfOwned();
			let icon = this.getItemIcon(purchase);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (hasRequirements && canPurchase)
				icon.setBg(greenBg);
			else if (hasRequirements && !canPurchase)
				icon.setBg(yellowBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Purchase');
		}
		filterConstellations() {
			game.astrology.actions.allObjects.filter(x => !game.astrology.isConstellationComplete(x) && filterSetting(x)).forEach(constellation => {
				let skills = constellation.skills.filter(x => this.data.skills.includes(x));
				if (constellation.skills.some(x => x.isCombat) && !constellation.skills.includes(game.attack))
					skills.push(game.attack);
				if (skills.length <= 0) return;
				skills.forEach(skill => {
					let { realms, modifiers } = this.hasModifiers(false, skill, this.getConstellationModifiers(constellation));
					if (realms.length > 0)
						this.createIcon(constellation, modifiers, realms, skill, 4, 'Constellation');
				});
			});
		}
		getConstellationModifiers(constellation) {
			let modData = [...constellation.standardModifiers, ...constellation.uniqueModifiers, ...constellation.abyssalModifiers],
				modifiers = [];
			modData.forEach(mods => modifiers.push(...this.getItemMods(mods.stats)));
			return modifiers;
		}
		getConstellationMulti(constellation) {
			return game.astrology.hasMasterRelic(melvorRealm) && game.astrology.isConstellationComplete(constellation) ? 2 : 1;
		}
		constellationOnClick(constellation, icon) {
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (debugEnabled)
					console.dir(icon);
				else {
					SwalLocale.fire({ html: this.createConstellationPanel(constellation), width: (windowWidth >= 600 ? '575px' : '') });
					this.updateDustQty();
				}
			};
		}
		updateDustQty() {
			dustItems.forEach(icon => icon.setText(game.bank.getQty(icon.item)));
		}
		isModifierUnlocked(constellation, requirements) {
			return game.astrology.isBasicSkillRecipeUnlocked(constellation) && isRequirementMet(requirements);
		}
		createConstellationPanel(constellation) {
			let panel = new AstrologyExplorationPanelElement(),
				multi = this.getConstellationMulti(constellation),
				setMaxMods = (length, type) => panel[`setMax${type}Mods`](length),
				setModifiers = (id, mod, multi, type) => {
					panel[`set${type}Modifier`](id, mod, mod.timesBought, multi);
					panel[`set${type}ModifierStatus`](id, mod.timesBought, mod);
				},
				lockModifiers = (id, requirements, mod, type) => {
					panel[`set${type}Locked`](id, requirements);
					panel[`set${type}LockedStatus`](id, mod);
				},
				upgradeModifier = (constellation, id, type) => game.astrology[`upgrade${type}Modifier`](constellation, id);

			['Standard', 'Unique', 'Abyssal'].forEach(type => {
				let menu = `${type.toLowerCase()}Modifiers`;
				if (constellation[menu].length <= 0)
					return;
				setMaxMods(constellation[menu].length, type);
				constellation[menu].forEach((mod, id) => {
					let requirements = mod.unlockRequirements,
						elem = panel[menu][id];

					if (constellation.realm === melvorRealm && requirements[0].level === 1)
						requirements = [new SkillLevelRequirement({ skillID: game.astrology.id, level: constellation.level }, game)];
					else if (constellation.realm === abyssalRealm && (!requirements[0] || requirements[0].level === 1))
						requirements = [new AbyssalLevelRequirement({ skillID: game.astrology.id, level: constellation.abyssalLevel }, game)];

					if (get('astroSpoilers') || this.isModifierUnlocked(constellation, requirements))
						setModifiers(id, mod, multi, type);
					else
						lockModifiers(id, requirements, mod, type);
					if (!this.isModifierUnlocked(constellation, requirements)) {
						elem.upgradeButton.disabled = true;
						let unlockNodes = printUnlockAllRequirements(requirements);
						unlockNodes.forEach(node => panel[menu][id].modifierText.append(node));
					}

					elem.setUpgradeCallback(() => {
						if (!this.isModifierUnlocked(constellation, requirements))
							return;
						upgradeModifier(constellation, id, type);
						this.updateConstellationPanel(constellation, panel, id, type);
						setModifiers(id, mod, multi, type);
					});

					elem.starImage.parentElement.remove();
					elem.modifierContainer.classList.replace('border-1x', 'border-5x');
					elem.modifierContainer.parentElement.append(createElement('div', { children: [elem.modifierProgress] }));
				});
			});
			dustItems = [];
			panel.setUpgradeCosts(game.astrology, constellation);
			let dustContainer = createElement('div', { id: 'dusts', className: 'row no-gutters justify-content-center border-top border-dark border-4x mb-1' });
			game.astrology.baseRandomItemChances.forEach((_, item) => {
				if (hasItA && item.id === 'melvorItA:Eternal_Stardust' && !eternalRealm.isUnlocked)
					return;
				let icon = new SkillBoostsIcon('Astrology', item, item.media, true);
				icon.setTooltip(item.name);
				icon.setBg(defaultBg);
				dustContainer.append(icon);
				dustItems.push(icon);
				MainTooltipController.init(icon.container);
			});
			let content = panel._content.children[0];
			content.className = `block block-rounded-extra m-0`;
			content.append(dustContainer);
			return panel;
		}
		updateConstellationPanel(constellation, panel, id, type) {
			panel[`set${type}UpgradeCost`](game.astrology, constellation, id);
			this.updateDustQty();
		}
		updateConstellationBg(constellation) {
			let icon = this.getItemIcon(constellation);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (game.astrology.isBasicSkillRecipeUnlocked(constellation))
				icon.setBg(defaultBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Constellation');
		}
		filterSynergies() {
			game.summoning.synergies.forEach(synergy => {
				for (var i = 0; i < this.data.skills.length; i++) {
					if (this.data.skills[i] === game.attack)
						continue;
					let { realms, modifiers } = this.hasModifiers(false, this.data.skills[i], this.getItemMods(synergy), synergy);
					if (realms.length > 0)
						this.createIcon(synergy, modifiers, realms, this.data.skills[i], 1, 'Synergy');
				}
			});
		}
		synergyOnClick(synergy, icon) {
			icon.container.onclick = () => {
				if (filterMode)
					this.filterIcon(icon);
				else if (debugEnabled)
					console.dir(icon);
				else {
					let { qty1, qty2 } = this.getSynergyQty(synergy);
					if (qty1 > 0 && qty2 > 0) {
						let slots = [getSlot('melvorD:Summon1'), getSlot('melvorD:Summon2')];
						slots.forEach((slot, i) => {
							let item = synergy.summons[i].product;
							if (player.equipment.itemSlotMap.has(item))
								player.unequipItem(player.selectedEquipmentSet, player.equipment.getSlotOfItem(item));
						});
						slots.forEach((slot, i) => player.equipItem(synergy.summons[i].product, player.selectedEquipmentSet, slot, (i === 0 ? qty1 : qty2)));
						this.renderSynergyBg();
						this.renderSynergyQty();
					}
				}
			};
		}
		updateSynergyBg(synergy) {
			let { qty1, qty2, bankQty1, bankQty2 } = this.getSynergyQty(synergy);

			let icon = this.getItemIcon(synergy);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (player.equippedSummoningSynergy === synergy)
				icon.setBg(greenBg);
			else if (qty1 > 0 && qty2 > 0)
				icon.setBg(defaultBg);
			else if (qty1 - bankQty1 > 0 && qty2 - bankQty2 > 0)
				icon.setBg(yellowBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Synergy');
		}
		updateSynergyQty(synergy) {
			let { qty1, qty2, bankQty1, bankQty2 } = this.getSynergyQty(synergy);

			let icon = this.getItemIcon(synergy, true);
			if (icon === undefined)
				return;
			icon.setPillbox('bg-secondary');

			if (player.equippedSummoningSynergy === synergy) {
				icon.setText(qty1 - bankQty1, qty2 - bankQty2);
				if (bankQty1 > 0 || bankQty2 > 0)
					icon.setPillbox('bg-warning');
			} else
				icon.setText(qty1, qty2);
		}
		updateSynergyLocked(synergy) {
			let isUnlocked = game.summoning.isSynergyUnlocked(synergy);
			let icon = this.getItemIcon(synergy, true);
			if (icon === undefined)
				return;
			if (icon.synergyLocked !== undefined)
				isUnlocked ? this.hideElement(icon.synergyLocked) : this.showElement(icon.synergyLocked);

		}
		getSynergyID(synergy) {
			return `Skill_Boosts:${synergy.summons[0].namespace}_${synergy.summons[0].localID}_${synergy.summons[1].namespace}_${synergy.summons[1].localID}`
		}
		getSynergyQty(synergy) {
			let summon1 = synergy.summons[0].product,
				summon2 = synergy.summons[1].product,
				bankQty1 = Math.max(game.bank.getQty(summon1) - get('allbutx'), 0),
				bankQty2 = Math.max(game.bank.getQty(summon2) - get('allbutx'), 0),
				qty1 = bankQty1,
				qty2 = bankQty2;

			let summon1Slot = player.equipment.getSlotOfItem(summon1),
				summon2Slot = player.equipment.getSlotOfItem(summon2);
			if (summon1Slot !== undefined)
				qty1 += player.equipment.getQuantityInSlot(summon1Slot.id);
			if (summon2Slot !== undefined)
				qty2 += player.equipment.getQuantityInSlot(summon2Slot.id);

			return { qty1, qty2, bankQty1, bankQty2 };
		}
		setClassByLength(menu = this.menu) {
			if (menu === undefined)
				return;

			if (windowWidth === undefined)
				windowWidth = window.innerWidth;
			if (windowWidth < (menu.skill === game.attack.id ? 1150 : 768))
				return this.setMobileClass(menu);

			let isCombat = this.skillPage === game.attack.id,
				isMedium = windowWidth >= (menu.skill === game.attack.id ? 1350 : 1150),
				lay4th = (!isMedium && !game.agility.hasMasterRelic(melvorRealm)),
				menuWidth = Math.min((windowWidth - (windowWidth >= 992 ? game.settings.enableMiniSidebar ? 60 : 240 : 0) - (isCombat ? 60 : 0) - 17), (isCombat ? 1860 : 1920)) - (lay4th ? 79 : 89),
				shownIcons = menu.shownIcons,
				totalIcons = lay4th ? menu.totalIcons - shownIcons[4] : menu.totalIcons;

			// Start with px values that are ~75% of the maximum menu width
			let maxPX = shownIcons.map((icons, i) => Math.max(Math.round(menuWidth * icons / totalIcons / (i === 1 ? 120 : 72)) * (i === 1 ? 96 : 48), (icons > 0 ? 96 : 0)));
			if (lay4th) maxPX.pop();
			// Increase the width of the tallest elements to decrease the height of the menu
			while (arrSum(maxPX) + 48 <= menuWidth) {
				let elemIconHeights = maxPX.map((x, i) => Math.ceil(48 * shownIcons[i] / x) || 0);
				let tallestElem = elemIconHeights.indexOf(Math.max(...elemIconHeights));
				maxPX[tallestElem] += 48;
				if (arrSum(maxPX) + 48 <= menuWidth && tallestElem === 1 && maxPX[tallestElem] / 48 % 96 !== 0)
					maxPX[tallestElem] += 48;
			}
			// Set the px count
			menu.iconParents.forEach((parent, i) => {
				if (shownIcons[i] === 0) {
					if (game.agility.hasMasterRelic(melvorRealm) && i === 3)
						menu.iconParents[4].classList.replace('sb-other', 'sb-right');
					if (i === 4)
						menu.iconParents[3].classList.add('mr-0');
					return this.hideElement(parent);
				}
				this.showElement(parent);
				if (lay4th && i === 4) return;
				parent.style.flex = `0 0 ${maxPX[i]}px`;
			});
			if (this.skillPage === 'melvorAoD:Cartography')
				this.updateCartographyMap();
		}
		setMobileClass(menu) {
			let modified, lastParent;
			menu.iconParents.forEach((parent, i) => {
				let icons = menu.shownIcons[i];
				if (icons === 0)
					return this.hideElement(parent);

				this.showElement(parent);
				let lastIconCount = menu.shownIcons[menu.iconParents.indexOf(lastParent)];

				if (icons <= 12 && lastParent && lastIconCount <= 12) {
					let percent = windowWidth < 450 ? 75 : 98;
					let tIcons = icons + lastIconCount;
					lastParent.style.flex = `0 0 ${lastIconCount / tIcons * percent}%`;
					parent.style.flex = `0 0 ${icons / tIcons * percent}%`;
					modified = true;
				} else
					parent.style.flex = '';

				if (modified) { // Only modify in pairs
					lastParent = undefined;
					modified = false;
				} else
					lastParent = parent;
			});
		}
		onLongPress(element, callbackFn) {
			let timer;
			element.addEventListener('touchstart', (_e) => {
				timer = setTimeout(() => {
					timer = null;
					callbackFn();
				}, 500);
			});

			function cancel() {
				clearTimeout(timer);
			}
			element.addEventListener('touchend', cancel);
			element.addEventListener('touchmove', cancel);
		}
		createSelection(element, item) {
			if (item instanceof EquipmentItem)
				return this.createSlotSelection(element, item);
			else
				return this.createAgilitySelection(item);
		}
		getSlotInfo(slot, icon) {
			let existingItem = player.equipment.getItemInSlot(slot.id);
			let isEmpty = existingItem === game.emptyEquipmentItem;
			let media = isEmpty ? slot.emptyMedia : existingItem.media;
			return { existingItem, isEmpty, media };
		}
		createSlotSelection(element, item) {
			this.slotSelectionIcons = [];
			let container = createElement('div');
			container.appendChild(createElement('div', { className: 'font-w600 text-center border-bottom', text: getLang('SELECT_SLOT') }));
			let iconContainer = container.appendChild(createElement('div', { className: 'd-flex justify-content-center' }));
			item.validSlots.forEach(slot => {
				let { isEmpty, media } = this.getSlotInfo(slot);
				let icon = new SkillBoostsIcon('', (isEmpty ? slot : item), media, isEmpty, 32);
				if (isEmpty) icon.setTooltip(slot.emptyName);
				icon.container.onclick = () => { this.equipmentCallback(element, item, slot, true), this.updateSlotSelection(); };
				this.slotSelectionIcons.push({ slot, icon });
				iconContainer.append(icon);
			});
			this.updateSlotSelection();
			return container;
		}
		updateSlotSelection() {
			for (let i = 0; i < this.slotSelectionIcons.length; i++) {
				let slot = this.slotSelectionIcons[i].slot;
				let { existingItem, isEmpty, media } = this.getSlotInfo(slot);
				let icon = this.slotSelectionIcons[i].icon;
				icon.item = (isEmpty ? slot : existingItem);
				MainTooltipController.init(icon.container);
				icon.setImage(media);
				icon.setBg((isEmpty ? defaultBg : greenBg));
				if (icon.tinyIcon) {
					icon.tinyIcon.remove();
					icon.tinyIcon = undefined;
				}
				if (!isEmpty)
					icon.tinyIcon = icon.container.appendChild(createImgNode(slot.emptyMedia, 'sb-inactive-sm'));
			}
		}
		createAgilitySelection(obstacle) {
			let container = createElement('div');
			container.appendChild(createElement('div', { className: 'font-w600 text-center border-bottom', text: getLang('SELECT_OBSTACLE') }));
			let iconContainer = container.appendChild(createElement('div', { className: 'd-flex justify-content-center' }));
			let obstacles = this.getObstacleType(obstacle) === 'Obstacle' ? game.agility.sortedMasteryActions : game.agility.pillars.allObjects;
			let sortedObstacles = obstacles.filter(x => x.category === obstacle.category && x.realm === obstacle.realm && obstacle.slot.obstacleCount === x.slot.obstacleCount);
			sortedObstacles.forEach(obst => {
				let icon = new SkillBoostsIcon('', obst, obst.media, false, 32);
				MainTooltipController.init(icon.container);
				icon.container.onclick = () => this.obstacleCallback(obst, icon, true);
				iconContainer.append(icon);
				this.updateObstacleBg(obst, icon, false);
			});
			return container;
		}
		addModifiersToMap(realm, skillID, val) {
			let map = this.data.modifierMap;
			if (!map.has(realm, skillID))
				map.set(val, realm, skillID);
			else {
				val.forEach(modifier => {
					if (!map.get(realm, skillID).includes(modifier))
						map.get(realm, skillID).push(modifier);
				});
			}
		}
		addValueToMap(map, key, val) {
			if (!map.has(key))
				map.set(key, [val]);
			else if (!map.get(key).includes(val))
				map.get(key).push(val);
		}
		removeValueFromMap(map, key, val) {
			if (map.has(key) && map.get(key).includes(val))
				map.get(key).splice(map.get(key).indexOf(val), 1);
		}
		findValueInMap(map, val, validKeys) {
			let key;
			map.forEach((v, k) => {
				if (validKeys.includes(k) && v.includes(val))
					key = k;
			});
			return key;
		}
		removeIcon(item, elem) {
			this.data.icons.forEach((iconArr, skill) => {
				iconArr.forEach(icon => {
					if (icon.item === item && (!elem || icon.elem === elem)) {
						this.data.icons.get(skill).splice(this.data.icons.get(skill).indexOf(icon), 1);
						icon.destroy();
					}
				});
			});
		}
		updateCartographyMap() {
			cartographyMap.onShow();
			cartographyMap.app.resize();
			cartographyMap.onZoomChange(game.cartography.activeMap);
		}
		hasAgilityCostMod(item) {
			if (!item.modifiers)
				return;
			return item.modifiers.some(x => ['melvorD:agilityPillarCost', 'melvorD:agilityObstacleCost', 'melvorD:agilityObstacleItemCost'].includes(x.modifier.id));
		}
		hasTravelCostMod(item) {
			if (!item.modifiers)
				return;
			return item.modifiers.some(x => x.modifier.id === 'melvorD:cartographyTravelCost');
		}
		createCostElement(menu, media, qty, met) {
			let group = createElement('span', {
				className: 'no-wrap'
			});
			let image = menu.createImage(media);
			image.classList.replace('skill-icon-xs', 'icon-xs-sb');
			let cost = createElement('span', {
				className: menu.getTextClass(met),
				text: formatNumber(qty, 2)
			});
			group.append(image, cost);
			return group;
		}
		createUnlockElement(menu, costNodes, met) {
			let parent = createElement('div');
			createElement('span', {
				className: menu.getTextClass(met),
				children: costNodes,
				parent
			});
			return parent;
		}
		addCostsAndRequirements(item, modifierContainer) {
			let menu = shopMenu.quickbuyMenu;
			let reqContainer = this.createDividerElem(modifierContainer, ' sb-font-2sm');
			item.purchaseRequirements.forEach(requirement => {
				reqContainer.append(this.createUnlockElement(menu, requirement.getNodes('icon-xs-sb m-1'), game.checkRequirement(requirement)));
			});
			let costs = item.costs;
			let costContainer = this.createDividerElem(modifierContainer, ' font-size-sm');
			costs.currencies.forEach(currencyCost => {
				const amount = game.shop.getCurrencyCost(currencyCost, 1, 0);
				const currency = currencyCost.currency;
				costContainer.append(this.createCostElement(menu, currency.media, amount, currency.canAfford(amount)));
			});
			costs.items.forEach(({ item, quantity }) => {
				costContainer.append(this.createCostElement(menu, item.media, quantity, game.bank.getQty(item) >= quantity));
			});
		}
		getConstellationModifierSpans(constellation, container, spoilers = get('astroSpoilers')) {
			['standard', 'unique', 'abyssal'].forEach(baseType => {
				constellation[`${baseType}Modifiers`].forEach(mod => {
					if (spoilers || this.isModifierUnlocked(constellation, mod.unlockRequirements)) {
						let multi = mod.timesBought * this.getConstellationMulti(constellation),
							nodes = this.getModifierNodes(mod.stats, multi, multi, true);

						nodes[0].textContent = `(${mod.timesBought}/${mod.maxCount}) ` + nodes[0].textContent;
						if (nodes.length > 1) {
							for (let i = 1; i < nodes.length; i++) {
								nodes[0].textContent += ', ' + nodes[i].textContent;
							};
						}
						if (mod.timesBought === mod.maxCount) {
							nodes[0].classList.replace('text-success', 'text-warning');
							nodes[0].classList.replace('text-disabled', 'text-warning-disabled');
						}
						container.append(nodes[0]);
					}
				});
			});
		}
		createModifierNode(obj) {
			let node = createElement('h5', { className: `${obj.isInfo ? 'text-info' : getStandardDescTextClass(obj, false)} sb-font-2sm m-1 font-w400` });
			if (obj.text.indexOf('text-warning') > 0)
				obj.text = obj.text.slice(0, obj.text.search('text-warning') - 13);
			node.innerHTML = applyDescriptionModifications(obj.text);
			return node;
		}
		getModifierNodes(statObject, negMult, posMult, includeZero = false) {
			let descriptions = [];
			let returnOriginal = false;
			if (statObject.modifiers !== undefined) {
				statObject.modifiers.forEach(modValue => {
					if (StatObject.showDescription(modValue.isNegative, negMult, posMult, includeZero)) {
						let description = modValue.print(negMult, posMult);
						if (description !== undefined)
							descriptions.push(description);
					}
				});
			}
			if (statObject.combatEffects !== undefined) {
				statObject.combatEffects.forEach(applicator => {
					if (StatObject.showDescription(applicator.isNegative, negMult, posMult, includeZero)) {
						let description = applicator.getDescription(negMult, posMult);
						if (description !== undefined)
							descriptions.push(description);
					}
				});
			}
			if (statObject.playerModifiers !== undefined) {
				statObject.playerModifiers.forEach(modValue => {
					if (StatObject.showDescription(!modValue.isNegative, negMult, posMult, includeZero)) {
						let description = modValue.print(posMult, negMult);
						if (description !== undefined)
							descriptions.push(description);
					}
				});
			}
			if (statObject.enemyModifiers !== undefined) {
				statObject.enemyModifiers.forEach(modValue => {
					if (StatObject.showDescription(!modValue.isNegative, negMult, posMult, includeZero)) {
						let description = modValue.printEnemy(posMult, negMult, 2, true);
						if (description !== undefined)
							descriptions.push(description);
					}
				});
			}
			if (statObject.conditionalModifiers !== undefined) {
				let prevDescriptions = [];
				statObject.conditionalModifiers.forEach(conditional => {
					if (returnOriginal)
						return;
					let desc = conditional.getDescription(negMult, posMult);
					if (desc === undefined)
						returnOriginal = true;
					if (desc !== undefined && !prevDescriptions.includes(desc.text) && StatObject.showDescription(conditional.isNegative, negMult, posMult, includeZero)) {
						descriptions.push(desc);
						prevDescriptions.push(desc.text);
					}
				});
			}
			if (returnOriginal || descriptions.length <= 0) {
				if (statObject.description === undefined)
					return [];
				return [this.createModifierNode({ text: statObject.description, isInfo: true })];
			}
			return this.sortModifiers(descriptions.map(this.createModifierNode));
		}
		createDividerElem(parent, textClass = '') {
			return createElement('div', { className: `border-top border-dark border-2x${textClass}`, parent: parent });
		}
		createTooltip(item) {
			let addItemSynergy = true;
			let _content = new DocumentFragment();
			let parent = _content.appendChild(createElement('div', { className: 'text-center sb-font-2sm' }));
			parent.appendChild(createElement('div', { className: 'font-w600 font-size-sm', text: item.name }));
			let container = this.createDividerElem(parent);
			if (item instanceof EquipmentItem) {
				item.validSlots.forEach(slot => {
					container.append(createElement('small', { className: 'font-w600 font-size-sm m-1', children: [createElement('small', { className: 'sb-badge bg-primary', text: getLangString(`EQUIP_SLOT_${slot.localID}`) })] }));
				});
			}
			if ((item instanceof EquipmentItem && item.fitsInSlot("melvorD:Summon1")) || item instanceof SummoningSynergy) {
				let maxHitText = getLangString('SUMMON_DOES_NOT_ATTACK'),
					items = item.summons ? [item.summons[0].product, item.summons[1].product] : [item],
					totalDamage = 0;
				items.forEach(item => item.equipmentStats.forEach(statPair => {
					if (statPair.key === 'summoningMaxhit')
						totalDamage += statPair.value;
				}));
				if (totalDamage > 0)
					maxHitText = templateLangString('BASE_SUMMON_MAX_HIT', { value: numberWithCommas(multiplyByNumberMultiplier(totalDamage)) });

				container.append(createElement('div', { className: `text-warning font-size-2sm m-1`, text: maxHitText }));
			} else if (item instanceof PotionItem) {
				container.append(createElement('div', { className: 'text-warning font-size-2sm', text: templateString(getLangString('MENU_TEXT_POTION_CHARGES'), { charges: item.charges }) }));
			} else if (item instanceof Pet || (item instanceof ShopPurchase && item.contains.pet !== undefined)) {
				let acquiredBy = item.acquiredBy || (item instanceof ShopPurchase && item.contains.pet.acquiredBy);
				if (acquiredBy !== undefined)
					container.append(createElement('span', { className: 'text-info font-w600', text: acquiredBy }));
			}

			let modifierContainer = createElement('div', { className: 'text-success', parent: container });
			if (item instanceof AstrologyRecipe) {
				this.getConstellationModifierSpans(item, modifierContainer);
			} else {
				let negMult = item instanceof AgilityObstacle || item instanceof AgilityPillar ? game.agility.getObstacleNegMult(item) : 1;
				let posMult = hasAoD && item instanceof PointOfInterest && game.cartography.hasCarthuluPet ? 2 : 1;
				let statObject = item instanceof ShopPurchase ? item.contains.stats || (item.contains.pet && item.contains.pet.stats) : item.activeStats || item.stats || item;
				let modifierNodes = this.getModifierNodes(statObject, negMult, posMult, false);
				let blacklistedItems = ['max_skillcape', 'cape_of_completion', 'mastery_magnet', 'jesters_hat', 'rhaelyx', 'blood_ring', 'elemental_potion', 'enhanced_production_scroll', 'enhanced_gathering_scroll', 'abyssal_xp_scroll', 'cloudburst'];
				if (blacklistedItems.some(x => item.id && item.id.toLowerCase().includes(x)) || item.consumesChargesOn || (modifierNodes.length <= 0 || modifierNodes[0].textContent.search('text-warning') > 0)) {
					modifierContainer.classList.replace('text-success', 'text-info');
					if (item.modifiedDescription.search('text-warning') > 0)
						modifierContainer.innerHTML = item.modifiedDescription.slice(0, item.modifiedDescription.search('text-warning') - 13);
					else
						modifierContainer.innerHTML = item.modifiedDescription;
				} else
					modifierContainer.append(...modifierNodes);
			}
			if (item instanceof ShopPurchase) {
				this.addCostsAndRequirements(item, modifierContainer);
			}
			if (addItemSynergy && game.itemSynergies.has(item)) {
				if (item._customDescription.indexOf('text-warning') > 0) {
					let descriptions = [];

					let itemDesc = item._customDescription.slice(item._customDescription.search('text-warning') + 14, item._customDescription.length);
					descriptions.push(createElement('h5', { className: 'text-warning m-1 sb-font-2sm', text: itemDesc }));
					game.itemSynergies.get(item).forEach(synergy => {
						this.getModifierNodes(synergy, 1, 1, false).forEach(node => {
							if (node && node.textContent !== '')
								descriptions.push(node);
						});
					});
					if (descriptions.length > 1) {
						itemDesc = itemDesc.slice(0, itemDesc.indexOf(':') + 1);
						descriptions[0].textContent = itemDesc;
						descriptions.forEach(node => modifierContainer.append(node));
					} else
						modifierContainer.append(descriptions[0]);
				} else {
					modifierContainer.append(createElement('h5', { className: 'text-warning m-1', text: item._customDescription }));
				}
			}

			let miscContainer = this.createDividerElem(container, ' sb-font-sm');
			if (item instanceof PointOfInterest) {
				miscContainer.append(createElement('span', { text: getLangString('TRAVEL_COST_COL') }), createElement('img', { className: 'skill-icon-xxs m-1', attributes: [['src', game.gp.media]] }), createElement('span', { id: 'GPCost', text: formatNumber(this.getTravelCosts(item)._currencies.get(game.gp)) }));
			} else if (item instanceof EquipmentItem && item.validSlots.includes(getSlot('melvorD:Passive'))) {
				miscContainer.append(createElement('span', { className: 'text-info', text: getLangString('MENU_TEXT_PASSIVE_SLOT_COMPATIBLE') }));
			} else if (item instanceof Pet) {
				let searchAreas = [...game.slayerAreas.allObjects, ...game.dungeons.allObjects, ...game.strongholds.allObjects, ...game.abyssDepths.allObjects],
					hasDrop = searchAreas.find(x => x.pet && x.pet.pet === item),
					chanceElem = createElement('span', { className: 'text-info sb-font-2sm', text: getLang('CHANCE') }),
					skill = item.skill;

				if (['melvorD:GoldenGolbin', 'melvorF:Pablo', 'melvorF:Mark', 'melvorAoD:Hex', 'melvorAoD:MapMasteryPet'].includes(item.id)) {
					let progress, goal;
					if (item.id === 'melvorD:GoldenGolbin') {
						let monster = game.monsters.getObjectByID('melvorD:Golbin');
						progress = game.stats.monsterKillCount(monster) + game.stats.GolbinRaid.get(RaidStats.GolbinsKilled);
						goal = monster.pet.kills;
					} else if (item.id === 'melvorF:Pablo') {
						let dungeon = game.dungeons.getObjectByID('melvorF:Into_the_Mist');
						progress = game.combat.getDungeonCompleteCount(dungeon);
						goal = dungeon.pet.weight;
					} else if (item.id === 'melvorAoD:Hex' || item.id === 'melvorAoD:MapMasteryPet') {
						let map = game.cartography.worldMaps.getObjectByID('melvorAoD:Melvor');
						progress = item.id === 'melvorAoD:Hex' ? map.fullySurveyedHexes : map.masteredHexes;
						goal = map._totalHexCount;
					} else if (item.id === 'melvorF:Mark') {
						let actions = [...game.summoning.actions.namespaceMaps.get("melvorF").values()];
						progress = actions.filter(x => game.summoning.getMarkCount(x) >= Summoning.markLevels[3]).length;
						goal = actions.length;
					}
					chanceElem.textContent = `${getLangString('TUTORIAL_MISC_0')}: ${numberWithCommas(progress)}/${numberWithCommas(goal)}`;
				} else if (item.id === 'melvorD:LarryTheLonelyLizard') {
					if (game.farming.growthTimerMap.size <= 0)
						chanceElem.textContent += ` ${getLang('NOT_ACTIVE').replace('${skillName}', item.skill.name)}`;
					else {
						let baseChance = (skill.virtualLevel / 25000000) * (1 + game.modifiers.skillPetLocationChance / 100);
						game.farming.categories.allObjects.forEach((category, i) => {
							let plot = game.farming.categoryPlotMap.get(category).find(x => x.state === 2);
							let interval = plot !== undefined ? plot.growthTime : 0;
							if (i !== 0) chanceElem.textContent += ' |';
							chanceElem.textContent += ` 1/${numberWithCommas(Math.floor(100 / (interval * baseChance)))}`;
						});
					}
				} else if (item.id === 'melvorD:Ty') {
					let skill = game.activeAction;
					if (skill === undefined || !skill.hasMastery)
						chanceElem.textContent += ` ${getLang('MASTERY_ACTION')}`;
					else {
						let modifiedInterval = skill.actionInterval * (1 + skill.getMasteryPoolProgress(game.defaultRealm) / 100);
						let chanceForPet = (modifiedInterval / 1000 * skill.virtualLevel / 250000) * (1 + game.modifiers.skillPetLocationChance / 100);
						chanceElem.textContent += ` 1/${numberWithCommas(Math.floor(100 / chanceForPet))}`;
					}
				} else if (hasDrop !== undefined) {
					let weight = hasDrop.fixedPetClears || hasDrop.pet.weight === 1 ? hasDrop.pet.weight : `1/${formatNumber(hasDrop.pet.weight)}`;
					chanceElem.textContent += ` ${weight}`;
					if (hasDrop instanceof Stronghold)
						chanceElem.textContent += ` ${getLang('SUPERIOR_ONLY')}`;
				} else if (skill !== undefined) {
					if ((skill.isCombat && !game.combat.activeSkills.includes(skill)) || (!skill.isCombat && !skill.isActive))
						chanceElem.textContent += ` ${getLang('NOT_ACTIVE').replace('${skillName}', item.skill.name)}`;
					else {
						let interval = skill.isCombat ? player.stats._attackInterval : skill.actionInterval,
							virtualLevel = ['melvorItA:Harvesting', 'melvorItA:Corruption'].includes(skill.id) ? skill.abyssalLevel : skill.virtualLevel;
						if (item.scaleChanceWithMasteryPool)
							interval *= 1 + skill.getMasteryPoolProgress(game.defaultRealm) / 100;
						let chanceForPet = (interval / 1000 * virtualLevel / 250000) * (1 + game.modifiers.skillPetLocationChance / 100);
						chanceElem.textContent += ` 1/${numberWithCommas(Math.floor(100 / chanceForPet))}`;
					}
				}
				if (chanceElem.textContent !== getLang('CHANCE'))
					miscContainer.append(chanceElem);
			}
			return _content;
		}
		sortEquipment(array) {
			array.sort(function(a, b) {
				let x = slotTypes.indexOf(a.validSlots[0].id);
				let y = slotTypes.indexOf(b.validSlots[0].id);
				if (x < y) { return -1; }
				if (x > y) { return 1; }
				return 0;
			});
		}
		sortModifiers(array) {
			return array.sort(function(a, b) {
				let x = a.classList.contains('text-success') ? 1 : 2;
				let y = b.classList.contains('text-disabled') ? 3 : 2;
				if (x < y) { return -1; }
				if (x > y) { return 1; }
				return 0;
			});
		}
		resetFilteredIcons() {
			Swal.fire({
				html: `<span class="text-warning">${getLang('SETTING_RESET_DATA')}</span> ${getLang('DELETE_DATA_2')}`,
				showConfirmButton: true,
				confirmButtonColor: "#e56767",
				confirmButtonText: getLang('RESET'),
				showCancelButton: true,
				cancelButtonColor: "#5cace5",
			}).then((result) => {
				if (result.value) {
					this.data.skills.forEach(skill => this.data.saveData.delete(skill.id));
					this.getAllIcons().filter(x => x.isFiltered).forEach(icon => {
						icon.isFiltered = false;
						icon.show();
						if (icon.skill === this.selectedSkillID)
							this.menu.updateIcon(icon);
					});
					this.setClassByLength();
				};
			});
		}
		hideElement(elem) {
			if (!elem.classList.contains('d-none'))
				elem.classList.add('d-none');
		}
		showElement(elem) {
			if (elem.classList.contains('d-none'))
				elem.classList.remove('d-none');
		}
		addNewSkill(data) {
			tempSkills.push(data.skill);
			let realms = hasItA ? [melvorRealm.id, abyssalRealm.id] : [melvorRealm.id];
			this.data.skillRealms.set(data.skill.id, data.realmIDs || realms);
			this.data.headers.set(data.skill.id, data.header);
			sortModdedSkill(data);
		}
		addNewModifiers(data) {
			if (data.melvorModifiers === undefined)
				data.melvorModifiers = [];
			if (data.abyssalModifiers === undefined)
				data.abyssalModifiers = [];
			this.data.moddedModifiers.push(data);
		}
		updateAllPOIs() {
			this.getCategoryIcons('POI').forEach(poi => { this.renderQueue.poi.cost.add(poi), this.renderQueue.poi.bg.add(poi); });
		}
		updateAllObstacles() {
			this.getCategoryIcons('Obstacle').forEach(obstacle => this.renderQueue.obstacle.bg.add(obstacle));
		}
		updateAllQuantities() {
			this.getCategoryIcons('Consumable').forEach(consumable => { this.renderQueue.consumable.bg.add(consumable), this.renderQueue.consumable.qty.add(consumable); });
			this.getCategoryIcons('Synergy').forEach(synergy => { this.renderQueue.synergy.bg.add(synergy), this.renderQueue.synergy.qty.add(synergy); });
		}
		togglePresetButtons(val) {
			this.data.menus.forEach(menu => {
				val ? this.showElement(menu.presetsBtn) : this.hideElement(menu.presetsBtn);
			});
		}
		reInitSB() {
			this.getAllIcons().forEach(icon => icon.destroy());
			this.data.menus.forEach(menu => {
				menu.container.querySelectorAll('#SB-Info').forEach(tooltip => tooltip?._tippy?.destroy());
				menu.remove();
			});
			this.data.skills = [];
			this.data.icons.clear();
			this.data.agiSelectArr = [];
			let t0 = performance.now();
			this.initSB();
			this.data.menus.forEach(menu => {
				MainTooltipController.initAll(menu.container);
				AltTooltipController.initAll(menu.container);
			});
			this.getAllIcons().forEach(addToImageLoader);
			if (game.openPage.skills !== undefined) {
				this.menu = this.data.menus.get(this.skillPage);
				this.menu.updateSelectedRealm(game.openPage.skills[0].currentRealm.id);
				this.updateMenu(this.skillPage);
				this.setClassByLength(this.menu);
			}
			let t1 = performance.now();
			console.log(`%c[Skill Boosts]: Loading took ${t1 - t0}ms`, 'color: #ccaffc');
			if (debugEnabled)
				this.menu.toggleAllDebugBtns();
		}
	};

	let skillBoosts = new SkillBoosts();
	window.skillBoosts = skillBoosts;

	generalSettings.add([{
		type: 'dropdown',
		name: 'state',
		label: getLang('SETTING_MENU_STATE'),
		options: [{ value: 0, display: getLang('SETTING_MENU_STATE_1') }, { value: 1, display: getLang('SETTING_MENU_STATE_2') }, { value: 2, display: getLang('SETTING_MENU_STATE_3') }],
		default: 0
	}]);
	if (hasItA) {
		generalSettings.add([{
			type: 'dropdown',
			name: 'realmStates',
			label: getLang('SETTING_REALM_STATE'),
			options: [{ value: 'Auto', display: getLang('SETTING_REALM_STATE_1') }, { value: defaultRealm.id, display: getLang('SETTING_REALM_STATE_2') }, { value: melvorRealm.id, display: getLang('SETTING_REALM_STATE_3') }, { value: abyssalRealm.id, display: getLang('SETTING_REALM_STATE_4') }],
			default: 'Auto'
		}, {
			type: 'switch',
			name: 'autoSwapRealms',
			label: getLang('SETTING_AUTO_REALM'),
			default: true
		}]);
	}
	generalSettings.add([{
		type: 'switch',
		name: 'showAllObstacles',
		label: getLang('SETTING_SHOW_ALL_OBSTACLES'),
		hint: `${getLang('SETTING_SHOW_ALL_OBSTACLES_HINT')} ${getLang('REQUIRES_RESTART')}`,
		default: false
	}, {
		type: 'switch',
		name: 'astroSpoilers',
		label: getLang('SETTING_ASTRO_SPOILERS'),
		default: true
	}, {
		type: 'dropdown',
		name: 'obstacleMenu',
		label: getLang('SETTING_BUILD_MENU'),
		options: [{ value: 'always', display: getLang('SETTING_BUILD_MENU_1') }, { value: 'lClick', display: getLang('SETTING_BUILD_MENU_2') }, { value: 'rClick', display: getLang('SETTING_BUILD_MENU_3') }, { value: 'never', display: getLang('SETTING_BUILD_MENU_4') }],
		default: 'always'
	}, {
		type: 'custom',
		name: 'instaBuildObstacle',
		label: 'DEPRECATED',
		default: '',
		render(name, onChange, config) { return createElement('div'); },
		get: function(root) { return root.value; },
		set: function(root, value) { root.value = value; }
	}, {
		type: 'custom',
		name: 'hideRedBgs',
		label: getLang('SETTING_HIDE_REDBGS'),
		default: [],
		options: [{ value: 'Equipment', label: getLangString('COMBAT_MISC_18') }, { value: 'POI', label: getLangString('POINT_OF_INTEREST') }, { value: 'Consumable', label: getLangString('EQUIP_SLOT_Consumable') }, { value: 'Obstacle', label: getLangString('GAME_GUIDE_142') }, { value: 'Purchase', label: getLang('PURCHASES') }, { value: 'Pet', label: getLangString('PAGE_NAME_CompletionLog_SUBCATEGORY_4') }, { value: 'Constellation', label: getLang('CONSTELLATION') }, { value: 'Synergy', label: getLang('SYNERGIES') }],
		onChange: (newVal, oldVal) => {
			let diff = oldVal.find(x => !newVal.includes(x)) || newVal.find(x => !oldVal.includes(x));
			skillBoosts.getAllIcons().filter(x => x.category === diff).forEach(icon => skillBoosts.menu.updateIcon(icon));
			skillBoosts.renderQueue.menu = true;
		},
		render(name, onChange, config) {
			let group = createElement('div', { className: 'row justify-content-end' });
			createElement('label', { className: 'font-weight-normal text-center col-12', text: config.label, parent: group });
			for (let i = 0; i < config.options.length; i++) {
				let option = config.options[i];
				let optName = `${name}[${i}]`;
				let checkbox = createElement('input', { id: optName, className: 'custom-control-input', attributes: [['type', 'checkbox'], ['name', optName]] });
				let label = createElement('label', { className: 'font-weight-normal ml-2 custom-control-label', attributes: [['for', optName]], text: option.label });
				let control = createElement('div', { className: 'custom-control custom-checkbox custom-control-lg mb-2 p-0 col-5', children: [checkbox, label], });
				if (config.default && config.default.includes(option.value))
					checkbox.checked = true;
				checkbox.addEventListener('change', () => onChange());
				elementValueMap.set(checkbox, option.value);
				group.appendChild(control);
			}
			return group;
		},
		get(root) {
			const checkboxes = root.querySelectorAll('input[type="checkbox"]');
			const value = [];
			checkboxes.forEach(c => c.checked && value.push(elementValueMap.get(c)));
			return value;
		},
		set(root, data) {
			const checkboxes = root.querySelectorAll('input[type="checkbox"]');
			checkboxes.forEach(c => data && data.includes(elementValueMap.get(c)) && (c.checked = true));
		}
	}, {
		type: 'text',
		name: 'filter',
		label: `${getLang('SETTING_FILTER')} ${getLang('REQUIRES_RESTART')}`,
		hint: `Ex: uncommon, rare`,
		default: ''
	}, {
		type: 'number',
		name: 'allbutx',
		label: getLang('SETTING_ALLBUTX'),
		hint: getLang('SETTING_ALLBUTX_DESC'),
		default: 0,
		onChange: () => skillBoosts.updateAllQuantities()
	}, {
		type: 'custom',
		name: 'colorBgs',
		label: '',
		default: ['#005706', '#665e00', '#5c000e', '#434d5b', '#006bb8'], // #6803ab
		render(name, onChange, config) {
			let container = createElement('div');
			container.appendChild(customColorSetting);
			return container;
		},
		get: function(root) { return root.value; },
		set: function(root, value) { root.value = value; }
	}, {
		type: 'custom',
		name: 'agilityCost',
		label: '',
		default: [],
		onChange: (value) => {},
		render(name, onChange, config) {
			let container = createElement('div');
			container.appendChild(agiCostSetting);
			return container;
		},
		get: function(root) {},
		set: function(root, value) {}
	}, {
		type: 'button',
		name: 'reset',
		display: getLang('SETTING_RESET_DATA'),
		color: 'danger',
		onClick: () => skillBoosts.resetFilteredIcons()
	}]);

	onModsLoaded(() => {
		if (mod.manager.getLoadedModList().includes('Equipment Presets')) {
			presetSettings = settings.section('Equipment Presets Compat');
			pGet = (setting) => presetSettings.get(setting);
			presetSettings.add([{
				type: 'switch',
				name: 'showPresetBtn',
				label: getLang('SETTING_PRESET_BUTTON'),
				default: true,
				onChange: (val) => skillBoosts.togglePresetButtons(val)
			}, {
				type: 'switch',
				name: 'noPreset',
				label: getLang('SETTING_PRESET_NO_PRESET'),
				default: false
			}, {
				type: 'switch',
				name: 'onePreset',
				label: getLang('SETTING_PRESET_ONE_PRESET'),
				default: false
			}, {
				type: 'dropdown',
				name: 'presetFilter',
				label: getLang('SETTING_PRESET_FILTER'),
				hint: getLang('SETTING_PRESET_FILTER_HINT'),
				default: 0,
				options: [{ value: 0, display: getLang('SETTING_PRESET_FILTER_OPTION_1') }, { value: 1, display: getLang('SETTING_PRESET_FILTER_OPTION_2') }, { value: 2, display: getLang('SETTING_PRESET_FILTER_OPTION_3') }]
			}]);
		}

		// Documenation can be found at https://mod.io/g/melvoridle/m/skill-boosts
		if (mod.manager.getLoadedModList().includes('[Myth] Music')) { //Replace with 'Skill Boosts'
			// Add [Myth] Music Skill data
			skillBoosts.addNewSkill({
				// Required //
				skill: game.music,
				// Optional //
				realmIDs: ['melvorD:Melvor'], // 'melvorD:Melvor', 'melvorItA:Abyssal', undefined = Both
				//header: HTMLElement, A header is only required if there is no `skill.header` property
				//noPreservation: Boolean,
				//noMastery: Boolean,
				//noSummon: Boolean,
				//noPotion: Boolean,
				noDoubling: true,
				//noInterval: Boolean,
				//noConsumable: Boolean,
				//noPrimaryResource: Boolean,
				//isArtisan: Boolean,
			});
			// Add [Myth] Music Modifier data
			skillBoosts.addNewModifiers({
				// Required //
				skills: [game.music],
				// Optional //
				melvorModifiers: ['melvorD:flatCurrencyGain', 'melvorD:currencyGain', 'mythMusic:musicGP', 'mythMusic:musicHireCost', 'mythMusic:bandPractice', 'mythMusic:masterAncientRelic', 'mythMusic:chanceToObtainShrimpWhileTrainingMusic', 'mythMusic:sheetMusicDropRate', 'mythMusic:musicAdditionalRewardRoll', 'mythMusic:skillMasteryXPPerVariel'],
				//abyssalModifiers: [],
			});
		}
	});

	function addToImageLoader(icon) {
		if (icon instanceof SkillBoostsIcon)
			ImageLoader.register(icon.image, icon.item.media);
		else {
			ImageLoader.register(icon.summon1Image, icon.item.summons[0].media);
			ImageLoader.register(icon.summon2Image, icon.item.summons[1].media);
		}
	}

	onCharacterLoaded(() => {
		SBSave.initAndLoad();
	});

	onInterfaceReady(() => {
		const t0 = performance.now();
		try {
			// SBSave.initAndLoad();
			skillBoosts.initSB();
			document.body.append(createElement('sb-tooltip'), createElement('sb-tooltip'));
			skillBoosts.data.menus.forEach(menu => {
				MainTooltipController.initAll(menu.container);
				AltTooltipController.initAll(menu.container);
			});
			agiCostSetting.init();
			customColorSetting.load();
			addLevelChangeEmitters();
		} catch (e) {
			console.error(`[Skill Boosts]: ${e}`);
		}

		document.addEventListener('click', () => AltTooltipController.hide());
		window.addEventListener("resize", skillBoosts.resizeMenu.bind(skillBoosts));
		document.querySelector("#combat-area-category-menu > div").classList.remove('push');

		if (game.openPage.skills !== undefined) {
			skillBoosts.onSkillChange(true);
			skillBoosts.getAllIcons(game.openPage.skills[0]).forEach(addToImageLoader);
		} else
			skillBoosts.getAllIcons().forEach(addToImageLoader);

		startRenderer();

		const t1 = performance.now();
		console.log(`%c[Skill Boosts]: Loading took ${t1 - t0}ms`, 'color: #ccaffc');
		// Cleanup old data
		skillBoosts.data.skills.forEach(skill => characterStorage.removeItem(`${skill.localID}-btn`));
	});
}