import { SYSTEM } from './config.mjs';
import { Flags } from './flags.mjs';
import { FUActor } from '../documents/actors/actor.mjs';
import { FUItem } from '../documents/items/item.mjs';
import { Expressions } from '../expressions/expressions.mjs';

/**
 * @description Information about a lookup for the source of an inline element
 * @property {String} name
 * @property {String} itemUuid
 * @property {String} actorUuid
 */
export class InlineSourceInfo {
	constructor(name, actorUuid, itemUuid) {
		this.name = name;
		this.actorUuid = actorUuid;
		this.itemUuid = itemUuid;
	}

	/**
	 * @param {FUActor} actor
	 * @param {FUItem} item
	 * @return {InlineSourceInfo}
	 */
	static fromInstance(actor, item) {
		return new InlineSourceInfo(item.name, actor.uuid, item.uuid);
	}

	/**
	 * @returns {FUActor|null}
	 */
	resolveActor() {
		if (this.actorUuid) {
			return fromUuidSync(this.actorUuid);
		}
		return null;
	}

	/**
	 * @returns {FUItem|null}
	 */
	resolveItem() {
		if (this.itemUuid) {
			return fromUuidSync(this.itemUuid);
		}
		return null;
	}

	/**
	 * @returns {FUActor|FUItem}
	 */
	resolve() {
		if (this.actorUuid) {
			return fromUuidSync(this.actorUuid);
		}
		if (this.itemUuid) {
			return fromUuidSync(this.itemUuid);
		}
		return null;
	}
}

/**
 * @description Attempts to determine the item/actor source within an html element
 * @param {Document} document
 * @param {HTMLElement} element
 * @returns {InlineSourceInfo}
 */
function determineSource(document, element) {
	let name = game.i18n.localize('FU.UnknownDamageSource');
	let itemUuid = null;
	let actorUuid = null;

	// Happens when clicked from the actor window
	if (document instanceof FUActor) {
		actorUuid = document.uuid;
		console.debug(`Determining source document as Actor ${actorUuid}`);
		const itemId = $(element).closest('[data-item-id]').data('itemId');
		if (itemId) {
			let item = document.items.get(itemId);
			itemUuid = itemId;
			name = item.name;
		} else {
			name = document.name;
		}
	} else if (document instanceof FUItem) {
		name = document.name;
		itemUuid = document.uuid;
		console.debug(`Determining source document as Item ${itemUuid}`);
	} else if (document instanceof ChatMessage) {
		const speakerActor = ChatMessage.getSpeakerActor(document.speaker);
		if (speakerActor) {
			actorUuid = speakerActor.uuid;
			name = speakerActor.name;
		}
		const check = document.getFlag(SYSTEM, Flags.ChatMessage.CheckV2);
		if (check) {
			itemUuid = check.itemUuid;
		} else {
			let item = document.getFlag(SYSTEM, Flags.ChatMessage.Item);
			if (item) {
				name = item.name;
				itemUuid = item.uuid;
			}
		}
		console.debug(`Determining source document as ChatMessage ${name}`);
	}
	return new InlineSourceInfo(name, actorUuid, itemUuid);
}

/**
 * @param {HTMLAnchorElement} anchor
 * @param {String} amount
 */
function appendAmountToAnchor(anchor, amount) {
	anchor.dataset.amount = amount;
	const dynamicAmount = Expressions.requiresContext(amount);
	if (dynamicAmount) {
		anchor.append(game.i18n.localize('FU.Variable'));
	} else {
		anchor.append(amount);
	}
}

/**
 * @param {HTMLAnchorElement} anchor
 * @param {String} key The key in the `anchor.dataset`
 * @param {String} expression
 * @param {String} localization
 */
function appendVariableToAnchor(anchor, key, expression, localization = 'FU.Variable') {
	anchor.dataset[key] = expression;
	const dynamicAmount = Expressions.requiresContext(expression);
	if (dynamicAmount) {
		anchor.append(game.i18n.localize(localization));
	} else {
		anchor.append(expression);
	}
}

function toBase64(value) {
	try {
		const string = JSON.stringify(value);
		const bytes = new TextEncoder().encode(string);
		const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
		return btoa(binString);
	} catch (e) {
		return null;
	}
}

function fromBase64(base64) {
	try {
		const binString = atob(base64);
		const uint8Array = Uint8Array.from(binString, (m) => m.codePointAt(0));
		const decodedValue = new TextDecoder().decode(uint8Array);
		return JSON.parse(decodedValue);
	} catch (e) {
		return null;
	}
}

function capitalize(word) {
	return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export const InlineHelper = {
	determineSource,
	appendAmountToAnchor,
	appendVariableToAnchor,
	toBase64,
	fromBase64,
	capitalize,
};
