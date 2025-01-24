import { createCheckMessage, getTargets, rollCheck } from '../../helpers/checks.mjs';
import { RollableClassFeatureDataModel } from './classFeature/class-feature-data-model.mjs';
import { RollableOptionalFeatureDataModel } from './optionalFeature/optional-feature-data-model.mjs';
import { Flags } from '../../helpers/flags.mjs';
import { FU, SYSTEM } from '../../helpers/config.mjs';
import { SOCKET } from '../../socket.mjs';
import { SETTINGS } from '../../settings.js';
import { ChecksV2 } from '../../checks/checks-v2.mjs';
import { slugify } from '../../util.mjs';
import { FUHooks } from '../../hooks.mjs';

const capitalizeFirst = (string) => (typeof string === 'string' ? string.charAt(0).toUpperCase() + string.slice(1) : string);

/**
 * @typedef KeyboardModifiers
 * @property {boolean} shift
 * @property {boolean} alt
 * @property {boolean} ctrl
 * @property {boolean} meta
 */

/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class FUItem extends Item {
	overrides = this.overrides ?? {};

	/**
	 * Augment the basic Item data model with additional dynamic data.
	 * This method is automatically called when an item is created or updated.
	 */
	prepareData() {
		// As with the actors class, items are documents that can have their data
		// preparation methods overridden (such as prepareBaseData()).
		super.prepareData();
		Hooks.callAll(FUHooks.DATA_PREPARED_ITEM, this);
	}

	/**
	 * Prepare a data object which is passed to any Roll formulas that are created related to this Item.
	 * @private
	 * @returns {object|null} The roll data object, or null if no actors is associated with this item.
	 */
	getRollData() {
		// If present, return the actors's roll data.
		if (!this.actor) return null;
		const rollData = this.actor.getRollData();

		// Grab the item's system data as well.
		rollData.item = foundry.utils.deepClone(this.system);

		return rollData;
	}

	/**
	 * @override
	 */
	toObject() {
		const result = super.toObject();
		result.uuid = this.uuid;
		return result;
	}

	/**
	 * Get the display data for a weapon item.
	 *
	 * @returns {object|boolean} An object containing weapon display information, or false if this is not a weapon.
	 * @property {string} attackString - The weapon's attack description.
	 * @property {string} damageString - The weapon's damage description.
	 * @property {string} qualityString - The weapon's quality description.
	 */
	getWeaponDisplayData(actor) {
		const isWeapon = this.type === 'weapon';
		const isBasic = this.type === 'basic';
		// Check if this item is not a weapon or not a weapon/shield with dual
		if (!isBasic && !isWeapon) {
			return false;
		}

		function translate(string) {
			const allTranslations = Object.assign({}, CONFIG.FU.handedness, CONFIG.FU.weaponCategories, CONFIG.FU.weaponTypes, CONFIG.FU.attributeAbbreviations, CONFIG.FU.damageTypes);

			return game.i18n.localize(allTranslations?.[string] ?? string);
		}
		const hrZeroText = this.system.rollInfo?.useWeapon?.hrZero?.value ? `${game.i18n.localize('FU.HRZero')} +` : `${game.i18n.localize('FU.HighRollAbbr')} +`;
		const qualText = this.system.quality?.value || '';
		let qualityString = '';
		let detailString = '';

		const primaryAttribute = this.system.attributes?.primary?.value;
		const secondaryAttribute = this.system.attributes?.secondary?.value;

		const attackAttributes = [translate(primaryAttribute || '').toUpperCase(), translate(secondaryAttribute || '').toUpperCase()].join(' + ');

		const accuracyValue = this.system.accuracy?.value ?? 0;
		const accuracyGlobalValue = actor.system.bonuses.accuracy?.accuracyCheck ?? 0;
		const accuracyTotal = accuracyValue + accuracyGlobalValue;
		const damageValue = this.system.damage?.value ?? 0;
		const weaponType = this.system.type?.value;
		let damageGlobalValue = 0;
		if (weaponType === 'melee') {
			damageGlobalValue = actor.system.bonuses.damage?.melee ?? 0;
		} else if (weaponType === 'ranged') {
			damageGlobalValue = actor.system.bonuses.damage?.ranged ?? 0;
		}
		const damageTotal = damageValue + damageGlobalValue;

		const attackString = `【${attackAttributes}】${accuracyTotal > 0 ? ` +${accuracyTotal}` : ''}`;

		const damageTypeValue = translate(this.system.damageType?.value || '');

		const damageString = `【${hrZeroText} ${damageTotal}】 ${damageTypeValue}`;

		if (isWeapon) {
			detailString = [attackString, damageString].filter(Boolean).join('⬥');
			qualityString = [translate(this.system.category?.value), translate(this.system.hands?.value), translate(this.system.type?.value), qualText].filter(Boolean).join(' ⬥ ');
		} else if (isBasic) {
			detailString = [attackString, damageString].filter(Boolean).join('⬥');
			qualityString = [attackString, damageString, qualText].filter(Boolean).join(' ⬥ ');
		}

		return {
			attackString,
			damageString,
			detailString: `${detailString}`,
			qualityString: `${qualityString}`,
		};
	}

	/**
	 * Retrieves the display data for a spell item.
	 *
	 * @returns {object|boolean} An object containing spell display information, or false if this is not a spell.
	 * @property {string} attackString - The spell's attack description.
	 * @property {string} damageString - The spell's damage description.
	 * @property {string} detailString - The combined attack and damage descriptions.
	 * @property {string} qualityString - The spell's quality description.
	 */
	getSpellDisplayData() {
		if (this.type !== 'spell') {
			return false;
		}

		// Define constants and variables
		const hrZeroText = this.system.rollInfo?.useWeapon?.hrZero?.value ? `${game.i18n.localize('FU.HRZero')} +` : `${game.i18n.localize('FU.HighRollAbbr')} +`;

		const attackAttributes = [this.system.rollInfo?.attributes?.primary.value.toUpperCase(), this.system.rollInfo?.attributes?.secondary.value.toUpperCase()].join(' + ');

		const attackString = this.system.hasRoll.value ? `【${attackAttributes}${this.system.rollInfo.accuracy.value > 0 ? ` +${this.system.rollInfo.accuracy.value}` : ''}】` : '';

		const damageString = this.system.rollInfo.damage.hasDamage.value ? `【${hrZeroText} ${this.system.rollInfo.damage.value}】 ${this.system.rollInfo.damage.type.value}` : '';

		const qualText = this.system.quality?.value || '';
		const detailString = [attackString, damageString].filter(Boolean).join('⬥');
		const qualityString = [capitalizeFirst(this.system.cost.amount), capitalizeFirst(this.system.targeting.rule), capitalizeFirst(this.system.duration.value), qualText].filter(Boolean).join(' ⬥ ');

		return {
			attackString,
			damageString,
			detailString,
			qualityString,
		};
	}

	/**
	 * Get the display data for an item.
	 *
	 * @returns {object|boolean} An object containing item display information, or false if this is not an item.
	 * @property {string} qualityString - The item's summary.
	 */
	getItemDisplayData() {
		const relevantTypes = ['consumable', 'treasure', 'rule'];
		if (!relevantTypes.includes(this.type)) {
			return false;
		}

		// Retrieve and process the item's summary
		const summary = this.system.summary.value?.trim() || '';
		let qualityString = game.i18n.localize('FU.SummaryNone');

		// Parse the summary if it exists and is not empty
		if (summary) {
			const parser = new DOMParser();
			const doc = parser.parseFromString(summary, 'text/html');
			qualityString = doc.body.textContent || game.i18n.localize('FU.SummaryNone');
		}

		return {
			qualityString,
		};
	}

	/**
	 * Get the display data for an item.
	 *
	 * @returns {object|boolean} An object containing skill display information, or false if this is not a skill.
	 * @property {string} qualityString - The skill's description.
	 */
	getSkillDisplayData() {
		// Check if this item is not a skill
		if (this.type !== 'skill' && this.type !== 'miscAbility') {
			return false;
		}

		function translate(string) {
			const allTranslations = Object.assign({}, CONFIG.FU.attributeAbbreviations, CONFIG.FU.damageTypes);

			return game.i18n.localize(allTranslations?.[string] ?? string);
		}

		// Get the equipped item IDs from the actor's system
		const equipped = this.actor.system.equipped || {};
		const mainHandId = equipped.mainHand;

		// Find the main hand weapon by its ID
		let weaponMain = mainHandId ? this.actor.items.get(mainHandId) : null;

		const hasRoll = this.system.hasRoll?.value;
		const hasDamage = this.system.rollInfo?.damage?.hasDamage.value;
		const usesWeapons = this.system.rollInfo?.useWeapon?.accuracy.value;
		const usesWeaponsDamage = this.system.rollInfo?.useWeapon?.damage.value;
		const hrZeroText = this.system.rollInfo?.useWeapon?.hrZero.value ? `${game.i18n.localize('FU.HRZero')} +` : `${game.i18n.localize('FU.HighRollAbbr')} +`;

		let attackWeaponAttributes, attackAttributes;
		if (usesWeapons && weaponMain) {
			attackWeaponAttributes = [translate(weaponMain?.system?.attributes?.primary.value).toUpperCase(), translate(weaponMain?.system?.attributes?.secondary.value).toUpperCase()].join(' + ');
		} else {
			attackWeaponAttributes = '';
		}

		if (hasRoll) {
			attackAttributes = [translate(this.system?.rollInfo?.attributes?.primary.value).toUpperCase(), translate(this.system?.rollInfo?.attributes?.secondary.value).toUpperCase()].join(' + ');
		}

		const weaponString = usesWeapons ? (weaponMain ? weaponMain?.name : game.i18n.localize('FU.AbilityNoWeaponEquipped')) : '';

		let attackString = '';
		if (hasRoll || usesWeapons) {
			attackString = usesWeapons
				? `【${attackWeaponAttributes}】${weaponMain ? (weaponMain?.system?.accuracy?.value > 0 ? ` + ${weaponMain?.system?.accuracy?.value}` : '') : ''}`
				: `【${attackAttributes}】${this.system?.rollInfo?.accuracy?.value > 0 ? ` + ${this.system?.rollInfo?.accuracy?.value}` : ''}`;
		}

		let damageString = '';
		if (hasDamage || usesWeaponsDamage) {
			damageString = usesWeapons
				? `【${hrZeroText} ${weaponMain ? `${weaponMain?.system?.damage.value}】 ${translate(weaponMain?.system?.damageType.value)}` : ''}`
				: `【${hrZeroText} ${this.system?.rollInfo?.damage?.value > 0 ? ` ${this.system?.rollInfo?.damage?.value}` : '0'} 】${translate(this.system?.rollInfo?.damage.type.value)}`;
		}

		const qualityString = [capitalizeFirst(this.system?.class?.value), weaponString, attackString, damageString].filter(Boolean).join(' ⬥ ');

		const starCurrent = this.system?.level?.value;
		const starMax = this.system?.level?.max;

		return {
			qualityString: `${qualityString}`,
			starCurrent: `${starCurrent}`,
			starMax: `${starMax}`,
		};
	}

	/**
	 * Asynchronously calculates and retrieves the single roll information for an item.
	 *
	 * @param {Item|null} usedItem - The item to be used for the roll, or null to use the current item.
	 * @param {boolean} addName - Whether to add the item's name to the output.
	 * @param {boolean} isShift - Whether the Shift key is pressed.
	 * @returns {Promise<[string, Roll]>} A formatted HTML string containing the roll information and the Roll itself.
	 * @throws {Error} Throws an error if the roll cannot be evaluated.
	 */
	async getSingleRollForItem(usedItem = null, addName = false, isShift = false) {
		const item = usedItem || this;
		let content = '';

		const hasImpDamage = item.type === 'ritual' && item.system.rollInfo?.impdamage?.hasImpDamage?.value;
		const isWeapon = item.type === 'weapon' || item.type === 'basic';
		const hasDamage = isWeapon || (['spell', 'skill', 'miscAbility'].includes(item.type) && item.system.rollInfo?.damage?.hasDamage?.value);

		// Determine bonuses
		const {
			accuracy: { magicCheck, accuracyCheck },
		} = this.actor.system.bonuses;
		const accBonus = isWeapon ? accuracyCheck : magicCheck || 0;

		// Extract attributes and values
		const attrs = isWeapon ? item.system.attributes : item.system.rollInfo.attributes;
		const accVal = isWeapon ? item.system.accuracy.value : item.system.rollInfo.accuracy.value || 0;
		const def = item.system.defense;
		const primary = this.actor.system.attributes[attrs.primary.value].current;
		const secondary = this.actor.system.attributes[attrs.secondary.value].current;

		// Create and evaluate roll
		const roll = new Roll('1d@prim + 1d@sec + @mod + @bonus', {
			prim: primary,
			sec: secondary,
			mod: accVal,
			bonus: accBonus,
		});
		await roll.evaluate({ async: true });

		const bonusAccVal = usedItem ? this.system.rollInfo.accuracy.value : 0;
		const acc = roll.total + bonusAccVal;
		const diceResults = roll.terms.filter((term) => term.results).map((die) => die.results[0].result);

		// Temporarily set hrZero if Shift is pressed
		const originalHrZero = item.system.rollInfo?.useWeapon?.hrZero?.value;
		if (isShift) {
			item.system.rollInfo ??= {};
			item.system.rollInfo.useWeapon ??= {};
			item.system.rollInfo.useWeapon.hrZero ??= {};
			item.system.rollInfo.useWeapon.hrZero.value = true;
		}

		const hr = item.system.rollInfo?.useWeapon?.hrZero?.value ? 0 : Math.max(...diceResults);
		const isFumble = diceResults[0] === 1 && diceResults[1] === 1;
		const isCrit = !isFumble && diceResults[0] === diceResults[1] && diceResults[0] >= 6;

		// Determine roll state
		const rollState = isFumble ? 'fumble' : isCrit ? 'critical' : 'default';

		// Add item name if specified
		if (addName) {
			content += `<strong>${item.name}</strong><br />`;
		}

		// Base content
		content += `
		<header class="title-desc chat-header flexrow">
			<h2 style="flex-grow: 4;">${game.i18n.localize('FU.Accuracy')}</h2>
			<section class="targets" style="align-items: end;">
				<div class="fu-tags flexrow gap-5">
					<a data-action="selectTargetedToken">
						<span class='fu-tag button flex-group-center gap-5' data-tooltip="${game.i18n.localize('FU.Target')}"><i class="icon fas fa-bullseye"></i></span>
					</a>
				</div>
			</section>
		</header>
		<div class='detail-desc flexrow flex-group-center desc'>
			<label
				class="total ${rollState} flexrow">
				<div class="startcap"></div>
				<div class="" style="flex: 0 1 auto;">${acc} ${def ? `<label>vs</label> <label>${def.toUpperCase()}</label>` : ''}</div>
				<div class="endcap"></div>
			</label>
		</div>

		<div style="clear: both;"></div>
		<div class="flexrow gap-5">
			<div id='results' class='detail-desc flex-group-center grid grid-3col flex3'>
				<div>
					<label class="title">${attrs.primary.value.toUpperCase()}</label>
					<label class="detail">${diceResults[0]}</label>
				</div>
				<div>
					<label class="title">${attrs.secondary.value.toUpperCase()}</label>
					<label class="detail">${diceResults[1]}</label>
				</div>
				<div>
					<label class="title">${game.i18n.localize('FU.ModAbbr')}</label>
					<label class="detail">${bonusAccVal}</label>
				</div>
			</div>
		</div>`;

		// Damage information
		if (hasDamage) {
			let damVal = isWeapon ? item.system.damage.value : item.system.rollInfo.damage.value;
			damVal = damVal || 0;
			const bonusDamVal = usedItem ? this.system.rollInfo.damage.value : 0;
			const damage = hr + damVal + bonusDamVal;
			const damType = isWeapon ? item.system.damageType.value : item.system.rollInfo.damage.type.value;
			function translate(string) {
				const allTranslations = Object.assign({}, CONFIG.FU.affIcon);

				return game.i18n.localize(allTranslations?.[string] ?? string);
			}

			content += `
			<header class="title-desc chat-header flexrow">
				<h2 style="flex-grow: 4;">${game.i18n.localize('FU.Damage')}</h2>
				<section class="targets" style="align-items: end;">
					<div class="fu-tags flexrow gap-5">
						<a data-action="selectDamageCustomizer">
							<span class='fu-tag button flex-group-center gap-5' data-tooltip="${game.i18n.localize('FU.DamageCustomizer')}"><i class="icon fas fa-gear"></i></span>
						</a>
					</div>
				</section>
			</header>

			<div class='detail-desc flex-group-center flexrow'>
				<a>
					<label class="damageType ${damType} grid grid-3col">
						<div class="startcap"></div>
						<div>${damage}</div>
						<div class="endcap"
							data-tooltip="${damType}">
							<i class="${translate(damType)}"></i></div>
					</label>
				</a>
			</div>
			
			<div class="flexrow gap-5">
				<div id='results' class='detail-desc flex-group-center grid grid-2col flex2'>
					<div>
						<label class="title">${game.i18n.localize('FU.HighRollAbbr')}</label>
						<label class="detail">${hr}</label>
					</div>
					<div>
						<label class="title">${game.i18n.localize('FU.ModAbbr')}</label>
						<label class="detail">${bonusDamVal}</label>
					</div>
				</div>
			</div>
			`;
		}

		// Imp damage information
		if (hasImpDamage) {
			const damageTable = {
				5: { minor: 10, heavy: 30, massive: 40 },
				20: { minor: 20, heavy: 40, massive: 60 },
				40: { minor: 30, heavy: 50, massive: 80 },
			};
			const level = item.actor.system.level.value;
			const improvType = item.type === 'ritual' ? item.system.rollInfo.impdamage.impType.value : '';
			const damage = damageTable[level >= 40 ? 40 : level >= 20 ? 20 : 5][improvType] || 0;
			const damType = item.type === 'ritual' ? item.system.rollInfo.impdamage.type.value : '';

			content += `
			<header class="title-desc chat-header flexrow">
				<h2 style="flex-grow: 4;">${game.i18n.localize('FU.Collateral')}</h2>
				<section class="targets" style="align-items: end;">
					<div class="fu-tags flexrow gap-5">
						<a data-action="selectDamageCustomizer">
							<span class='fu-tag button flex-group-center gap-5' data-tooltip="${game.i18n.localize('FU.DamageCustomizer')}"><i class="icon fas fa-gear"></i></span>
						</a>
					</div>
				</section>
			</header>
			<div class='detail-desc flex-group-center flexrow'>
				<a data-action="applyDamage">
					<label class="damageType ${damType} grid grid-3col">
						<div class="startcap detail">${improvType}</div>
						<div>${damage}</div>
						<div class="endcap">${damType}!</div>
					</label>
				</a>
			</div>`;
		}

		// Restore the original hrZero value if it was changed
		if (isShift) {
			item.system.rollInfo.useWeapon.hrZero.value = originalHrZero;
		}

		return [content, roll];
	}

	async getRollString(isShift) {
		const isSpellOrSkill = ['spell', 'skill', 'miscAbility', 'ritual'].includes(this.type);
		const isWeapon = this.type === 'weapon' || this.type === 'basic';
		const hasRoll = isWeapon || (isSpellOrSkill && this.system.hasRoll?.value);

		let mainHandContent = '';
		let offHandContent = '';
		let otherContent = '';
		const rolls = [];

		if (hasRoll) {
			const usesWeapons = isSpellOrSkill && (this.system.rollInfo?.useWeapon?.accuracy?.value || this.system.rollInfo?.useWeapon?.damage?.value);

			if (usesWeapons) {
				// Retrieve equipped item IDs from the actor's system
				const equipped = this.actor.system.equipped || {};
				const mainHandId = equipped.mainHand;
				const offHandId = equipped.offHand;

				// Get all equipped weapons
				const equippedWeapons = this.actor.items.filter((singleItem) => singleItem.type === 'weapon' || (singleItem.type === 'basic' && singleItem.system.isEquipped?.value));

				for (const equippedWeapon of equippedWeapons) {
					const [data, roll] = await this.getSingleRollForItem(equippedWeapon, true, isShift);

					// Determine if the weapon is equipped in the main hand or off hand
					if (equippedWeapon.id === mainHandId) {
						mainHandContent += data;
						rolls.push(roll);
					} else if (equippedWeapon.id === offHandId) {
						offHandContent += data;
						rolls.push(roll);
					}
				}

				// Handle the content if no weapons are equipped
				if (mainHandContent === '' && offHandContent === '') {
					mainHandContent = "<div style='display:none;'>";
					offHandContent = "<div style='display:none;'>";
				} else {
					mainHandContent = mainHandContent || '<strong>No Main-Hand Equipped!</strong>';
					offHandContent = offHandContent || '<strong>No Off-Hand Equipped!</strong>';
				}

				mainHandContent = `<p class="mainhand-header">Main: ${mainHandContent}</p>`;
				offHandContent = `<p class="offhand-header">Off: ${offHandContent}</p>`;
			} else {
				// Handle non-weapon rolls
				const [content, roll] = await this.getSingleRollForItem(null, false, isShift);
				otherContent = content;
				rolls.push(roll);
			}
		}

		return [mainHandContent + offHandContent + otherContent, rolls];
	}

	getDescriptionString() {
		const summary = this.system.summary.value?.trim() || '';
		const description = this.system.description?.trim() || '';
		const collapseDescriptions = game.settings.get('projectfu', 'collapseDescriptions') ? '' : 'open';

		// Prepare summary and description HTML
		const summaryHtml = summary ? `<blockquote class="summary quote">${summary}</blockquote>` : '';
		const descriptionHtml = description ? description : '';

		// Prepare the combined HTML
		const content = [summaryHtml, descriptionHtml].filter((part) => part).join('');

		return content
			? `
			<div class='chat-desc'>
				<details ${collapseDescriptions}>
					<summary class="align-center">${game.i18n.localize('FU.Description')}</summary>
					${content}
				</details>
			</div>`
			: '';
	}

	getQualityString() {
		const validTypes = ['basic', 'weapon', 'shield', 'armor', 'accessory'];
		if (!validTypes.includes(this.type)) {
			return '';
		}

		// Prepare tags for category, hands, and type, always showing for 'weapon' or dual shield
		const tags = [
			this.type === 'weapon' && this.system.category?.value ? `<div class="fu-tag">${capitalizeFirst(this.system.category.value)}</div>` : '',
			this.type === 'weapon' && this.system.hands?.value ? `<div class="fu-tag">${capitalizeFirst(this.system.hands.value)}</div>` : '',
			this.type === 'weapon' && this.system.type?.value ? `<div class="fu-tag">${capitalizeFirst(this.system.type.value)}</div>` : '',
			['shield', 'armor', 'accessory'].includes(this.type) && this.system.def?.value >= 0 ? `<div class="fu-tag">${game.i18n.localize('FU.DefenseAbbr')} ${this.system.def.value}</div>` : '',
			['shield', 'armor', 'accessory'].includes(this.type) && this.system.mdef?.value >= 0 ? `<div class="fu-tag">${game.i18n.localize('FU.MagicDefenseAbbr')} ${this.system.mdef.value}</div>` : '',
			['shield', 'armor', 'accessory'].includes(this.type) && this.system.init?.value >= 0 ? `<div class="fu-tag">${game.i18n.localize('FU.InitiativeAbbr')} ${this.system.init.value}</div>` : '',
		]
			.filter((tag) => tag)
			.join('');

		// Prepare description
		const qualityValue = this.system.quality?.value?.trim() || '';
		const description = qualityValue ? `<div class='chat-desc'><p><strong>${game.i18n.localize('FU.Quality')}: </strong>${qualityValue}</p></div>` : '';

		return tags || description ? `<div class="fu-tags">${tags}</div>${description}` : '';
	}

	getConsumableDataString() {
		if (this.type !== 'consumable') {
			return '';
		}

		const ipCostText = this.system.ipCost?.value ? `${this.system.ipCost.value} ${game.i18n.localize('FU.InventoryAbbr')}` : game.i18n.localize('FU.InventoryCost');

		// Prepare tags
		const tags = ipCostText ? `<div class="fu-tag">${ipCostText}</div>` : '';

		return tags ? `<div class="fu-tags">${tags}</div>` : '';
	}

	getRitualDataString() {
		if (this.type !== 'ritual') {
			return '';
		}

		const { mpCost, dLevel, clock } = this.system;

		// Prepare tags
		const tags = [`<div class="fu-tag">${mpCost?.value || 'Mp Cost'} MP</div>`, `<div class="fu-tag">${dLevel?.value || 'Difficulty Level'} DL</div>`, `<div class="fu-tag">Clock ${clock?.value || 'Clock'}</div>`].join('');

		return tags ? `<div class="fu-tags">${tags}</div>` : '';
	}

	async getResourceDataString() {
		// Check if the item type is 'ritual'
		if (this.type !== 'miscAbility') {
			return '';
		}

		const { rp, hasResource } = this.system;

		// Determine resoure point display status
		const resourceDisplay =
			hasResource?.value ?? true
				? await renderTemplate('systems/projectfu/templates/chat/partials/chat-resource-details.hbs', {
						data: rp,
					})
				: '';

		// Create HTML content
		const content = `
			<div style="display: grid;">
				${resourceDisplay}
			</div>
		`;
		return content;
	}

	async getClockDataString() {
		// Check if the item type is 'ritual'
		if (this.type !== 'ritual' && this.type !== 'miscAbility') {
			return '';
		}

		const { progress, hasClock } = this.system;

		// Generate and reverse the progress array
		this.progressArr = this.generateProgressArray(progress);

		// Determine clock display status
		const clockDisplay =
			hasClock?.value ?? true
				? await renderTemplate('systems/projectfu/templates/chat/partials/chat-clock-details.hbs', {
						arr: this.progressArr,
						data: progress,
					})
				: '';

		// Create HTML content
		const content = `
        <div style="display: grid;">
            ${clockDisplay}
        </div>
    	`;
		return content;
	}

	// Helper function to generate progress array
	generateProgressArray(progress) {
		return Array.from({ length: progress.max }, (_, i) => ({
			id: i + 1,
			checked: parseInt(progress.current) === i + 1,
		})).reverse();
	}

	getSpellDataString() {
		if (this.type !== 'spell') {
			return '';
		}

		const { mpCost, target, duration } = this.system;
		const opportunityValue = this.system.opportunity?.value?.trim() || '';

		// Prepare tags
		const tags = [`<div class="fu-tag">${duration?.value || 'Duration'}</div>`, `<div class="fu-tag">${target?.value || 'Target'}</div>`, `<div class="fu-tag">${mpCost?.value ? `${mpCost.value} MP` : 'MP Cost'}</div>`]
			.filter((tag) => tag)
			.join('');

		// Prepare opportunity description
		const opportunityDesc = opportunityValue
			? `<div class='chat-desc'>
				<p><strong>${game.i18n.localize('FU.Opportunity')}: </strong>${opportunityValue}</p>
			  </div>`
			: '';

		return tags || opportunityDesc ? `<div class="fu-tags">${tags}</div>${opportunityDesc}` : '';
	}

	getTreasureDataString() {
		if (this.type !== 'treasure') {
			return '';
		}

		const { subtype, cost, quantity, origin } = this.system;
		const currency = game.settings.get('projectfu', 'optionRenameCurrency');

		// Determine the localization key based on the subtype
		const localizationKey = FU.treasureType[subtype?.value] || 'FU.Treasure';

		// Prepare tags
		const tags = [
			subtype?.value ? `<div class="fu-tag">${game.i18n.localize(localizationKey)}</div>` : '',
			cost?.value ? `<div class="fu-tag">${cost.value} ${currency}</div>` : '',
			quantity?.value > 0 ? `<div class="fu-tag">${game.i18n.localize('FU.Quantity')}: ${quantity?.value}</div>` : '',
			origin?.value ? `<div class="fu-tag">${game.i18n.localize('FU.Origin')}: ${origin?.value}</div>` : '',
		]
			.filter((tag) => tag)
			.join('');

		return tags ? `<div class="fu-tags">${tags}</div>` : '';
	}

	getProjectDataString() {
		if (this.type !== 'project') {
			return '';
		}

		const { cost, discount, progress, progressPerDay } = this.system;
		const currency = game.settings.get('projectfu', 'optionRenameCurrency');

		// Calculate discount text and total cost
		const discountText = discount.value ? `<span>-${discount.value}</span>` : '';
		const totalCost = cost.value - discount.value;

		// Prepare tags
		const tags = [
			`<div class="fu-tag" data-tooltip="${cost.value}${discountText}<br>=${totalCost}">${totalCost} ${currency}</div>`,
			`<div class="fu-tag">${progress.current} progress / ${progress.max} total days</div>`,
			`<div class="fu-tag">${progressPerDay.value} progress per day</div>`,
		].join('');

		return `<div class="fu-tags">${tags}</div>`;
	}

	getHeroicDataString() {
		if (this.type !== 'heroic') {
			return '';
		}

		const { subtype, class: heroicClass, requirement, heroicStyle } = this.system;

		// Determine the localization key based on the subtype
		const localizationKey = FU.heroicType[subtype?.value] || 'FU.Heroic';

		// Prepare tags
		const tags = [
			subtype?.value ? `<div class="fu-tag">${game.i18n.localize(localizationKey)}</div>` : '',
			heroicClass?.value ? `<div class="fu-tag">${game.i18n.localize('FU.Class')}: ${heroicClass.value}</div>` : '',
			requirement?.value ? `<div class="fu-tag">${game.i18n.localize('FU.Requirements')}: ${requirement.value}</div>` : '',
			heroicStyle?.value ? `<div class="fu-tag">${game.i18n.localize('FU.HeroicStyle')}: ${heroicStyle.value}</div>` : '',
		]
			.filter((tag) => tag)
			.join('');

		return tags ? `<div class="fu-tags">${tags}</div>` : '';
	}

	getZeroDataString() {
		if (this.type !== 'zeroPower') {
			return '';
		}

		const {
			system: { zeroTrigger, zeroEffect, progress },
		} = this;

		// Prepare tags
		const tags = [
			`<div class="fu-tag">${zeroTrigger.value || 'Zero Trigger'}</div>`,
			`<div class="fu-tag">${zeroEffect.value || 'Zero Effect'}</div>`,
			`<div class="fu-tag">${game.i18n.localize('FU.Clock')}: ${progress.current} / ${progress.max}</div>`,
		].join('');

		// Prepare descriptions
		const descriptions = [
			zeroTrigger.description?.trim() ? `<div class="resource-label">${zeroTrigger.value || 'Zero Trigger'}</div><div>${zeroTrigger.description}</div>` : '',
			zeroEffect.description?.trim() ? `<div class="resource-label">${zeroEffect.value || 'Zero Effect'}</div><div>${zeroEffect.description}</div>` : '',
		].join('');

		// Combine tags and descriptions
		return tags || descriptions ? `<div class="fu-tags">${tags}</div><div class="chat-desc">${descriptions}</div>` : '';
	}

	/**
	 * Handle clickable rolls.
	 * @param {KeyboardModifiers} modifiers
	 */
	async roll(modifiers = { shift: false, alt: false, ctrl: false, meta: false }) {
		const isShift = modifiers.shift;
		if (this.system.showTitleCard?.value) {
			SOCKET.executeForEveryone('use', this.name);
		}
		if (game.settings.get(SYSTEM, SETTINGS.checksV2)) {
			return this.handleCheckV2(modifiers);
		}
		if (this.type === 'weapon') {
			return this.rollWeapon(isShift);
		}
		if (this.type === 'spell' && this.system.hasRoll.value) {
			return this.rollSpell(isShift);
		}
		if (this.type === 'basic') {
			return this.rollBasic(isShift);
		}
		if ((this.type === 'miscAbility' || this.type === 'skill') && this.system.hasRoll.value) {
			return this.rollAbility(isShift);
		}
		if (this.type === 'classFeature' && this.system.data instanceof RollableClassFeatureDataModel) {
			return this.system.data.constructor.roll(this.system.data, this, isShift);
		}
		if (this.type === 'optionalFeature' && this.system.data instanceof RollableOptionalFeatureDataModel) {
			return this.system.data.constructor.roll(this.system.data, this, isShift);
		}

		const item = this;
		const { system, img, name } = item;
		// Initialize chat data.
		const speaker = ChatMessage.getSpeaker({ actor: item.actor });
		const rollMode = game.settings.get('core', 'rollMode');

		const label = `
			<header class="title-desc chat-header flexrow">
				<img src="${img}" alt="Image">
				<h2>${name}</h2>
			</header>
		`;

		// Check if there's no roll data
		if (!system.formula) {
			let { rolls, content } = await this.createChatMessage(item, isShift);

			// if (['consumable'].includes(type) {}

			// Create a chat message.
			ChatMessage.create({
				speaker: speaker,
				type: foundry.utils.isNewerVersion(game.version, '12.0.0') ? undefined : CONST.CHAT_MESSAGE_TYPES.ROLL,
				flavor: label,
				content,
				rolls,
				flags: { [SYSTEM]: { [Flags.ChatMessage.Item]: item } },
			});
		} else {
			// Retrieve roll data.
			const rollData = item.getRollData();

			// Invoke the roll and submit it to chat.
			const roll = new Roll(rollData.item.formula, rollData);
			roll.toMessage({
				speaker: speaker,
				rollMode: rollMode,
				flavor: label,
				flags: { [SYSTEM]: { [Flags.ChatMessage.Item]: item } },
			});
			return roll;
		}
	}

	async createChatMessage(item, isShift) {
		const clockString = await item.getClockDataString();
		const resourceString = await item.getResourceDataString();
		const chatdesc = item.getDescriptionString();
		const [attackData, rolls] = await item.getRollString(isShift);
		const spellString = item.getSpellDataString();
		const ritualString = item.getRitualDataString();
		const consumableString = item.getConsumableDataString();
		const treasureString = item.getTreasureDataString();
		const projectString = item.getProjectDataString();
		const heroicString = item.getHeroicDataString();
		const zeroString = item.getZeroDataString();
		const qualityString = item.getQualityString();

		const attackString = Array.isArray(attackData) ? attackData.join('<br /><br />') : attackData;

		// Prepare the content by filtering and joining various parts.
		let content = [qualityString, spellString, ritualString, consumableString, treasureString, projectString, heroicString, zeroString, resourceString, clockString, chatdesc, attackString].filter((part) => part).join('');
		content = `<div data-item-id="${item.id}">${content}</div>`;
		return { rolls, content };
	}

	/**
	 * @param {KeyboardModifiers} modifiers
	 * @return {Promise<undefined>}
	 */
	async handleCheckV2(modifiers) {
		if (this.system.roll instanceof Function) {
			return this.system.roll(modifiers);
		} else {
			return ChecksV2.display(this.actor, this);
		}
	}

	/**
	 * @param {boolean} hrZero whether HR should be treated as 0 for damage
	 * @return {Promise<chatMessage>}
	 */
	async rollSpell(hrZero) {
		const { rollInfo, opportunity, description, summary, cost, targeting, duration, defense } = this.system;
		let defenseAbbr = !defense ? game.i18n.localize('FU.MagicDefenseAbbr') : defenseAbbr;
		let checkDamage = undefined;
		if (rollInfo?.damage?.hasDamage?.value) {
			const damageBonus = this.actor.system.bonuses.damage.spell;
			checkDamage = {
				hrZero: rollInfo.useWeapon?.hrZero?.value || hrZero,
				type: rollInfo.damage.type.value,
				bonus: rollInfo.damage.value + damageBonus,
			};
		}

		/** @type CheckSpell */
		const details = {
			_type: 'spell',
			name: this.name,
			img: this.img,
			id: this.id,
			duration: duration.value,
			target: targeting.rule,
			mpCost: cost.amount,
			defense: defenseAbbr,
			opportunity: opportunity,
			summary: summary.value,
			description: await TextEditor.enrichHTML(description),
		};
		const check = await rollCheck({
			check: {
				title: game.i18n.localize('FU.MagicCheck'),
				attr1: {
					attribute: rollInfo.attributes.primary.value,
					dice: this.actor.system.attributes[rollInfo.attributes.primary.value].current,
				},
				attr2: {
					attribute: rollInfo.attributes.secondary.value,
					dice: this.actor.system.attributes[rollInfo.attributes.secondary.value].current,
				},
				modifier: rollInfo.accuracy.value,
				bonus: this.actor.system.bonuses.accuracy.magicCheck,
			},
			details,
			damage: checkDamage,
			speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
			targets: getTargets('mdef'),
		});
		return createCheckMessage(check, { [SYSTEM]: { [Flags.ChatMessage.Item]: this } });
	}

	/**
	 * @param  {boolean} hrZero whether HR should be treated as 0 for damage
	 * @return {Promise<chatMessage>}
	 */
	async rollWeapon(hrZero) {
		/** @type WeaponDataModel */
		const dataModel = this.system;
		const { accuracy, attributes, type, rollInfo, quality, damage, damageType, hands, description, category, summary, defense } = dataModel;
		const { accuracyCheck = 0, [category.value]: categoryAccuracyBonus = 0 } = this.actor.system.bonuses.accuracy;
		const { [type.value]: typeDamageBonus = 0, [category.value]: categoryDamageBonus = 0 } = this.actor.system.bonuses.damage;
		/** @type CheckWeapon */
		let details = {
			_type: 'weapon',
			name: this.name,
			img: this.img,
			id: this.id,
			category: category.value,
			type: type.value,
			hands: hands.value,
			defense: defense,
			quality: quality.value,
			summary: summary.value,
			description: await TextEditor.enrichHTML(description),
		};
		const check = await rollCheck({
			check: {
				title: game.i18n.localize('FU.AccuracyCheck'),
				attr1: {
					attribute: attributes.primary?.value,
					dice: this.actor.system.attributes[attributes.primary.value].current,
				},
				attr2: {
					attribute: attributes.secondary.value,
					dice: this.actor.system.attributes[attributes.secondary.value].current,
				},
				modifier: accuracy.value,
				bonus: accuracyCheck + categoryAccuracyBonus,
			},
			details,
			damage: {
				hrZero: rollInfo?.useWeapon?.hrZero?.value || hrZero,
				type: damageType.value,
				bonus: damage.value + categoryDamageBonus + typeDamageBonus,
			},
			translation: {
				damageTypes: FU.damageTypes,
				damageIcon: FU.affIcon,
			},
			speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
			targets: getTargets(defense),
		});
		return createCheckMessage(check, { [SYSTEM]: { [Flags.ChatMessage.Item]: this } });
	}

	async rollBasic(hrZero) {
		const { accuracy, attributes, type, rollInfo, quality, damage, damageType, description, summary, defense } = /** @type BasicItemDataModel */ this.system;
		const { accuracyCheck } = this.actor.system.bonuses.accuracy;
		const { [type.value]: typeDamageBonus = 0 } = this.actor.system.bonuses.damage;
		/** @type CheckBasic */
		const details = {
			_type: 'basic',
			name: this.name,
			img: this.img,
			id: this.id,
			type: type.value,
			defense: defense,
			quality: quality.value,
			summary: summary.value,
			description: await TextEditor.enrichHTML(description),
		};
		const check = await rollCheck({
			check: {
				title: game.i18n.localize('FU.AccuracyCheck'),
				attr1: {
					attribute: attributes.primary.value,
					dice: this.actor.system.attributes[attributes.primary.value].current,
				},
				attr2: {
					attribute: attributes.secondary.value,
					dice: this.actor.system.attributes[attributes.secondary.value].current,
				},
				modifier: accuracy.value,
				bonus: accuracyCheck,
			},
			details,
			damage: {
				hrZero: rollInfo?.useWeapon?.hrZero?.value || hrZero,
				type: damageType.value,
				bonus: damage.value + typeDamageBonus,
			},
			speaker: ChatMessage.implementation.getSpeaker({ actor: this.actor }),
			targets: getTargets(defense),
		});
		return createCheckMessage(check, { [SYSTEM]: { [Flags.ChatMessage.Item]: this } });
	}

	async rollAbility(hrZero) {
		const { summary, description, opportunity, rollInfo, defense } = /** @type {MiscAbilityDataModel | SkillDataModel} */ this.system;
		/** @type CheckAbility */
		const details = {
			_type: 'ability',
			name: this.name,
			img: this.img,
			id: this.id,
			defense: defense,
			summary: summary.value,
			opportunity: opportunity,
			description: await TextEditor.enrichHTML(description),
		};

		const speaker = ChatMessage.implementation.getSpeaker({ actor: this.actor });
		const targets = getTargets(defense);

		// Get the equipped item IDs from the actor's system
		const equipped = this.actor.system.equipped || {};
		const mainHandId = equipped.mainHand;
		const offHandId = equipped.offHand;

		// Retrieve equipped weapons by their IDs
		const weaponMain = mainHandId ? this.actor.items.get(mainHandId) : null;
		const weaponOff = offHandId ? this.actor.items.get(offHandId) : null;

		if (rollInfo.useWeapon.accuracy.value || rollInfo.useWeapon.damage.value) {
			// Ensure at least one weapon is equipped
			if (!weaponMain && !weaponOff) {
				ui.notifications.error('FU.AbilityNoWeaponEquipped', { localize: true });
				return;
			}

			const equippedWeapons = { mainHand: weaponMain, offHand: weaponOff };
			const checks = [];

			// Iterate over both main and off-hand weapons
			for (let [, weapon] of Object.entries(equippedWeapons)) {
				if (weapon) {
					let params = this.#prepareAbilityCheckWithWeapon(weapon, hrZero, details, speaker, rollInfo, targets);
					checks.push(rollCheck(params).then((check) => createCheckMessage(check, { [SYSTEM]: { [Flags.ChatMessage.Item]: this } })));
				}
			}

			// Return a Promise that resolves after all checks are done
			return Promise.all(checks);
		} else {
			/** @type {CheckDamage | undefined} */
			let checkDamage = undefined;
			if (rollInfo.damage.hasDamage.value) {
				checkDamage = {
					hrZero: rollInfo.useWeapon.hrZero.value || hrZero,
					type: rollInfo.damage.type.value,
					bonus: rollInfo.damage.value,
				};
			}

			// Perform the check without weapons
			const check = await rollCheck({
				check: {
					title: game.i18n.localize('FU.SkillCheck'),
					attr1: {
						attribute: rollInfo.attributes.primary.value,
						dice: this.actor.system.attributes[rollInfo.attributes.primary.value].current,
					},
					attr2: {
						attribute: rollInfo.attributes.secondary.value,
						dice: this.actor.system.attributes[rollInfo.attributes.secondary.value].current,
					},
					modifier: rollInfo.accuracy.value,
					bonus: 0,
				},
				details,
				damage: checkDamage,
				speaker: speaker,
				targets: targets,
			});
			return createCheckMessage(check, { [SYSTEM]: { [Flags.ChatMessage.Item]: this } });
		}
	}

	/**
	 * @param {FUItem} weapon
	 * @param {boolean} hrZero
	 * @param {CheckAbility} details
	 * @param {ChatSpeakerData} speaker
	 * @param {{useWeapon: UseWeaponDataModel, attributes: ItemAttributesDataModel, accuracy: {value: number}, damage: DamageDataModel}} rollInfo
	 * @param {Array} targets
	 * @return {CheckParameters}
	 */
	#prepareAbilityCheckWithWeapon(weapon, hrZero, details, speaker, rollInfo, targets) {
		const { useWeapon, accuracy, attributes, damage } = rollInfo;
		const {
			name: weaponName,
			system: { attributes: weaponAttributes, accuracy: weaponAccuracy, damage: weaponDamage, category: weaponCategory, type: weaponType, damageType: weaponDamageType },
		} = weapon;

		// Retrieve equipped item IDs from the actor's system
		const equipped = this.actor.system.equipped || {};
		const mainHandId = equipped.mainHand;
		const offHandId = equipped.offHand;

		let attr1 = attributes.primary.value;
		let attr2 = attributes.secondary.value;
		let modifier = accuracy.value;
		let bonus = 0;

		if (useWeapon.accuracy.value) {
			const { accuracyCheck: bonusAccCheck, [weaponCategory]: bonusAccWeaponCat } = this.actor.system.bonuses.accuracy;
			attr1 = weaponAttributes.primary.value;
			attr2 = weaponAttributes.secondary.value;
			modifier = weaponAccuracy.value;
			bonus = 0 + bonusAccCheck + bonusAccWeaponCat;
		}

		/** @type {CheckDamage | undefined} */
		let checkDamage = undefined;
		if (useWeapon.damage.value) {
			const { [weaponCategory.value]: categoryDamageBonus, [weaponType.value]: typeDamageBonus } = this.actor.system.bonuses.damage;
			checkDamage = {
				hrZero: useWeapon.hrZero.value || hrZero,
				type: weaponDamageType.value,
				bonus: weaponDamage.value + categoryDamageBonus + typeDamageBonus,
			};
		} else if (damage.hasDamage.value) {
			checkDamage = {
				hrZero: useWeapon.hrZero.value || hrZero,
				type: damage.type.value,
				bonus: damage.value,
			};
		}

		// Determine the weapon's slot based on its ID
		const slot = weapon.id === mainHandId ? 'FU.MainAbbr' : weapon.id === offHandId ? 'FU.OffAbbr' : '';

		return {
			check: {
				title: game.i18n.localize('FU.SkillCheck'),
				attr1: {
					attribute: attr1,
					dice: this.actor.system.attributes[attr1].current,
				},
				attr2: {
					attribute: attr2,
					dice: this.actor.system.attributes[attr2].current,
				},
				modifier: modifier,
				bonus: bonus,
			},
			details: { ...details, weapon: { name: weaponName, slot: slot } },
			damage: checkDamage,
			speaker: speaker,
			targets: targets,
		};
	}

	applyActiveEffects() {
		const overrides = {};

		// Organize non-disabled effects by their application priority
		const changes = [];
		for (const effect of this.allApplicableEffects()) {
			if (!effect.active) continue;
			changes.push(
				...effect.changes.map((change) => {
					const c = foundry.utils.deepClone(change);
					c.effect = effect;
					c.order = c.priority ?? c.mode * 10;
					return c;
				}),
			);
		}
		changes.sort((a, b) => a.order - b.order);

		// Apply all changes
		for (let change of changes) {
			if (!change.key) continue;
			const changes = change.effect.apply(this, change);
			Object.assign(overrides, changes);
		}

		// Expand the set of final overrides
		this.overrides = foundry.utils.expandObject(overrides);
		this.render();
	}

	*allApplicableEffects() {
		for (const effect of this.effects) {
			// only yield effects that try to modify the item and not the actor
			if (effect.target === this) {
				yield effect;
			}
		}
	}

	/**
	 * Renders a dialog to confirm the FUID change and if accepted updates the FUID on the item.
	 * @returns {Promise<string|undefined>} The generated FUID or undefined if no change was made.
	 */
	async regenerateFUID() {
		const html = `
			<div class="warning-message">
			<p>${game.i18n.localize('FU.FUID.ChangeWarning2')}</p>
			<p>${game.i18n.localize('FU.FUID.ChangeWarning3')}</p>
			</div>
			`;

		const confirmation = await Dialog.confirm({
			title: game.i18n.localize('FU.FUID.Regenerate'),
			content: html,
			defaultYes: false,
			options: { classes: ['projectfu', 'unique-dialog', 'backgroundstyle'] },
		});

		if (!confirmation) return;

		const fuid = slugify(this.name);
		await this.update({ 'system.fuid': fuid });

		return fuid;
	}

	get isEquipped() {
		if (this.actor) {
			return this.actor.system.equipped.isEquipped(this);
		}
		return false;
	}
}
