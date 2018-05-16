'use strict';

// Supporting debug modules
const Config = require('../config-has');
const Util = require('util');
const Debug = require('debug')('ziggo-horizon:controller');
Debug.log = function () {
	process.stderr.write('[' + new Date().toISOString() + '] ' + Util.format.apply(Util, arguments) + '\n');
}

// Controller class
const MediaboxXl = require('./mediabox-xl');

// 3rd party modules
const NeeoSdk = require('neeo-sdk');
const Ssdp = require('node-ssdp').Client;

// Variables
var foundOrConfiguredMediaBoxes = [];

/**
 *
 */
function isArray(arr) {
	return (Object.prototype.toString.call(arr) === '[object Array]');
}

/**
 *
 */
function isObject(obj) {
	return (Object.prototype.toString.call(obj) === '[object Object]');
}

/**
 *
 */
function initialise() {

}

/**
 *
 */
function buttonHandler(name, deviceid) {
	Debug(`[CONTROLLER] ${name} button pressed on ${deviceid}!`);
}

/**
 *
 */
function discoverMediaboxes() {
	return new Promise(function(resolve, reject) {
		// Reset object on new discovery
		// TODO: Close connections to previously connected boxes?
		foundOrConfiguredMediaBoxes = [];

		// Get pre-configured mediaboxes from the config/default.json
		var preConfiguredMediaboxes = Config.hasOr('ziggoHorizon.PreConfiguredMediaboxes', []);
		if (isArray(preConfiguredMediaboxes) && (preConfiguredMediaboxes.length > 0)) {
			// Make sure the objects in the JSON are correctly configured
			if (!preConfiguredMediaboxes.every(item => item.hasOwnProperty('id') && item.hasOwnProperty('label') && item.hasOwnProperty('ip'))) {
				Debug('ERROR: Make sure each object in the "ziggoHorizon.PreConfiguredMediaboxes" array has an ID, a LABEL and an IP; e.g. { "id": "someUniqueValue", "label": "Some descriptive label", "ip": "127.0.0.1" }')
			} else {
				for (var idx in preConfiguredMediaboxes) {
					var preConfiguredMediabox = preConfiguredMediaboxes[idx];
					if (foundOrConfiguredMediaBoxes.includes(preConfiguredMediabox.id)) {
						Debug('ERROR: Mediabox with label "' + preConfiguredMediabox.label + '" doesn\'t have a unique ID and is therefore not added as discovered device.');
					} else {
						foundOrConfiguredMediaBoxes[preConfiguredMediabox.id] = new MediaboxXl(preConfiguredMediabox.label, preConfiguredMediabox.ip);
					}
				}
			}
		} else {
			// Do an SSDP search
		}

        setTimeout(() => {
        	var discoveredDevicesForNeeoApp = [];
			for (var idx in foundOrConfiguredMediaBoxes) {
				discoveredDevicesForNeeoApp.push({
					id: idx,
					name: foundOrConfiguredMediaBoxes[idx].getLabel(),
					reachable: foundOrConfiguredMediaBoxes[idx].isReachable()
				});				
			}
            resolve(discoveredDevicesForNeeoApp);
        }, 1000);
    });
}

discoverMediaboxes().then((result) => {
	Debug(result);
});

/**
 *
 */
function exitHandler(options, err) {
	if (options.cleanup) {
		// Perform cleanup tasks
	}

	if (err) {
		Debug(err.stack);
	}

	if (options.exit) {
		process.exit();
	}
}

// process handlers
process.on('exit', exitHandler.bind(null, { cleanup: true }));
process.on('SIGINT', exitHandler.bind(null, { exit: true }));
process.on('SIGUSR1', exitHandler.bind(null, { exit: true })); // catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR2', exitHandler.bind(null, { exit: true })); // catches "kill pid" (for example: nodemon restart)
process.on('uncaughtException', exitHandler.bind(null, { exit: true }));

// Set the device info, used to identify it on the Brain
const horizonController = NeeoSdk.buildDevice('Horizon Mediabox XL')
	.registerInitialiseFunction(initialise)
	.setManufacturer('Ziggo')
	.addAdditionalSearchToken('ziggo')
	.addAdditionalSearchToken('horizon')
	.addAdditionalSearchToken('mediabox')
	.setType('DVB')
	.addButtonGroup('POWER')
	.addButtonGroup('Menu and Back')
	.addButtonGroup('Controlpad')
	.addButtonGroup('Channel Zapper')
	.addButtonGroup('Numpad')
	.addButtonGroup('Transport')
	.addButtonGroup('Transport Search')
	.addButtonGroup('Record')
	.addButton({ name: 'GUIDE', label: Config.hasOr('ziggoHorizon.UiLabels.Guide', 'TV Guide') })
	.addButton({ name: 'ONDEMAND', label: Config.hasOr('ziggoHorizon.UiLabels.OnDemand', 'On Demand') })
	.addButton({ name: 'HELP', label: Config.hasOr('ziggoHorizon.UiLabels.Help', 'Help') })
	.addButton({ name: 'INFO', label: Config.hasOr('ziggoHorizon.UiLabels.Info', 'Info') })
	.addButton({ name: 'TEXT', label: Config.hasOr('ziggoHorizon.UiLabels.Text', 'Text') })
	.addButtonHandler(buttonHandler)
	.enableDiscovery({
		  headerText: Config.hasOr('ziggoHorizon.Discovery.Header', 'Prepare your mediabox(es)'),
		  description: Config.hasOr('ziggoHorizon.Discovery.Description', 'Make sure the Mediaboxes you want to discover are connected to your home network.')
		}, discoverMediaboxes);

// Module export
module.exports = horizonController;