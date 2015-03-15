'use strict';

const config = require('../..config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var _latencyRunning = false;
var _activeDelegatesCount = 501;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var blocksCollection = db.get('blocks');
var latencyCollection = db.get('latencies');

function latencyLauncher() {
  if (_latencyRunning === false) {
    _latencyRunning = true;
    console.log('** UPDATING LATENCIES');
    var latencyObject = {};
    latencyObject._id = 1;
    latencyObject.latencies = {};
    delegatesListCollection.find({
      'rank': {
        $lte: _activeDelegatesCount
      }
    }, {
      fields: {
        'id': 1,
        'name': 1
      }
    }).success(function(delegates) {
      if (delegates) {
        return updateLatencies(0, delegates, latencyObject);
      } else {
        return false;
      }
    });
  }
}

function updateLatencies(ii, delegates, latencyObject) {
  if (ii < _activeDelegatesCount && delegates[ii]) {
    var limitBlocks = 200;
    var latencies = {};
    var id = parseInt(delegates[ii].id);
    blocksCollection.find({
      'signee': delegates[ii].name
    }, {
      fields: {
        latency: 1
      },
      limit: limitBlocks,
      sort: {
        '_id': -1
      }
    }).success(function(blocks) {
      var latencySum = 0;
      var avg = 'n/a',
        avg50 = 'n/a',
        avg100 = 'n/a',
        avg200 = 'n/a',
        counter = 0;
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].latency / 1000000 < 500) {
          latencySum += blocks[i].latency / 1000000;
          counter++;
        }
        if (counter === 49) {
          avg50 = latencySum / 50;
        } else if (counter === 99) {
          avg100 = latencySum / 100;
        } else if (counter == 199) {
          avg200 = latencySum / (counter + 1);
        }
      }
      avg = latencySum / (counter + 1);
      // if (avg==='n/a') {
      //   console.log('latencySum: '+latencySum);
      //   console.log('counter: '+counter);
      // }
      latencyObject.latencies[id] = {
        'avg': avg,
        'avg50': avg50,
        'avg100': avg100,
        'avg200': avg200
      };
      return updateLatencies(ii + 1, delegates, latencyObject);
    });
  } else {
    latencyCollection.update({
      '_id': latencyObject._id
    }, latencyObject, {
      'upsert': true
    }).success(function(doc) {
      console.log('wrote latencies');
      _latencyRunning = false;
      return;
    });
  }
}

module.exports = {
  update: latencyLauncher
};