import { Action } from './action.mjs';
import { CheckConfiguration } from '../checks/check-configuration.mjs';
import { ChecksV2 } from '../checks/checks-v2.mjs';

const handleChatCommand = (chatLog, message, data) => {
	if (/^\/test$/i.test(message)) {
		/** @type ChatMessageData */
		const chatMessageData = {
			user: data.user,
			speaker: data.speaker,
			flags: {
				core: {
					actionTest: true,
				},
			},
			content: `
<div>
  <a data-some-action="someAction">Click to test some action!</a>
</div>
<div>
  <a data-some-action="someOtherAction">Click to test some other action!</a>
</div>
<div>
  <a data-some-action="anotherAction">Click to test another action!</a>
</div>
<div>
  <a data-action="applyDamage">The apply damage action will not be attached because this chat message is not a check.</a>
</div>`,
		};
		ChatMessage.create(chatMessageData);
		return false;
	}
};

const someAction = new Action(
	'someAction',
	(document, element, event) => {
		console.log('ActionHandler', this, document, element, event);
	},
	{
		dataAttribute: 'some-action',
		requireOwner: true,
		hasPermission: (document, element) => {
			return document.getFlag('core', 'someAction') === true;
		},
	},
);

const someOtherAction = new Action(
	'someOtherAction',
	(document, element, event) => {
		console.log('ActionHandler', this, document, element, event);
	},
	{
		dataAttribute: 'some-action',
		requireOwner: true,
		whenNotAllowed: 'disable',
		hasPermission: (document, element) => {
			return document.getFlag('core', 'someAction') === true;
		},
	},
);

const anotherAction = new Action(
	'anotherAction',
	(document, element, event) => {
		console.log('ActionHandler', this, document, element, event);
	},
	{
		dataAttribute: 'some-action',
		requireOwner: true,
		whenNotAllowed: (jQuery) =>
			jQuery.css({
				backgroundColor: 'red',
			}),
		hasPermission: (document, element) => {
			return document.getFlag('core', 'someAction') === true;
		},
	},
);

const applyDamageAction = new Action(
	'applyDamage',
	(document, element, event) => {
		console.log(CheckConfiguration.inspect(document).getDamage());
	},
	{
		hasPermission: (document, element) => fromUuidSync(element.dataset.id).testUserPermission(game.user, 'OWNER'),
		shouldAttach: (document) => {
			if (ChecksV2.isCheck(document)) {
				return true;
			} else {
				console.log('Not attaching ApplyDamageAction');
				return false;
			}
		},
	},
);

const onRenderChatMessage = (message, html, messageData) => {
	Action.attachAll(message, html, someAction, someOtherAction, anotherAction, applyDamageAction);
};

/**
 * @param application
 * @param {ContextMenuEntry[]} entryOptions
 */
const onGetChatLogEntryContext = (application, entryOptions) => {
	entryOptions.push({
		name: "Toggle 'Some Action'",
		icon: '<i class="fas fa-toggle-on"></i>',
		condition: (jQuery) => {
			const message = game.messages.get(jQuery.data('messageId'));
			return message.getFlag('core', 'actionTest');
		},
		callback: (jQuery) => {
			const message = game.messages.get(jQuery.data('messageId'));
			const flag = message.getFlag('core', 'someAction');
			message.setFlag('core', 'someAction', !flag);
		},
	});
};

export const ActionTest = Object.freeze({
	initialize: () => {
		Hooks.on('chatMessage', handleChatCommand);
		Hooks.on('renderChatMessage', onRenderChatMessage);
		Hooks.on('getChatLogEntryContext', onGetChatLogEntryContext);
	},
});
