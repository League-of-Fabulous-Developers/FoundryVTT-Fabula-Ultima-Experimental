import { SYSTEM } from './config.mjs';

/**
 * @description Registers a context menu item for the chat messages with the specified flag
 * @param {String} flag The flag to check against, from those within {@link Flags}
 * @param {String} name The localized name for the item name
 * @param {String} iconClass The css class of the icon to use
 * @param {Promise<ChatMessage, void>} callback The function to execute for the item
 */
function registerContextMenuItem(flag, name, iconClass, callback) {
	const hook = (html, options) => {
		options.unshift({
			name: name,
			icon: `<i class="${iconClass}"></i>`,
			group: SYSTEM,
			condition: (li) => {
				const messageId = li.data('messageId');
				/** @type ChatMessage | undefined */
				const message = game.messages.get(messageId);
				return message.getFlag(SYSTEM, flag);
			},
			callback: async (li) => {
				const messageId = li.data('messageId');
				/** @type ChatMessage | undefined */
				const message = game.messages.get(messageId);
				if (message) {
					const damage = message.getFlag(SYSTEM, flag);
					if (damage) {
						callback(message);
					}
				}
			},
		});
	};

	Hooks.on('getChatLogEntryContext', hook);
}

export const ChatMessageHelper = Object.freeze({
	registerContextMenuItem,
});
