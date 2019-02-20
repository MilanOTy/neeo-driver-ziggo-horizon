'use strict';

// Supporting debug modules
const NeeoSdkWebunity = require('neeo-sdk-webunity');
const NeeoSdkHelper = new NeeoSdkWebunity('ziggo-horizon:main');

// Start discovery object
const Manager = require('./lib/manager');
const MediaboxManager = new Manager();
MediaboxManager.on('BoxDiscovered', function(serialNumberOrUniqueId, modelName, modelDescription, ipAddress) {
	NeeoSdkHelper.Debug('- Found a ' + modelName + ' (' + modelDescription + ') with serial number \'' + serialNumberOrUniqueId + '\' on IP \'' + ipAddress + '\'');
});
MediaboxManager.on('SsdpDiscoveryStarted', function(minutes, seconds) {
	NeeoSdkHelper.Debug('Initiating SSDP discovery for ' + minutes + (((minutes != '') && (seconds != '')) ? ' and ' : '') + seconds + '.');
});
MediaboxManager.on('SsdpDiscoveryError', function(errMsg) {
	NeeoSdkHelper.Debug('SsdpDiscoveryError: ' +  errMsg);
});
MediaboxManager.on('SsdpDiscoveryException', function(errMsg, rawData) {
	NeeoSdkHelper.Debug('SsdpDiscoveryException: ' + errMsg);
	NeeoSdkHelper.Debug('SsdpDiscoveryException: ' + rawData);
});
MediaboxManager.on('SsdpDiscoveryFinished', function() {
	NeeoSdkHelper.Debug('SsdpDiscoveryFinished');
});
MediaboxManager.LoadAndDiscoverBoxes();
