'use strict';

// Supporting debug modules
const NeeoHelper = require('../NeeoHelper');
const Helper = new NeeoHelper('ziggo-horizon:mediabox');


// 3rd party modules
const Net = require('net');
const Promise = require('bluebird');
const http = require('http');

// Driver constants
const CONSTANTS = require('./constants');

/**
 * Main class
 */
class Mediabox {
	constructor(label, ip) {
		// Settings
		this.label = label;
		this.ip = ip;

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.digitTimer = null;
		this.digits = [];

		// Reconnect after
		this.reconnect(250);
	}

	/**
	 *
	 */
	getLabel() {
		return this.label;
	}

	/**
	 *
	 */
	getIp() {
		return this.ip;
	}

	/**
	 *
	 */
	isReachable() {
		return (this.connectionState === CONSTANTS.CONNECTION_STATE.CONNECTED);
	}

	/**
	 *
	 */
	debug(msg) {
		Helper.Debug('- ' + this.getLabel() + ': ' + msg);
	}

	/**
	 *
	 */
	reconnect(delay) {
		this.connectTimer = setTimeout(this.connect.bind(this), delay);
	}

	/**
	 *
	 */
	connect() {
		clearTimeout(this.connectTimer);
		this.debug('Connecting to ' + this.getIp() + ' (max. 10 seconds) ...');

		// Set a timeout after 10 seconds
		this.connectionTimeout = setTimeout(function() {
			_this.socket.removeAllListeners('close');
            _this.socket.destroy();
            _this.disconnected('BOX_CONNECTION_NOT_POSSIBLE');
        }, 10000);

		// Keep track of socket state
		var _this = this;
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
			var buffer = data.toJSON(data);

			switch (_this.connectionState) {
				case CONSTANTS.CONNECTION_STATE.DISCONNECTED:
					if (datastring.substring(0, 3) == 'RFB') {
						_this.debug('Received version message, returning it.');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTING;
						this.write(datastring);
					}
					break;
				case CONSTANTS.CONNECTION_STATE.CONNECTING:
					if (datastring == "\u0001\u0001") {
						_this.debug('Received OK message, returning: ' + Helper.Hex2Bin('01'));
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATING;
						this.write(Helper.Hex2Bin('01'));
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATING:
					if (datastring == "\u0000\u0000\u0000\u0000") {
						_this.debug('Received AUTH OK message');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.AUTHENTICATED;
					}
					break;
				case CONSTANTS.CONNECTION_STATE.AUTHENTICATED:
					clearTimeout(_this.connectionTimeout);

					if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
						_this.debug('Connected and ready to send commands.');
						_this.connectionState = CONSTANTS.CONNECTION_STATE.CONNECTED;
					}
					break;
			}
		});

		this.socket.on('timeout', this.disconnected.bind(this, 'BOX_CONNECTION_TIMEOUT'));
		this.socket.on('end', this.disconnected.bind(this, 'BOX_CONNECTION_ENDED'));
		this.socket.on('close', this.disconnected.bind(this, 'BOX_CONNECTION_CLOSED'));

		// Make the actual connection
		this.socket.connect(5900, this.getIp());
	}

	/**
	 *
	 */
	disconnected(reason) {
		this.connectionState = CONSTANTS.CONNECTION_STATE.DISCONNECTED;
		this.debug('Disconnected (' + reason + ')');

		// Reconnect after random time
		var reconnectDelay = Math.floor(Math.random() * 17) + 3;
		this.debug('Reconnecting after ' + reconnectDelay + ' seconds ...');
		this.reconnect(reconnectDelay * 1000);
	}

	/**
	 *
	 */
	addCommands(cmds) {
		this.socketCmds = this.socketCmds.concat(cmds);
		this.sendCommands();
	}

	/**
	 *
	 */
	sendCommands() {
		var _this = this;
		if (this.connectionState == CONSTANTS.CONNECTION_STATE.DISCONNECTED) {
			_this.disconnected('BOX_CONNECTION_CLOSED');
			return;
		}

		var _this = this;
		var cmds = this.socketCmds;
		this.socketCmds = [];
		Promise.mapSeries(cmds, function (cmd) {
			_this.socket.write(Helper.Hex2Bin("040100000000" + cmd));
			return Promise.delay(CONSTANTS.KEY_DELAY).then(function () {
				_this.socket.write(Helper.Hex2Bin("040000000000" + cmd));
			}).delay(CONSTANTS.KEY_DELAY);
		});
	}

	/**
	 *
	 */
	getPowerState() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			var request = http.get('http://' + _this.getIp() + ':62137/DeviceDescription.xml', function (res) {
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
	 *
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
	 *
	 */
	powerToggle() {
		this.addCommands([ CONSTANTS.BUTTON.POWER ]);
	}

	/**
	 *
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
		Helper.Debug('    - Switch to channel: ' + channel);

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
					this.debug(`error! ${btn} button pressed which is not mapped!`);
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
			this.digitTimer = setTimeout(function () {
				this.selectChannel();
			}, 1500);

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

		this.debug(`${btn} button pressed, resulting in ${cmd}`);
		this.addCommands([ cmd ]);
	}
}

module.exports = Mediabox;