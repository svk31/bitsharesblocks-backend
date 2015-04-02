'use strict';

const config = require('../../config_dvs.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var _lastMissedCheck;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var missedCollection = db.get('missed');
var blocksCollection = db.get('blocks');

// FUNCTIONS
function updateMissing() {
  console.log('** UPDATING MISSING BLOCKS **');
  missedCollection.findOne({}, {
    sort: {
      _id: -1
    }
  }).success(function(missed) {
    var startBlock;
    if (missed === null) {
      startBlock = 1;
    } else {
      startBlock = (_lastMissedCheck !== undefined) ? Math.max(_lastMissedCheck, missed._id) + 1 : missed._id + 1;
    }
    return getMissingBlocks(startBlock, true).then(function(result) {
      return console.log(result);
    });
  });
}

function getMissingBlocks(i, loopBoolean) {
  var deferred = Q.defer();

  console.log('-- looking for missed block at: ' + i);
  var block = {};
  utils.rpcCall('blockchain_list_missing_block_delegates', [i]).then(function(missing) {
      if (missing.length > 0) {
        block._id = i;
        block.delegates = missing;

        missedCollection.update({
          '_id': parseInt(block._id)
        }, block, {
          'upsert': true
        }).success(function(doc) {
          console.log('wrote missing block: ' + i);
          if (loopBoolean === true) {
            deferred.resolve(getMissingBlocks(i + 1, true));
          } else {
            deferred.resolve('get missing done');
          }
        });
      } else {
        console.log('-- block ' + i + ' not missed');
        _lastMissedCheck = i;
        if (loopBoolean === true) {
          deferred.resolve(getMissingBlocks(i + 1, true));
        } else {
          deferred.resolve('get missing done');
        }
      }
    })
    .catch(function(error) {
      deferred.resolve('No more missing blocks found');
    });
  return deferred.promise;
}

module.exports = {
  update: updateMissing,
  updateBlock: getMissingBlocks
};