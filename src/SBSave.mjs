const { characterStorage, patch } = mod.getContext('Skill_Boosts');

// Credits to Psycast (Equipment Presents) for the original crc32 system (SAVE_VERSION 1 & 2)
// https://mod.io/g/melvoridle/m/psy-equipment-presets
class SBSave {
	constructor() {
		this.oldDataMap = new Map([['0', 'Skill_Boosts:Menu_Closed'], ['1', 'Skill_Boosts:Menu_Opened'], ['Default Sorting', 'Skill_Boosts:No_Realm'], ['mf', 'Skill_Boosts:Mass_Filter']]);
		this.SAVE_VERSION = 3;
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
			...game.ancientRelics.allObjects
		];
		if (cloudManager.hasAoDEntitlementAndIsEnabled) {
			game.cartography.worldMaps.forEach(map => crcStrings.push(...map.pointsOfInterest.allObjects));
		}
		let mappedIDs = [...crcStrings.map(item => item.id), ...this.oldDataMap.keys(), 'agi'];
		game.summoning.synergies.forEach(({ summons }) => mappedIDs.push(`${summons[0].id}+${summons[1].id}`));
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
	}
	readMapping(crc) {
		if (crc === 0x0)
			return null;

		const item = this.crcMap.from.get(crc);
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
			if (compressedData)
				characterStorage.setItem('saveData', compressedData);
		} catch (e) {
			notifyPlayer(-1, `[Skill Boosts]: ${e}`, 'danger');
		}
	}
	decode(reader, saveString) {
		let unpack = (byte) => [...Array(8)].map((x, i) => byte >> i & 1).reverse(),
			data = skillBoosts.saveData,
			booleans = [],
			id = 0;

		try {
			if (reader === undefined)
				reader = new SaveWriter('Read', 1);
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
				this.crcTable = [];
				this.makeCRCTable();
				this.crcCreateMapID();

				let len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let item = this.readMapping(reader.getUint32());
					let lenItems = reader.getUint16();
					let skills = [];
					for (let i = 0; i < lenItems; i++) {
						let skill = this.readMapping(reader.getUint32());
						if (skill != null)
							skills.push(skill);
					}
					if (this.oldDataMap.has(item))
						item = this.oldDataMap.get(item);

					if (item === 'agi')
						mod.getContext('Skill_Boosts').settings.section('General').set('agilityCost', skills);
					else if (item != null)
						skills.forEach(skill => skillBoosts.addValueToMap(data, skill, item));
				}

				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = this.readMapping(reader.getUint32());
					let state = this.readMapping(reader.getUint32());
					if (this.oldDataMap.has(state))
						state = this.oldDataMap.get(state);
					if (skill != null && state != null && skill !== 'mf')
						skillBoosts.addValueToMap(data, skill, state);
				}

				if (version >= 2) {
					len = reader.getUint16();
					for (let i = 0; i < len; i++) {
						let skill = this.readMapping(reader.getUint32());
						let realm = this.readMapping(reader.getUint32());
						if (this.oldDataMap.has(realm))
							realm = this.oldDataMap.get(realm);
						if (skill != null && realm != null)
							skillBoosts.addValueToMap(data, skill, realm);
					}
				}
				delete this.crcTable;
				delete this.crcMap;
			} else {
				let len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					booleans.push(...unpack(reader.getUint8()));
				}

				len = reader.getUint16();
				for (let i = 0; i < len; i++) {
					let skill = reader.getNamespacedObjectId();
					let lenData = reader.getUint16();
					let items = [];
					for (let i = 0; i < lenData; i++) {
						let item;
						if (booleans[id]) {
							let fam1 = reader.getNamespacedObjectId();
							let fam2 = reader.getNamespacedObjectId();
							if (fam1 != undefined && fam2 != undefined)
								item = `${fam1}+${fam2}`;
						} else
							item = reader.getNamespacedObjectId();

						if (item != undefined)
							items.push(item);
						id++;
					}
					if (skill != undefined)
						data.set(skill, items);
				}
			}
			delete this.reader;
			delete this.oldDataMap;
		} catch (_a) {
			console.error("[Skill Boosts] Config Reader Error", _a);
		}
	}
	encode(writer) {
		let pack = (arr) => (arr.push(...new Array(8 - arr.length).fill(0)), arr).reduce((packed, bit) => bit |= packed << 1),
			chunkArray = (array, chunk_size) => Array(Math.ceil(array.length / chunk_size)).fill().map((_, index) => index * chunk_size).map(begin => array.slice(begin, begin + chunk_size)),
			data = skillBoosts.saveData,
			booleans = [],
			id = 0;

		if (data.size === 0)
			return;

		writer.writeString('PLMV');
		writer.writeUint16(this.SAVE_VERSION);

		data.forEach(valueArr => valueArr.forEach(val => booleans.push(val.includes('+') ? 1 : 0)));
		let chunks = chunkArray(booleans, 8);
		writer.writeUint16(chunks.length);
		chunks.forEach(chunk => writer.writeUint8(pack(chunk)));

		writer.writeUint16(data.size);
		data.forEach((valueArr, key) => {
			writer.writeNamespacedObject(key);
			writer.writeUint16(valueArr.length);
			valueArr.forEach(val => {
				if (booleans[id])
					val.split('+').forEach(v => writer.writeNamespacedObject(v));
				else
					writer.writeNamespacedObject(val);
				id++;
			});
		});

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	}
	oldEncode() {
		const writeUint32 = (value) => writer.writeUint32(this.crcMap.to.get(value) || 0);
		let writer = new SaveWriter('Write', 128),
			data = skillBoosts.saveData,
			oldData = { filteredItems: new Map() };

		this.oldDataMap = new Map([['0', 'Skill_Boosts:Menu_Closed'], ['1', 'Skill_Boosts:Menu_Opened'], ['Default Sorting', 'Skill_Boosts:No_Realm'], ['mf', 'Skill_Boosts:Mass_Filter']]);
		this.crcTable = [];
		this.makeCRCTable();
		this.crcCreateMapID();

		writer.writeString('PLMV');
		writer.writeUint16(2);

		data.forEach((values, key) => {
			values.forEach((value, i) => {
				if (![...this.oldDataMap.values()].includes(value))
					skillBoosts.addValueToMap(oldData.filteredItems, value, key);
			});
		});

		writer.writeUint16(oldData.filteredItems.size);
		oldData.filteredItems.forEach((skillArr, item) => {
			writeUint32(item);
			writer.writeUint16(skillArr.length);
			skillArr.forEach((skill) => {
				writeUint32(skill);
			});
		});

		writer.writeUint16(0);
		writer.writeUint16(0);

		delete this.oldDataMap;
		delete this.crcTable;
		delete this.crcMap;

		const rawSaveData = writer.getRawData();
		const compressedData = fflate.strFromU8(fflate.zlibSync(new Uint8Array(rawSaveData)), true);
		const saveString = btoa(compressedData);
		return saveString;
	}
}

// SBSave SAVE_VERSION 3+ //
export const SBSaver = new SBSave();

patch(Game, 'decode').after(function(_, reader, version) {
	let modReader = new ModWriter('Read', 1, reader);
	SBSaver.reader = modReader;
});
patch(Game, 'encode').before(function(writer) {
	let modWriter = new ModWriter('Write', 128, writer);
	SBSaver.save(modWriter);
});

class ModWriter extends SaveWriter {
	constructor(mode, dataExtensionLength, saveWriter) {
		super(mode, dataExtensionLength);
		this.modWriter = saveWriter;
	}
	writeNamespacedObject(objectID) {
		const [namespace, localID] = objectID.split(':');
		let nameMap = this.modWriter.namespaceMap.get(namespace);
		if (nameMap === undefined) {
			nameMap = new Map();
			this.modWriter.namespaceMap.set(namespace, nameMap);
		}
		let numericID = nameMap.get(localID);
		if (numericID === undefined) {
			numericID = this.modWriter.nextNumericID;
			this.modWriter.nextNumericID++;
			nameMap.set(localID, numericID);
		}
		this.writeUint16(numericID);
	}
	getNamespacedObjectId() {
		const numericID = this.getUint16();
		const id = this.modWriter.numericToStringIDMap.get(numericID);
		if (id === undefined)
			throw new Error(`[Skill Boosts]: No namespaced id exists for numeric ID: ${numericID}`);
		const [namespace, localID] = id.split(':');
		if (game.registeredNamespaces.getNamespace(namespace) !== undefined)
			return id;
	}
}