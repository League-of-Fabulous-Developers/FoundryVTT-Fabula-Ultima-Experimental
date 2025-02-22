import { FU } from '../../../helpers/config.mjs';

/**
 * @property {boolean} hasDamage
 * @property {boolean} hrZero Whether to treat the high roll as zero
 * @property {number} value The base value which is generally added to the high roll
 * @property {String} onRoll An expression which is evaluated during the roll.
 * @property {String} onApply An expression which is evaluated during damage application.
 * @property {DamageType} type
 */
export class DamageDataModelV2 extends foundry.abstract.DataModel {
	static defineSchema() {
		const { BooleanField, NumberField, StringField } = foundry.data.fields;
		return {
			hasDamage: new BooleanField(),
			hrZero: new BooleanField(),
			value: new NumberField({ initial: 0, integer: true, nullable: false }),
			onRoll: new StringField({ nullable: true }),
			onApply: new StringField({ nullable: true }),
			type: new StringField({ initial: 'physical', choices: Object.keys(FU.damageTypes), blank: true, nullable: false }),
		};
	}
}
