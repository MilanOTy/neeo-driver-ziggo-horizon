'use strict';

const Net = require('net');
const Promise = require('bluebird');

/**
 * Convert a hexadecimal string into its binary representation.
 */
function Hex2Bin(s) {
	return new Buffer(s, "hex");
}

/**
 * Different connection states
 */
const ConnectionState = {
	DISCONNECTED: 0,
	CONNECTING: 1,
	AUTHENTICATING: 2,
	AUTHENTICATED: 3,
	CONNECTED: 4
}

const buttonMapping = {
	MENU: 'e00a',
	BACK: 'e002',
	CHANNEL_UP: 'e006',
	CHANNEL_DOWN: 'e007',
	CURSOR_UP: 'e100',
	CURSOR_DOWN: 'e101',
	CURSOR_LEFT: 'e102',
	CURSOR_RIGHT: 'e103',
	CURSOR_ENTER: 'e001',
	DIGIT_0: 'e300',
	DIGIT_1: 'e301',
	DIGIT_2: 'e302',
	DIGIT_3: 'e303',
	DIGIT_4: 'e304',
	DIGIT_5: 'e305',
	DIGIT_6: 'e306',
	DIGIT_7: 'e307',
	DIGIT_8: 'e308',
	DIGIT_9: 'e309',
	PLAY: 'e400',
	PAUSE: 'e400',
	STOP: 'e402',
	REVERSE: 'e407',
	FORWARD: 'e405',
	PREVIOUS: 'e102',
	NEXT: 'e103',
	SKIP_SECONDS_BACKWARD: 'e407',
	SKIP_SECONDS_FORWARD: 'e405',
	MY_RECORDINGS: 'ef29',
	RECORD: 'e403',
	LIVE: 'ef2a',
	// Custom commands:
	POWER: 'e000',
	ONDEMAND: 'ef28',
	HELP: 'e009',
	GUIDE: 'e00b',
	INFO: 'e00e',
	TEXT: 'e00f',
	MENU1: 'e011',
	MENU2: 'e015',
	MENU3: 'ef00',
	TIMESHIFT_INFO: 'ef06',	// TIMESHIFT INFO
	POWER2: 'ef15',  			// POWER
	ID: 'ef16',					// ID
	RC_PAIR: 'ef17',			// RC PAIRING
	TIMINGS: 'ef19'			// TIMINGS
}

/**
 * Delay to send inbetween keydown/keyup.
 */
const keyDelay = 100;

/**
 * Main class
 */
module.exports = class MediaboxXl {
	constructor(mediaboxIp) {
		this.mediaboxIp = mediaboxIp;

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.digitTimer = null;
		this.digits = [];

		// Keep track of socket state
		var _this = this;
		this.socketCmds = [];
		this.socketState = ConnectionState.DISCONNECTED;
		this.socket = new Net.Socket();
		this.socket.on('data', function(data) {
			var datastring = data.toString();
			var buffer = data.toJSON(data);

			if (_this.socketState == ConnectionState.DISCONNECTED) {
				if (datastring.substring(0, 3) == 'RFB') {
					_this.debug('Received version message, returning it.');
					_this.socketState = ConnectionState.CONNECTING;
					this.write(datastring);
					return;
				}
			}

			// Send Authorisation type (none)
			if (_this.socketState == ConnectionState.CONNECTING) {
				if (datastring == "\u0001\u0001") {
					_this.debug('received OK message, returning: ' + Hex2Bin('01'));
					_this.socketState = ConnectionState.AUTHENTICATING;
					this.write(Hex2Bin('01'));
					return;
				}
			}

			if (_this.socketState == ConnectionState.AUTHENTICATING) {
				if (datastring == "\u0000\u0000\u0000\u0000") {
					_this.debug('received AUTH OK message');
					_this.socketState = ConnectionState.AUTHENTICATED;
					return;
				}
			}

			if (_this.socketState == ConnectionState.AUTHENTICATED) {
				if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
					_this.debug('ready to send commands.');
					_this.socketState = ConnectionState.CONNECTED;

					// Now send the commands
					_this.sendCommands();
					return;
				}
			}
		});

		this.socket.on('close', function() {
			_this.debug('Connection closed');
			_this.socketState = ConnectionState.DISCONNECTED;
			//this.end();
		});
	}

	debug(msg) {
		console.log(msg);
	}

	addCommands(cmds) {
		this.socketCmds = this.socketCmds.concat(cmds);
		if (this.socketState == ConnectionState.CONNECTED) {
			this.sendCommands();
			return;
		}

		if (this.socketState == ConnectionState.DISCONNECTED) {
			this.socket.connect(5900, this.mediaboxIp);
		}
	}

	sendCommands() {
		var _this = this;
		var cmds = this.socketCmds;
		this.socketCmds = [];
		Promise.mapSeries(cmds, function(cmd) {
				_this.socket.write(Hex2Bin("040100000000" + cmd));
				return Promise.delay(keyDelay).then(function() {
					_this.socket.write(Hex2Bin("040000000000" + cmd));
				}).delay(keyDelay);
			}).then(function() {
				//socket.destroy();
			});
	}

	isPoweredOn() {
		return false;
	}

	powerOn() {
		if (!this.isPoweredOn()) {
			this.powerToggle();
		}
	}

	powerOff() {
		if (this.isPoweredOn()) {
			this.powerToggle();
		}
	}

	powerToggle() {
		this.addCommands([ buttonMapping['POWER'] ]);
	}

	selectChannel() {
		clearTimeout(this.digitTimer);
		var cmds = this.digits;
		this.digits = [];

		// For debugging
		var channel = '';
		for (var i = 0; i < cmds.length; i++) {
			channel+= cmds[i].substr(3, 1);
		}
		this.debug('Should switch to channel: ' + channel);

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
		if (!(btn in buttonMapping)) {
			switch (btn) {
				case 'POWER_ON':
					this.powerOn();
					break;
				case 'POWER_OFF':
					this.powerOff();
					break;
				default:
					this.debug(`[CONTROLLER] ${btn} button pressed`);
					break;
			}
			return;
		}

		// In all other cases we should have support for it.
		var cmd = buttonMapping[btn];

		// Channel support
		if (btn.substr(0, 5) == 'DIGIT') {
			// Reset timer
			clearTimeout(this.digitTimer);
			this.digitTimer = setTimeout(() => {
					this.selectChannel();
				}, 1000);

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

		this.debug(`[CONTROLLER] ${btn} button pressed`);
		this.debug('Command: ' + cmd);
		this.addCommands([ cmd ]);
	}
}

/*
	var Net = require('net');

	function Hex2Bin (s) {
		return new Buffer(s, "hex");
	}

	//open on port 5900
	var client = new Net.Socket();
	client.on('error', function(err){
		console.log("Error: " + err.message);
	});

	client.on('close', function() {
		console.log('Connection closed');
		client.destroy();
	});

	var cmd = 'ef2a';

	client.on('data', function(data) {
		var datastring = data.toString();
		var buffer = data.toJSON(data);
		console.log ('buffer = ' + JSON.stringify(buffer.data));

		//readVersionMsg
		if (datastring.substring(0,3) == 'RFB') {
			console.log('Received version message, returning it.');
			client.write (datastring);
		} else if (datastring == "\u0001\u0001") {
			console.log('received OK message, returning it.');
			client.write (Hex2Bin('01'));	// Send Authorisation type (none)
		} else if (datastring == "\u0000\u0000\u0000\u0000") {
			console.log('received AUTH OK message');
		} else if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
			console.log('Received init data');
			console.log ('sending: ' + "040100000000" + cmd);
			console.log ('sending: ' + Hex2Bin("040100000000" + cmd));
			client.write(Hex2Bin("040100000000" + cmd)); // Turn key on
			setTimeout(function() {
				console.log ('turn key off');
				client.write(Hex2Bin("040000000000" + cmd));
				client.destroy();
			}, 400); // Turn key off
		} else {
			console.log ('unrecognized datastring=' + JSON.stringify(datastring));
		}
	});

	client.connect(5900, this.mediaboxIP);
*/