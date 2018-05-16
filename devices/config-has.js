'use strict';

// Constants
const Config = require('config');

class ConfigHas {
    hasOr(key, fallback) {
        return (Config.has(key) ? Config.get(key) : fallback);
    }
}

module.exports = new ConfigHas();