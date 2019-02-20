'use strict';

// 3rd party modules
const NeeoSdk = require('neeo-sdk');

// Supporting debug modules
const WebunitySdkHelperModule = require('./lib/webunitySdkHelper');
const WebunitySdkHelper = new WebunitySdkHelperModule('ziggo-horizon:main');

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

// Set the device info, used to identify it on the Brain
// See constants.js for mapping of the 'addButtonGroup' stuff
const horizonController = NeeoSdk.buildDevice('Horizon Mediabox XL')
	.setDriverVersion(1)
	.setManufacturer('Ziggo')
	.addAdditionalSearchToken('ziggo')
	.addAdditionalSearchToken('horizon')
	.addAdditionalSearchToken('mediabox')
	.setType('DVB')
	.addButtonGroup('POWER')
	.addButtonGroup('Menu and Back')
	.addButtonGroup('Controlpad')
	.addButtonGroup('Channel Zapper')
	.addButtonGroup('Volume')
	.addButtonGroup('Numpad')
	.addButtonGroup('Transport')
	.addButtonGroup('Transport Search')
	.addButtonGroup('Record')
	.addButtonGroup('Color Buttons')
	.addButton({ name: 'GUIDE', label: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.UiLabels.Guide', 'TV Guide') })
	.addButton({ name: 'ONDEMAND', label: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.UiLabels.OnDemand', 'On Demand') })
	.addButton({ name: 'HELP', label: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.UiLabels.Help', 'Help') })
	.addButton({ name: 'INFO', label: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.UiLabels.Info', 'Info') })
	.addButton({ name: 'TEXT', label: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.UiLabels.Text', 'Text') })
	.addButtonHandler((button, serialNumberOrUniqueId) => { MediaboxManager.ButtonPressed(serialNumberOrUniqueId, button); })
	.registerFavoriteHandlers({ execute: (serialNumberOrUniqueId, favoriteId) => { MediaboxManager.FavoritePressed(serialNumberOrUniqueId, favoriteId); } })
	.enableDiscovery({
		  headerText: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.Discovery.Header', 'Prepare your mediabox(es)'),
		  description: WebunitySdkHelper.ConfigHasOr('ziggoHorizon.Discovery.Description', 'Make sure the Mediaboxes you want to discover are connected to your home network.')
		}, getDevicesForNeeoWrapper);

MediaboxManager.GetDevicesForNeeo();

// Module export
module.exports = {
	devices: [
		horizonController,
	],
  };