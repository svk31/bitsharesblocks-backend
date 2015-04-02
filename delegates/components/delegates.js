'use strict';

const config = require('../../config_play.json');
var utils = require('../../utils/utils.js');

var Q = require('q');

var _delegateRunning = false;
var _activeDelegatesCount = 101;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var supplyCollection = db.get('supply');

var setIndex = false;
if (setIndex) {
  delegatesListCollection.ensureIndex({
    user_transaction_ids: 1
  });
  delegatesListCollection.ensureIndex({
    "delegate_info.votes_for": 1
  });
  delegatesListCollection.ensureIndex({
    rank: 1
  });
  delegatesListCollection.ensureIndex({
    name: 1
  });
  delegatesListCollection.ensureIndex({
    reg_date_ISO: 1
  });
}

function updateDelegates() {
  var promises = [];
  if (_delegateRunning === false) {
    _delegateRunning = true;
    console.log('** RUNNING DELEGATE UPDATE **');

    Q.all([
        utils.rpcCall('blockchain_list_delegates', [1, 99999]),
        supplyCollection.find({
          _id: 0
        }, {
          fields: {
            currentSupply: 1
          }
        })
      ])
      .then(function(results) {
        var delegates = results[0];
        var btsSupply = results[1][0].currentSupply;
        console.log('found delegates');

        delegates.forEach(function(entry, index) {
          entry._id = entry.id;
          entry.rank = index + 1;
          entry.delegate_info.votes_for = Math.round(entry.delegate_info.votes_for / config.basePrecision);
          if (btsSupply) {
            entry.share_supply = btsSupply;
            entry.delegate_info.votes_for_percent = Math.round((entry.delegate_info.votes_for / btsSupply) * 100 * 100) / 100;
          }
          entry.reg_date_ISO = utils.get_ISO_date(entry.registration_date);
          entry.delegate_info.pay_balance = Math.round(entry.delegate_info.pay_balance / config.basePrecision);
          entry.reliability = 100 - entry.delegate_info.blocks_missed / (entry.delegate_info.blocks_produced + entry.delegate_info.blocks_missed) * 100;

          promises.push(delegatesListCollection.update({
            '_id': entry.id
          }, entry, {
            'upsert': true
          }));

        });
        Q.all(promises).then(function(result) {
          _delegateRunning = false;
          console.log('** DELEGATE UPDATE DONE **');
          return;
        });
      })
      .catch(function(error) {
        _delegateRunning = false;
        return console.log(error);
      });
  } else {
    return console.log('DELEGATE UPDATE ALREADY RUNNING');
  }
}

module.exports = {
  update: updateDelegates
};