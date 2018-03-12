const winston = require('winston');

/**
 * Manages client subscriptions.
 */
class SubscriptionManager {
	/**
	 * Creates a subscription manager.
	 * @param {object} subscriptionCallbacks Callbacks to invoke in response to subscription changes.
	 */
	constructor(subscriptionCallbacks) {
		this.subscriptions = {};
		this.callbacks = Object.assign({ newClient: () => {} }, subscriptionCallbacks);
	}

	/**
	 * Subscribes a client to a channel.
	 * @param {string} channel The channel to subscribe.
	 * @param {object} client The client.
	 */
	add(channel, client) {
		if (!(channel in this.subscriptions)) {
			this.subscriptions[channel] = new Set();
			try {
				this.callbacks.newChannel(channel, this.subscriptions[channel]);
			} catch (err) {
				delete this.subscriptions[channel];
				throw err;
			}
		}

		if (this.subscriptions[channel].has(client))
			return;

		this.subscriptions[channel].add(client);
		this.callbacks.newClient(channel, client);
	}

	/**
	 * Unsubscribes a client from a channel.
	 * @param {string} channel The channel to unsubscribe.
	 * @param {object} client The client.
	 */
	delete(channel, client) {
		const subscriptions = this.subscriptions[channel];
		if (!subscriptions)
			return;

		subscriptions.delete(client);
		if (!subscriptions.size) {
			delete this.subscriptions[channel];
			winston.debug(`all subscriptions to channel '${channel}' have been removed`);
			this.callbacks.removeChannel(channel);
		}
	}

	/**
	 * Gets all active subscriptions for a client.
	 * @param {object} client The client.
	 * @returns {array<string>} The client's subscribed channels.
	 */
	clientSubscriptions(client) {
		return Object.keys(this.subscriptions).filter(channel => this.subscriptions[channel].has(client));
	}

	/**
	 * Unsubscribes a client from all channels.
	 * @param {object} client The client.
	 */
	deleteClient(client) {
		Object.keys(this.subscriptions).forEach(channel => {
			this.delete(channel, client);
		});
	}
}

module.exports = SubscriptionManager;