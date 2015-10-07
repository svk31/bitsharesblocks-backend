'use strict';

require('node-monkey').start({host: "127.0.0.1", port:"50500"});
var redis = require("redis");
var messenger = require("messenger");
const config = require('../config.json');
console.log('Lanching block collection scripts at port:', config.rpc_port);

var Apis = require("./grapheneApi")(function() {setTimeout(init, 2500)});
var chainState;
var redisServer = redis.createClient();

var server = messenger.createListener(config.messengerPort);

server.on('getObject', (m, id) => {
    console.log("m", m, "id:", id);
    chainState.getObject(id).then(result => {
        m.reply(result);
    }).catch(err => {
        m.reply(err);
    });
})

server.on('recentBlocks', (m) => {
    console.log("server got request for recentBlocks");
    console.log("recentBlocks length:", chainState.getLatestBlocks().length);
    m.reply(chainState.getLatestBlocks());
})

server.on('activeWitnesses', (m) => {
    console.log("server got request for activeWitnesses");
    m.reply(chainState.getActiveWitnesses());
})

server.on('getBlock', (m, height) => {
    // console.log("server got request for getBlock", height);
    // console.log("recentBlocks length:", chainState.getLatestBlocks().length);
    chainState.getBlock(height).then(block => {
        // console.log("gotBlock found:", block);
        m.reply(block);
    }).catch(err => {
        m.reply(err);
    });
})

server.on('give it to me', function(message, data){
    console.log("server got request for give it to me");
    message.reply({'you':'got it'})
});

// DB DEF
var db = require('monk')('localhost/' + config.database);

function init() {
    Apis.instance().initPromise.then(function(result) {
        // console.log("apis ready:", result, Apis.instance().db());

        chainState = require("./chainState")(redisServer, Apis.instance());
        var blockReducers = require("./components/newBlocks")(Apis.instance().db(), redisServer, db, chainState);
        var witnessReducers = require("./components/witnesses")(Apis.instance().db(), redisServer, db, chainState);

        Apis.instance().db().call("set_subscribe_callback", [chainState.updateObjects, true]).then(result => {
            console.log("set_subscribe_callback result:", result);
        });

        // setTimeout(blockReducers.getAllBlocks, 3000);

    }).catch(err => {
        console.log("initPromise error:", err);
        // setTimeout(init, 2500);
    });  
}

init();

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

