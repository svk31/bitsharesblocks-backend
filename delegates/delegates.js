'use strict';

const config = require('..config.json');

var delegates = require('./components/delegates');
var votes = require('./components/votes');
var latencies = require('./components/latencies');
var feeds = require('./components/feeds');
var slates = require('./components/slates');
// var records = require('./components/records');

// INTERVALS

setInterval(delegates.update, 1.5 * 60000);
setInterval(latencies.update, 15 * 60000);
setInterval(votes.update, 1000 * 60);
setInterval(feeds.update, 2 * 60000);
setInterval(slates.update, 10 * 60000);

// setInterval(records.update,10*60000);

// SINGLE LAUNCH
// slates.update();



