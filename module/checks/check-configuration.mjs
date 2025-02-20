import { SETTINGS } from '../settings.js';
import { FU, SYSTEM } from '../helpers/config.mjs';
import { Flags } from '../helpers/flags.mjs';
import { CheckHooks } from './check-hooks.mjs';

const TARGETS = 'targets';
const TARGETED_DEFENSE = 'targetedDefense';
const DIFFICULTY = 'difficulty';
const DAMAGE = 'damage';
const TRAITS = 'traits';

/**
 *
 * @param difficulty
 * @return CheckCallback
 */
const initDifficulty = (difficulty) => (check) => difficulty > 0 && configure(check).setDifficulty(difficulty);

const HR_ZERO = 'hrZero';

/**
 * @param {boolean} hrZero
 * @return {CheckCallback}
 */
const initHrZero = (hrZero) => (check) => {
	hrZero && (check.additionalData[HR_ZERO] = true);
};

/**
 * @typedef BonusDamage
 * @property {string} label
 * @property {number} value
 */

/**
 * @typedef DamageData
 * @property {DamageType} type
 * @property {BonusDamage[]} modifiers
 * @property {number} modifierTotal
 * @property {number} [total]
 * @property {String} extra An expression to evaluate to add extra damage
 */

/**
 * @typedef TemplateDamageData
 * @property {Object} result - The result attributes from the check.
 * @property {number} result.attr1 - The primary check result.
 * @property {number} result.attr2 - The secondary check result.
 * @property {Object} damage - The damage details.
 * @property {number} damage.hrZero - The HR zero value.
 * @property {number} damage.bonus - The total damage bonus.
 * @property {number} damage.total - The total calculated damage.
 * @property {string} damage.type - The type of damage.
 * @property {String} damage.extra - Additional damage information.
 * @property {Object} translation - Translation details for damage types and icons.
 * @property {Object} translation.damageTypes - The available damage types.
 * @property {Object} translation.damageIcon - The icon representation of damage types.
 * @property {Array} modifiers - Modifiers applied to the damage.
 *
 */

/**
 * @param {CheckV2, CheckResultV2} check
 * @return {CheckConfigurer} check
 */
const configure = (check) => {
	return new CheckConfigurer(check);
};

class CheckConfigurer {
	/**
	 * @type {CheckV2, CheckResultV2}
	 */
	#check;

	constructor(check) {
		this.#check = check;
	}

	/**
	 * @param {Attribute} primary
	 * @param {Attribute} secondary
	 */
	setAttributes(primary, secondary) {
		this.#check.primary = primary;
		this.#check.secondary = secondary;
	}

	/**
	 * @param {DamageType} type
	 * @param {number} baseDamage
	 * @return {CheckConfigurer}
	 */
	setDamage(type, baseDamage) {
		this.#check.additionalData[DAMAGE] = {
			modifiers: [{ label: 'FU.BaseDamage', value: baseDamage }],
			type,
		};
		return this;
	}

	/**
	 * @returns {DamageData}
	 */
	get damage() {
		return this.#check.additionalData[DAMAGE];
	}

	/**
	 * @param {String[]|String} traits
	 * @returns {CheckConfigurer}
	 */
	addTraits(...traits) {
		if (!this.#check.additionalData[TRAITS]) {
			this.#check.additionalData[TRAITS] = [];
		}
		traits.forEach((t) => this.#check.additionalData[TRAITS].push(t.toLowerCase()));
		return this;
	}

	/**
	 * @param {FUItem} item Adds a special-case trait that denotes the name of the item
	 */
	addItemName(item) {
		return this.addTraits(`name:${item.name}`);
	}

	/**
	 * @param {FUItem} item
	 * @param {FUActor} actor
	 * @return {CheckConfigurer}
	 */
	addItemAccuracyBonuses(item, actor) {
		return this.addModelAccuracyBonuses(item.system, actor);
	}

	/**
	 * @description Add the common traits of a weapon
	 * @param {WeaponDataModel} system
	 */
	addWeaponTraits(system) {
		return this.addTraits(system.category.value, system.damageType.value, system.type.value);
	}

	/**
	 * @description Add the common traits of an NPC attack
	 * @param {BasicItemDataModel} system
	 */
	addAttackTraits(system) {
		return this.addTraits(system.type.value, system.damageType.value);
	}

	/**
	 * @param {DataModel} model
	 * @param {FUActor} actor
	 * @return {CheckConfigurer}
	 */
	addModelAccuracyBonuses(model, actor) {
		// Weapon Category
		const category = model.category?.value;
		if (category && actor.system.bonuses.accuracy[category]) {
			this.#check.modifiers.push({
				label: `FU.AccuracyCheckBonus${category.capitalize()}`,
				value: actor.system.bonuses.accuracy[category],
			});
		}
		// Attack Type
		const attackType = model.type?.value;
		if (attackType === 'melee' && actor.system.bonuses.accuracy.accuracyMelee) {
			this.#check.modifiers.push({
				label: 'FU.AccuracyCheckBonusMelee',
				value: actor.system.bonuses.accuracy.accuracyMelee,
			});
		} else if (attackType === 'ranged' && actor.system.bonuses.accuracy.accuracyRanged) {
			this.#check.modifiers.push({
				label: 'FU.AccuracyCheckBonusRanged',
				value: actor.system.bonuses.accuracy.accuracyRanged,
			});
		}
		return this;
	}

	/**
	 * @description A modifier to the check (accuracy)
	 * @param {String} label
	 * @param {Number} value
	 */
	addModifier(label, value) {
		this.#check.modifiers.push({
			label: label,
			value: value,
		});
	}

	/**
	 * @param {FUActor} actor
	 * @param {FUItem} item
	 * @return {CheckConfigurer}
	 */
	addItemDamageBonuses(item, actor) {
		return this.addModelDamageBonuses(item.system, actor);
	}

	/**
	 * @param {DataModel} model
	 * @param {FUActor} actor
	 * @return {CheckConfigurer}
	 */
	addModelDamageBonuses(model, actor) {
		// All Damage
		const globalBonus = actor.system.bonuses.damage.all;
		if (globalBonus) {
			this.addDamageBonus(`FU.DamageBonusAll`, globalBonus);
		}
		// Damage Type
		if (model.damageType) {
			const damageTypeBonus = actor.system.bonuses.damage[model.damageType.value];
			if (damageTypeBonus) {
				this.addDamageBonus(`FU.DamageBonus${model.damageType.value.capitalize()}`, damageTypeBonus);
			}
		}
		// Attack Type
		const attackTypeBonus = actor.system.bonuses.damage[model.type.value] ?? 0;
		if (attackTypeBonus) {
			this.addDamageBonus(`FU.DamageBonusType${model.type.value.capitalize()}`, attackTypeBonus);
		}
		// Weapon Category
		if (model.category) {
			const weaponCategoryBonus = actor.system.bonuses.damage[model.category.value] ?? 0;
			if (weaponCategoryBonus) {
				this.addDamageBonus(`FU.DamageBonusCategory${model.category.value.capitalize()}`, weaponCategoryBonus);
			}
		}
		return this;
	}

	/**
	 * @param {(damage: DamageData | null) => DamageData | null} callback
	 * @return {CheckConfigurer}
	 */
	modifyDamage(callback) {
		const damage = this.#check.additionalData[DAMAGE] ?? null;
		this.#check.additionalData[DAMAGE] = callback(damage);
		return this;
	}

	/**
	 * @param {string} label
	 * @param {number} value
	 * @return CheckConfigurer
	 */
	addDamageBonus(label, value) {
		this.#check.additionalData[DAMAGE]?.modifiers.push({ label, value });
		return this;
	}

	/**
	 * @param {String} extra
	 * @return {CheckConfigurer}
	 */
	setExtraDamage(extra) {
		this.damage.extra = extra;
		return this;
	}

	/**
	 * @param {boolean} hrZero
	 * @return {CheckConfigurer}
	 */
	setHrZero(hrZero) {
		this.#check.additionalData[HR_ZERO] = hrZero;
		return this;
	}

	/**
	 * @param {(hrZero: boolean | null) => boolean | null} callback
	 * @return {CheckConfigurer}
	 */
	modifyHrZero(callback) {
		const hrZero = this.#check.additionalData[HR_ZERO] ?? null;
		this.#check.additionalData[HR_ZERO] = callback(hrZero);
		return this;
	}

	/**
	 * @param {Defense} targetedDefense
	 * @return {CheckConfigurer}
	 */
	setTargetedDefense(targetedDefense) {
		this.#check.additionalData[TARGETED_DEFENSE] = targetedDefense;
		return this;
	}

	/**
	 * @param {(targetedDefense: Defense | null) => Defense | null} callback
	 * @return {CheckConfigurer}
	 */
	modifyTargetedDefense(callback) {
		const targetedDefense = this.#check.additionalData[TARGETED_DEFENSE] ?? null;
		this.#check.additionalData[TARGETED_DEFENSE] = callback(targetedDefense);
		return this;
	}

	/**
	 * @param {TargetData[]} targets
	 * @return {CheckConfigurer}
	 */
	setTargets(targets) {
		this.#check.additionalData[TARGETS] = [...targets];
		return this;
	}

	/**
	 * @description Assign actors currently targeted by the users
	 * @return {CheckConfigurer}
	 */
	setDefaultTargets() {
		return this.setTargets(
			[...game.user.targets]
				.filter((token) => !!token.actor)
				.map((token) => ({
					name: token.name,
					uuid: token.actor.uuid,
					link: token.actor.link,
				})),
		);
	}

	/**
	 * @param {(targets: TargetData[] | null) => TargetData[] | null} callback
	 * @return {CheckConfigurer}
	 */
	modifyTargets(callback) {
		const targets = this.#check.additionalData[TARGETS] ?? null;
		this.#check.additionalData[TARGETS] = callback(targets);
		return this;
	}

	/**
	 * @param {number} difficulty
	 * @return {CheckConfigurer}
	 */
	setDifficulty(difficulty) {
		this.#check.additionalData[DIFFICULTY] = difficulty;
		return this;
	}

	/**
	 * @param {(difficulty: number | null) => number | null} callback
	 * @return {CheckConfigurer}
	 */
	modifyDifficulty(callback) {
		const difficulty = this.#check.additionalData[DIFFICULTY] ?? null;
		this.#check.additionalData[DIFFICULTY] = callback(difficulty);
		return this;
	}
}

/**
 * @param {CheckV2, CheckResultV2, ChatMessage} check
 * @return {CheckInspector}
 */
const inspect = (check) => {
	if (check instanceof ChatMessage) {
		check = check.getFlag(SYSTEM, Flags.ChatMessage.CheckV2);
	}
	return new CheckInspector(check);
};

/**
 * @description Given a {@link CheckResultV2} object, provides additional information from it
 * @remarks Provides read-only access, to be used after {@linkcode CheckConfigurer}
 */
class CheckInspector {
	/**
	 * @type CheckResultV2
	 */
	#check;

	constructor(check) {
		this.#check = check;
	}

	/**
	 * @return {CheckV2|CheckResultV2}
	 */
	getCheck() {
		return this.#check;
	}

	/**
	 * @return {DamageData|null}
	 */
	getDamage() {
		return this.#check.additionalData[DAMAGE] != null ? foundry.utils.duplicate(this.#check.additionalData[DAMAGE]) : null;
	}

	/**
	 * @return {boolean|null}
	 */
	getHrZero() {
		return this.#check.additionalData[HR_ZERO] ?? null;
	}

	/**
	 * @return {Defense|null}
	 */
	getTargetedDefense() {
		return this.#check.additionalData[TARGETED_DEFENSE] ?? null;
	}

	/**
	 * @return {number|null}
	 */
	getDifficulty() {
		return this.#check.additionalData[DIFFICULTY] ?? null;
	}

	/**
	 * @return {String[]|null}
	 */
	getTraits() {
		return this.#check.additionalData[TRAITS] ?? null;
	}

	/**
	 * @return {TargetData[]|null}
	 */
	getTargets() {
		return this.#check.additionalData[TARGETS] ? foundry.utils.duplicate(this.#check.additionalData[TARGETS]) : null;
	}

	/**
	 * @return {TargetData[]}
	 */
	getTargetsOrDefault() {
		return this.getTargets() || [];
	}

	/**
	 * @remarks Used for templating
	 */
	getAccuracyData() {
		const _check = this.getCheck();
		const accuracyData = {
			result: {
				attr1: _check.primary.result,
				attr2: _check.secondary.result,
				die1: _check.primary.dice,
				die2: _check.secondary.dice,
				modifier: _check.modifierTotal,
				total: _check.result,
				crit: _check.critical,
				fumble: _check.fumble,
			},
			check: {
				attr1: {
					attribute: _check.primary.attribute,
				},
				attr2: {
					attribute: _check.secondary.attribute,
				},
			},
			modifiers: _check.modifiers,
			additionalData: _check.additionalData,
		};
		return accuracyData;
	}

	/**
	 * @returns {TemplateDamageData}
	 * @remarks Used for templating
	 */
	getDamageData() {
		const _check = this.getCheck();
		const damage = this.getDamage();
		const hrZero = this.getHrZero();
		let damageData = null;
		if (damage) {
			damageData = {
				result: {
					attr1: _check.primary.result,
					attr2: _check.secondary.result,
				},
				damage: {
					hrZero: hrZero,
					bonus: damage.modifierTotal,
					total: damage.total,
					type: damage.type,
					extra: damage.extra,
					traits: this.getTraits(),
				},
				translation: {
					damageTypes: FU.damageTypes,
					damageIcon: FU.affIcon,
				},
				modifiers: damage.modifiers,
			};
		}

		return damageData;
	}
}

/**
 * @param {CheckResultV2} check
 */
const registerMetaCurrencyExpenditure = (check) => {
	// if (!game.settings.get(SYSTEM, Flags.ChatMessage.UseMetaCurrency)) {
	// 	return;
	// }
	if (!game.settings.get(SYSTEM, SETTINGS.metaCurrencyAutomation)) {
		return;
	}
	const randomId = foundry.utils.randomID();
	check.additionalData.triggerMetaCurrencyExpenditure = randomId;
	let hookId;
	/**
	 * @type RenderCheckHook
	 */
	const spendMetaCurrency = (sections, check, actor) => {
		if (check.additionalData.triggerMetaCurrencyExpenditure === randomId) {
			delete check.additionalData.triggerMetaCurrencyExpenditure;
			Hooks.off(CheckHooks.renderCheck, hookId);
			sections.push(async () => {
				const success = await actor.spendMetaCurrency(true);
				if (!success) {
					throw new Error('not enough meta currency');
				}
			});
		}
	};

	hookId = Hooks.on(CheckHooks.renderCheck, spendMetaCurrency);
};

export const CheckConfiguration = Object.freeze({
	configure,
	inspect,
	initHrZero,
	initDifficulty,
	registerMetaCurrencyExpenditure,
});
