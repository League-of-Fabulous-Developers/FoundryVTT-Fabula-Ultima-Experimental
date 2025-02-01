import { FU } from './config.mjs';
import { targetHandler } from './target-handler.mjs';
import { InlineHelper, InlineSourceInfo } from './inline-helper.mjs';
import { ExpressionContext, Expressions } from '../expressions/expressions.mjs';
import { DamagePipeline, DamageRequest } from '../pipelines/damage-pipeline.mjs';

const INLINE_DAMAGE = 'InlineDamage';

/**
 * @typedef SourceInfo
 * @prop {string | null} uuid
 * @prop {string | null} name
 */

/**
 * @type {TextEditorEnricherConfig}
 */
const inlineDamageEnricher = {
	pattern: /@DMG\[\s*(?<amount>\(?.*?\)*?)\s(?<type>\w+?)]\B/g,
	enricher: enricher,
};

function enricher(text, options) {
	const amount = text[1];
	const type = text[2];

	if (type in FU.damageTypes) {
		const anchor = document.createElement('a');
		anchor.classList.add('inline', 'inline-damage');
		anchor.dataset.type = type;
		anchor.draggable = true;

		// TOOLTIP
		anchor.setAttribute('data-tooltip', `${game.i18n.localize('FU.InlineDamage')} (${amount})`);
		// AMOUNT
		InlineHelper.appendAmountToAnchor(anchor, amount);
		// TYPE
		anchor.append(` ${game.i18n.localize(FU.damageTypes[type])}`);
		// ICON
		const icon = document.createElement('i');
		icon.className = FU.affIcon[type] ?? '';
		anchor.append(icon);
		return anchor;
	}

	return null;
}

/**
 * @param {ClientDocument} document
 * @param {jQuery} html
 */
function activateListeners(document, html) {
	if (document instanceof DocumentSheet) {
		document = document.document;
	}

	html.find('a.inline.inline-damage[draggable]')
		.on('click', async function () {
			let targets = await targetHandler();
			if (targets.length > 0) {
				const sourceInfo = InlineHelper.determineSource(document, this);
				const type = this.dataset.type;
				const context = ExpressionContext.fromUuid(sourceInfo.actorUuid, sourceInfo.itemUuid, targets);
				const amount = Expressions.evaluate(this.dataset.amount, context);

				const baseDamageInfo = { type, total: amount, modifierTotal: 0 };
				const request = new DamageRequest(sourceInfo, targets, baseDamageInfo);
				await DamagePipeline.process(request);
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
				type: INLINE_DAMAGE,
				_sourceInfo: sourceInfo,
				damageType: this.dataset.type,
				amount: this.dataset.amount,
			};
			event.dataTransfer.setData('text/plain', JSON.stringify(data));
			event.stopPropagation();
		});
}

// TODO: Implement
function onDropActor(actor, sheet, { type, damageType, amount, _sourceInfo, ignore }) {
	if (type === INLINE_DAMAGE) {
		// Need to rebuild the class after it was deserialized
		const sourceInfo = InlineSourceInfo.fromObject(_sourceInfo);
		const context = ExpressionContext.fromUuid(sourceInfo.actorUuid, sourceInfo.itemUuid, [actor]);
		const _amount = Expressions.evaluate(amount, context);
		const baseDamageInfo = { type: damageType, total: _amount, modifierTotal: 0 };

		const request = new DamageRequest(sourceInfo, [actor], baseDamageInfo);
		DamagePipeline.process(request);
		return false;
	}
}

export const InlineDamage = {
	enricher: inlineDamageEnricher,
	activateListeners,
	onDropActor,
};
