'use strict';

const config = require('../config_dvs.json');
console.log('Lanching block collection scripts at port:', config.rpc_port);

// COMPONENTS
var blocks = require('./components/blocks');
var home = require('./components/home');
var accounts = require('./components/accounts');
var missing = require('./components/missingBlocks');

// INTERVALS

setInterval(blocks.update, 10000);
setInterval(home.securityUpdate, 60000);
setInterval(home.update, 60000);
setInterval(home.blockchainUpdate, 1000 * 60 * 10);

// SINGLE LAUNCH

blocks.update();
home.blockchainUpdate();




