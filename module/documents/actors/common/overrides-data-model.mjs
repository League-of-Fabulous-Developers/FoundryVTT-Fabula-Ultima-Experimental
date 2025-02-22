import { FU } from '../../../helpers/config.mjs';

/**
 * @property {String} damageType The damage type of all actions performed by the character
 * @property {Number} turns Number of additional turns this character can take each round
 */
export class OverridesDataModel extends foundry.abstract.DataModel {
	static defineSchema() {
		const { StringField, NumberField } = foundry.data.fields;
		return {
			turns: new NumberField({ initial: 1, min: 1, integer: true, nullable: false }),
			damageType: new StringField({ initial: '', choices: Object.keys(FU.damageTypes), blank: true, nullable: false }),
		};
	}
}
