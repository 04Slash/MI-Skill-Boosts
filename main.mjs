export async function setup({ settings, loadModule, loadTemplates, onCharacterSelectionLoaded, onCharacterLoaded, onInterfaceReady, getResourceUrl, characterStorage }) {
	await loadTemplates('template.html');
	document.body.append(createElement('sb-tooltip'), createElement('sb-tooltip'));

	const getSlot = (id) => game.equipmentSlots.getObjectByID(id),
		filterSetting = (x) => !filterByIDSetting.some(y => y !== '' && x.id.toLowerCase().includes(y)),
		{ lang } = await loadModule('localization.mjs'),
		{ addLevelChangeEmitters, startRenderer } = await loadModule('src/Patching.mjs'),
		{ SkillBoostsIcon, SkillBoostsSynergy, SBAgilitySelect, SBRenderQueue, SBCompactCheckboxGroup, AgilityCostSetting, SBColorSetting } = await loadModule('src/SBClasses.mjs'),
		{ noPreservation, checkAgilityCourses, sortModdedSkill, getCommonModifiers, getMelvorModifiers, getAbyssalModifiers } = await loadModule('src/ModifierData.mjs'),
		{ MainTooltipController, AltTooltipController } = await loadModule('src/Tooltips.mjs'),
		{ ImageLoader } = await loadModule('src/ImageLoader.mjs'),
		{ SBSaver } = await loadModule('src/SBSave.mjs'),
		getLang = (key) => {
			if (!lang[key]) {
				return `SkillBoosts: Undefined Lang`;
			}
			return lang[key][setLang] ? lang[key][setLang] : lang[key]['en'];
		},
		generalSettings = settings.section('General'),
		getSetting = (setting) => generalSettings.get(setting),
		setSetting = (setting, value) => generalSettings.set(setting, value),
		player = game.combat.player,
		hasTotH = cloudManager.hasTotHEntitlementAndIsEnabled,
		hasAoD = cloudManager.hasAoDEntitlementAndIsEnabled,
		hasItA = cloudManager.hasItAEntitlementAndIsEnabled,
		defaultRealm = { id: 'Skill_Boosts:No_Realm', name: getLang('NO_REALM'), media: assets.getURI('assets/media/main/skill_tree.png') },
		melvorRealm = game.realms.getObjectByID('melvorD:Melvor'),
		abyssalRealm = hasItA && game.realms.getObjectByID('melvorItA:Abyssal'),
		eternalRealm = hasItA && game.realms.getObjectByID('melvorItA:Eternal'),
		intoTheAbyss = game.dungeons.getObjectByID('melvorItA:Into_The_Abyss'),
		slotTypes = ['melvorD:Weapon', 'melvorD:Shield', 'melvorD:Helmet', 'melvorD:Platebody', 'melvorD:Platelegs', 'melvorD:Boots', 'melvorD:Gloves', 'melvorD:Cape', 'melvorD:Amulet', 'melvorD:Ring', 'melvorD:Gem', 'melvorD:Enhancement1', 'melvorD:Enhancement2', 'melvorD:Enhancement3', 'melvorD:Quiver', 'melvorD:Summon1', 'melvorD:Consumable'],
		providedRunes = ['melvorD:Air_Rune', 'melvorD:Water_Rune', 'melvorD:Earth_Rune', 'melvorD:Fire_Rune', 'melvorF:Nature_Rune', 'melvorF:Spirit_Rune', 'melvorF:Lava_Rune', 'melvorF:Mud_Rune', 'melvorTotH:Soul_Rune', 'melvorTotH:Infernal_Rune'],
		catOverrides = ['melvorD:Allotment', 'melvorD:Herb', 'melvorD:Tree', 'melvorD:Fish', 'melvorD:Soup', 'melvorF:Consumables', 'melvorF:Runes', 'melvorF:Wands', 'melvorD:Synergies'],
		itemsByRealm = new Map([
			[melvorRealm.id, ['melvorF:Stardust', 'melvorF:Golden_Stardust', 'melvorD:Bird_Nest', 'melvorF:Ash', 'melvorD:Coal_Ore', 'melvorTotH:Charcoal']],
			[abyssalRealm.id, ['melvorItA:Abyssal_Stardust', 'melvorItA:Shadow_Raven_Nest', 'melvorItA:Shadow_Drake_Nest', 'melvorItA:Withered_Ash']]
		]),
		namespaceByRealm = new Map([
			[melvorRealm.id, ['melvorD', 'melvorF', 'melvorTotH', 'melvorAoD']],
			[abyssalRealm.id, ['melvorItA']]
		]),
		fillerObstacles = new MultiMap(2);

	for (let i = 1; i < 16; i++) {
		let melvorFiller = { id: `Skill_Boosts:${i}SB`, name: getLang('FILLER_OBSTACLE'), media: getResourceUrl(`assets/${i}SB.png`) };
		fillerObstacles.set(melvorFiller, melvorRealm.id, i - 1);
	}
	for (let i = 1; i < 13; i++) {
		let abyssalFiller = { id: `Skill_Boosts:${i}-SB`, name: getLang('FILLER_OBSTACLE'), media: getResourceUrl(`assets/${i}-SB.png`) };
		fillerObstacles.set(abyssalFiller, abyssalRealm.id, i - 1);
	}

	let filterMode = 0,
		settingID = 0,
		debugEnabled = false,
		dustItems = [],
		filteredPets = [],
		filterByIDSetting = [],
		greenBg, yellowBg, redBg, defaultBg, filteredBg,
		getPresetSetting,
		windowWidth,
		lockedSynergyImg = assets.getURI('assets/media/skills/summoning/synergy_locked.png'),
		fullRelicImg = assets.getURI('assets/media/main/relic_progress_5.png'),
		passiveImg = getResourceUrl('assets/passive_slot_filled.png'),
		passiveIcon = createImgNode(passiveImg, 'sb-inactive'),
		abyssalRelicImage = getResourceUrl('assets/abyssalRelic.png'),
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
			textNode.textContent = `• ${textNode.textContent}`;
		if (bg || colorClass !== '')
			template.append(icon);
		template.append(textNode);
		return template;
	}

	function createImgNode(src, cls, text, returnNodes) {
		let container = createElement('div');
		let img = createElement('img', { className: cls });
		ImageLoader.register(img, src);
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
			this.massFilterToggle.onclick = () => setSetting('massFiltering', !getSetting('massFiltering'));
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
			if (realmOptions.length >= 2) {
				let realms = [defaultRealm, ...realmOptions.map(x => game.realms.getObjectByID(x))];
				realms.forEach(realm => {
					let icon = new SkillBoostsIcon('', realm, realm.media, true, 28);
					icon.setTooltip(realm.name);
					icon.setBg('#6C757D');
					icon.container.classList.replace('m-1', 'mx-1');
					icon.onclick = () => skillBoosts.onRealmChange(realm.id, undefined, this, this.skill.id);
					this.realmIcons.push(icon);
					this.realmContainer.append(icon);
				});
			} else {
				this.currentRealm = this.skill.currentRealm.id;
				hideElement(this.realmContainer);
			}

			if (this.skill === game.attack) {
				this.container.classList.replace('sb-menu', 'sb-combat-menu');
				// this.appendCombatMenu();
			}
			if (mod.manager.getLoadedModList().includes('Equipment Presets') && getPresetSetting('showPresetBtn'))
				showElement(this.presetsBtn);

			this.translate(this.container);
			this.createTooltips();
			this.massFilterToggle.checked = getSetting('massFiltering');
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
					if (!icon.realms.includes(this.currentRealm) || (icon.isFiltered && !filterMode) || icon.isHidden || (icon.bgColor === redBg && getSetting('hideRedBgs').includes(icon.category)))
						icon.hide();
					else
						icon.show();
				});
				this.setSearchNormal();
			} else {
				let searchKeys = ['slots', 'name'];
				skillBoosts.data.realmIDs.forEach(realmID => {
					if (this.currentRealm === 'Default Sorting' || this.currentRealm === realmID)
						searchKeys.push(`${realmID.replace(':', '')}Mods`, `${realmID.replace(':', '')}Text`);
				});
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
			let menuOpen = skillBoosts.saveData.get(skillBoosts.skillPage).includes('Skill_Boosts:Menu_Opened');
			if (onLoad)
				menuOpen = !menuOpen;
			else {
				skillBoosts.removeValueFromMap(skillBoosts.saveData, skillBoosts.skillPage, `Skill_Boosts:${menuOpen ? 'Menu_Opened' : 'Menu_Closed'}`);
				skillBoosts.addValueToMap(skillBoosts.saveData, skillBoosts.skillPage, `Skill_Boosts:${menuOpen ? 'Menu_Closed' : 'Menu_Opened'}`);
			}
			menuOpen ? hideElement(this.iconMenu) : showElement(this.iconMenu);
			if (skillBoosts.skillPage === 'melvorAoD:Cartography')
				skillBoosts.updateCartographyMap();
		}
		toggleFilterAlert() {
			filterMode ? showElement(this.alert) : hideElement(this.alert);
		}
		toggleFilterModeOnClick() {
			filterMode = 1 - filterMode;
			this.toggleFilterAlert();
			this.toggleAllFilteredIcons();
			skillBoosts.resizeMenu();
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
				return skillBoosts.toggleFilterState(icon, icon.isFiltered, filterMode && icon.realms.includes(this.currentRealm));
			if (icon.category === 'FillerObstacle')
				return icon.setBg(defaultBg);

			let queue = skillBoosts.renderQueue[icon.category.toLowerCase()];
			queue.bg.add(icon.item);

			if (['Equipment', 'Pet', 'Purchase', 'Constellation', 'Relic'].includes(icon.category))
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
			let container = createElement('div', { className: 'block sb-swal' }),
				createPresetBtn = container.appendChild(createElement('button', { className: 'btn btn-primary mb-2 w-100', text: getLang('CREATE_PRESET') })),
				presetContainer = container.appendChild(createElement('div')),
				btnClass = 'btn btn-sm my-2 no-wrap';

			createPresetBtn.onclick = () => presetAPI.uiShowCreate();

			presets.forEach(preset => {
				let presetElem = skillBoosts.createDividerElem(presetContainer, ' d-flex border-bottom');
				presetElem.classList.replace('border-dark', 'border-secondary');

				let equipBtn = presetElem.appendChild(createElement('button', { className: `${btnClass} btn-success`, text: getLangString('TUTORIAL_TASK_PREFIX_2') }));
				equipBtn.onclick = () => presetAPI.equipPresetByGID(preset.gid);

				let textContainer = presetElem.appendChild(createElement('div', { className: 'text-left font-size-sm my-2 mx-1 w-100' }));
				textContainer.appendChild(createImgNode(presetAPI.uiGetPresetIcon(preset).media, 'resize-28 p-1'));
				textContainer.append(createElement('span', { className: 'align-middle', text: preset.title }));

				let editBtn = presetElem.appendChild(createElement('button', { className: `${btnClass} btn-info`, text: getLang('EDIT') }));
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
				filterType = getPresetSetting('presetFilter'),
				skillPresets;

			if (filterType === 0)
				skillPresets = presets.filter(x => x.type === 0 || x.type === (skill === game.attack ? 1 : 2));
			else if (filterType === 1)
				skillPresets = presets.filter(x => x.type === (skill === game.attack ? 1 : 2));
			else if (filterType === 2)
				skillPresets = presets.filter(x => x.minibar.includes(skillBoosts.selectedSkillID) || (skill === game.attack && x.type === 1));
			else
				skillPresets = presets;

			if (getPresetSetting('noPreset') && skillPresets.length < 1)
				presetAPI.uiShowCreate();
			else if (getPresetSetting('onePreset') && skillPresets.length === 1)
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
			this.MainTooltipController = MainTooltipController;
			this.data = { skills: [], realms: [], realmIDs: [], modifiers: new MultiMap(2), menus: new Map(), icons: new Map(), skillRealms: new Map(), agiSelectArr: [] };
			this.modData = { skills: [], modifiers: [], realms: [], headers: new Map() };
			this.saveData = new Map();
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
			this.addMysteriousStone();
			this.filterPotions();
			if (hasAoD) this.filterPOIs();
			this.filterObstacles();
			this.filterPurchases();
			this.filterPets();
			this.filterConstellations();
			this.filterSynergies();
			if (game.currentGamemode.allowAncientRelicDrops) this.filterRelics();
			// Data cleanup
			this.data.modifiers = new MultiMap(2);
			filteredPets = [];
		}
		initSettings() {
			this.updateBackgrounds(getSetting('colorBgs'), true);

			filterByIDSetting = getSetting('filter').toLowerCase().replace(/\s/g, '').split(",");

			if (getSetting('instaBuildObstacle') === true && !characterStorage.getItem('ibo')) {
				setSetting('obstacleMenu', 'never');
				characterStorage.setItem('ibo', 1);
			}
			if (this.data.realms.length >= 3) {
				let oldRealmState = getSetting('realmStates');
				if (oldRealmState !== undefined && !characterStorage.getItem('r')) {
					if (oldRealmState === getLangString('BANK_STRING_14'))
						oldRealmState = defaultRealm.id;
					setSetting('realmState', oldRealmState);
					characterStorage.setItem('r', 1);
				}
			}
		}
		initRealms() {
			this.data.realms.push(defaultRealm);
			game.realms.forEach(realm => {
				if (realm.ignoreCompletion || realm.isModded)
					return;
				this.data.realms.push(realm);
				this.data.realmIDs.push(realm.id);
			});
			this.modData.realms.forEach(realm => {
				this.data.realms.push(realm);
				this.data.realmIDs.push(realm.id);
			});
		}
		initSkills() {
			let sidebarItems = [{ id: 'melvorD:Attack' }, ...sidebar.category('Passive').items(), ...sidebar.category('Non-Combat').items()];

			sidebarItems.forEach(item => {
				let skill = game.skills.find(x => x.id === item.id);
				if (!skill)
					skill = this.modData.skills.find(x => x.namespace === item.id.substr(0, item.id.indexOf(':')));
				if (skill === undefined)
					return;
				if (!skill.isModded || this.modData.headers.has(item.id))
					this.data.skills.push(skill);
				if (!skill.isModded)
					this.data.skillRealms.set(skill.id, skill.getRealmOptions().filter(x => x !== eternalRealm).map(x => x.id));
			});

			['melvorD:Attack', 'melvorD:Township'].forEach(skillID => this.data.skillRealms.set(skillID, this.data.realms.filter(x => x.isModded === false).map(x => x.id)));
			['melvorD:Magic', 'melvorAoD:Cartography'].forEach(skillID => this.data.skillRealms.set(skillID, [melvorRealm.id]));
			this.modData.headers.set(game.attack.id, combatAreaMenus.categoryMenu.parentElement.lastElementChild);

			this.data.skills.forEach(skill => {
				if (!this.saveData.has(skill.id) || !this.data.realms.some(x => this.saveData.get(skill.id).includes(x.id)))
					this.addValueToMap(this.saveData, skill.id, skill.currentRealm.id);
			});
		}
		initModifiers() {
			this.data.skills.forEach(skill => {
				this.data.realms.forEach(realm => {
					if (realm.id === 'Default Sorting')
						return;

					let modifiers = getCommonModifiers(skill.id);
					if (realm.id === 'melvorD:Melvor')
						modifiers.push(...getMelvorModifiers(skill.id));
					if (realm.id === 'melvorItA:Abyssal')
						modifiers.push(...getAbyssalModifiers(skill.id));

					this.modData.modifiers.forEach(data => {
						if (data.skills.includes(skill) && data.modifiers.has(realm.id))
							modifiers.push(...data.modifiers.get(realm.id))
					});

					this.addModifiersToMap(realm.id, skill.id, modifiers);
				});
			});
		}
		createMenus() {
			this.data.skills.forEach(skill => {
				let menu = new SkillBoostMenu(skill);
				this.data.menus.set(skill.id, menu);
				this.moveMenu(skill.id, menu);

				let menuState = getSetting('state');
				if (menuState === 1) {
					this.addValueToMap(this.saveData, skill.id, 'Skill_Boosts:Menu_Closed');
					hideElement(menu.iconMenu);
				} else if (menuState === 2) {
					this.addValueToMap(this.saveData, skill.id, 'Skill_Boosts:Menu_Opened');
					showElement(menu.iconMenu);
				} else
					menu.toggleMenu(true);
			});
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
			this.renderRelicBg();
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
		renderRelicBg() {
			if (this.renderQueue.relic.bg.size === 0)
				return;
			this.renderQueue.relic.bg.forEach(relic => this.updateRelicBg(relic));
			this.setIconSearch();
			this.renderQueue.relic.bg.clear();
		}
		renderMenu() {
			if (!this.renderQueue.menu)
				return;
			windowWidth = window.innerWidth;
			this.resizeMenu();
			this.renderQueue.menu = false;
		}
		setIconSearch(menu = this.menu) {
			if (menu !== undefined && menu.searchBar.value !== '')
				menu.onSearchChange(menu.searchBar.value);
		}
		updateMenu(newSkillID, moveMenu) {
			this.selectedSkillID = newSkillID;

			if (this.menu === undefined)
				this.menu = this.data.menus.get(this.selectedSkillID);
			if (moveMenu && this.menu.skillPage !== this.selectedSkillID)
				this.moveMenu(this.selectedSkillID);

			this.menu.toggleMenu(true);
			this.menu.toggleFilterAlert();
			let icons = this.getSkillIcons();
			this.updateOnRealmChange(this.menu.currentRealm, icons);
			icons.forEach(icon => this.menu.updateIcon(icon));
			this.render();
		}
		updateOnSkillChange(newSkillID, isNewPage) {
			if (!this.data.skills.some(x => x.id === newSkillID && ((!isNewPage && !x.isUnlocked) || x.isUnlocked)))
				return;
			let oldMenu = this.menu;
			this.menu = this.data.menus.get(newSkillID);

			if (!oldMenu)
				return this.updateMenu(newSkillID, true);

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
			this.updateOnSkillChange(skillID, isNewPage);
			this.resizeMenu();
			this.setIconSearch();
		}
		updateOnRealmChange(newRealmID, icons, menu = this.menu, skillID = this.selectedSkillID) {
			if (this.data.realms.length < 3 || (!this.data.realms.some(x => x.id === newRealmID) && newRealmID !== undefined))
				return;

			let realmState = getSetting('realmState'),
				skillRealms = this.data.skillRealms.get(skillID);

			if (!menu || !skillRealms || skillRealms.length <= 1)
				return;

			if (!newRealmID)
				newRealmID = realmState === 'Auto' ? this.data.realms.find(x => this.saveData.get(skillID).includes(x.id)).id : realmState;
			if (realmState !== 'Auto' && !skillRealms.includes(newRealmID) && newRealmID !== defaultRealm.id)
				newRealmID = this.saveData.get(this.selectedSkillID).find(x => this.data.realmIDs.some(y => y === x));

			if (this.selectedSkillID === skillID) {
				if (!icons)
					icons = this.getSkillIcons(false, false, skillID);
				icons.forEach(icon => {
					if (!icon.realms.includes(newRealmID) || (icon.isFiltered && !filterMode) || icon.isHidden || (icon.bgColor === redBg && getSetting('hideRedBgs').includes(icon.category)))
						icon.hide();
					else
						icon.show();
				});
			}

			let oldRealmID = menu.currentRealm;
			menu.updateSelectedRealm(newRealmID);
			if (realmState === 'Auto') {
				this.removeValueFromMap(this.saveData, skillID, oldRealmID);
				this.addValueToMap(this.saveData, skillID, newRealmID);
			}
		}
		onRealmChange(realmID, icons, menu = this.menu, skillID = this.selectedSkillID) {
			this.updateOnRealmChange(realmID, icons, menu, skillID);
			if (this.selectedSkillID === skillID) {
				this.resizeMenu(menu);
				this.setIconSearch(menu);
			}
		}
		moveMenu(skillID, menu = this.menu) {
			let skill = game.skills.getObjectByID(skillID),
				header;
			if (skill !== undefined)
				header = skill.header;
			if (header == undefined)
				header = this.modData.headers.get(skillID);
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

			if (item instanceof EquipmentItem)
				icon.slots = item.validSlots.map(x => x.localID);
			if (item.name)
				icon.name = item.name;

			if (modifiers) {
				modifiers.forEach((mods, realm) => {
					icon[`${realm.replace(':', '')}Text`] = Array.from(new Set(getPlainModifierDescriptions(mods)));
					icon[`${realm.replace(':', '')}Mods`] = Array.from(new Set(mods.map(x => x.modifier.localID)));
				});
			}

			if (!modifiers || (!modifiers.has('melvorD:Melvor') && realms.includes('melvorD:Melvor')))
				icon['melvorDMelvorText'] = [item.description];
			if (!modifiers || (!modifiers.has('melvorItA:Abyssal') && realms.includes('melvorItA:Abyssal')))
				icon['melvorItAAbyssalText'] = [item.description];

			icon.elem = elem;
			icon.skill = skill.id;
			icon.realms = [...realms, defaultRealm.id];
			this.data.menus.get(skill.id).iconContainers[elem].appendChild(icon);

			if (game.openPage.skills && game.openPage.skills[0] === skill && this.saveData.get(skill.id).some(x => icon.realms.includes(x))) {
				let media = category === 'Relic' ? realms.includes('melvorItA:Abyssal') ? abyssalRelicImage : fullRelicImg : item.media;
				icon.setImage(media);
			}

			let id = category === 'Synergy' ? this.getSynergyID(item) : item.id;
			if (this.saveData.has(skill.id) && this.saveData.get(skill.id).includes(id))
				this.toggleFilterState(icon, undefined, false);
			else
				icon.isFiltered = false;

			if (category) {
				this.setIconOnClick(icon, item, category);
				this.addValueToMap(this.data.icons, skill.id, icon);
			}

			return icon;
		}
		setIconOnClick(icon, item, category) {
			if (item instanceof EquipmentItem) {
				icon.onclick = () => this.equipmentOnClick(icon, item, item.validSlots[0]);
				if (item.validSlots.length <= 2)
					this.equipmentOnContextMenu(icon, item, getSlot((item.type === 'Familiar' ? 'melvorD:Summon2' : 'melvorD:Passive')));
			} else if (category === 'Obstacle')
				icon.onclick = () => this.obstacleOnClick(item, icon);
			else if (item.type === 'Potion')
				icon.onclick = () => this.potionOnClick(item, icon);
			else if (category === 'Synergy')
				icon.onclick = () => this.synergyOnClick(item, icon);
			else if (category === 'Purchase')
				icon.onclick = () => this.purchaseOnClick(item, icon);
			else if (category === 'POI')
				icon.onclick = () => this.poiOnClick(item, icon);
			else if (category === 'Pet')
				icon.onclick = () => this.petOnClick(icon);
			else if (category === 'Constellation')
				icon.onclick = () => this.constellationOnClick(item, icon);
			else if (category === 'Relic')
				icon.onclick = () => this.relicOnClick(icon);
		}
		getAllIcons(excludedSkill) {
			let icons = [];
			this.data.icons.forEach((iconArr, skill) => {
				if (skill !== excludedSkill)
					icons.push(...iconArr);
			});
			return icons;
		}
		getSkillIcons(removeRedBgs, removeFiltered, skillID = this.selectedSkillID) {
			if (skillID === undefined) return [];
			let icons = this.data.icons.get(skillID);
			if (icons === undefined) return [];
			if (removeFiltered && !filterMode)
				icons = icons.filter(x => !x.isFiltered);
			if (removeRedBgs && getSetting('hideRedBgs').length > 0)
				icons = icons.filter(x => !(x.bgColor === redBg && getSetting('hideRedBgs').includes(x.category)));
			return icons;
		}
		getRealmIcons(removeRedBgs, removeFiltered = true) {
			let realm = this.menu !== undefined && (this.menu.currentRealm);
			if (!realm) return [];
			return this.getSkillIcons(removeRedBgs, removeFiltered).filter(x => x.realms.includes(realm));
		}
		getItemIcon(item, removeRedBgs) {
			return this.getSkillIcons(removeRedBgs, true).find(x => x.item === item);
		}
		getCategoryIcons(category, removeRedBgs) {
			return this.getSkillIcons(removeRedBgs, true).filter(x => x.category === category).map(x => x.item);
		}
		filterIcon(oIcon) {
			let isFiltered = oIcon.isFiltered,
				icons = getSetting('massFiltering') ? this.getAllIcons().filter(x => x.item === oIcon.item) : [oIcon];

			icons.forEach(icon => this.toggleFilterState(icon, !isFiltered, true));

			this.saveFilteredIcon(icons, isFiltered);
			this.render();
		}
		toggleFilterState(icon, setState, showIcon) {
			icon.isFiltered = setState !== undefined ? setState : !icon.isFiltered;
			icon.isFiltered ? icon.setBg(filteredBg) : this.menu.updateIcon(icon);
			showIcon ? icon.show() : icon.hide();
		}
		saveFilteredIcon(icons, remove) {
			icons.forEach(icon => {
				let id = icon.category === 'Synergy' ? this.getSynergyID(icon.item) : icon.item.id;
				let saveIcon = remove ? this.removeValueFromMap : this.addValueToMap;
				saveIcon(this.saveData, icon.skill, id);
			});
		}
		hideUndiscoveredIcons(icon, shouldHide, category) {
			if (shouldHide && getSetting('hideRedBgs').includes(category) || icon.isFiltered)
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
				modifiers = new Map();

			if (itemModifiers.length <= 0 || (isNeg && (item instanceof AgilityObstacle || item instanceof AgilityPillar) && game.agility.hasMasterRelic(melvorRealm)))
				return { realms, modifiers };

			let skillRealms = this.data.skillRealms.get(skill.id);
			this.data.realms.forEach(realm => {
				if (!skillRealms.includes(realm.id))
					return;

				const isAbyssal = realm === abyssalRealm,
					isMelvor = realm === melvorRealm,
					damageType = isAbyssal ? 'melvorItA:Abyssal' : 'melvorD:Normal',
					hasDamageType = (obj) => (!obj || !obj.damageType || obj.damageType.id === damageType || (!isMelvor && !isAbyssal && game.combatAreas.some(x => x.realm === realm && x.monsters.length > 0 && x.monsters[0].damageType === obj.damageType)));

				if (item instanceof WeaponItem && (skill.isCombat || skill === game.thieving) && !hasDamageType(item))
					return;
				if (isAbyssal && item instanceof EquipmentItem && ['melvorD:Mining_Gloves', 'melvorD:Gem_Gloves', 'melvorF:Scroll_Of_Essence'].includes(item.id))
					return;
				if (item && item.consumesOn && (item.consumesOn.some(x => x && ((x.realms && !x.realms.has(realm)) || (x.actions && [...x.actions].some(y => y.realm !== realm))))))
					return;

				const searchMods = this.data.modifiers.get(realm.id, skill.id),
					gpCurr = isAbyssal ? game.abyssalPieces : game.gp,
					scCurr = isAbyssal ? game.abyssalSlayerCoins : game.slayerCoins,
					isValid = (m, inverted) => (m.modifier && m.isNegative === (inverted ? !isNeg : isNeg) && (!inverted || skill === game.attack) && !m.modifier.disabled),
					isCorrupted = (m) => (!m || !m.group || (m.group.id === 'melvorItA:Corruption' && isAbyssal)),
					hasRealm = (x) => (!x.realm || x.realm === realm),
					hasSkill = (x) => (!x.skill || x.skill === skill || (x.skill.isCombat && skill === game.attack)),
					hasCategory = (m, cat) => (!m[cat] || (namespaceByRealm.has(realm.id) && namespaceByRealm.get(realm.id).includes(m[cat].namespace)) || (!namespaceByRealm.has(realm.id) && m[cat].namespace === realm.namespace) || (isAbyssal && catOverrides.includes(m[cat].id))),
					hasAction = (m) => (!m.action || (m.action.realm === realm && ((m.action.potions && m.action.potions[0].action === skill) || (!m.action.skill || (!m.action.potions && m.action.skill === skill)) || item.id === 'melvorTotH:Toxic_Maker_Gloves'))),
					hasCurrency = (m) => (!m.currency || m.currency === gpCurr || (skill === game.attack && m.currency === scCurr)),
					hasItem = (m) => (!m.item || ![...itemsByRealm.values()].flat().includes(m.item.id) || !itemsByRealm.has(realm.id) || itemsByRealm.get(realm.id).includes(m.item.id)),
					foundMods = itemModifiers.filter(({ mod, inverted, conditionals }) => isValid(mod, inverted) && hasRealm(mod) && hasSkill(mod) && hasCategory(mod, 'category') && hasCategory(mod, 'subcategory') && hasAction(mod) && hasCurrency(mod) && hasDamageType(mod) && (!conditionals || conditionals.every(x => hasDamageType(x) && isCorrupted(x))) && hasItem(mod) && searchMods.some(y => mod.modifier && y === mod.modifier.id));

				if (foundMods.length > 0) {
					realms.push(realm.id);
					modifiers.set(realm.id, foundMods.map(x => x.mod).flat());
				}
			});
			return { realms, modifiers };
		}
		filterEquipment() {
			let specialItems = [{ itemID: 'melvorD:Barbarian_Gloves', skill: game.fishing, realms: [melvorRealm.id] }, { itemID: 'melvorF:Jesters_Hat', skill: game.thieving, realms: this.data.realmIDs }, { itemID: 'melvorF:Sailors_Top', skill: game.fishing, realms: this.data.realmIDs }];
			if (mod.manager.getLoadedModList().includes('[Myth] Music'))
				specialItems.push({ itemID: 'mythMusic:Concert_Pass', skill: game.music, realms: [melvorRealm.id] });
			let containsMods = (x) => (x.modifiers && x.modifiers.length > 0) || (x.conditionalModifiers && x.conditionalModifiers.length > 0),
				allEquipment = game.items.equipment.filter(x => x.providedRunes.length > 0 || filterSetting(x) && (containsMods(x) && !['Golbin Raid', 'Events'].includes(x.category))),
				lesserRelicDrops = game.woodcutting.rareDrops.filter(x => x.item.id.includes('_Lesser_Relic'));

			specialItems.forEach(({ itemID }) => {
				let item = game.items.getObjectByID(itemID);
				if (!containsMods(item))
					allEquipment.push(item);
			});
			allEquipment.sort((a, b) => slotTypes.indexOf(a.validSlots[0].id) - slotTypes.indexOf(b.validSlots[0].id));

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
					let modifiers = new Map();
					specialItem.realms.forEach(realm => modifiers.set(realm, itemMods.map(x => x.id).flat()));
					return this.createIcon(item, modifiers, specialItem.realms, specialItem.skill, 0, 'Equipment');
				}

				if (item.providedRunes.some(({ item }) => providedRunes.includes(item.id)))
					return this.createIcon(item, undefined, [melvorRealm.id], game.altMagic, isConsumable ? 1 : 0, isConsumable ? 'Consumable' : 'Equipment');

				if (this.hasAgilityCostMod(item) && !this.data.agiSelectArr.includes(item))
					this.data.agiSelectArr.push(item);

				if (itemMods.length <= 0)
					return;

				this.data.skills.forEach(skill => {
					if (skill === game.attack && !['melvorD:Enhancement1', 'melvorD:Enhancement2', 'melvorD:Enhancement3', 'melvorD:Consumable', 'melvorD:Summon1'].some(x => item.validSlots.some(y => y.id === x)))
						return;
					if (skill === game.altMagic && itemMods.some(x => x.mod.modifier && x.mod.modifier.id === 'melvorD:altMagicSkillXP' && x.mod.isNegative))
						return;
					if (skill === game.thieving && item.id === 'melvorItA:Netherite_Gloves')
						return;
					let { realms, modifiers } = this.hasModifiers(false, skill, itemMods, item);
					if (realms.length > 0)
						this.createIcon(item, modifiers, realms, skill, isConsumable ? 1 : 0, isConsumable ? 'Consumable' : 'Equipment');
				});
			});
		}
		equipmentOnClick(icon, item, slot, ignore = false) {
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
					qty -= Math.floor(getSetting('allbutx'));

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
		equipmentOnContextMenu(icon, item, slot) {
			if (nativeManager.isMobile)
				this.onLongPress(icon, () => this.equipmentOnClick(icon, item, slot));
			else
				icon.oncontextmenu = (e) => { e.preventDefault(), this.equipmentOnClick(icon, item, slot); };
		}
		checkOtherEquipmentSets(item) {
			return player.equipmentSets.some(({ equipment }) => {
				if (equipment === player.equipment)
					return false;
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
					let enhancementIcon = createImgNode(itemSlot.emptyMedia, 'sb-inactive');
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
		potionOnClick(potion, icon) {
			let activePotion = game.potions.activePotions.get(potion.action);
			if (filterMode)
				this.filterIcon(icon);
			else if (debugEnabled)
				console.dir(icon);
			else if (game.bank.getQty(potion) - getSetting('allbutx') > 0 && (activePotion === undefined || activePotion.item !== potion)) {
				game.potions.usePotion(potion, false);
				this.renderConsumableBg();
				this.renderConsumableQty();
			}
		}
		updateConsumableBg(consumable) {
			let icon = this.getItemIcon(consumable);
			if (icon === undefined)
				return;

			let shouldHide = false;

			if (player.equipment.checkForItem(consumable) || game.potions.isPotionActive(consumable) || (consumable.id === 'melvorD:Charge_Stone_of_Rhaelyx' && game.bank.getQty(consumable) > 0))
				icon.setBg(greenBg);
			else if (Math.max(game.bank.getQty(consumable) - getSetting('allbutx'), 0) > 0)
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
			let icon = this.getItemIcon(consumable, true);
			if (icon === undefined)
				return;

			let qty = game.bank.getQty(consumable);
			if (!['melvorD:Mysterious_Stone', 'melvorD:Charge_Stone_of_Rhaelyx'].includes(consumable.id)) {
				qty = Math.max(qty - getSetting('allbutx'), 0);
			}
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
		addMysteriousStone() {
			if (game.currentGamemode.disablePreservation)
				return;

			this.data.skills.forEach(skill => {
				if (noPreservation.includes(skill.id))
					return;

				let itemIDs = ['melvorD:Mysterious_Stone', 'melvorD:Charge_Stone_of_Rhaelyx'];
				itemIDs.forEach(itemID => {
					let item = game.items.getObjectByID(itemID),
						icon = this.createIcon(item, undefined, this.data.skillRealms.get(skill.id), skill, 1, 'Consumable'),
						upgrade = game.bank.itemUpgrades.get(item);

					icon.onclick = () => {
						if (filterMode)
							this.filterIcon(icon);
						else if (debugEnabled)
							console.dir(icon);
						else if (game.bank.getQty(item) > 0)
							game.bank.fireItemUpgradeModal(upgrade[0], item);
					};
				});
			});
		}
		filterPOIs() {
			game.cartography.worldMaps.forEach(map => {
				map.pointsOfInterest.filter(x => x.activeStats.hasStats && filterSetting(x)).forEach(poi => {
					this.data.skills.forEach(skill => {
						let { realms, modifiers } = this.hasModifiers(false, skill, this.getItemMods(poi.activeStats));
						if (realms.length > 0)
							this.createIcon(poi, modifiers, realms, skill, 0, 'POI');
					});
				});
			});
		}
		poiOnClick(poi, icon) {
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
			let sortedObstacles = [...game.agility.sortedMasteryActions].sort((a, b) => (a.abyssalLevel - b.abyssalLevel)),
				showFillerObstacles = getSetting('showFillerObstacles');

			sortedObstacles.push(...game.agility.pillars.allObjects);
			sortedObstacles = sortedObstacles.filter(x => filterSetting(x));

			this.data.skills.forEach(skill => {
				let tierMap = new Map(),
					previousObstacle;

				sortedObstacles.forEach(obstacle => {
					let obstacleMods = this.getItemMods(obstacle),
						isPositive = this.hasModifiers(false, skill, obstacleMods),
						realms = isPositive.realms.length > 0 ? isPositive : this.hasModifiers(true, skill, obstacleMods, obstacle);

					if (showFillerObstacles) {
						if (previousObstacle && previousObstacle.category !== obstacle.category && previousObstacle instanceof AgilityObstacle) {
							let fillerRealms = [];
							tierMap.forEach((tiers, realm) => {
								if (!tiers.includes(previousObstacle.category) && this.data.skillRealms.get(skill.id).includes(realm))
									fillerRealms.push(realm);
							});
							if (fillerRealms.length > 0)
								this.addFillerObstacle(previousObstacle, skill, fillerRealms);
						}
						if (obstacle.category === 0 && (!previousObstacle || previousObstacle.realm !== obstacle.realm))
							this.data.realmIDs.forEach(realm => tierMap.set(realm, []));
					}

					if (realms.realms.length > 0) {
						this.createIcon(obstacle, realms.modifiers, realms.realms, skill, isPositive.realms.length > 0 ? 2 : 3, 'Obstacle');
						if (showFillerObstacles && isPositive.realms.length > 0)
							isPositive.realms.forEach(realm => this.addValueToMap(tierMap, realm, obstacle.category));
					}
					previousObstacle = obstacle;
				});
			});
		}
		addFillerObstacle(obstacle, skill, realms) {
			if (realms.length >= this.data.realmIDs.length)
				realms.push(defaultRealm.id);
			let fillerObstacle = fillerObstacles.get(obstacle.realm.id, obstacle.category);
			let fillerIcon = new SkillBoostsIcon('FillerObstacle', fillerObstacle, fillerObstacle.media);
			fillerIcon.setBg(defaultBg);
			fillerIcon.elem = 2;
			fillerIcon.skill = skill.id;
			fillerIcon.realms = realms;
			fillerIcon.item.category = obstacle.category;
			fillerIcon.item.realm = obstacle.realm;
			fillerIcon.item.slot = {};

			fillerIcon.onclick = () => {
				if (filterMode)
					this.filterIcon(fillerIcon);
				else if (debugEnabled)
					console.dir(fillerIcon);
				else {
					let buildMenu = getSetting('obstacleMenu');
					if (buildMenu === 'always' || buildMenu === 'lClick')
						this.obstacleOnClick(obstacle, fillerIcon);
				}
			}

			if (this.saveData.has(skill.id) && this.saveData.get(skill.id).includes(fillerObstacle.id))
				this.toggleFilterState(fillerIcon, undefined, false);
			else
				fillerIcon.isFiltered = false;

			this.addValueToMap(this.data.icons, skill.id, fillerIcon);
			this.data.menus.get(skill.id).iconContainers[2].appendChild(fillerIcon);
		}
		obstacleOnClick(obstacle, icon, tinyMenu = false) {
			if (filterMode && !tinyMenu)
				this.filterIcon(icon);
			else if (debugEnabled && !tinyMenu)
				console.dir(icon);
			else {
				let buildMenu = getSetting('obstacleMenu');
				let skipBuildMenu = (buildMenu === 'never' || (buildMenu === 'lClick' && tinyMenu) || (buildMenu === 'rClick' && !tinyMenu));
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
			inlineContainer.innerHTML = `<img src=${media} class='sb-icon-xs mr-1'/><span class="sb-font-sm font-w400 ${textClass}">${text}</span>`;
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
			return obstacle instanceof AgilityPillar ? 'Pillar' : 'Obstacle';
		}
		getObstacleCost(obstacle, agiSetting = false) {
			this.agiCosts = agiSetting;
			let costs = this.getObstacleType(obstacle) === 'Obstacle' ? game.agility.getObstacleBuildCosts(obstacle) : game.agility.getPillarBuildCosts(obstacle);
			return costs;
		}
		hasObstacleRequirements(obstacle) {
			return (game.agility.isSlotUnlocked(obstacle.slot) && (!obstacle.skillRequirements || game.checkRequirements(obstacle.skillRequirements)) && this.canAccessAbyssalRealm(obstacle));
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
				return hideElement(icon.inactiveIcon);
			game.agility.courses.get(obstacle.realm).activeObstacleCount < requirement ? showElement(icon.inactiveIcon) : hideElement(icon.inactiveIcon);

		}
		filterPets() {
			game.pets.filter(x => !filteredPets.includes(x) && !game.petManager.unlocked.has(x) && !x.ignoreCompletion && filterSetting(x)).forEach(pet => {
				this.data.skills.forEach(skill => {
					let { realms, modifiers } = this.hasModifiers(false, skill, this.getItemMods(pet.stats));
					if (realms.length > 0)
						this.createIcon(pet, modifiers, realms, skill, 4, 'Pet');
				});
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
			if (filterMode)
				this.filterIcon(icon);
			else if (debugEnabled)
				console.dir(icon);
		}
		filterPurchases() {
			let purchases = game.shop.purchases.filter(x => x.category.id !== 'melvorD:GolbinRaid' && !game.shop.upgradesPurchased.has(x) && filterSetting(x) && (x.contains.stats || x.contains.pet));
			purchases.sort((a, b) => (a.contains.pet ? 1 : 0) - (b.contains.pet ? 1 : 0));

			this.data.skills.forEach(skill => {
				purchases.forEach(purchase => {
					let statObject = purchase.contains.pet || purchase.contains;
					let { realms, modifiers } = this.hasModifiers(false, skill, this.getItemMods(statObject.stats));
					if (realms.length > 0) {
						this.createIcon(purchase, modifiers, realms, skill, 4, 'Purchase');
						if (statObject instanceof Pet)
							filteredPets.push(purchase.contains.pet);
					}
				});
			});
		}
		purchaseOnClick(purchase, icon) {
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
			game.astrology.actions.filter(x => !game.astrology.isConstellationComplete(x) && filterSetting(x)).forEach(constellation => {
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
			if (filterMode)
				this.filterIcon(icon);
			else if (debugEnabled)
				console.dir(icon);
			else {
				SwalLocale.fire({ html: this.createConstellationPanel(constellation), width: (windowWidth >= 600 ? '575px' : '') });
				this.updateDustQty();
			}
		}
		updateDustQty() {
			dustItems.forEach(icon => icon.setText(game.bank.getQty(icon.item)));
		}
		isModifierUnlocked(constellation, requirements) {
			return game.astrology.isBasicSkillRecipeUnlocked(constellation) && isRequirementMet(requirements) && this.canAccessAbyssalRealm(constellation);
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

					if (getSetting('astroSpoilers') || this.isModifierUnlocked(constellation, requirements))
						setModifiers(id, mod, multi, type);
					else
						lockModifiers(id, requirements, mod, type);

					if (!this.isModifierUnlocked(constellation, requirements) && getSetting('astroSpoilers')) {
						elem.upgradeButton.disabled = true;
						let unlockNodes = printUnlockAllRequirements(requirements);
						unlockNodes.forEach(node => panel[menu][id].modifierText.append(node));
						if (hasItA && constellation.abyssalLevel >= 1 && !abyssalRealm.isUnlocked)
							panel[menu][id].modifierText.append(this.getItACompletionNode(false));
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
			content.className = `block sb-swal`;
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
			if (game.astrology.isBasicSkillRecipeUnlocked(constellation) && this.canAccessAbyssalRealm(constellation))
				icon.setBg(defaultBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Constellation');
		}
		filterSynergies() {
			game.summoning.synergies.forEach(synergy => {
				this.data.skills.forEach(skill => {
					if (skill === game.attack)
						return;
					let { realms, modifiers } = this.hasModifiers(false, skill, this.getItemMods(synergy), synergy);
					if (realms.length > 0)
						this.createIcon(synergy, modifiers, realms, skill, 1, 'Synergy');
				});
			});
		}
		synergyOnClick(synergy, icon) {
			if (filterMode)
				this.filterIcon(icon);
			else if (debugEnabled)
				console.dir(icon);
			else {
				let { equippedQty0, equippedQty1, bankQty0, bankQty1 } = this.getSynergyQty(synergy);
				if (equippedQty0 + bankQty0 > 0 && equippedQty1 + bankQty1 > 0) {
					let slots = [getSlot('melvorD:Summon1'), getSlot('melvorD:Summon2')];
					slots.forEach((slot, i) => {
						let item = synergy.summons[i].product;
						if (player.equipment.itemSlotMap.has(item))
							player.unequipItem(player.selectedEquipmentSet, player.equipment.getSlotOfItem(item));
					});
					slots.forEach((slot, i) => player.equipItem(synergy.summons[i].product, player.selectedEquipmentSet, slot, (i === 0 ? equippedQty0 + bankQty0 : equippedQty1 + bankQty1)));
					this.renderSynergyBg();
					this.renderSynergyQty();
				}
			}
		}
		updateSynergyBg(synergy) {
			let { equippedQty0, equippedQty1, bankQty0, bankQty1, otherSetQty0, otherSetQty1 } = this.getSynergyQty(synergy);

			let icon = this.getItemIcon(synergy);
			if (icon === undefined)
				return;
			let shouldHide = false;
			if (player.equippedSummoningSynergy === synergy)
				icon.setBg(greenBg);
			else if (equippedQty0 + bankQty0 > 0 && equippedQty1 + bankQty1 > 0)
				icon.setBg(defaultBg);
			else if (otherSetQty0 > 0 && otherSetQty1 > 0)
				icon.setBg(yellowBg);
			else {
				shouldHide = true;
				icon.setBg(redBg);
			}
			this.hideUndiscoveredIcons(icon, shouldHide, 'Synergy');
		}
		updateSynergyQty(synergy) {
			let { equippedQty0, equippedQty1, bankQty0, bankQty1, otherSetQty0, otherSetQty1 } = this.getSynergyQty(synergy);

			let icon = this.getItemIcon(synergy, true);
			if (icon === undefined)
				return;
			icon.setPillbox('bg-secondary');

			if (player.equippedSummoningSynergy === synergy) {
				icon.setText(equippedQty0, equippedQty1);
				if (bankQty0 > 0 || bankQty1 > 0)
					icon.setPillbox('bg-warning');
			} else if (equippedQty0 + bankQty0 > 0 && equippedQty1 + bankQty1 > 0) {
				icon.setText(equippedQty0 + bankQty0, equippedQty1 + bankQty1);
			} else if (otherSetQty0 > 0 && otherSetQty1 > 0)
				icon.setText(otherSetQty0, otherSetQty1);
			else
				icon.setText(0, 0);
		}
		updateSynergyLocked(synergy) {
			let isUnlocked = game.summoning.isSynergyUnlocked(synergy);
			let icon = this.getItemIcon(synergy, true);
			if (icon === undefined)
				return;
			if (icon.synergyLocked !== undefined)
				isUnlocked ? hideElement(icon.synergyLocked) : showElement(icon.synergyLocked);

		}
		getSynergyQty(synergy) {
			let quantities = {};

			synergy.summons.forEach((summon, i) => {
				quantities[`bankQty${i}`] = Math.max(game.bank.getQty(summon.product) - getSetting('allbutx'), 0);
				quantities[`equippedQty${i}`] = 0;
				quantities[`otherSetQty${i}`] = 0;

				player.equipmentSets.forEach(({ equipment }) => {
					if (equipment === player.equipment)
						quantities[`equippedQty${i}`] += equipment.getQuantityOfItem(summon.product);
					else
						quantities[`otherSetQty${i}`] += equipment.getQuantityOfItem(summon.product);
				});
			});

			return quantities;
		}
		getSynergyID(synergy) {
			return `${synergy.summons[0].id}+${synergy.summons[1].id}`;
		}
		filterRelics() {
			game.ancientRelics.forEach(relic => {
				let relicRealms = [],
					hasRelic;

				relic.skill.ancientRelicSets.forEach((relicSet, realm) => {
					if (relicSet.foundRelics.has(relic) || relicSet.foundRelics.size === relicSet.relicDrops.length)
						hasRelic = true;
					else if (relicSet.relicDrops.some(x => x.relic === relic) || relicSet.completedRelic === relic)
						relicRealms.push(realm.id);
				});

				if (hasRelic)
					return;

				this.data.skills.forEach(skill => {
					let { realms, modifiers } = this.hasModifiers(false, skill, this.getItemMods(relic.stats));
					if (realms.length > 0)
						this.createIcon(relic, modifiers, relicRealms, skill, 4, 'Relic');
				});
			});
		}
		updateRelicBg(relic) {
			let icon = this.getItemIcon(relic);
			if (icon === undefined)
				return;
			icon.setBg(redBg);
			this.hideUndiscoveredIcons(icon, true, 'Relic');
		}
		relicOnClick(icon) {
			if (filterMode)
				this.filterIcon(icon);
			else if (debugEnabled)
				console.dir(icon);
		}
		resizeMenu(menu = this.menu, forceMobile = false) {
			if (!menu)
				return;

			if (windowWidth === undefined)
				windowWidth = window.innerWidth;
			if (forceMobile || windowWidth < (menu.skill === game.attack.id ? 1150 : 768))
				return this.setMobileClass(menu);

			let shownIcons = menu.shownIcons,
				isCombat = this.skillPage === game.attack.id,
				isMedium = windowWidth >= (menu.skill === game.attack.id ? 1350 : 1150),
				lay4th = (!isMedium && !game.agility.hasMasterRelic(melvorRealm)),
				sidebar = (windowWidth >= 992 ? game.settings.enableMiniSidebar ? 60 : 240 : 28),
				padding = (isCombat ? 60 : 0),
				margins = shownIcons.filter(x => x > 0).length * 16 - (lay4th && shownIcons[4] > 0 ? 32 : 16),
				scrollbar = (isMobile() ? 0 : 17),
				maxWidth = (isCombat ? 1860 : 1920) - margins,
				menuWidth = windowWidth >= 2177 ? maxWidth : Math.min(windowWidth - sidebar - padding - margins - scrollbar - 12, maxWidth),
				totalIcons = lay4th ? menu.totalIcons - shownIcons[4] : menu.totalIcons,
				iconPX = 48;

			// Start with px values that are ~75% of the maximum menu width
			let maxPX = shownIcons.map((icons, i) => Math.max(Math.round(menuWidth * icons / totalIcons / (i === 1 ? 120 : 72)) * (i === 1 ? 96 : iconPX), (icons > 0 ? 96 : 0)));
			if (lay4th) maxPX.pop();
			// Increase the width of the tallest elements to decrease the height of the menu
			while (arrSum(maxPX) + iconPX <= menuWidth) {
				let elemIconHeights = maxPX.map((x, i) => Math.ceil(iconPX * shownIcons[i] / x) || 0);
				let tallestElem = elemIconHeights.indexOf(Math.max(...elemIconHeights));
				maxPX[tallestElem] += iconPX;
				if (arrSum(maxPX) + iconPX <= menuWidth && tallestElem === 1 && maxPX[tallestElem] / iconPX % 96 !== 0)
					maxPX[tallestElem] += iconPX;
			}
			// Set the px count
			let firstParent, lastParent;
			menu.iconParents.forEach((parent, i) => {
				if (shownIcons[i] === 0) {
					if (game.agility.hasMasterRelic(melvorRealm) && i === 3)
						menu.iconParents[4].classList.remove('sb-other');
					return hideElement(parent);
				}
				showElement(parent);
				if (lay4th && i === 4) return;
				parent.style.flex = `0 0 ${maxPX[i]}px`;
				if (!firstParent) firstParent = parent;
				parent.classList.remove('mr-0', 'ml-0');
				lastParent = parent;
			});
			if (firstParent) firstParent.classList.add('ml-0');
			if (lastParent) lastParent.classList.add('mr-0');
			if (this.skillPage === 'melvorAoD:Cartography')
				this.updateCartographyMap();
		}
		setMobileClass(menu) {
			let modified, lastParent;
			menu.iconParents.forEach((parent, i) => {
				let icons = menu.shownIcons[i];
				if (icons === 0)
					return hideElement(parent);

				showElement(parent);
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
			let container = createElement('div');
			let name = container.appendChild(createElement('div', { className: 'font-w600 text-center border-bottom' }));
			let iconContainer = container.appendChild(createElement('div', { className: 'd-flex row no-gutters justify-content-center' }));

			if (item instanceof PointOfInterest) {
				name.textContent = getLang('SELECT_POI');
				this.createPOISelection(iconContainer);
			} else if (item instanceof EquipmentItem) {
				name.textContent = getLang('SELECT_SLOT');
				this.createSlotSelection(iconContainer, element, item);
			} else {
				name.textContent = getLang('SELECT_OBSTACLE');
				this.createAgilitySelection(iconContainer, item);
			}
			return container;
		}
		createPOISelection(container) {
			this.slotSelectionIcons = [];
			let pois = [...new Set(this.getAllIcons().filter(x => x.category === 'POI').map(x => x.item))];
			pois.forEach(poi => {
				let icon = new SkillBoostsIcon('POI', poi, poi.media, undefined, 32),
					travelCost = this.getTravelCosts(poi);

				icon.setText(travelCost._currencies.get(game.gp) || 0, 1);
				icon.onclick = () => this.poiOnClick(poi, icon);
				MainTooltipController.init(icon.container);

				if (poi.hex.isPlayerHere)
					icon.setBg(greenBg);
				else if (!poi.hex.isMastered)
					icon.setBg(redBg);
				else if (!travelCost.checkIfOwned())
					icon.setBg(yellowBg);
				else
					icon.setBg(defaultBg);

				container.append(icon);
			});
		}
		getSlotInfo(slot, icon) {
			let existingItem = player.equipment.getItemInSlot(slot.id);
			let isEmpty = existingItem === game.emptyEquipmentItem;
			let media = isEmpty ? slot.emptyMedia : existingItem.media;
			return { existingItem, isEmpty, media };
		}
		createSlotSelection(container, element, item) {
			this.slotSelectionIcons = [];
			item.validSlots.forEach(slot => {
				let { isEmpty, media } = this.getSlotInfo(slot);
				let icon = new SkillBoostsIcon('', (isEmpty ? slot : item), media, isEmpty, 32);
				if (isEmpty) icon.setTooltip(slot.emptyName);
				icon.onclick = () => { this.equipmentOnClick(element, item, slot, true), this.updateSlotSelection(); };
				this.slotSelectionIcons.push({ slot, icon });
				container.append(icon);
			});
			this.updateSlotSelection();
		}
		updateSlotSelection() {
			this.slotSelectionIcons.forEach(({ slot, icon }) => {
				let { existingItem, isEmpty, media } = this.getSlotInfo(slot);
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
			});
		}
		createAgilitySelection(container, obstacle) {
			let obstacles = this.getObstacleType(obstacle) === 'Obstacle' ? game.agility.sortedMasteryActions : game.agility.pillars.allObjects;
			let sortedObstacles = obstacles.filter(x => x.category === obstacle.category && x.realm === obstacle.realm && obstacle.slot.obstacleCount === x.slot.obstacleCount);
			sortedObstacles.forEach(obst => {
				let icon = new SkillBoostsIcon('', obst, obst.media, false, 32);
				MainTooltipController.init(icon.container);
				icon.onclick = () => this.obstacleOnClick(obst, icon, true);
				container.append(icon);
				this.updateObstacleBg(obst, icon, false);
			});
		}
		addModifiersToMap(realm, skillID, val) {
			let map = this.data.modifiers;
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
		removeIcon(item, elem) {
			this.data.icons.forEach((iconArr, skill) => {
				iconArr.forEach(icon => {
					if (icon.item === item && (!elem || icon.elem === elem)) {
						this.data.icons.get(skill).splice(this.data.icons.get(skill).indexOf(icon), 1);
						icon.destroy();
					}
				});
			});
			this.resizeMenu();
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
			image.classList.replace('skill-icon-xs', 'sb-icon-xs');
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
				reqContainer.append(this.createUnlockElement(menu, requirement.getNodes('sb-icon-xs m-1'), game.checkRequirement(requirement)));
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
		getConstellationModifierSpans(constellation, container, spoilers = getSetting('astroSpoilers')) {
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
			let node = createElement('h5', { className: `${obj.isInfo ? 'text-info' : obj.isWarning ? 'text-warning font-w600' : getStandardDescTextClass(obj, false)} sb-font-2sm m-1 font-w400` });
			if (obj.text.indexOf('text-warning') > 0)
				obj.text = obj.text.slice(0, obj.text.search('text-warning') - 13);
			node.innerHTML = applyDescriptionModifications(obj.text);
			node.order = obj.order ? obj.order : obj.isInfo ? 1 : obj.isNegative ? 3 : obj.isDisabled ? 4 : 2;
			return node;
		}
		getModifierNodes(statObject, negMult, posMult, includeZero = false, isConditional, isItemSynergy) {
			let descriptions = [],
				returnOriginal = false,
				itemModifiers = statObject.modifiers || [],
				playerModifiers = statObject.playerModifiers || [],
				modifiers = [...itemModifiers, ...playerModifiers];

			if (modifiers.length > 0) {
				modifiers.forEach(modValue => {
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
			if (statObject.enemyModifiers !== undefined) {
				statObject.enemyModifiers.forEach(modValue => {
					if (StatObject.showDescription(!modValue.isNegative, negMult, posMult, includeZero)) {
						let description = modValue.printEnemy(posMult, negMult, 2, true);
						if (description !== undefined)
							descriptions.push(description);
					}
				});
			}
			if (statObject.conditionalModifiers !== undefined && !isConditional) {
				statObject.conditionalModifiers.forEach(conditional => {
					let conditionalDescriptions = this.getModifierNodes(conditional, negMult, posMult, false, true),
						desc = conditional.getDescription(negMult, posMult);

					if (desc && ((conditional.modifiers && conditional.modifiers.length || 0) + (conditional.combatEffects && conditional.combatEffects.length || 0) + (conditional.enemyModifiers && conditional.enemyModifiers.length || 0)) === conditionalDescriptions.length) {
						desc.text = desc.text.slice(0, desc.text.search(':') + 1);
						desc.isWarning = true;
						desc.order = 5;
						conditionalDescriptions.forEach(d => d.order = d.isNegative ? 7 : d.isDisabled ? 8 : 6);
						descriptions.push(desc);
						descriptions.push(...conditionalDescriptions);
					} else if (desc)
						descriptions.push(desc);
					else if (isItemSynergy)
						descriptions.push(...conditionalDescriptions);
					else
						returnOriginal = true;
				});
			}
			if (isConditional)
				return descriptions;

			if (descriptions.length <= 0) {
				if (statObject.description === undefined)
					return [];
				return [this.createModifierNode({ text: statObject.description, isInfo: true })];
			}
			return descriptions.map(this.createModifierNode).sort((a, b) => (a.order - b.order));
		}
		createDividerElem(parent, textClass = '') {
			return createElement('div', { className: `border-top border-dark border-2x${textClass}`, parent: parent });
		}
		createSummonDamageTooltip(container, item) {
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
		}
		createModifierTooltip(container, item, statObject, posMult = 1, negMult = 1) {
			let modifierContainer = createElement('div', { className: 'text-success', parent: container }),
				modifierNodes = this.getModifierNodes(statObject, negMult, posMult, false),
				blacklistedItems = ['max_skillcape', 'cape_of_completion', 'mastery_magnet', 'jesters_hat', 'rhaelyx', 'blood_ring', 'elemental_potion', 'enhanced_production_scroll', 'enhanced_gathering_scroll', 'abyssal_xp_scroll', 'cloudburst'];

			if (blacklistedItems.some(x => item.id && item.id.toLowerCase().includes(x)) || item.consumesChargesOn || (modifierNodes.length <= 0 || modifierNodes[0].textContent.search('text-warning') > 0)) {
				modifierContainer.classList.replace('text-success', 'text-info');
				if (item.modifiedDescription.search('text-warning') > 0)
					modifierContainer.innerHTML = item.modifiedDescription.slice(0, item.modifiedDescription.search('text-warning') - 13);
				else
					modifierContainer.innerHTML = item.modifiedDescription;
			} else
				modifierContainer.append(...modifierNodes);

			return modifierContainer;
		}
		createTooltip(item, icon) {
			let content = new DocumentFragment(),
				parent = content.appendChild(createElement('div', { className: 'text-center sb-font-2sm' }));

			parent.appendChild(createElement('div', { className: 'font-w600 font-size-sm', text: item.name }));
			let container = this.createDividerElem(parent);

			if (item instanceof EquipmentItem)
				this.createEquipmentTooltip(container, item);
			else if (icon.category !== 'FillerObstacle' && (item instanceof AgilityObstacle || item instanceof AgilityPillar))
				this.createObstacleTooltip(container, item);
			else if (item instanceof SummoningSynergy)
				this.createSynergyTooltip(container, item);
			else if (item instanceof PotionItem)
				this.createPotionTooltip(container, item);
			else if (hasAoD && item instanceof PointOfInterest)
				this.createPOITooltip(container, item);
			else if (item instanceof Pet)
				this.createPetTooltip(container, item);
			else if (item instanceof ShopPurchase)
				this.createPurchaseTooltip(container, item);
			else if (item instanceof AstrologyRecipe)
				this.createConstellationTooltip(container, item);
			else if (item instanceof AncientRelic)
				this.createRelicsTooltip(container, item, icon);
			else if (icon.category === 'FillerObstacle')
				createElement('div', { className: 'text-info', parent: container, text: getLang('FILLER_OBSTACLE_DESC') });

			return content;
		}
		createEquipmentTooltip(container, item) {
			let itemDescription = item._customDescription || item.description;
			let slotContainer = container.appendChild(createElement('div', { className: 'row no-gutters justify-content-center' }));

			item.validSlots.forEach(slot => {
				slotContainer.append(createElement('small', { className: 'font-w600 font-size-sm m-1', children: [createElement('small', { className: 'sb-badge bg-primary', text: slot.emptyName })] }));
			});

			if (item.fitsInSlot("melvorD:Summon1"))
				this.createSummonDamageTooltip(container, item);

			let modifierContainer = this.createModifierTooltip(container, item, item);

			if (game.itemSynergies.has(item) && itemDescription.indexOf('text-warning') > 0) {
				let descriptions = [],
					synergyDesc = itemDescription.slice(itemDescription.search('text-warning') + 14, itemDescription.length);

				descriptions.push(createElement('h5', { className: 'text-warning m-1 sb-font-2sm', text: synergyDesc }));
				game.itemSynergies.get(item).forEach(synergy => {
					this.getModifierNodes(synergy, 1, 1, false, false, true).forEach(node => {
						if (node && node.textContent !== '')
							descriptions.push(node);
					});
				});

				if (descriptions.length > 1) {
					synergyDesc = synergyDesc.slice(0, synergyDesc.indexOf(':') + 1);
					descriptions[0].textContent = synergyDesc;
					descriptions.forEach(node => modifierContainer.append(node));
				} else
					modifierContainer.append(descriptions[0]);
			}

			let miscContainer = this.createDividerElem(container, ' sb-font-sm');

			if (item.validSlots.includes(getSlot('melvorD:Passive')))
				miscContainer.append(createElement('span', { className: 'text-info', text: getLangString('MENU_TEXT_PASSIVE_SLOT_COMPATIBLE') }));
		}
		createSynergyTooltip(container, item) {
			this.createSummonDamageTooltip(container, item);
			this.createModifierTooltip(container, item, item);
		}
		createPotionTooltip(container, item) {
			container.append(createElement('div', { className: 'text-warning font-size-2sm', text: templateString(getLangString('MENU_TEXT_POTION_CHARGES'), { charges: item.charges }) }));
			this.createModifierTooltip(container, item, item.stats);
		}
		createPetTooltip(container, item) {
			let acquiredBy = item.acquiredBy;

			if (acquiredBy)
				container.append(createElement('span', { className: 'text-info font-w600', text: acquiredBy }));

			this.createModifierTooltip(container, item, item.stats);
			let miscContainer = this.createDividerElem(container, ' sb-font-sm');

			let searchAreas = [...game.slayerAreas.allObjects, ...game.dungeons.allObjects, ...game.strongholds.allObjects, ...game.abyssDepths.allObjects],
				dungeon = searchAreas.find(x => x.pet && x.pet.pet === item),
				chanceElem = createElement('span', { className: 'text-info sb-font-2sm', text: getLang('CHANCE') }),
				skill = item.skill,
				progressPets = ['melvorD:GoldenGolbin', 'melvorF:Mark', 'melvorAoD:Hex', 'melvorAoD:MapMasteryPet'];

			if (progressPets.includes(item.id)) {
				let progress, goal;

				if (item.id === 'melvorD:GoldenGolbin') {
					let monster = game.monsters.getObjectByID('melvorD:Golbin');
					progress = game.stats.monsterKillCount(monster) + game.stats.GolbinRaid.get(RaidStats.GolbinsKilled);
					goal = monster.pet.kills;
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
					let modifiedInterval = skill.actionInterval * (1 + skill.getMasteryPoolProgress(game.defaultRealm) / 100),
						chanceForPet = (modifiedInterval / 1000 * skill.virtualLevel / 250000) * (1 + game.modifiers.skillPetLocationChance / 100);

					chanceElem.textContent += ` 1/${numberWithCommas(Math.floor(100 / chanceForPet))}`;
				}
			} else if (dungeon !== undefined) {
				if (dungeon.fixedPetClears || dungeon.pet.weight === 1) {
					chanceElem.textContent = `${getLangString('TUTORIAL_MISC_0')}: ${game.combat.getDungeonCompleteCount(dungeon)}/${dungeon.pet.weight}`;
				} else {
					chanceElem.textContent += ` 1/${formatNumber(dungeon.pet.weight)}`;
				}
				if (dungeon instanceof Stronghold)
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
		createPurchaseTooltip(container, item) {
			let acquiredBy = item.contains.pet && item.contains.pet.acquiredBy,
				statObject = item.contains.stats || (item.contains.pet && item.contains.pet.stats);

			if (acquiredBy)
				container.append(createElement('span', { className: 'text-info font-w600', text: acquiredBy }));

			let modifierContainer = this.createModifierTooltip(container, item, statObject);
			this.addCostsAndRequirements(item, modifierContainer);
		}
		createConstellationTooltip(container, item) {
			let modifierContainer = createElement('div', { className: 'text-success', parent: container });
			this.getConstellationModifierSpans(item, modifierContainer);
		}
		createObstacleTooltip(container, item) {
			let negMult = game.agility.getObstacleNegMult(item);
			this.createModifierTooltip(container, item, item, 1, negMult);
		}
		createPOITooltip(container, item) {
			let posMult = game.cartography.hasCarthuluPet ? 2 : 1;
			this.createModifierTooltip(container, item, item.activeStats, posMult);

			let miscContainer = this.createDividerElem(container, ' sb-font-sm'),
				costText = createElement('span', { text: getLangString('TRAVEL_COST_COL') }),
				currency = createElement('img', { className: 'skill-icon-xxs m-1', attributes: [['src', game.gp.media]] }),
				cost = createElement('span', { text: formatNumber(this.getTravelCosts(item)._currencies.get(game.gp)) });

			miscContainer.append(costText, currency, cost);
		}
		createRelicsTooltip(container, item, icon) {
			this.createModifierTooltip(container, item, item.stats);

			let miscContainer = this.createDividerElem(container, ' sb-font-sm'),
				chanceElem = createElement('span', { className: 'text-info sb-font-2sm', text: getLang('CHANCE') }),
				skill = item.skill,
				realm = game.realms.getObjectByID(icon.realms[0]),
				relicSet = skill.ancientRelicSets.get(realm);

			if (item === relicSet.completedRelic) {
				chanceElem.textContent = `${getLangString('TUTORIAL_MISC_0')}: ${relicSet.foundRelics.size}/${relicSet.relicDrops.length}`;
			} else {
				let chanceForRelic = skill.getRareDropChance(skill.level, relicSet.relicDrops.find(x => x.relic === item).chance);
				chanceForRelic *= 1 + game.modifiers.getValue("melvorD:ancientRelicLocationChance", realm.modQuery) / 100;
				chanceForRelic = 100 / (chanceForRelic * (relicSet.relicDrops.length - relicSet.foundRelics.size));
				chanceElem.textContent += ` 1/${numberWithCommas(Math.floor(chanceForRelic))}`;
			}
			if (chanceElem.textContent !== getLang('CHANCE'))
				miscContainer.append(chanceElem);
		}
		canAccessAbyssalRealm(object) {
			return (!hasItA || ((object.slot && object.slot.abyssalLevel > 1) || object.abyssalLevel > 1) || abyssalRealm.isUnlocked);
		}
		getItACompletionNode(inline) {
			let elemType = inline ? 'span' : 'div',
				container = createElement(elemType, { className: `text-danger${inline ? ' font-w400 m-2' : ''}` });

			container.append(...abyssalRealm.unlockRequirements[0].getNodes('skill-icon-xs'));
			return container;
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
					this.data.skills.forEach(skill => {
						let existingData = this.saveData.get(skill.id).filter(x => ['Skill_Boosts:No_Realm', 'melvorD:Melvor', 'melvorItA:Abyssal', 'Skill_Boosts:Menu_Opened', 'Skill_Boosts:Menu_Closed'].includes(x));
						this.saveData.delete(skill.id);
						this.saveData.set(skill.id, existingData);
					});
					this.getAllIcons().filter(x => x.isFiltered).forEach(icon => {
						icon.isFiltered = false;
						icon.show();
						if (icon.skill === this.selectedSkillID)
							this.menu.updateIcon(icon);
					});
					this.resizeMenu();
				};
			});
		}
		addNewSkill(data) {
			this.modData.skills.push(data.skill);
			let realms = data.realmIDs || this.data.realms.filter(x => x.isModded === false).map(x => x.id);
			realms.forEach(realm => this.addValueToMap(namespaceByRealm, realm, data.skill.namespace));
			this.data.skillRealms.set(data.skill.id, realms);
			this.modData.headers.set(data.skill.id, data.header);
			sortModdedSkill(data);
		}
		addNewModifiers(data) {
			if (data.modifiers === undefined)
				data.modifiers = new Map();
			if (data.skills === undefined)
				data.skills = this.data.skills;

			Array.from(data.skills);
			this.modData.modifiers.push(data);
		}
		addNewRealm(data) {
			this.modData.realms.push(data);
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
				val ? showElement(menu.presetsBtn) : hideElement(menu.presetsBtn);
			});
		}
		oldEncode() {
			return SBSaver.oldEncode();
		}
		reInitSB() {
			this.getAllIcons().forEach(icon => icon.destroy());
			this.data.menus.forEach(menu => {
				menu.container.querySelectorAll('#SB-Info').forEach(tooltip => tooltip?._tippy?.destroy());
				menu.remove();
			});
			this.data.skills = [];
			this.data.realms = [];
			this.data.realmIDs = [];
			this.data.icons.clear();
			this.data.agiSelectArr = [];
			let t0 = performance.now();
			this.initRealms();
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
				this.resizeMenu(this.menu);
			}
			let t1 = performance.now();
			console.log(`%c[Skill Boosts]: Loading took ${Math.floor(t1 - t0)}ms`, 'color: #ccaffc');
			if (debugEnabled)
				this.menu.toggleAllDebugBtns();
		}
	}

	let skillBoosts = new SkillBoosts();
	window.skillBoosts = skillBoosts;

	onCharacterSelectionLoaded(() => {
		// Documenation can be found at https://mod.io/g/melvoridle/m/skill-boosts //
		if (mod.manager.getLoadedModList().includes('Shamanism')) { // Replace with 'Skill Boosts' //
			// Add Shamanism Skill data //
			skillBoosts.addNewSkill({
				// Required //
				skill: game.shamanism,
				// Optional //
				realmIDs: ['melvorD:Melvor', 'shamanism:Spirit'], // 'melvorD:Melvor', 'melvorItA:Abyssal', undefined = All Non-Modded Realms //
				//header: HTMLElement, A header is only required if there is no `skill.header` property
				//noPreservation: Boolean,
				//noMastery: Boolean,
				//noSummon: Boolean,
				//noPotion: Boolean,
				//noDoubling: Boolean,
				//noInterval: Boolean,
				noConsumable: true,
				//noPrimaryResource: Boolean,
				//isArtisan: Boolean,
			});
			// Add Shamanism Modifier data //
			skillBoosts.addNewModifiers({
				// Suggested //
				skills: [game.shamanism], // Undefined = All Skills //
				modifiers: new Map([
					['melvorD:Melvor', ['shamanism:flatConvergenceInterval', 'shamanism:convergenceInterval', 'shamanism:skillMasteryXPPerAtonga']],
					['shamanism:Spirit', ['melvorD:skillXP', 'melvorD:nonCombatSkillXP', 'shamanism:flatConvergenceInterval', 'shamanism:convergenceInterval', 'shamanism:skillMasteryXPPerAtonga']]
				])
			});
			// Add Spirit Realm from Shamanism //
			skillBoosts.addNewRealm(game.realms.getObjectByID('shamanism:Spirit'));
		}
		if (mod.manager.getLoadedModList().includes('[Myth] Music')) {
			skillBoosts.addNewSkill({
				skill: game.music,
				realmIDs: ['melvorD:Melvor'],
				noDoubling: true,
			});
			skillBoosts.addNewModifiers({
				skills: [game.music],
				modifiers: new Map([
					['melvorD:Melvor', ['melvorD:flatCurrencyGain', 'melvorD:currencyGain', 'mythMusic:musicGP', 'mythMusic:musicHireCost', 'mythMusic:bandPractice', 'mythMusic:masterAncientRelic', 'mythMusic:chanceToObtainShrimpWhileTrainingMusic', 'mythMusic:sheetMusicDropRate', 'mythMusic:musicAdditionalRewardRoll', 'mythMusic:skillMasteryXPPerVariel']]
				])
			});
		}

		skillBoosts.initRealms();

		generalSettings.add([{
			type: 'dropdown',
			name: 'state',
			label: getLang('SETTING_MENU_STATE'),
			options: [{ value: 0, display: getLang('SETTING_MENU_STATE_1') }, { value: 1, display: getLang('SETTING_MENU_STATE_2') }, { value: 2, display: getLang('SETTING_MENU_STATE_3') }],
			default: 0
		}]);
		if (skillBoosts.data.realms.length >= 3) {
			generalSettings.add([{
				type: 'dropdown',
				name: 'realmState',
				label: getLang('SETTING_REALM_STATE'),
				options: [{ value: 'Auto', display: getLang('SETTING_REALM_STATE_1') }, { value: defaultRealm.id, display: getLang('SETTING_REALM_STATE_2') }, { value: melvorRealm.id, display: getLang('SETTING_REALM_STATE_3') }, { value: abyssalRealm.id, display: getLang('SETTING_REALM_STATE_4') }],
				default: 'Auto'
			}, {
				type: 'custom',
				name: 'realmStates',
				label: 'I guess I have to migrate this setting if I want to change an existing value without resetting the value for everyone :)',
				options: [{ value: 'Auto', display: '' }, { value: defaultRealm.id, display: '' }, { value: melvorRealm.id, display: '' }, { value: abyssalRealm.id, display: '' }],
				default: 'Auto',
				render(name, onChange, config) { return createElement('div', { className: 'd-none' }); },
				get: function(root) { return root.value; },
				set: function(root, value) { root.value = value; }
			}, {
				type: 'switch',
				name: 'autoSwapRealms',
				label: getLang('SETTING_AUTO_REALM'),
				hint: getLang('SETTING_AUTO_REALM_HINT'),
				default: true
			}]);
		}
		generalSettings.add([{
			type: 'switch',
			name: 'showFillerObstacles',
			label: getLang('SETTING_SHOW_FILLER_OBSTACLE'),
			hint: `${getLang('SETTING_SHOW_FILLER_OBSTACLE_DESC')} ${getLang('REQUIRES_RESTART')}`,
			default: false
		}, {
			type: 'switch',
			name: 'astroSpoilers',
			label: getLang('SETTING_ASTRO_SPOILERS'),
			hint: getLang('SETTING_ASTRO_SPOILERS_HINT'),
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
			render(name, onChange, config) { return createElement('div', { className: 'd-none' }); },
			get: function(root) { return root.value; },
			set: function(root, value) { root.value = value; }
		}, {
			type: 'custom',
			name: 'hideRedBgs',
			label: getLang('SETTING_HIDE_REDBGS'),
			hint: getLang('SETTING_HIDE_REDBGS_HINT'),
			default: [],
			options: [{ value: 'Equipment', label: getLangString('COMBAT_MISC_18') }, { value: 'POI', label: getLangString('POINT_OF_INTEREST') }, { value: 'Consumable', label: getLangString('EQUIP_SLOT_Consumable') }, { value: 'Obstacle', label: getLangString('GAME_GUIDE_142') }, { value: 'Purchase', label: getLang('PURCHASES') }, { value: 'Pet', label: getLangString('PAGE_NAME_CompletionLog_SUBCATEGORY_4') }, { value: 'Constellation', label: getLang('CONSTELLATION') }, { value: 'Synergy', label: getLang('SYNERGIES') }, { value: 'Relic', label: getLang('RELICS') }],
			render(name, onChange, config) {
				let setting = new SBCompactCheckboxGroup();
				setting.init(config);
				return setting;
			},
			get: function(root) { return root.value; },
			set: function(root, value) {
				root.value = value;
				root.checkboxes.forEach(checkbox => checkbox.checked = value.includes(checkbox.value));
			}
		}, {
			type: 'text',
			name: 'filter',
			label: `${getLang('SETTING_FILTER')} ${getLang('REQUIRES_RESTART')}`,
			hint: `${getLang('SETTING_FILTER_HINT')} Ex: uncommon, rare`,
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
				let setting = new SBColorSetting(config);
				return setting;
			},
			get: function(root) { return root.value; },
			set: function(root, value) {
				root.value = value;
				root.container.children.forEach((child, i) => {
					child.children[0].value = value[i];
					child.children[1].value = value[i];
				});
			}
		}, {
			type: 'custom',
			name: 'agilityCost',
			label: getLang('SETTING_AGILITY_COST'),
			hint: getLang('SETTING_AGILITY_COST_HINT'),
			default: [],
			render(name, onChange, config) {
				let setting = new AgilityCostSetting(config);
				skillBoosts.agilitySetting = setting;
				return setting;
			},
			get: function(root) { return root.value || []; },
			set: function(root, value) { root.value = value || []; }
		}, {
			type: 'button',
			name: 'reset',
			display: getLang('SETTING_RESET_DATA'),
			color: 'danger',
			onClick: () => skillBoosts.resetFilteredIcons()
		}, {
			type: 'custom',
			name: 'massFiltering',
			label: '',
			default: false,
			render(name, onChange, config) { return createElement('div', { className: 'd-none' }); },
			get: function(root) { return root.value; },
			set: function(root, value) {
				root.value = value;
				skillBoosts.data.menus.forEach(menu => menu.massFilterToggle.checked = value);
			}
		}]);

		if (mod.manager.getLoadedModList().includes('Equipment Presets')) {
			let presetSettings = settings.section('Equipment Presets Compat');
			getPresetSetting = (setting) => presetSettings.get(setting);
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
				hint: getLang('SETTING_PRESET_NO_PRESET_HINT'),
				default: false
			}, {
				type: 'switch',
				name: 'onePreset',
				label: getLang('SETTING_PRESET_ONE_PRESET'),
				hint: getLang('SETTING_PRESET_ONE_PRESET_HINT'),
				default: false
			}, {
				type: 'dropdown',
				name: 'presetFilter',
				label: getLang('SETTING_PRESET_FILTER'),
				hint: createElement('span', {
					className: 'sb-pre-line',
					text: ` • ${getLang('SETTING_PRESET_FILTER_ALL')}: ${getLang('SETTING_PRESET_FILTER_ALL_HINT')}
							• ${getLang('SETTING_PRESET_FILTER_ALL_SKILL')}: ${getLang('SETTING_PRESET_FILTER_ALL_SKILL_HINT')}
							• ${getLang('SETTING_PRESET_FILTER_ONLY_SKILLS')}: ${getLang('SETTING_PRESET_FILTER_ONLY_SKILLS_HINT')}
							• ${getLang('SETTING_PRESET_FILTER_CURRENT_SKILL')}: ${getLang('SETTING_PRESET_FILTER_CURRENT_SKILL_HINT')}`
				}),
				default: 0,
				options: [{ value: 3, display: getLang('SETTING_PRESET_FILTER_ALL') }, { value: 0, display: getLang('SETTING_PRESET_FILTER_ALL_SKILL') }, { value: 1, display: getLang('SETTING_PRESET_FILTER_ONLY_SKILLS') }, { value: 2, display: getLang('SETTING_PRESET_FILTER_CURRENT_SKILL') }]
			}]);
		}
	});

	function addToImageLoader(icon) {
		if (icon instanceof SkillBoostsSynergy) {
			ImageLoader.register(icon.summon1Image, icon.item.summons[0].media);
			ImageLoader.register(icon.summon2Image, icon.item.summons[1].media);
		} else {
			let media = icon.category === 'Relic' ? icon.realms.includes('melvorItA:Abyssal') ? abyssalRelicImage : fullRelicImg : icon.item.media;
			ImageLoader.register(icon.image, media);
		}
	}

	onCharacterLoaded(() => {
		SBSaver.load();
	});

	onInterfaceReady(() => {
		const t0 = performance.now();
		try {
			checkAgilityCourses();
			skillBoosts.initSB();
			skillBoosts.data.menus.forEach(menu => {
				MainTooltipController.initAll(menu.container);
				AltTooltipController.initAll(menu.container);
			});
			skillBoosts.agilitySetting.init();
			addLevelChangeEmitters();
			combatAreaMenus.categoryMenu.children[0].classList.remove('push');
			document.addEventListener('click', () => AltTooltipController.hide());
			startRenderer();
		} catch (e) {
			console.error(`[Skill Boosts]: ${e}`);
		}

		window.addEventListener("resize", function() { skillBoosts.renderQueue.menu = true });

		if (game.openPage.skills !== undefined) {
			skillBoosts.onSkillChange(true);
			skillBoosts.getAllIcons(game.openPage.skills[0]).forEach(addToImageLoader);
		} else
			skillBoosts.getAllIcons().forEach(addToImageLoader);

		const t1 = performance.now();
		console.log(`%c[Skill Boosts]: Loading took ${Math.floor(t1 - t0)}ms`, 'color: #ccaffc');
		// Cleanup old data
		skillBoosts.data.skills.forEach(skill => characterStorage.removeItem(`${skill.localID}-btn`));
	});
}