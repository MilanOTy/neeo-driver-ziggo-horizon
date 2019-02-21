'use strict';

// Supporting debug modules
const WebunitySdkHelperModule = require('./webunitySdkHelper');
const WebunitySdkHelper = new WebunitySdkHelperModule('ziggo-horizon:mediabox');

// 3rd party modules
const EventEmitter = require('events');
const Http = require('http');
const Net = require('net');
const Promise = require('bluebird');

// Driver constants
const CONSTANTS = require('./constants');

/**
 * Mediabox class
 */
class Mediabox extends EventEmitter {
	/**
	 * Constructor
	 */
	constructor(modelName, modelDescription, ipAddress) {
		super();

		// Settings
		this.modelName = modelName;
		this.modelDescription = modelDescription;
		this.ipAddress = ipAddress;

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.channelSelectTimer = null;
		this.channelDigits = [];

		// Reconnect after
		this.reconnect(250);
	}

	/**
	 * Debug helper
	 */
	_debug(msg) {
		WebunitySdkHelper.Debug('- ' + this.getModelDescription() + ': ' + msg);
	}

	/**
	 * @return The model name
	 */
	getModelName() {
		return this.modelName;
	}

	/**
	 * @return The model description
	 */
	getModelDescription() {
		return this.modelDescription;
	}

	/**
	 * @return The IP address
	 */
	getIpAddress() {
		return this.ipAddress;
	}

	/**
	 * Determines if the box is reachable
	 * @return Boolean indicating reachability status
	 */
	isReachable() {
		return (this.connectionState === CONSTANTS.CONNECTION_STATE.CONNECTED);
	}

	/**
	 * Reconnect after 'x' time
	 * @param delay time to delay the reconnection (in milliseconds)
	 */
	reconnect(delay) {
		this.connectTimer = setTimeout(this.connect.bind(this), delay);
	}

	/**
	 * Convert a hexadecimal string into its binary representation.
	 * @return binary representation  of the hexadecimal value
	 */
	Hex2Bin(s) {
		return Buffer.from(s, 'hex')
		//return new Buffer(s, "hex");
	}

	/**
	*
	*/
	Bin2Hex(s) {
		return parseInt(s, 2).toString(16);
	}

	/**
	 * Connects to the box with a timeout of 10 seconds
	 */
	connect() {
		var _this = this;
		this._debug('Connecting to ' + this.getIpAddress() + ' (max. 10 seconds) ...');
		clearTimeout(this.connectTimer);

		// Set a timeout after 10 seconds
		this.connectionTimeout = setTimeout(function() {
			clearTimeout(_this.connectionTimeout);
			_this.socket.removeAllListeners('close');
			_this.socket.destroy();
			_this.disconnected('BOX_CONNECTION_NOT_POSSIBLE');
		}, 10000);

		// Keep track of socket state
		this.connectionState = CONSTANTS.CONNECTION_STATE.DISCONNECTED;
		this.socket = new Net.Socket();
		this.socket.setKeepAlive(true, 5000);

		this.socket.on('error', function (ex) {
			if (ex.code === 'ETIMEDOUT') {
				_this.disconnected('BOX_CONNECTION_TIMEOUT');
				return;
			}

			if (ex.code === 'ECONNREFUSED') {
				_this.disconnected('BOX_CONNECTION_REFUSED');
				return;
			}

			if (ex.code === 'ECONNRESET') {
				_this.disconnected('BOX_CONNECTION_RESET');
				return;
			}
		});

		this.socket.on('data', function (data) {
			var datastring = data.toString();
			//var buffer = data.toJSON(data);

			switch (_this.connectionState) {
				case CONSTANTS.CONNECTION_STATE.DISCONNECTED:
					if (datastring.substring(0, 3) == 'RFB') {
						_this._debug('Received version message "' + datastring.substring(0, 11) + '", returning it.');
						this.write(datastring);
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTING;
						_this.emit('StateChanged', 'CONNECTING');
					}
					break;
				case CONSTANTS.CONNECTION_STATE.CONNECTING:
					if (datastring == "\u0001\u0001") {
						_this._debug('Received OK message');
						this.write(_this.Hex2Bin('01'));
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATING;
						_this.emit('StateChanged', 'AUTHENTICATING');
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATING:
					if (datastring == "\u0000\u0000\u0000\u0000") {
						_this._debug('Received AUTH OK message');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATED;
						_this.emit('StateChanged', 'AUTHENTICATED');
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATED:
					clearTimeout(_this.connectionTimeout);

					if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
						_this._debug('Connected and ready to send commands.');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
						_this.emit('StateChanged', 'CONNECTED');
					}
					break;
				case CONSTANTS.CONNECTION_STATE.CONNECTED:
					_this._debug('Received data:');
					_this._debug(datastring);
					_this.emit('DataReceived', datastring);
					break;
			}
		});

		this.socket.on('timeout', this.disconnected.bind(this, 'BOX_CONNECTION_TIMEOUT'));
		this.socket.on('end', this.disconnected.bind(this, 'BOX_CONNECTION_ENDED'));
		this.socket.on('close', this.disconnected.bind(this, 'BOX_CONNECTION_CLOSED'));

		// Make the actual connection
		this.socket.connect(5900, this.getIpAddress());
	}

	/**
	 * Occurs when the box is disconnected
	 * @param reason The reason why we disconnected
	 */
	disconnected(reason) {
		clearTimeout(this.connectionTimeout);
		this._debug('Disconnected (' + reason + ')');
		this.connectionState = CONSTANTS.CONNECTION_STATE.DISCONNECTED;
		this.emit('StateChanged', 'DISCONNECTED', reason);

		// Reconnect after random time
		var reconnectDelay = Math.floor(Math.random() * 8) + 3;
		this._debug('Reconnecting after ' + reconnectDelay + ' seconds ...');
		this.reconnect(reconnectDelay * 1000);
	}

	/**
	 * Sends the actual commands to the box
	 */
	sendCommands(cmds) {
		var _this = this;
		if (this.connectionState == CONSTANTS.CONNECTION_STATE.DISCONNECTED) {
			this.disconnected('BOX_CONNECTION_CLOSED');
			return;
		}

		Promise.mapSeries(cmds, function (cmd) {
			//
			// For event emitter & debugging
			var btnDown = '040100000000' + cmd;
			var btnDownBin = _this.Hex2Bin(btnDown);
			var btnUp = '040000000000' + cmd;
			var btnUpBin = _this.Hex2Bin(btnUp);
			_this.emit('SendCommand', cmd, btnDown, btnUp, btnDownBin, btnUpBin);

			//
			// Send keydown event
			_this.socket.write(btnDownBin);

			//
			// Return promise which sends keyUp event after KEY_DELAY
			return Promise.delay(CONSTANTS.KEY_DELAY).then(function () {
				_this.socket.write(btnUpBin);
			}).delay(CONSTANTS.KEY_DELAY);
		});
	}

	/**
	 * Returns if the box is on
	 * @return boolean
	 */
	getPowerState() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			var request = Http.get('http://' + _this.getIpAddress() + ':62137/DeviceDescription.xml', function (res) {
				resolve(true);
			}).on('error', function (e) {
				resolve(false);
			});
			request.setTimeout(5000, function () {
				resolve(false);
			});
		})
	}

	/**
	 * Turns on or turns off the box if needed
	 * @param desiredPowerState Self explanatory
	 */
	powerToggleIfNotState(desiredPowerState) {
		var _this = this;
		this.getPowerState()
			.then(function (currentPowerState) {
				if (currentPowerState !== desiredPowerState) {
					_this.powerToggle();
				}
			});
	}

	/**
	 * Toggles the power state
	 */
	powerToggle() {
		this.sendCommands([ 'e000' ]);
	}

	/**
	 * Selects the specified channel
	 */
	selectChannel() {
		clearTimeout(this.channelSelectTimer);
		var cmds = this.channelDigits;
		this.channelDigits = [];

		// For debugging
		var channel = '';
		for (var i = 0; i < cmds.length; i++) {
			channel += cmds[i].substr(3, 1);
		}
		this._debug('	- Switch to channel: ' + channel);

		// Add 'return' key for faster switching
		cmds.push(CONSTANTS.BUTTON.CURSOR_ENTER);

		// Send the command
		this.sendCommands(cmds);
	}

	/*
	 *
	 */
	onButtonPressed(btn) {
		// Don't know if this is needed but it makes testing easier.
		btn = btn.toUpperCase().replace(/ /g, '_');
		this._debug('Button pressed: ' + btn);
		this.emit('ButtonPressed', btn);

		// Reset 'channel selection' timer
		clearTimeout(this.channelSelectTimer);

		// Some custom command or unmapped command
		if (!(btn in CONSTANTS.BUTTON)) {
			switch (btn) {
				case 'POWER_ON':
					this.powerToggleIfNotState(true);
					break;
				case 'POWER_OFF':
					this.powerToggleIfNotState(false);
					break;
				default:
					this._debug('^ BUTTON NOT MAPPED!');
					break;
			}
			return;
		}

		// In all other cases we should have support for it.
		var cmd = CONSTANTS.BUTTON[btn];

		// Channel support
		if (btn.substr(0, 5) != 'DIGIT') {
			this.channelDigits = [];
			this.sendCommands([ cmd ]);
		} else {
			// Reset timer
			this.channelSelectTimer = setTimeout(this.selectChannel.bind(this), 1500);

			// Add this digit to the stack
			this.channelDigits.push(cmd);

			// If we have a length of 3, then the choice is definite.
			if (this.channelDigits.length == 3) {
				this.selectChannel();
			}
		}
	}

	/**
	 * Favorites according to: https://neeoinc.github.io/neeo-sdk/#src-lib-models-devicebuilder.ts-registerfavoritehandlers
	 */
	onFavoritePressed(favoriteId) {
		this._debug('Favorite pressed: ' + favoriteId);
		this.emit('FavoritePressed', favoriteId);

		if (favoriteId == null || favoriteId.length === 0) {
			this._debug('- FavoriteId was empty!');
			return;
		}

		// String should be full digits
		const regex = /^(\d+)$/gm;
		if (!regex.test(favoriteId)) {
			this._debug('- FavoriteId was not all digits!');
			return;
		}

		// Loop through digits
		var favoriteCmds = [];
		for (var i = 0; i < favoriteId.length; i++) {
			favoriteCmds.push(CONSTANTS.BUTTON['DIGIT_' + favoriteId.charAt(i)]);
		}

		// Add 'return' to make box know we are done with channel selection
		favoriteCmds.push(CONSTANTS.BUTTON.CURSOR_ENTER);
		this.sendCommands(favoriteCmds);
	}

}

module.exports = Mediabox;
