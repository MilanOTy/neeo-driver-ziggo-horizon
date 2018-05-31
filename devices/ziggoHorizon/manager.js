'use strict';

// Supporting debug modules
const NeeoHelper = require('../NeeoHelper');
const Helper = new NeeoHelper('ziggo-horizon:manager');

// Controller class
const Mediabox = require('./mediabox');

// 3rd party modules
const EventEmitter = require('events');
const Ssdp = require('node-ssdp').Client;
const http = require('http');

/**
 * Main class
 */
class Manager extends EventEmitter {
	/**
	 *
	 */
	constructor() {
		super();
		this.mediaBoxes = { };
		this.ssdpDiscoveryTimer = 0;

		// process handlers
		process.on('exit', this.exitHandler.bind(null, { cleanup: true }));
		process.on('SIGINT', this.exitHandler.bind(null, { exit: true }));
		process.on('SIGUSR1', this.exitHandler.bind(null, { exit: true })); // catches 'kill pid' (for example: nodemon restart)
		process.on('SIGUSR2', this.exitHandler.bind(null, { exit: true })); // catches 'kill pid' (for example: nodemon restart)
		process.on('uncaughtException', this.exitHandler.bind(null, { exit: true }));
	}

	/**
	 *
	 */
	exitHandler(options, err) {
		if (options.cleanup) {
			// Perform cleanup tasks
		}

		if (err) {
			Helper.Debug(err.stack);
		}

		if (options.exit) {
			process.exit();
		}
	}

	/**
	 *
	 */
	_BoxDiscovered(serialNumberOrUniqueId, mediaboxLabel, mediaboxIp) {
		serialNumberOrUniqueId = serialNumberOrUniqueId.toString();

		// Already added box
		if (serialNumberOrUniqueId in this.mediaBoxes) {
			if (this.mediaBoxes[serialNumberOrUniqueId].getIp() === mediaboxIp) {
				Helper.Debug('  - Skipped mediabox with uniqueId \'' + mediaboxLabel + '\': already known with this IP address.');
			} else { 
				Helper.Debug('  - Skipped mediabox with uniqueId \'' + mediaboxLabel + '\': already added with name \'' + mediaboxLabel + '\' and IP \'' + mediaboxIp + '\'.');
			}
			return;
		}

		this.mediaBoxes[serialNumberOrUniqueId] = new Mediabox(mediaboxLabel, mediaboxIp);
	}

	/**
	 *
	 */
	LoadAndDiscoverBoxes() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			// Get pre-configured mediaboxes from the config/default.json
			var preConfiguredMediaboxes = Helper.ConfigHasOr('ziggoHorizon.Discovery.KnownMediaboxes', []);
			if (Helper.IsArray(preConfiguredMediaboxes) && (preConfiguredMediaboxes.length > 0)) {
				// Make sure the objects in the JSON are correctly configured
				if (!preConfiguredMediaboxes.every(item => item.hasOwnProperty('uniqueId') && item.hasOwnProperty('label') && item.hasOwnProperty('ip'))) {
					Helper.Debug('ERROR: Make sure each object in the \'ziggoHorizon.PreConfiguredMediaboxes\' array has a unique id (or serial number), a label and an ip; e.g. { "uniqueId": "someUniqueValue", "label": "Some descriptive label", "ip": "127.0.0.1" }')
				} else {
					for (var idx in preConfiguredMediaboxes) {
						var preConfiguredMediabox = preConfiguredMediaboxes[idx];
						_this._BoxDiscovered(preConfiguredMediabox.uniqueId, preConfiguredMediabox.label, preConfiguredMediabox.ip);
					}
				}
			}

			// If we do not need to SSDP discovery we are already done
			if (Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpEnabled', false) === false) {
				Helper.Debug('SSDP discovery disabled, therefore we seem to be done...');
				resolve();
				return;
			}

			_this.DiscoverBoxes().then((result) => {
				resolve(_this.mediaBoxes);
			}).catch((err) => {
				resolve(_this.mediaBoxes);
			});
		});
	}

	/**
	 *
	 */
	DiscoverBoxes() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			clearTimeout(_this.ssdpDiscoveryTimer);

			// Set timeout
			var millis = Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpTimeout', 15000);
			var minutes = Math.floor(millis / 60000);
			minutes = (minutes == 0) ? '' : (minutes + ' minute' + ((minutes > 1) ? 's' : ''));

			var seconds = ((millis % 60000) / 1000).toFixed(0);
			seconds = (seconds == 0) ? '' : (seconds + ' second' + ((seconds > 1) ? 's' : ''));
			if ((minutes != '') && (seconds != '')) {
				minutes = minutes + ' and ';
			}

			const ssdpClient = new Ssdp({ 'explicitSocketBind': true });
			const ssdpTimeout = setTimeout(function () {
				clearTimeout(ssdpTimeout);
				ssdpClient.stop();
				resolve(_this.mediaBoxes);
				
				var ssdpRediscoveryDelay = Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpRediscovery', -1);
				if (ssdpRediscoveryDelay !== -1) {
					_this.ssdpDiscoveryTimer = setTimeout(_this.DiscoverBoxes.bind(_this), Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpRediscovery', 300000));
				}
			}, millis);

			ssdpClient.on('response', function (headers, statusCode, rinfo) {
				// Check to make sure we only discover 'redsonic' with a valid XML
				if ((headers['X-USER-AGENT'] != 'redsonic') || (headers['LOCATION'] === undefined)) {
					return;
				}

				// We download the description XML ...
				http.get(headers['LOCATION'], function (res) {
					const { statusCode } = res;
					const contentType = res.headers['content-type'];

					let error;
					if (statusCode !== 200) {
						error = new Error('Request failed with status code: ' + statusCode);
					} else if (!/^text\/xml/.test(contentType)) {
						error = new Error('Invalid content-type. Need text/xml but received: ' + contentType);
					}

					if (error) {
						res.resume();
						Helper.Debug('HTTP_GET_ERROR: ' +  error.message);
						return;
					}

					res.setEncoding('utf8');
					let rawData = '';
					res.on('data', function (chunk) { rawData += chunk; });
					res.on('end', function () {
						try {
							// We parse the result ...
							var parseString = require('xml2js').parseString;
							parseString(rawData, function (err, result) {
								if (err) {
									throw err;
									return;
								}

								// ... and if all goes well, we have found a box
								if (('device' in result.root) && ('modelName' in result.root.device[0]) && ('modelDescription' in result.root.device[0])) {
									var modelName = result.root.device[0].modelName[0];
									var modelDescription = result.root.device[0].modelDescription[0];
									if (modelName.startsWith('SMT-G74') && modelDescription.startsWith('UPC')) {
										var serialNumber = result.root.device[0].friendlyName[0];
										var ipAddress = rinfo.address;
										Helper.Debug('- Found a ' + modelDescription + ' (' + modelName + ') with serial number \'' + serialNumber + '\' on IP \'' + ipAddress + '\'');
										_this._BoxDiscovered(serialNumber, modelDescription, ipAddress);
									}
								}
							});
						} catch (e) {
							Helper.Debug('XML_EXCEPTION: ' +  e.message);
							Helper.Debug(rawData);
						}
					});
				}).on('error', function (e) {
					Helper.Debug('HTTP_GET_ERROR: ' +  e.message);
				});

			});

			Helper.Debug('Initiating SSDP discovery for ' + minutes + (((minutes != '') && (seconds != '')) ? ' and ' : '') + seconds + '.');
			ssdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');
		});
	}

	/**
	 *
	 */
	GetDevicesForNeeo() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			_this.LoadAndDiscoverBoxes().then((result) => {
				var neeoDevices = [];
				for (var idx in _this.mediaBoxes) {
					neeoDevices.push({
						id: idx,
						name: _this.mediaBoxes[idx].getLabel(),
						reachable: _this.mediaBoxes[idx].isReachable()
					});
				}
				resolve(neeoDevices);
			}).catch((err) => {
				resolve([ ]);
			});
		});
	}

	/**
	 *
	 */
	ButtonHandler(name, deviceId) {
		if (!(deviceId in this.mediaBoxes)) {
			Helper.Debug('ButtonHandler: No device with deviceId \'' + deviceId + '\' found.');
			return;
		}
		this.mediaBoxes[deviceId].onButtonPressed(name);
	}
}

module.exports = Manager;