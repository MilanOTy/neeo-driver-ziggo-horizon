'use strict';

// Supported buttons on the Neeo Remote (https://github.com/NEEOInc/neeo-sdk/blob/cb2bc15899a5a96575cfc6850f2b001c7cddf280/widgetDocumentation.md)
module.exports = {
	KEY_DELAY: 100,
	CONNECTION_STATE: {
		DISCONNECTED: 0,
		CONNECTING: 1,
		AUTHENTICATING: 2,
		AUTHENTICATED: 3,
		CONNECTED: 4
	},
	BUTTON: {
		//-------------------------
		// Buttongroup: Power (missing intentionally; they are handled in a special way in mediabox.js)
		//-------------------------
		// POWER_ON: 'e000',
		// POWER_OFF: 'e000',
		//-------------------------
		// Buttongroup: Menu and Back
		//-------------------------
		MENU: 'e00a',
		BACK: 'e002',
		//-------------------------
		// Buttongroup: Controlpad
		//-------------------------
		CURSOR_UP: 'e100',
		CURSOR_DOWN: 'e101',
		CURSOR_LEFT: 'e102',
		CURSOR_RIGHT: 'e103',
		CURSOR_ENTER: 'e001',
		//-------------------------
		// Buttongroup: Channel Zapper
		//-------------------------
		CHANNEL_UP: 'e006',
		CHANNEL_DOWN: 'e007',
		//-------------------------
		// Buttongroup: NumPad
		//-------------------------
		DIGIT_0: 'e300',
		DIGIT_1: 'e301',
		DIGIT_2: 'e302',
		DIGIT_3: 'e303',
		DIGIT_4: 'e304',
		DIGIT_5: 'e305',
		DIGIT_6: 'e306',
		DIGIT_7: 'e307',
		DIGIT_8: 'e308',
		DIGIT_9: 'e309',
		//-------------------------
		// Buttongroup: Transport
		//-------------------------
		PLAY: 'e400',
		PAUSE: 'e400',
		STOP: 'e402',
		SKIP_SECONDS_FORWARD: 'e405',	// NOT USED BY NEEO, BUT DOES WORK ON BOX (SLOWMO)
		SKIP_SECONDS_BACKWARD: 'e407',	// NOT USED BY NEEO, BUT DOES WORK ON BOX (SLOWMO)
		//-------------------------
		// Buttongroup: Transport Search
		//-------------------------
		REVERSE: 'e407',
		FORWARD: 'e405',
		//-------------------------
		// Buttongroup: Record
		//-------------------------
		MY_RECORDINGS: 'ef29',
		RECORD: 'e403',
		LIVE: 'ef2a',
		//-------------------------
		// Buttongroup: Color Buttons
		//-------------------------
		FUNCTION_RED: 'e200',
		FUNCTION_GREEN: 'e201',
		FUNCTION_YELLOW: 'e202',
		FUNCTION_BLUE: 'e203',
		//-------------------------
		// Buttongroup: Volume
		//-------------------------
		VOLUME_UP: 'e003',
		VOLUME_DOWN: 'e004',
		MUTE_TOGGLE: 'e005',
		//-------------------------
		// Custom buttons
		//-------------------------
		GUIDE: 'e00b',
		ONDEMAND: 'ef28',
		HELP: 'e009',
		INFO: 'e00e',
		TEXT: 'e00f',
	}
};

/*
	//-------------------------
	// Currently not used/mapped:
	//-------------------------
	PREVIOUS: 'e102',
	NEXT: 'e103',
	POWER: 'e000',
	MENU1: 'e011',
	MENU2: 'e015',					// HOME
	MENU3: 'ef00',					// ELPS(?) / PRIMAFILA(?)
	TIMESHIFT_INFO: 'ef06',			// TIMESHIFT INFO
	POWER2: 'ef15',					// POWER
	ID: 'ef16',						// ID
	RC_PAIR: 'ef17',				// RC PAIRING
	TIMINGS: 'ef19',				// TIMINGS
	INPUTSELECT: 'e010',
	INTERACT: 'e008',
	PAUSE2: 'e401',
	PLAYPAUSE: 'e40a',
	SEARCH: 'ef03',
	SKY: 'ef01',

	//-------------------------
	// Found keyboard codes
	//-------------------------
	ENTER: 'ff0d',
	BACKSPACE: 'ffff',

*/
