'use strict';

const config = require('../config.json');
console.log('Lanching block collection scripts at port:', config.rpc_port);

var Apis = require("./grapheneApi");
console.log("Apis.initPromise:", Apis.initPromise);
Apis.instance().initPromise.then(function(result) {
    console.log("apis ready:", result, Apis.instance().db());
    Apis.instance().db().call("lookup_accounts", ["A", 10]).then(function(result) {
        console.log("lookup:", result);
    })
});


// console.log(Apis.instance().db();

// COMPONENTS
// var blocks = require('./components/blocks');
// var home = require('./components/home');
// var accounts = require('./components/accounts');
// var missing = require('./components/missingBlocks');

// INTERVALS

// setInterval(blocks.update, 10000);
// setInterval(home.securityUpdate, 60000);
// setInterval(home.update, 60000);
// setInterval(home.blockchainUpdate, 1000 * 60 * 10);

// SINGLE LAUNCH

// blocks.update();
// home.update();



// ws.send()

