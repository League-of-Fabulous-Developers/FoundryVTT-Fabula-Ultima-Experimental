/**
 * @callback ActionPermissionCheck
 * @param {foundry.abstract.Document} document - the document represented by the HTML
 * @param {Element} element - the HTML element that would trigger the action
 * @return boolean - if the user is allowed to execute the action
 */

/**
 * @typedef {ActionPermissionCheck} ActionAttachCheck
 */

/**
 * @callback ActionDisableCallback
 * @param {jQuery} jQuery - a jQuery object containing all elements that should be disabled
 * @param {foundry.abstract.Document} document - the document represented by the HTML
 */

/**
 * @typedef ActionOptions
 * @property {string} [dataAttribute="action"] - the name of the "data attribute" in the HTML, minus the leading "data-". Has to be exactly the same as in the HTML.
 * @property {boolean} [requireOwner=true] - if the action should only be possible for the owner of the document. Defaults to true, unless "hasPermission" is specified, then defaults to false
 * @property {ActionPermissionCheck} [hasPermission] - callback to check if the current user is allowed to perform the action
 * @property {ActionAttachCheck} [shouldAttach] - callback to check if listeners should be attached at all.
 * @property {"hide", "disable", ActionDisableCallback} [whenNotAllowed] - what to do with the action element in case performing the action is not allowed, defaults to "hide"
 */

/**
 * @callback ActionHandler
 * @param {foundry.abstract.Document} document - the document represented by the HTML
 * @param {Element} element - the HTML element that triggered the action
 * @param {Event} event - the event that triggered the action
 * @return {void, false} - void or false to stop event propagation, as described in https://api.jquery.com/on/#event-handler
 */

/**
 * Defines an action that will be triggered by a click on an HTML element.
 * If a user is not allowed to trigger the action, the element will be hidden from them.
 */
export class Action {
	/**
	 * Attach multiple actions in one call.
	 * @param {foundry.abstract.Document} document - the document represented by the HTML
	 * @param {jQuery} jQuery - the "top level" jQuery object for the HTML representing the document, usually available as a hook param
	 * @param {Action} actions - the actions to attach
	 */
	static attachAll(document, jQuery, ...actions) {
		actions.forEach((action) => action.attach(document, jQuery));
	}

	/** @type string */
	#action;
	/** @type ActionOptions */
	#options = {};
	/** @type ActionHandler */
	#actionHandler;

	/**
	 * Configure a new action.
	 * @param {string} action - the action, the expected value in the data attribute
	 * @param {ActionHandler} actionHandler - the action that gets executed by clicking the matched elements
	 * @param {ActionOptions} [options] - configuration options for the action
	 */
	constructor(action, actionHandler, options = {}) {
		this.#action = action;
		this.#actionHandler = actionHandler;
		this.#options.dataAttribute = options.dataAttribute ?? 'action';
		this.#options.requireOwner = options.requireOwner ?? !(typeof options.hasPermission === 'function');
		this.#options.hasPermission = options.hasPermission;
		this.#options.shouldAttach = options.shouldAttach;
		if (typeof options.whenNotAllowed === 'function') {
			this.#options.whenNotAllowed = options.whenNotAllowed;
		} else if (options.whenNotAllowed === 'disable') {
			this.#options.whenNotAllowed = this.#disableElements;
		} else {
			this.#options.whenNotAllowed = this.#hideElements;
		}
	}

	/**
	 * Attach the action to the document and HTML
	 * @param {foundry.abstract.Document} document - the document represented by the HTML
	 * @param {jQuery} jQuery - the "top level" jQuery object for the HTML representing the document, usually available as a hook param
	 */
	attach(document, jQuery) {
		if (typeof this.#options.shouldAttach === 'function' && !this.#options.shouldAttach(document, jQuery)) {
			return;
		}
		const queryString = `[data-${this.#options.dataAttribute}="${this.#action}"]`;
		let actionElements = jQuery.find(queryString);
		if (actionElements && actionElements.length) {
			if (this.#options.requireOwner && !document.testUserPermission(game.user, 'OWNER')) {
				this.#options.whenNotAllowed(actionElements, document);
			} else {
				if (typeof this.#options.hasPermission === 'function') {
					const grouped = {
						true: [],
						false: [],
					};
					const _hasPermission = this.#options.hasPermission;
					actionElements.each(function () {
						const hasPermission = _hasPermission(document, this);
						grouped[hasPermission].push(this);
					});

					this.#options.whenNotAllowed($(grouped[false]), document);

					actionElements = $(grouped[true]);
				}

				const _actionHandler = this.#actionHandler;
				actionElements.on('click', function (event) {
					return _actionHandler(document, this, event);
				});
			}
		}
	}

	/**
	 * @param {jQuery} jQuery
	 */
	#hideElements(jQuery) {
		jQuery.addClass('action-hidden');
	}

	/**
	 * @param {jQuery} jQuery
	 */
	#disableElements(jQuery) {
		jQuery.addClass('action-disabled');
	}
}
