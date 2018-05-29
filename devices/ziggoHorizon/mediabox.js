'use strict';

// Supporting debug modules
const NeeoHelper = require('../NeeoHelper');
const Helper = new NeeoHelper('ziggo-horizon:mediabox');


// 3rd party modules
const EventEmitter = require('events');
const Net = require('net');
const Promise = require('bluebird');
const http = require('http');

// Driver constants
const CONSTANTS = require('./constants');

/**
 * Main class
 */
class Mediabox extends EventEmitter {
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

	getIp() {
		return this.ip;
	}

	isReachable() {
		return true;
	}
}

module.exports = Mediabox;