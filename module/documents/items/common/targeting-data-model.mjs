import { Targeting } from '../../../helpers/targeting.mjs';

/**
 * @property {TargetingRule} rule The type of targeting rule to use
 * @property {Number} max The maximum number of targets
 */
export class TargetingDataModel extends foundry.abstract.DataModel {
	static defineSchema() {
		const { NumberField, StringField } = foundry.data.fields;
		return {
			rule: new StringField({ initial: Targeting.rule.self, choices: Object.keys(Targeting.rule), required: true }),
			max: new NumberField({ initial: 0, min: 0, max: 3, integer: true, nullable: false }),
		};
	}
}
