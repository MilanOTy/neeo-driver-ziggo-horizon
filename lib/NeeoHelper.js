'use strict';

// Constants
const Config = require('config');
const Util = require('util');

/**
 * Main class
 */
class NeeoHelper {
	/**
	 *
	 */
	constructor(moduleName) {
		this.Debug = require('debug')('neeo:' + moduleName);
		this.Debug.log = function () {
			process.stderr.write('[' + new Date().toISOString() + '] ' + Util.format.apply(Util, arguments) + '\n');
		};
	}

	/**
	 *
	 */
	ConfigHasOr(key, fallback) {
		return (Config.has(key) ? Config.get(key) : fallback);
	}

	/**
	 *
	 */
	IsArray(arr) {
		return (Object.prototype.toString.call(arr) === '[object Array]');
	}

	/**
	 *
	 */
	IsObject(obj) {
		return (Object.prototype.toString.call(obj) === '[object Object]');
	}

	/**
	 *
	 */
	Sleep(ms) {
  		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

module.exports = NeeoHelper;