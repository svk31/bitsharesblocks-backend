'use strict';

const config = require('../..config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var moment = require('moment');

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var accountsCollection = db.get('accounts');
var transactionsCollection = db.get('transactions');
var assetsCollection = db.get('assets_v2');
var securityCollection = db.get('security');
var blockchainInfoCollection = db.get('blockchainInfo');
var homeCollection = db.get('home');
var missedCollection = db.get('missed');
var transactionChartCollection = db.get('trxCharts');
var transactionChartCollectionHour = db.get('trxChartsHour');
var supplyCollection = db.get('supply');

// FUNCTIONS
function homeUpdate() {
  console.log('** RUNNING HOME UPDATE **');

  var yesterday = new moment.utc;
  var oneWeekAgo = new moment.utc;
  var oneMonthAgo = new moment.utc;

  yesterday = yesterday.subtract(1, 'days');
  oneWeekAgo = oneWeekAgo.subtract(7, 'days');
  oneMonthAgo = oneMonthAgo.subtract(30, 'days');

  var startDay = new Date(yesterday.year(), yesterday.month(), yesterday.date(), yesterday.hour(), yesterday.minute());
  var startWeek = new Date(oneWeekAgo.year(), oneWeekAgo.month(), oneWeekAgo.date(), oneWeekAgo.hour(), oneWeekAgo.minute());
  var startMonth = new Date(oneMonthAgo.year(), oneMonthAgo.month(), oneMonthAgo.date(), oneMonthAgo.hour(), oneMonthAgo.minute());

  Q.all([
      accountsCollection.count({}),
      accountsCollection.count({
        reg_date_ISO: {
          $gte: startDay
        }
      }),
      accountsCollection.count({
        reg_date_ISO: {
          $gte: new Date(startWeek)
        }
      }),
      accountsCollection.count({
        isSub: true
      }),
      delegatesListCollection.count({}),
      delegatesListCollection.count({
        'delegate_info.votes_for': {
          '$gt': 0
        }
      }),
      delegatesListCollection.count({
        reg_date_ISO: {
          $gte: startDay
        }
      }),
      delegatesListCollection.count({
        reg_date_ISO: {
          $gte: new Date(startWeek)
        }
      }),
      securityCollection.find({}),
      assetsCollection.count({}),
      assetsCollection.count({
        issuer_account_id: {
          $gt: 0
        }
      }),
      assetsCollection.count({
        reg_date_ISO: {
          $gte: startMonth
        }
      }),
      assetsCollection.count({
        reg_date_ISO: {
          $gte: new Date(startWeek)
        }
      }),
      transactionsCollection.count({}),
      missedCollection.count({}),
      utils.rpcCall('blockchain_unclaimed_genesis', []),
      transactionChartCollectionHour.findOne({}, {
        sort: {
          _id: -1
        }
      }),
      supplyCollection.find({}),
      blockchainInfoCollection.find(),
      delegatesListCollection.find({
        rank: {
          $lt: 102
        }
      }, {
        fields: {
          delegate_info: 1
        }
      })
    ])
    .then(function(result) {
      var homeInfo = {};
      homeInfo._id = 1;
      homeInfo.numberOfUsers = result[0];
      homeInfo.newAccountsDay = result[1];
      homeInfo.newAccountsWeek = result[2];
      homeInfo.subaccounts = result[3];
      homeInfo.numberOfDelegates = result[4];
      homeInfo.numberOfVotedDelegates = result[5];
      homeInfo.newDelegatesDay = result[6];
      homeInfo.newDelegatesWeek = result[7];
      homeInfo.security = result[8][0];
      homeInfo.assetCount = result[9];
      homeInfo.userAssets = result[10];
      homeInfo.newAssetsMonth = result[11];
      homeInfo.newAssetsWeek = result[12];
      homeInfo.transactionCount = result[13];
      console.log('trxCount:', homeInfo.transactionCount);
      homeInfo.missedCount = result[14];
      homeInfo.unclaimed = Math.round(result[15].amount / config.basePrecision);
      homeInfo.nrAssetTrx = (result[16]) ? result[16].totalAssetTrx: 0;

      var collaterals = result[17];

      var totalCollateral = 0,
        j = 0;
      for (var i = 0; i < collaterals.length; i++) {
        if (collaterals[i]._id === 0) {
          for (j = collaterals[i].supply.length - 1; j > 0; j--) {
            if (startDay.getTime() > collaterals[i].supply[j][0]) {
              break;
            }
          }
          homeInfo.dailyInflation = collaterals[i].currentSupply - collaterals[i].supply[j][1];
          homeInfo.btsxSupply = collaterals[i].currentSupply;
        }
        if (collaterals[i].currentCollateral) {
          totalCollateral += collaterals[i].currentCollateral;
        }
      }
      homeInfo.totalCollateral = totalCollateral;

      homeInfo.delegatePayRate = result[18][0].max_delegate_pay_issued_per_block / config.basePrecision;

      homeInfo.assetReg = result[18][0].short_symbol_asset_reg_fee / config.basePrecision;
      homeInfo.assetRegLong = result[18][0].long_symbol_asset_reg_fee / config.basePrecision;
      homeInfo.delegateReg = result[18][0].max_delegate_reg_fee / config.basePrecision;

      homeInfo.averagePay = 0;
      result[19].forEach(function(delegate) {
        homeInfo.averagePay += delegate.delegate_info.pay_rate;
      });
      homeInfo.averagePay = homeInfo.averagePay * homeInfo.delegatePayRate / 100 / 101;

      homeCollection.update({
        '_id': parseInt(homeInfo._id)
      }, homeInfo, {
        'upsert': true
      }).success(function(doc) {
        return console.log('wrote home collection');
      });
    })
    .catch(function(err) {
      console.log('HOME UPDATE FAILED');
      console.log(err);
    });
}

function securityInfo() {
  console.log('** UPDATING SECURITY INFO **');
  Q.all([
      utils.rpcCall('blockchain_get_security_state', []),
      utils.redisGet('_getInfo')
    ])
    .then(function(results) {
      var security = results[0];
      var getInfo = results[1];
      security._id = 1;
      security.getInfo = getInfo;
      securityCollection.update({
        '_id': parseInt(security._id)
      }, security, {
        'upsert': true
      }).success(function(doc) {
        return console.log('** SECURITY UPDATE DONE **');
      });
    });
}

function blockchainInfo() {
  console.log('** UPDATING BLOCKCHAIN INFO **');
  utils.rpcCall('blockchain_get_info', []).then(function(blockchainInfo) {
    blockchainInfo._id = 1;
    blockchainInfoCollection.update({
      '_id': parseInt(blockchainInfo._id)
    }, blockchainInfo, {
      'upsert': true
    }).success(function(doc) {
      return console.log('** BLOCKCHAIN INFO UPDATE DONE **');
    });
  });
}

module.exports = {
  update: homeUpdate,
  securityUpdate: securityInfo,
  blockchainUpdate: blockchainInfo
};