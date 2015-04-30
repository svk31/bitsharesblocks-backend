'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js');

var request = require('request');
var Q = require('q');
var debug = false;

// db def
var db = require('monk')('localhost/' + config.database);
var assetsCollection = db.get('assets_v2');
var supplyCollection = db.get('supply');

supplyCollection.ensureIndex({
  marketAsset: 1
});

// FUNCTIONS

function assetSupply() {
  console.log('** FETCHING ASSET SUPPLIES **');
  if (debug) {
    var start = Date.now();
  }
  var promises = [];

  assetsCollection.find({}, {
    fields: {
      'symbol': 1,
      'precision': 1,
      'issuer_id': 1
    }
  }).success(function(assets) {
    if (assets) {
      for (var i = 0; i < assets.length; i++) {
        promises.push(updateSupply(assets[i], assets[i].issuer_id === -2));
        // promises.push(updateSupply(assets[i], false));
      }
      console.log('Asset count: ', promises.length);
      Q.all(promises).then(function(result) {
        console.log('Supply update done');
        // console.log(result);
        if (debug) {
          console.log('Supply update Time taken: ', (Date.now() - start) / 1000, 'seconds');
        }
      });
    }
  });

  function updateSupply(asset, marketBoolean) {
    var deferred = Q.defer();
    var updateObject;
    var collateralPromise = (marketBoolean) ? utils.rpcCall('blockchain_market_get_asset_collateral', [asset.symbol]) : [];
    var currentTime = new Date();
    Q.all([
        utils.rpcCall('blockchain_calculate_supply', [asset.symbol]),
        collateralPromise
      ])
      .then(function(results) {

        var supply = results[0];
        var collateral = results[1];

        supply.amount = supply.amount / asset.precision;

        if (marketBoolean) {
          collateral = collateral / config.basePrecision;
          updateObject = {
            $set: {
              currentSupply: supply.amount,
              currentCollateral: collateral,
              marketAsset: marketBoolean
            },
            $push: {
              supply: [currentTime.getTime(), supply.amount],
              collateral: [currentTime.getTime(), collateral]
            }
          };
        } else {
          updateObject = {
            $set: {
              currentSupply: supply.amount,
              marketAsset: marketBoolean
            },
            $push: {
              supply: [currentTime.getTime(), supply.amount],
            }
          };
        }

        supplyCollection.update({
          '_id': parseInt(supply.asset_id, 10)
        }, updateObject, {
          'upsert': true
        }).success(function(doc) {
          deferred.resolve({
            done: true
          });
        });
      })
      .catch(function(err) {
        deferred.resolve({
          done: false,
          error: err
        });
      });
    return deferred.promise;
  }
}

// fixSupply();

function fixSupply() {
  supplyCollection.findOne({
    _id: 0
  }).then(function(result) {
    var found = false;
    for (var i = 0; i < result.supply.length; i++) {
      if (result.supply[i][0] === 1418406820953 && result.supply[i][1] === 2498095109.13434) {
        found = true;
        // console.log('found it, index:', i);
        break;
      }
    }

    if (found) {
      result.supply.splice(i, 1);
      supplyCollection.update({
        _id: 0
      }, result);
    }
  });
}

module.exports = {
  update: assetSupply,
  fix: fixSupply
};