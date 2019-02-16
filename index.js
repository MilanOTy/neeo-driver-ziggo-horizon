'use strict';

// 3rd party modules
const NeeoSdk = require('neeo-sdk');

// Supporting debug modules
const NeeoHelper = require('./lib/NeeoHelper');
const Helper = new NeeoHelper('ziggo-horizon:main');

// Start discovery object
const Manager = require('./lib/manager');
const MediaboxManager = new Manager();

/**
 * Wrapper for discovery function
 */
function getDevicesForNeeoWrapper() {
	return MediaboxManager.GetDevicesForNeeo().then((result) => {
		return result;
	}).catch((err) => {
		return [];
	});
}

/**
 * Wrapper for button handler
 */
function buttonHandler(button, serialNumberOrUniqueId) {
	MediaboxManager.ButtonPressed(serialNumberOrUniqueId, button);
}


// Set the device info, used to identify it on the Brain
const horizonController = NeeoSdk.buildDevice('Horizon Mediabox XL')
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
	.addButton({ name: 'GUIDE', label: Helper.ConfigHasOr('ziggoHorizon.UiLabels.Guide', 'TV Guide') })
	.addButton({ name: 'ONDEMAND', label: Helper.ConfigHasOr('ziggoHorizon.UiLabels.OnDemand', 'On Demand') })
	.addButton({ name: 'HELP', label: Helper.ConfigHasOr('ziggoHorizon.UiLabels.Help', 'Help') })
	.addButton({ name: 'INFO', label: Helper.ConfigHasOr('ziggoHorizon.UiLabels.Info', 'Info') })
	.addButton({ name: 'TEXT', label: Helper.ConfigHasOr('ziggoHorizon.UiLabels.Text', 'Text') })
	.addButtonHandler(buttonHandler)
	.enableDiscovery({
		  headerText: Helper.ConfigHasOr('ziggoHorizon.Discovery.Header', 'Prepare your mediabox(es)'),
		  description: Helper.ConfigHasOr('ziggoHorizon.Discovery.Description', 'Make sure the Mediaboxes you want to discover are connected to your home network.')
		}, getDevicesForNeeoWrapper);

MediaboxManager.GetDevicesForNeeo();

// Module export
module.exports = {
	devices: [
		horizonController,
	],
  };