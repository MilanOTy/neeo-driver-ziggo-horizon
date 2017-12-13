'use strict';

// Constants
const Debug = require('debug')('ziggo-horizon:main');
const Util = require('util');
Debug.log = function() {
	process.stderr.write('[' + new Date().toISOString() + '] ' + Util.format.apply(Util, arguments) + '\n');
}
const Config = require('config');

// Variables
var horizonController;

// Methods
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

// Start script
Debug('---------------------------------------------');
Debug(' Ziggo Horizon Mediabox XL driver');
Debug('---------------------------------------------');

// Check Node version
Debug('* verifying installed Node runtime ...');
if (process.versions.node < '6.0') {
        throw new Error('This driver only runs on node >= 6.0. Your current node version is ' + process.versions.node + '.');
} else {
	Debug('  - OK: ', process.versions.node);
}

// Load modules
Debug('* loading modules ...');
const NeeoSdk = require('neeo-sdk');
const HorizonController = require('./horizon-controller');
Debug('  - OK');

// Start script
horizonController = new HorizonController();
horizonController.on('found', function(ip) {
	Debug('* Searching for NEEO Brain (max 10 sec.)');
	const neeoTimeout = setTimeout(() => {
		Debug('  - Failed');
		process.exit(1);
	}, 10000);
	
	NeeoSdk
		.discoverOneBrain()
		.then((brain) => {
			clearTimeout(neeoTimeout);
			Debug('  - OK, found a Neeo brain with name: ' + brain.name);

			// Set the device info, used to identify it on the Brain
			const neeoDevice = NeeoSdk.buildDevice('Horizon Mediabox XL')
				.setManufacturer('Ziggo/UPC')
				.addAdditionalSearchToken('horizon')
				.setType('DVB')
				.addButtonGroup('POWER')
				.addButtonGroup('Menu and Back')
				.addButtonGroup('Controlpad')
				.addButtonGroup('Channel Zapper')
				.addButtonGroup('Numpad')
				.addButtonGroup('Transport')
				.addButtonGroup('Transport Search')
				.addButtonGroup('Record')
				.addButton({ name: 'GUIDE', label: (Config.has('NeeoUI.GuideLabel') ? Config.get('NeeoUI.GuideLabel') : 'TV Guide') })
				.addButton({ name: 'ONDEMAND', label: (Config.has('NeeoUI.OnDemandLabel') ? Config.get('NeeoUI.OnDemandLabel') : 'On Demand') })
				.addButton({ name: 'HELP', label: (Config.has('NeeoUI.HelpLabel') ? Config.get('NeeoUI.HelpLabel') : 'Help') })
				.addButton({ name: 'INFO', label: (Config.has('NeeoUI.InfoLabel') ? Config.get('NeeoUI.InfoLabel') : 'Info') })
				.addButton({ name: 'TEXT', label: (Config.has('NeeoUI.TextLabel') ? Config.get('NeeoUI.TextLabel') : 'Text') })
				.addButtonHander((btn) => { horizonController.onButtonPressed(btn); });

			Debug('* Announcing "Horizon Mediabox XL" driver to the Neeo brain ...');
			return NeeoSdk.startServer({
				brain,
				port: 6336,
				name: 'ziggo-horizon',
				devices: [neeoDevice]
			});
		})
		.then(() => {
			Debug('  - OK');
			horizonController.connectBox();
		});
});

horizonController.on('connected', function() {
	Debug('* We are ready to control your Horizon Mediabox XL!');
	Debug('* If this is the first time you start this driver, you can use the');
	Debug('* Neeo app to search for a new device called "Horizon Mediabox XL".');
});

horizonController.on('disconnected', function() {
	var reconnectTimer = setTimeout(() => {
					clearTimeout(reconnectTimer);
					horizonController.findBox();
				}, horizonController.reconnectDelay);
});
horizonController.findBox();
