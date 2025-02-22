import { CharacterMigrations } from './character-migrations.mjs';
import { AffinitiesDataModel } from '../common/affinities-data-model.mjs';
import { AttributesDataModel } from '../common/attributes-data-model.mjs';
import { BonusesDataModel } from '../common/bonuses-data-model.mjs';
import { ImmunitiesDataModel } from '../common/immunities-data-model.mjs';
import { BondDataModel } from '../common/bond-data-model.mjs';
import { CharacterSkillTracker } from './character-skill-tracker.mjs';
import { FU, SYSTEM } from '../../../helpers/config.mjs';
import { DerivedValuesDataModel } from '../common/derived-values-data-model.mjs';
import { EquipDataModel } from '../common/equip-data-model.mjs';
import { PilotVehicleDataModel } from './pilot-vehicle-data-model.mjs';
import { SETTINGS } from '../../../settings.js';
import { OverridesDataModel } from '../common/overrides-data-model.mjs';

const CLASS_HP_BENEFITS = 5;
const CLASS_MP_BENEFITS = 5;
const CLASS_IP_BENEFITS = 2;
const HEROIC_IP_BENEFITS = 4;

function heroicHpBenefits(dataModel) {
	return dataModel.level.value >= 40 ? 20 : 10;
}

function heroicMpBenefits(dataModel) {
	return dataModel.level.value >= 40 ? 20 : 10;
}

/**
 * @property {number} level.value
 * @property {number} resources.hp.max
 * @property {number} resources.hp.value
 * @property {number} resources.hp.bonus
 * @property {number} resources.mp.max
 * @property {number} resources.mp.value
 * @property {number} resources.mp.bonus
 * @property {string} resources.rp1.name
 * @property {number} resources.rp1.value
 * @property {string} resources.rp2.name
 * @property {number} resources.rp2.value
 * @property {string} resources.rp2.name
 * @property {number} resources.rp2.value
 * @property {number} resources.zenit.value
 * @property {number} resources.ip.min
 * @property {number} resources.ip.max
 * @property {number} resources.ip.value
 * @property {number} resources.ip.bonus
 * @property {Object} resources.fp
 * @property {number} resources.fp.value
 * @property {BondDataModel[]} bonds
 * @property {number} resources.exp.value
 * @property {string} resources.identity.name
 * @property {string} resources.pronouns.name
 * @property {string} resources.theme.name
 * @property {string} resources.origin.name
 * @property {AffinitiesDataModel} affinities
 * @property {AttributesDataModel} attributes
 * @property {DerivedValuesDataModel} derived
 * @property {BonusesDataModel} bonuses
 * @property {PilotVehicleDataModel} vehicle
 * @property {string} description
 * @property {CharacterSkillTracker} tlTracker
 * @property {OverridesDataModel} overrides Overrides for default behaviour
 *
 */
export class CharacterDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const { SchemaField, NumberField, StringField, ArrayField, EmbeddedDataField, HTMLField } = foundry.data.fields;
		return {
			level: new SchemaField({
				value: new NumberField({
					initial: 5,
					min: 5,
					max: 50,
					integer: true,
					nullable: false,
				}),
			}),
			resources: new SchemaField({
				hp: new SchemaField({
					value: new NumberField({ initial: 10, min: 0, integer: true, nullable: false }),
					bonus: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				mp: new SchemaField({
					value: new NumberField({ initial: 10, min: 0, integer: true, nullable: false }),
					bonus: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				rp1: new SchemaField({
					name: new StringField({ initial: '' }),
					value: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				rp2: new SchemaField({
					name: new StringField({ initial: '' }),
					value: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				rp3: new SchemaField({
					name: new StringField({ initial: '' }),
					value: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				zenit: new SchemaField({ value: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }) }),
				ip: new SchemaField({
					value: new NumberField({ initial: 6, min: 0, integer: true, nullable: false }),
					bonus: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
				}),
				fp: new SchemaField({ value: new NumberField({ initial: 3, min: 0, integer: true, nullable: false }) }),
				exp: new SchemaField({ value: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }) }),
				identity: new SchemaField({ name: new StringField() }),
				pronouns: new SchemaField({ name: new StringField() }),
				theme: new SchemaField({ name: new StringField() }),
				origin: new SchemaField({ name: new StringField() }),
			}),
			bonds: new ArrayField(new EmbeddedDataField(BondDataModel, {}), {
				validate: (value) => {
					const maxBonds = game.settings.get(SYSTEM, SETTINGS.optionBondMaxLength);
					if (value.length > maxBonds) {
						value.splice(maxBonds);
					}
				},
			}),
			affinities: new EmbeddedDataField(AffinitiesDataModel, {}),
			attributes: new EmbeddedDataField(AttributesDataModel, {}),
			derived: new EmbeddedDataField(DerivedValuesDataModel, {}),
			equipped: new EmbeddedDataField(EquipDataModel, {}),
			bonuses: new EmbeddedDataField(BonusesDataModel, {}),
			immunities: new EmbeddedDataField(ImmunitiesDataModel, {}),
			vehicle: new EmbeddedDataField(PilotVehicleDataModel, {}),
			overrides: new EmbeddedDataField(OverridesDataModel, {}),
			description: new HTMLField(),
		};
	}

	static migrateData(source) {
		CharacterMigrations.run(source);

		return source;
	}

	/**
	 * @return FUActor
	 */
	get actor() {
		return this.parent;
	}

	prepareBaseData() {
		this.resources.hp.attribute = 'mig';
		this.resources.mp.attribute = 'wlp';
	}

	prepareEmbeddedData() {
		this.#prepareBasicResources();
		this.vehicle.prepareData();
		this.derived.prepareData();
	}

	prepareDerivedData() {
		this.tlTracker = new CharacterSkillTracker(this);
	}

	#prepareBasicResources() {
		const itemTypes = this.actor.itemTypes;
		let benefits = itemTypes.class.reduce(
			(agg, curr) => {
				if (curr.system.benefits.resources.hp.value) {
					agg.hp += CLASS_HP_BENEFITS;
				}
				if (curr.system.benefits.resources.mp.value) {
					agg.mp += CLASS_MP_BENEFITS;
				}
				if (curr.system.benefits.resources.ip.value) {
					agg.ip += CLASS_IP_BENEFITS;
				}
				return agg;
			},
			{ hp: 0, mp: 0, ip: 0 },
		);
		benefits = itemTypes.heroic.reduce((agg, curr) => {
			if (curr.system.benefits.resources.hp.value) {
				agg.hp += heroicHpBenefits(this);
			}
			if (curr.system.benefits.resources.mp.value) {
				agg.mp += heroicMpBenefits(this);
			}
			if (curr.system.benefits.resources.ip.value) {
				agg.ip += HEROIC_IP_BENEFITS;
			}
			return agg;
		}, benefits);

		// Calculate multipliers based on actor type and attributes.
		const data = this;
		// Define maximum hit points (hp) calculation, replace calculation with actual value on write.
		Object.defineProperty(this.resources.hp, 'max', {
			configurable: true,
			enumerable: true,
			get() {
				const baseAttribute = Object.keys(FU.attributes).includes(this.attribute) ? data.attributes[this.attribute].base : data.attributes.mig.base;
				return baseAttribute * 5 + data.level.value + benefits.hp + this.bonus;
			},
			set(newValue) {
				delete this.max;
				this.max = newValue;
			},
		});

		// Define maximum mind points (mp) calculation, replace calculation with actual value on write.
		Object.defineProperty(this.resources.mp, 'max', {
			configurable: true,
			enumerable: true,
			get() {
				const baseAttribute = Object.keys(FU.attributes).includes(this.attribute) ? data.attributes[this.attribute].base : data.attributes.wlp.base;
				return baseAttribute * 5 + data.level.value + benefits.mp + this.bonus;
			},
			set(newValue) {
				delete this.max;
				this.max = newValue;
			},
		});

		// Define maximum inventory points (ip) calculation, replace calculation with actual value on write.
		Object.defineProperty(this.resources.ip, 'max', {
			configurable: true,
			enumerable: true,
			get() {
				return 6 + benefits.ip + this.bonus;
			},
			set(newValue) {
				delete this.max;
				this.max = newValue;
			},
		});

		// Initialize fp and exp
		this.resources.fp.value = this.resources.fp.value || 0;
		this.resources.exp.value = this.resources.exp.value || 0;
	}
}
