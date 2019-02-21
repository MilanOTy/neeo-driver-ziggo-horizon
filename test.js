'use strict';

// Supporting debug modules
const WebunitySdkHelperModule = require('./lib/webunitySdkHelper');
const WebunitySdkHelper = new WebunitySdkHelperModule('ziggo-horizon:main');

// 3rd party modules
const Promise = require('bluebird');

// Start discovery object
const ManagerModule = require('./lib/manager');
const MediaboxManager = new ManagerModule();
MediaboxManager.on('BoxDiscovered', function(serialNumberOrUniqueId, modelName, modelDescription, ipAddress) {
	WebunitySdkHelper.Debug('- Found a ' + modelName + ' (' + modelDescription + ') with serial number \'' + serialNumberOrUniqueId + '\' on IP \'' + ipAddress + '\'');
});
MediaboxManager.on('SsdpDiscoveryStarted', function(minutes, seconds) {
	WebunitySdkHelper.Debug('Initiating SSDP discovery for ' + minutes + (((minutes != '') && (seconds != '')) ? ' and ' : '') + seconds + '.');
});
MediaboxManager.on('SsdpDiscoveryError', function(errMsg) {
	WebunitySdkHelper.Debug('SsdpDiscoveryError: ' +  errMsg);
});
MediaboxManager.on('SsdpDiscoveryException', function(errMsg, rawData) {
	WebunitySdkHelper.Debug('SsdpDiscoveryException: ' + errMsg);
	WebunitySdkHelper.Debug('SsdpDiscoveryException: ' + rawData);
});
MediaboxManager.on('SsdpDiscoveryFinished', function() {
	WebunitySdkHelper.Debug('SsdpDiscoveryFinished');
});
MediaboxManager.LoadAndDiscoverBoxes();

