'use strict';

const Debug = require('debug')('ziggo-horizon:controller');
const Util = require('util');
Debug.log = () => {
	process.stderr.write('[' + new Date().toISOString() + '] ' + Util.format.apply(Util, arguments) + '\n');
}
const Config = require('./config-has');
const EventEmitter = require('events');
const Ssdp = require('node-ssdp').Client;
const Net = require('net');
const Promise = require('bluebird');
const http = require('http');

/**
 * Convert a hexadecimal string into its binary representation.
 */
var Hex2Bin = (s) => {
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
	POWER2: 'ef15',		// POWER
	ID: 'ef16',		// ID
	RC_PAIR: 'ef17',	// RC PAIRING
	TIMINGS: 'ef19'		// TIMINGS
}

/**
 * Delay to send inbetween keydown/keyup.
 */
const keyDelay = 100;

/**
 * Main class
 */
class HorizonController extends EventEmitter {
	constructor() {
		super();

		// If we have a hardcoded IP, connect to it
		this.mediaboxIp = Config.hasOr('Mediabox.IP', '');

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.digitTimer = null;
		this.digits = [];
	}

	findBox() {
		var _this = this;

		// Initialize random reconnect delay
		this.reconnectDelay = Math.floor(Math.random() * 17) + 3;

		Debug('* Searching for Horizon Mediabox XL ...');
		if (this.mediaboxIp != '') {
			Debug(' - Found a box with IP: ' + this.mediaboxIp);
			this.emit('found', this.mediaboxIp);
			return;
		}

		// Initiate SSDP search
		var millis = Config.hasOr('Driver.SsdpTimeout', 15000);
		var minutes = Math.floor(millis / 60000);
		minutes = (minutes == 0) ? '' : (minutes + ' minute' + ((minutes > 1) ? 's' : ''));

		var seconds = ((millis % 60000) / 1000).toFixed(0);
		seconds = (seconds == 0) ? '' : (seconds + ' second' + ((seconds > 1) ? 's' : ''));
		if ((minutes != '') && (seconds != '')) {
			minutes = minutes + ' and ';
		}

		// Set timeout
		const ssdpClient = new Ssdp({ 'explicitSocketBind': true });
		const ssdpTimeout = setTimeout(() => {
			clearTimeout(ssdpTimeout);

			Debug('  - Timeout occured after ' + minutes + seconds + '!');
			_this.boxDisconnected('BOX_NOT_FOUND');
		}, millis);

		// Start search
		ssdpClient.on('response', (headers, statusCode, rinfo) => {
			// If we get a redsonic user agent ...
			if (headers['X-USER-AGENT'] == 'redsonic') {
				// We download the description XML ...
				http.get(headers['LOCATION'], (res) => {
					const { statusCode } = res;
					const contentType = res.headers['content-type'];

					let error;
					if (statusCode !== 200) {
						error = new Error('Request Failed.\n' + `Status Code: ${statusCode}`);
					} else if (!/^text\/xml/.test(contentType)) {
						error = new Error('Invalid content-type.\n' + `Expected text/xml but received ${contentType}`);
					}

					if (error) {
						console.error(error.message);
						res.resume();
						return;
					}

					res.setEncoding('utf8');
					let rawData = '';
					res.on('data', (chunk) => { rawData += chunk; });
					res.on('end', () => {
						try {
							// We parse the result ...
							var parseString = require('xml2js').parseString;
							parseString(rawData, (err, result) => {
								// ... and if all goes well, we have found a box
								var modelName = result.root.device[0].modelName[0];
								var modelDescription = result.root.device[0].modelDescription[0];
								if (modelName.startsWith('SMT-G74') && modelDescription.startsWith('UPC')) {
									clearTimeout(ssdpTimeout);
									_this.mediaboxIp = rinfo.address;

									Debug('  - Found a ' + modelDescription + ' (' + modelName + ')');
									_this.emit('found', _this.mediaboxIp);
									ssdpClient.stop();
								}
							});
						} catch (e) {
							console.error(`Got error: ${e.message}`);
						}
					});
				}).on('error', (e) => {
					console.error(`Got error: ${e.message}`);
				});
			}
		});
		ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');
	}

	connectBox() {
		Debug('* Connecting to Horizon Mediabox XL with IP ' + this.mediaboxIp + ' ...');

		// Keep track of socket state
		var _this = this;
		this.socketCmds = [];
		this.connectionState = ConnectionState.DISCONNECTED;
		this.socket = new Net.Socket();
		this.socket.setKeepAlive(true, 5000);
		this.socket.setTimeout(0);

		this.socket.on('error', (ex) => {
			_this.emit('error', ex);

			if (ex.code === 'ECONNREFUSED') {
				_this.boxDisconnected('BOX_CONNECTION_REFUSED');
				return;
			}

			if (ex.code === 'ECONNRESET') {
				_this.boxDisconnected('BOX_CONNECTION_RESET');
				return;
			}
		});

		this.socket.on('data', (data) => {
			var datastring = data.toString();
			var buffer = data.toJSON(data);

			switch (_this.connectionState) {
				case ConnectionState.DISCONNECTED:
					if (datastring.substring(0, 3) == 'RFB') {
						Debug('  - Received version message, returning it.');
						_this.connectionState = ConnectionState.CONNECTING;
						this.write(datastring);
					}
					break;
				case ConnectionState.CONNECTING:
					if (datastring == "\u0001\u0001") {
						Debug('  - Received OK message, returning: ' + Hex2Bin('01'));
						_this.connectionState = ConnectionState.AUTHENTICATING;
						this.write(Hex2Bin('01'));
					}
					break;
				case ConnectionState.AUTHENTICATING:
					if (datastring == "\u0000\u0000\u0000\u0000") {
						Debug('  - Received AUTH OK message');
						_this.connectionState = ConnectionState.AUTHENTICATED;
					}
					break;
				case ConnectionState.AUTHENTICATED:
					if (datastring == "\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000\u0000") {
						Debug('  - Connected and ready to send commands.');
						_this.connectionState = ConnectionState.CONNECTED;
						_this.emit('connected');
					}
					break;
			}
		});

		this.socket.on('timeout', this.boxDisconnected.bind('BOX_CONNECTION_TIMEOUT'));
		this.socket.on('end', this.boxDisconnected.bind('BOX_CONNECTION_CLOSED'));
		this.socket.on('close', this.boxDisconnected.bind('BOX_CONNECTION_CLOSED'));

		// Make the actual connection
		this.socket.connect(5900, this.mediaboxIp);
	}

	boxDisconnected(reason) {
		this.connectionState = ConnectionState.DISCONNECTED;
		this.emit('disconnected', reason);
	}

	addCommands(cmds) {
		this.socketCmds = this.socketCmds.concat(cmds);
		this.sendCommands();
	}

	sendCommands() {
		var _this = this;
		if (this.connectionState == ConnectionState.DISCONNECTED) {
			_this.boxDisconnected('BOX_CONNECTION_CLOSED');
			return;
		}

		var _this = this;
		var cmds = this.socketCmds;
		this.socketCmds = [];
		Promise.mapSeries(cmds, (cmd) => {
			_this.socket.write(Hex2Bin("040100000000" + cmd));
			return Promise.delay(keyDelay).then(() => {
				_this.socket.write(Hex2Bin("040000000000" + cmd));
			}).delay(keyDelay);
		});
	}

	isPoweredOn() {
		var _this = this;
		return new Promise((resolve, reject) => {
			var request = http.get('http://' + _this.mediaboxIp + ':62137/DeviceDescription.xml', (res) => {
				resolve();
			}).on('error', (e) => {
				reject(e);
			});
			request.setTimeout(2000, () => {
				reject('timeout');
			});
		})
	}

	powerOn() {
		var _this = this;
		this.isPoweredOn().then(() => { }, () => { _this.powerToggle(); });
	}

	powerOff() {
		var _this = this;
		this.isPoweredOn().then(() => { _this.powerToggle(); }, () => { });
	}

	powerToggle() {
		this.addCommands([buttonMapping['POWER']]);
	}

	selectChannel() {
		clearTimeout(this.digitTimer);
		var cmds = this.digits;
		this.digits = [];

		// For debugging
		var channel = '';
		for (var i = 0; i < cmds.length; i++) {
			channel += cmds[i].substr(3, 1);
		}
		Debug('* Switch to channel: ' + channel);

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
					Debug(`${btn} button pressed which is not mapped!`);
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

		Debug(`* ${btn} button pressed, resulting in ${cmd}`);
		this.addCommands([cmd]);
	}
}

module.exports = HorizonController;
