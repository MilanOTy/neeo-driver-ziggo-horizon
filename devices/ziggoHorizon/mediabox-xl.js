'use strict';

// Supporting debug modules
const Config = require('../config-has');
const Util = require('util');
const Debug = require('debug')('ziggo-horizon:mediabox-xl');
Debug.log = function () {
	process.stderr.write('[' + new Date().toISOString() + '] ' + Util.format.apply(Util, arguments) + '\n');
}

// 3rd party modules
const EventEmitter = require('events');
const Net = require('net');
const Promise = require('bluebird');
const http = require('http');

// Driver constants
const CONSTANTS = require('./constants');

/**
 * Convert a hexadecimal string into its binary representation.
 */
function Hex2Bin(s) {
	return new Buffer(s, "hex");
}

/**
 * Main class
 */
class MediaboxXl extends EventEmitter {
	constructor(label, ip) {
		super();

		// Settings
		this.label = label;
		this.ip = ip;

		// This keeps an array of digits, to make it possible to send just one 'command' for changing to channel e.g. "311" instead of 3 seperate connections.
		this.digitTimer = null;
		this.digits = [];
	}

	getLabel() {
		return this.label;
	}

	isReachable() {
		return true;
	}
}

module.exports = MediaboxXl;