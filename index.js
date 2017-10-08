'use strict';

const Promise = require("bluebird");
const Ssdp = require('node-ssdp-lite');
const neeoapi = require('neeo-sdk');
const controller = require('./controller');



//----------------------------------------------------------------------------------------------------
// Start script
//----------------------------------------------------------------------------------------------------

console.log('---------------------------------------------');
console.log(' Ziggo Horizon Mediabox adapter');
console.log('---------------------------------------------');
console.log(' - Searching for Horizon Mediabox XL (max 15 sec.)');

// Search for mediabox on local network
var mediabox;

const SsdpClient = new Ssdp({ logLevel: 'TRACE', log: false });
const ssdpTimeout = setTimeout(() => {
			console.log('   - FAILED!');
			process.exit(1);
		}, 15000);

SsdpClient.on('response', function(headers, rinfo) {
	if (headers.indexOf('X-User-Agent: redsonic') > -1) {
		console.log('   - FOUND! -> ', rinfo.address);
		clearTimeout(ssdpTimeout);
		this.stop();

		const neeoTimeout = setTimeout(() => {
			console.log('   - FAILED!');
			process.exit(1);
		}, 15000);

		console.log(' - Searching for NEEO Brain (max 15 sec.)');
		neeoapi.discoverOneBrain().then((brain) => {
			console.log('   - FOUND! -> ', brain.name);
			clearTimeout(neeoTimeout);

			// initiate Mediabox object
			mediabox = new controller(rinfo.address);

			// Set the device info, used to identify it on the Brain
			const neeoDevice = neeoapi.buildDevice('Mediabox XL')
				.setManufacturer('Ziggo')
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
				.addButton({ name: 'GUIDE', label: 'TV Gids' })
				.addButton({ name: 'ONDEMAND', label: 'On Demand' })
				.addButton({ name: 'HELP', label: 'Help' })
				.addButton({ name: 'INFO', label: 'Informatie' })
				.addButton({ name: 'TEXT', label: 'Teletekst' })
				.addButtonHander((btn) => { mediabox.onButtonPressed(btn); });

			console.log(' - Starting "Ziggo Mediabox XL" driver ...');
			return neeoapi.startServer({
				brain,
				port: 6336,
				name: 'mediaboxXl',
				devices: [neeoDevice]
			});
		})
		.then(() => {
			console.log('   - READY! use the NEEO app to search for "Ziggo Mediabox XL".');
		})
		.catch((err) => {
			console.error('ERROR!', err);
			process.exit(1);
		});
	}
});

SsdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');

/*

function exitHandler(options, err) {
	if (options.cleanup) {
		console.log('clean');
	}

	if (err) {
		console.log(err.stack);
	}

	if (options.exit) {
		process.exit();
	}
}

//do something when app is closing
process.on('exit', exitHandler.bind(null,{cleanup:true}));

//catches ctrl+c event
process.on('SIGINT', exitHandler.bind(null, {exit:true}));

// catches "kill pid" (for example: nodemon restart)
process.on('SIGUSR1', exitHandler.bind(null, {exit:true}));
process.on('SIGUSR2', exitHandler.bind(null, {exit:true}));

//catches uncaught exceptions
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));

var Mediabox = require('./mediabox/mediabox.js');
var Ssdp = require('node-ssdp-lite'), SsdpClient = new Ssdp({logLevel: 'TRACE', log: false});
SsdpClient.on('response', function(headers, rinfo) {
	if (headers.indexOf('X-User-Agent: redsonic') > -1) {
		var mediaBox = new Mediabox(rinfo.address);
		mediaBox.display();
		mediaBox.powerOn();
	}
});
SsdpClient.search('urn:schemas-upnp-org:service:ContentDirectory:1');

*/
