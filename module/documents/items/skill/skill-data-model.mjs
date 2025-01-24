import { UseWeaponDataModel } from '../common/use-weapon-data-model.mjs';
import { ItemAttributesDataModel } from '../common/item-attributes-data-model.mjs';
import { DamageDataModel } from '../common/damage-data-model.mjs';
import { ImprovisedDamageDataModel } from '../common/improvised-damage-data-model.mjs';
import { ProgressDataModel } from '../common/progress-data-model.mjs';
import { FU, SYSTEM } from '../../../helpers/config.mjs';
import { CheckHooks } from '../../../checks/check-hooks.mjs';
import { ChooseWeaponDialog } from './choose-weapon-dialog.mjs';
import { ChecksV2 } from '../../../checks/checks-v2.mjs';
import { CheckConfiguration } from '../../../checks/check-configuration.mjs';
import { AccuracyCheck } from '../../../checks/accuracy-check.mjs';
import { SETTINGS } from '../../../settings.js';
import { CommonSections } from '../../../checks/common-sections.mjs';
import { CHECK_DETAILS } from '../../../checks/default-section-order.mjs';
import { ActionCostDataModel } from '../common/action-cost-data-model.mjs';
import { TargetingDataModel } from '../common/targeting-data-model.mjs';

const weaponUsedBySkill = 'weaponUsedBySkill';
const skillForAttributeCheck = 'skillForAttributeCheck';

/**
 * @type PrepareCheckHook
 */
const onPrepareAccuracyCheck = (check, actor, item, registerCallback) => {
	if (check.type === 'accuracy' && item.system instanceof SkillDataModel) {
		/** @type SkillDataModel */
		const skillData = item.system;
		registerCallback(async (check) => {
			const weapon = await ChooseWeaponDialog.prompt(actor);
			if (weapon) {
				/** @type WeaponDataModel */
				const weaponData = weapon.system;

				check.primary = weaponData.attributes.primary.value;
				check.secondary = weaponData.attributes.secondary.value;
				if (weaponData.accuracy.value) {
					check.modifiers.push({
						label: 'FU.AccuracyCheckBaseAccuracy',
						value: weaponData.accuracy.value,
					});
				}

				check.additionalData[weaponUsedBySkill] = weapon.uuid;

				if (skillData.rollInfo.damage.hasDamage.value) {
					const configurer = AccuracyCheck.configure(check);
					if (skillData.rollInfo.useWeapon.damage.value) {
						configurer
							.setDamage(weaponData.damageType.value, weaponData.damage.value)
							.addItemAccuracyBonuses(weapon, actor)
							.addItemDamageBonuses(weapon, actor)
							.modifyHrZero((hrZero) => hrZero || skillData.rollInfo.useWeapon.hrZero.value)
							.setTargetedDefense(weaponData.defense);
					} else {
						configurer
							.setDamage(skillData.rollInfo.damage.type.value, skillData.rollInfo.damage.value)
							.addItemDamageBonuses(weapon, actor)
							.addItemAccuracyBonuses(weapon, actor)
							.modifyHrZero((hrZero) => hrZero || skillData.rollInfo.useWeapon.hrZero.value)
							.setTargetedDefense(weaponData.defense);
					}
				}
			} else {
				if (weapon === false) {
					ui.notifications.error('FU.AbilityNoWeaponEquipped', { localize: true });
				}
			}
		});
	}
};
Hooks.on(CheckHooks.prepareCheck, onPrepareAccuracyCheck);

/**
 * @type PrepareCheckHook
 */
const onPrepareAttributeCheck = (check, actor, item, registerCallback) => {
	if (check.type === 'attribute' && check.additionalData[skillForAttributeCheck]) {
		item = fromUuidSync(check.additionalData[skillForAttributeCheck]);
		/** @type SkillDataModel */
		const skillData = item.system;
		if (skillData.rollInfo.accuracy.value) {
			check.modifiers.push({ label: 'FU.Bonus', value: skillData.rollInfo.accuracy.value });
		}
	}
};
Hooks.on(CheckHooks.prepareCheck, onPrepareAttributeCheck);

/**
 * @type RenderCheckHook
 */
let onRenderAccuracyCheck = (sections, check, actor, item, flags) => {
	if (check.type === 'accuracy' && item?.system instanceof SkillDataModel) {
		if (check.additionalData[weaponUsedBySkill]) {
			const weapon = fromUuidSync(check.additionalData[weaponUsedBySkill]);
			/** @type WeaponDataModel */
			const weaponData = weapon.system;
			CommonSections.tags(sections, [{ tag: 'FU.Class', separator: ':', value: item.system.class.value }], CHECK_DETAILS);
			if (item.system.hasResource.value) {
				CommonSections.resource(sections, item.system.rp, CHECK_DETAILS);
			}
			sections.push({
				partial: 'systems/projectfu/templates/chat/partials/chat-weapon-details.hbs',
				data: {
					weapon: {
						category: weaponData.category.value,
						hands: weaponData.hands.value,
						type: weaponData.type.value,
						summary: item.system.summary.value,
						description: item.system.description,
					},
					collapseDescriptions: game.settings.get(SYSTEM, SETTINGS.collapseDescriptions),
				},
				order: CHECK_DETAILS + 2,
			});
			sections.push({
				content: `
                  <div class='detail-desc flexrow flex-group-center desc' style='padding: 4px;'>
                    <div>
                      <span>
                        ${game.i18n.localize('FU.Weapon')}:
                        <strong>${weapon.name}</strong>
                      </span>
                    </div>
                  </div>
                  `,
				order: CHECK_DETAILS + 1,
			});
		}

		const inspector = CheckConfiguration.inspect(check);
		const targets = inspector.getTargets();
		CommonSections.spendResource(sections, actor, item, targets, flags);
	}
};
Hooks.on(CheckHooks.renderCheck, onRenderAccuracyCheck);

/**
 * @type RenderCheckHook
 */
let onRenderAttributeCheck = (sections, check, actor, item) => {
	if (check.type === 'attribute' && check.additionalData[skillForAttributeCheck]) {
		const skill = fromUuidSync(check.additionalData[skillForAttributeCheck]);
		CommonSections.itemFlavor(sections, skill);
		CommonSections.tags(sections, [{ tag: 'FU.Class', separator: ':', value: skill.system.class.value }], CHECK_DETAILS);
		if (skill.system.hasResource.value) {
			CommonSections.resource(sections, skill.system.rp, CHECK_DETAILS);
		}
		CommonSections.description(sections, skill.system.description, skill.system.summary.value, CHECK_DETAILS);
	}
};
Hooks.on(CheckHooks.renderCheck, onRenderAttributeCheck);

/**
 * @type RenderCheckHook
 */
const onRenderDisplay = (sections, check, actor, item, flags) => {
	if (check.type === 'display' && item.system instanceof SkillDataModel) {
		CommonSections.tags(sections, [{ tag: 'FU.Class', separator: ':', value: item.system.class.value }], CHECK_DETAILS);
		if (item.system.hasResource.value) {
			CommonSections.resource(sections, item.system.rp, CHECK_DETAILS);
		}
		CommonSections.description(sections, item.system.description, item.system.summary.value, CHECK_DETAILS);
		const targets = CheckConfiguration.inspect(check).getTargetsOrDefault();
		CommonSections.spendResource(sections, actor, item, targets, flags);
	}
};
Hooks.on(CheckHooks.renderCheck, onRenderDisplay);

/**
 * @property {string} subtype.value
 * @property {string} summary.value
 * @property {string} description
 * @property {boolean} isFavored.value
 * @property {boolean} showTitleCard.value
 * @property {number} level.value
 * @property {number} level.min
 * @property {number} level.max
 * @property {string} class.value
 * @property {UseWeaponDataModel} useWeapon
 * @property {ItemAttributesDataModel} attributes
 * @property {number} accuracy.value
 * @property {Defense} defense
 * @property {DamageDataModel} damage
 * @property {ImprovisedDamageDataModel} impdamage
 * @property {string} source.value
 * @property {UseWeaponDataModel} rollInfo.useWeapon
 * @property {ItemAttributesDataModel} rollInfo.attributes
 * @property {number} rollInfo.accuracy.value
 * @property {DamageDataModel} rollInfo.damage
 * @property {boolean} hasRoll.value
 * @property {ActionCostDataModel} cost
 * @property {TargetingDataModel} targeting
 */
export class SkillDataModel extends foundry.abstract.TypeDataModel {
	static defineSchema() {
		const { SchemaField, StringField, HTMLField, BooleanField, NumberField, EmbeddedDataField } = foundry.data.fields;
		return {
			fuid: new StringField(),
			subtype: new SchemaField({ value: new StringField() }),
			summary: new SchemaField({ value: new StringField() }),
			description: new HTMLField(),
			isFavored: new SchemaField({ value: new BooleanField() }),
			showTitleCard: new SchemaField({ value: new BooleanField() }),
			level: new SchemaField({
				value: new NumberField({ initial: 1, min: 0, integer: true, nullable: false }),
				max: new NumberField({ initial: 10, min: 1, integer: true, nullable: false }),
				min: new NumberField({ initial: 0, min: 0, integer: true, nullable: false }),
			}),
			class: new SchemaField({ value: new StringField() }),
			useWeapon: new EmbeddedDataField(UseWeaponDataModel, {}),
			attributes: new EmbeddedDataField(ItemAttributesDataModel, {
				initial: {
					primary: { value: 'ins' },
					secondary: { value: 'mig' },
				},
			}),
			accuracy: new SchemaField({ value: new NumberField({ initial: 0, integer: true, nullable: false }) }),
			defense: new StringField({ initial: 'def', choices: Object.keys(FU.defenses) }),
			damage: new EmbeddedDataField(DamageDataModel, {}),
			impdamage: new EmbeddedDataField(ImprovisedDamageDataModel, {}),
			hasResource: new SchemaField({ value: new BooleanField() }),
			rp: new EmbeddedDataField(ProgressDataModel, {}),
			source: new SchemaField({ value: new StringField() }),
			rollInfo: new SchemaField({
				useWeapon: new EmbeddedDataField(UseWeaponDataModel, {}),
				attributes: new EmbeddedDataField(ItemAttributesDataModel, {
					initial: {
						primary: { value: 'ins' },
						secondary: { value: 'mig' },
					},
				}),
				accuracy: new SchemaField({ value: new NumberField({ initial: 0, integer: true, nullable: false }) }),
				damage: new EmbeddedDataField(DamageDataModel, {}),
			}),
			hasRoll: new SchemaField({ value: new BooleanField() }),
			cost: new EmbeddedDataField(ActionCostDataModel, {}),
			targeting: new EmbeddedDataField(TargetingDataModel, {}),
		};
	}

	/**
	 * @param {KeyboardModifiers} modifier
	 */
	roll(modifier) {
		if (this.hasRoll.value) {
			if (this.rollInfo.useWeapon.accuracy.value) {
				return ChecksV2.accuracyCheck(this.parent.actor, this.parent, CheckConfiguration.initHrZero(modifier.shift));
			} else {
				return ChecksV2.attributeCheck(this.parent.actor, { primary: this.rollInfo.attributes.primary.value, secondary: this.rollInfo.attributes.secondary.value }, (check) => {
					check.additionalData[skillForAttributeCheck] = this.parent.uuid;
				});
			}
		} else {
			return ChecksV2.display(this.parent.actor, this.parent);
		}
	}
}
