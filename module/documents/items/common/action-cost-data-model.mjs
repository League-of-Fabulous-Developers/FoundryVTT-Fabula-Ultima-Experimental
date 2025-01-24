import { FU } from '../../../helpers/config.mjs';

/**
 * @property {"hp", "mp", "ip", "fp", "exp", "zenit"} resource The resource type
 * @property {Number} amount The resource cost
s
 */
export class ActionCostDataModel extends foundry.abstract.DataModel {
	static defineSchema() {
		const { NumberField, StringField } = foundry.data.fields;
		return {
			resource: new StringField({ initial: 'mp', choices: Object.keys(FU.resources), required: true }),
			amount: new NumberField({ initial: 0, integer: true, nullable: false }),
		};
	}
}
