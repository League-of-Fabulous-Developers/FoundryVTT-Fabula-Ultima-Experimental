import { FU } from './config.mjs';
import { InlineHelper, InlineSourceInfo } from './inline-helper.mjs';
import { targetHandler } from './target-handler.mjs';
import { CharacterDataModel } from '../documents/actors/character/character-data-model.mjs';
import { NpcDataModel } from '../documents/actors/npc/npc-data-model.mjs';
import { Effects } from '../pipelines/effects.mjs';

const INLINE_DATA_TYPE = 'InlineAffinity';
const className = `inline-affinity`;

/**
 * @type {TextEditorEnricherConfig}
 */
const editorEnricher = {
	pattern: /@AFFINITY\[\s*(?<type>\w+)\s(?<value>\w+)]/g,
	enricher: (match, options) => {
		const type = match.groups.type.toLowerCase();
		const value = match.groups.value;

		if (type && type in FU.damageTypes && (value in FU.affValue || value === 'damage')) {
			const anchor = document.createElement('a');
			anchor.classList.add('inline', className);
			anchor.draggable = true;
			anchor.dataset.type = type;
			anchor.dataset.value = value;
			// TOOLTIP
			anchor.setAttribute('data-tooltip', `${game.i18n.localize('FU.InlineAffinity')} (${type})`);
			// TYPE
			const localizedType = game.i18n.localize(FU.damageTypes[type]);
			const isDamage = value === 'damage';
			const localizedValue = game.i18n.localize(isDamage ? 'FU.Damage' : FU.affType[FU.affValue[value]]);
			anchor.append(`${localizedType} ${localizedValue}`);
			// ICON
			const icon = document.createElement('i');
			icon.className = FU.affIcon[type] ?? '';
			anchor.append(icon);
			return anchor;
		}

		return null;
	},
};

/**
 * @param {ClientDocument} document
 * @param {jQuery} html
 */
function activateListeners(document, html) {
	if (document instanceof DocumentSheet) {
		document = document.document;
	}

	html.find(`a.inline.inline-affinity[draggable]`)
		.on('click', async function () {
			let targets = await targetHandler();
			if (targets.length > 0) {
				const sourceInfo = InlineHelper.determineSource(document, this);
				const type = this.dataset.type;
				const value = this.dataset.value;

				targets.forEach(async (target) => {
					await applyEffect(target, sourceInfo, type, value);
				});
			}
		})
		.on('dragstart', function (event) {
			/** @type DragEvent */
			event = event.originalEvent;
			if (!(this instanceof HTMLElement) || !event.dataTransfer) {
				return;
			}

			const sourceInfo = InlineHelper.determineSource(document, this);
			const data = {
				type: INLINE_DATA_TYPE,
				sourceInfo: sourceInfo,
				affinity: this.dataset.type,
				value: this.dataset.value,
			};
			event.dataTransfer.setData('text/plain', JSON.stringify(data));
			event.stopPropagation();
		});
}

async function onDropActor(actor, sheet, { type, sourceInfo, affinity, value, ignore }) {
	if (type === INLINE_DATA_TYPE) {
		sourceInfo = InlineSourceInfo.fromObject(sourceInfo);
		await applyEffect(actor, sourceInfo, affinity, value);
		return false;
	}
}

/**
 * @param {String} type
 * @param {String} value
 * @returns {ActiveEffectData}
 */
function createEffect(type, value) {
	// If overriding the character's damage type for all actions
	let attributeKey;
	let attributeValue;
	let name;
	const localizedType = game.i18n.localize(FU.damageTypes[type]);
	if (value === 'damage') {
		attributeKey = `system.overrides.damageType`;
		attributeValue = type;
		name = `${localizedType} ${game.i18n.localize('FU.Damage')}`;
	}
	// Otherwise just adjusting their affinities
	else {
		attributeKey = `system.affinities.${type}.current`;
		attributeValue = FU.affValue[value];
		const localizedValue = game.i18n.localize(FU.affType[attributeValue]);
		name = `${localizedType} ${localizedValue}`;
	}

	/** @type Number **/

	return {
		fuid: `${type}-${value}`,
		name: name,
		img: `systems/projectfu/styles/static/affinities/${type}.svg`,
		transfer: false,
		changes: attributeKey
			? [
					{
						key: attributeKey,
						mode: CONST.ACTIVE_EFFECT_MODES.OVERRIDE,
						value: attributeValue,
					},
				]
			: [],
	};
}

/**
 * @param {FUActor} actor
 * @param {InlineSourceInfo} sourceInfo
 * @param {String} type
 * @param {String} value
 *
 */
async function applyEffect(actor, sourceInfo, type, value) {
	if (actor.system instanceof CharacterDataModel || actor.system instanceof NpcDataModel) {
		const source = sourceInfo.resolve();
		const effectData = createEffect(type, value);
		Effects.onApplyEffectToActor(actor, source?.uuid, effectData).then((effect) => {
			console.info(`Created effect: ${effect.uuid} on actor uuid: ${actor.uuid}`);
		});
	} else {
		ui.notifications.error('FU.ChatApplyNoCharacterSelected', { localize: true });
	}
}

export const InlineAffinity = {
	enricher: editorEnricher,
	activateListeners,
	onDropActor,
};
