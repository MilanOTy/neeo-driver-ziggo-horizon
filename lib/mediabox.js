'use strict';

// Supporting debug modules
const NeeoHelper = require('./NeeoHelper');
const Helper = new NeeoHelper('ziggo-horizon:mediabox');


// 3rd party modules
const Net = require('net');
const Promise = require('bluebird');
const http = require('http');

// Driver constants
const CONSTANTS = require('./constants');

/**
 * Mediabox class
 */
class Mediabox {
	/**
	 * Constructor
	 */
	constructor(modelName, modelDescription, ipAddress) {
		// Settings
		this.modelName = modelName;
		this.modelDescription = modelDescription;
		this.ipAddress = ipAddress;

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.digitTimer = null;
		this.digits = [];

		// Reconnect after
		this.reconnect(250);
	}

	/**
	 * Debug helper
	 */
	_debug(msg) {
		Helper.Debug('- ' + this.getModelDescription() + ': ' + msg);
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
		return new Buffer(s, "hex");
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
		this.socketCmds = [];
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
						_this._debug('Received version message, returning it.');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTING;
						this.write(datastring);
					}
					break;
				case CONSTANTS.CONNECTION_STATE.CONNECTING:
					if (datastring == "\u0001\u0001") {
						_this._debug('Received OK message, returning: ' + _this.Hex2Bin('01'));
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATING;
						this.write(_this.Hex2Bin('01'));
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATING:
					if (datastring == "\u0000\u0000\u0000\u0000") {
						_this._debug('Received AUTH OK message');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATED;
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATED:
					clearTimeout(_this.connectionTimeout);

					if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
						_this._debug('Connected and ready to send commands.');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
					}
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
		this.connectionState = CONSTANTS.CONNECTION_STATE.DISCONNECTED;
		this._debug('Disconnected (' + reason + ')');

		// Reconnect after random time
		var reconnectDelay = Math.floor(Math.random() * 17) + 3;
		this._debug('Reconnecting after ' + reconnectDelay + ' seconds ...');
		this.reconnect(reconnectDelay * 1000);
	}

	/**
	 * Adds a command to the list of commands we have to send
	 * @param cmds The commands to send
	 */
	addCommands(cmds) {
		this.socketCmds = this.socketCmds.concat(cmds);
		this.sendCommands();
	}

	/**
	 * Sends the actual commands to the box
	 */
	sendCommands() {
		var _this = this;
		if (this.connectionState == CONSTANTS.CONNECTION_STATE.DISCONNECTED) {
			_this.disconnected('BOX_CONNECTION_CLOSED');
			return;
		}

		var cmds = this.socketCmds;
		this.socketCmds = [];
		Promise.mapSeries(cmds, function (cmd) {
			_this.socket.write(_this.Hex2Bin("040100000000" + cmd));
			return Promise.delay(CONSTANTS.KEY_DELAY).then(function () {
				_this.socket.write(_this.Hex2Bin("040000000000" + cmd));
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
			var request = http.get('http://' + _this.getIpAddress() + ':62137/DeviceDescription.xml', function (res) {
				resolve(true);
			}).on('error', function (e) {
				resolve(false);
			});
			request.setTimeout(2000, function () {
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
		this.addCommands([ CONSTANTS.BUTTON.POWER ]);
	}

	/**
	 * Selects the specified channel
	 */
	selectChannel() {
		clearTimeout(this.digitTimer);
		var cmds = this.digits;
		this.digits = [];

		// For debugging
		var channel = '';
		for (var i = 0; i < cmds.length; i++) {
			channel += cmds[i].substr(3, 1);
		}
		this._debug('	- Switch to channel: ' + channel);

		// Send the command
		this.addCommands(cmds);
	}

	/*
	 * Device Controller
	 * Events on that device from the Brain will be forwarded here for handling.
	 * NOTE: there are no multiple devices support for this example, so only the button is passed
	 */
	onButtonPressed(btn) {
		// Don't know if this is needed but it makes testing easier.
		btn = btn.toUpperCase().replace(/ /g, '_');
		this._debug('Button pressed: ' + btn);

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
		if (btn.substr(0, 5) == 'DIGIT') {
			// Reset timer
			clearTimeout(this.digitTimer);
			this.digitTimer = setTimeout(this.selectChannel.bind(this), 1500);

			// Add this digit to the stack
			this.digits.push(cmd);

			// If we have a length of 3, then the choice is definite.
			if (this.digits.length == 3) {
				this.selectChannel();
			}
			return;
		}

		// If we have a digit pre-selected, cancel this
		if (this.digits.length > 0) {
			clearTimeout(this.digitTimer);
			this.digits = [];
		}

		this.addCommands([ cmd ]);
	}
}

module.exports = Mediabox;
