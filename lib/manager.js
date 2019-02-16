'use strict';

// Supporting debug modules
const NeeoHelper = require('./NeeoHelper');
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
	 * Constructor
	 */
	constructor() {
		super();
		this.mediaBoxes = { };
		this.ssdpDiscoveryTimer = 0;
		this.ssdpEnabled = Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpEnabled', false);
		this.ssdpTimeout = Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpTimeout', 15) * 1000;
		this.ssdpRediscovery = Helper.ConfigHasOr('ziggoHorizon.Discovery.SsdpRediscovery', -1);
		this.knownMediaboxes = Helper.ConfigHasOr('ziggoHorizon.Discovery.KnownMediaboxes', []);
	}

	/**
	 * (internal) Callback function whenver a box is found
	 * @param serialNumberOrUniqueId The serial number or uniqueId (according to the devicedescription.xml) of this specific box
	 * @param modelName The model name (e.g. SMT-G7401:P01C)
	 * @param modelDescription The model description (e.g. UPC Hzn Gateway)
	 * @param ipAddress The location this box was found on the network.
	 */
	_BoxDiscovered(serialNumberOrUniqueId, modelName, modelDescription, ipAddress) {
		serialNumberOrUniqueId = serialNumberOrUniqueId.toString();

		// Already added box
		Helper.Debug('- Found a ' + modelName + ' (' + modelDescription + ') with serial number \'' + serialNumberOrUniqueId + '\' at IP \'' + ipAddress + '\'');
		if (serialNumberOrUniqueId in this.mediaBoxes) {
			if (this.mediaBoxes[serialNumberOrUniqueId].getIp() === ipAddress) {
				Helper.Debug('  - Skipped mediabox with uniqueId \'' + modelDescription + '\': already known with this IP address.');
			} else {
				Helper.Debug('  - Skipped mediabox with uniqueId \'' + modelDescription + '\': already added with name \'' + modelDescription + '\' and IP \'' + ipAddress + '\'.');
			}
			return;
		}

		this.mediaBoxes[serialNumberOrUniqueId] = new Mediabox(modelName, modelDescription, ipAddress);
		this.emit('BoxDiscovered', serialNumberOrUniqueId, modelName, modelDescription, ipAddress);
	}

	/**
	 * Loads all preconfigured boxes or starts SSDP discovery
	 */
	LoadAndDiscoverBoxes() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			// Get pre-configured mediaboxes from the config/default.json
			var preConfiguredMediaboxes = _this.knownMediaboxes;
			if (Helper.IsArray(preConfiguredMediaboxes) && (preConfiguredMediaboxes.length > 0)) {
				// Make sure the objects in the JSON are correctly configured
				if (!preConfiguredMediaboxes.every(item => item.hasOwnProperty('uniqueId') && item.hasOwnProperty('modelName') && item.hasOwnProperty('modelDescription') && item.hasOwnProperty('ipAddress'))) {
					Helper.Debug('ERROR: Make sure each object in the \'ziggoHorizon.PreConfiguredMediaboxes\' array has a unique id (or serial number), a label and an ip; e.g. { "uniqueId": "someUniqueValue", "label": "Some descriptive label", "ip": "127.0.0.1" }')
				} else {
					for (var idx in preConfiguredMediaboxes) {
						var preConfiguredMediabox = preConfiguredMediaboxes[idx];
						_this._BoxDiscovered(preConfiguredMediabox.uniqueId, preConfiguredMediabox.modelName, preConfiguredMediabox.modelDescription, preConfiguredMediabox.ipAddress);
					}
				}
			}

			_this._DiscoverBoxes().then(() => {
				resolve(_this.mediaBoxes);
			}).catch((err) => {
				resolve(_this.mediaBoxes);
			});
		});
	}

	/**
	 *
	 */
	_DiscoverBoxes() {
		var _this = this;
		return new Promise(function (resolve, reject) {
			clearTimeout(_this.ssdpDiscoveryTimer);

			// If we do not need to SSDP discovery we are already done
			if (!_this.ssdpEnabled) {
				Helper.Debug('SSDP discovery disabled, therefore we seem to be done...');
				resolve();
				return;
			}

			// Set timeout
			var minutes = Math.floor(_this.ssdpTimeout / 60000);
			minutes = (minutes == 0) ? '' : (minutes + ' minute' + ((minutes > 1) ? 's' : ''));

			var seconds = ((_this.ssdpTimeout % 60000) / 1000).toFixed(0);
			seconds = (seconds == 0) ? '' : (seconds + ' second' + ((seconds > 1) ? 's' : ''));
			if ((minutes != '') && (seconds != '')) {
				minutes = minutes + ' and ';
			}

			const ssdpClient = new Ssdp({ 'explicitSocketBind': true });
			const ssdpTimeoutTimer = setTimeout(function () {
				clearTimeout(ssdpTimeoutTimer);
				ssdpClient.stop();
				Helper.Debug('SSDP discovery finished.');
				_this.emit('SsdpDiscoveryFinished');
				resolve(_this.mediaBoxes);

				if (_this.ssdpRediscovery !== -1) {
					_this.ssdpDiscoveryTimer = setTimeout(_this._DiscoverBoxes.bind(_this), Math.max(_this.ssdpRediscovery, 10) * 1000);
				}
			}, _this.ssdpTimeout);

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
						_this.emit('SsdpDiscoveryError', error.message);
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
										var serialNumberOrUniqueId = result.root.device[0].friendlyName[0];
										var ipAddress = rinfo.address;
										Helper.Debug('- Found a ' + modelName + ' (' + modelDescription + ') with serial number \'' + serialNumberOrUniqueId + '\' at IP \'' + ipAddress + '\'');
										_this._BoxDiscovered(serialNumberOrUniqueId, modelName, modelDescription, ipAddress);
									}
								}
							});
						} catch (e) {
							Helper.Debug('XML_EXCEPTION: ' +  e.message);
							Helper.Debug(rawData);
							_this.emit('SsdpDiscoveryException', e.message, rawData);
						}
					});
				}).on('error', function (e) {
					Helper.Debug('HTTP_GET_ERROR: ' +  e.message);
					_this.emit('SsdpDiscoveryError', e.message);
				});

			});

			_this.emit('SsdpDiscoveryStarted', minutes, seconds);
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
	ButtonPressed(serialNumberOrUniqueId, button) {
		serialNumberOrUniqueId = serialNumberOrUniqueId.toString();
		if (!(serialNumberOrUniqueId in this.mediaBoxes)) {
			Helper.Debug('- Unable to send command to device with unique id (or serial number) "' + serialNumberOrUniqueId + '". It appears to be missing from the list...');
			return;
		}
		this.mediaBoxes[serialNumberOrUniqueId].onButtonPressed(button);
	}
}

module.exports = Manager;