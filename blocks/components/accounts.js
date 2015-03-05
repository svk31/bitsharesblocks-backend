'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');

// DB DEF
var db = require('monk')('localhost/' + config.database);
var accountsCollection = db.get('accounts');
var blocksCollection = db.get('blocks');

accountsCollection.ensureIndex({
  isSub: 1
});
// FUNCTIONS

function updateAccounts() {
  console.log('UPDATING ACCOUNTS');
  accountsCollection.findOne({}, {
    sort: {
      _id: -1
    }
  }).success(function(previousAccount) {
    var startAccount = (previousAccount) ? previousAccount._id + 1 : 1;
    // startAccount = 1; // Forcing restart here
    return getAccount(startAccount, true).then(function(result) {});
  });
}

function getAccount(i, loopBoolean, blockNum) {
  var blockHeight = blockNum;
  console.log('updating account:', i);
  var deferred = Q.defer();
  loopBoolean = loopBoolean || false;

  utils.rpcCall('blockchain_get_account', [i]).then(function(account) {
    if (account) {

      account._id = account.id;
      account.reg_date_ISO = utils.get_ISO_date(account.registration_date);

      account.isDelegate = (account.delegate_info && account.delegate_info.pay_rate <= 100) ? true : false;


      var promises = [];
      promises.push(utils.rpcCall('blockchain_get_account_wall', [account.name]));
      if (account.reg_date_ISO === '2014-07-19 03:18:40.000Z' || blockHeight) {
        promises.push({});
      } else {
        promises.push(blocksCollection.find({
          reg_date_ISO: (new Date(account.reg_date_ISO))
        }, {
          fields: {
            _id: 1
          }
        }));
      }

      var parent = account.name.split('.');
      account.isSub = parent.length > 1;

      if (account.isSub) {
        parent = parent[parent.length - 1];
        promises.push(accountsCollection.update({
          name: parent
        }, {
          $set: {
            hasSubs: true
          }
        }));
      }

      delete account.id;
      Q.all(promises)
        .then(function(results) {
          account.burn = results[0];
          account.reg_block = (results[1].length > 0) ? results[1][0]._id : 0;
          if (blockHeight) {
            console.log('using blockNum:', blockHeight);
            account.reg_block = blockHeight;
          }
          console.log('account reg block:', account.reg_block);
          accountsCollection.update({
              '_id': parseInt(account._id)
            }, account, {
              'upsert': true
            })
            .success(function(doc) {
              if (loopBoolean === true) {
                deferred.resolve(getAccount(i + 1, true));
              }
              deferred.resolve('done');
            });
        });
    } else {
      deferred.resolve('no more accounts found');
    }
  });

  return deferred.promise;
}

module.exports = {
  update: updateAccounts,
  updateAccount: getAccount
};