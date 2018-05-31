'use strict';

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
		MENU: 'e00a',
		BACK: 'e002',
		CHANNEL_UP: 'e006',
		CHANNEL_DOWN: 'e007',
		CURSOR_UP: 'e100',
		CURSOR_DOWN: 'e101',
		CURSOR_LEFT: 'e102',
		CURSOR_RIGHT: 'e103',
		CURSOR_ENTER: 'e001',
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
		PLAY: 'e400',
		PAUSE: 'e400',
		STOP: 'e402',
		REVERSE: 'e407',
		FORWARD: 'e405',
		PREVIOUS: 'e102',
		NEXT: 'e103',
		SKIP_SECONDS_BACKWARD: 'e407',
		SKIP_SECONDS_FORWARD: 'e405',
		MY_RECORDINGS: 'ef29',
		RECORD: 'e403',
		LIVE: 'ef2a',
		// Custom commands:
		POWER: 'e000',
		ONDEMAND: 'ef28',
		HELP: 'e009',
		GUIDE: 'e00b',
		INFO: 'e00e',
		TEXT: 'e00f',
		MENU1: 'e011',
		MENU2: 'e015',
		MENU3: 'ef00',
		TIMESHIFT_INFO: 'ef06', // TIMESHIFT INFO
		POWER2: 'ef15', // POWER
		ID: 'ef16', // ID
		RC_PAIR: 'ef17', // RC PAIRING
		TIMINGS: 'ef19' // TIMINGS
	}
};
