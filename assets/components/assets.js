'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');

// DB DEF
var db = require('monk')('localhost/' + config.database);
var assetsCollection = db.get('assets_v2');
var delegatesListCollection = db.get('delegatesList');
var feedsCollection = db.get('feeds');
var priceHistoryCollection = db.get('priceHistory_v2');
var _baseUnit = config.baseSymbol;
console.log('** USING BASE ASSET:',_baseUnit);

// DB INDEX DEFINITIONS
var setIndex = true;
if (setIndex) {
  assetsCollection.ensureIndex({
    reg_date_ISO: 1
  });
  assetsCollection.ensureIndex({
    issuer_account_id: 1
  });
  assetsCollection.ensureIndex({
    symbol: 1
  });
}

// GLOBAL PRIVATE VARIABLES
var _currentBlock = 600000;
var _assetRunningMarket = false;
var _assetRunningUser = false;
var _assetRunningRecent = false;
var _assetRunningAll = false;
var _debug = false;
var _lastUpdateBlock = 1;

// FUNCTIONS
getLatestBlock();
setInterval(getLatestBlock, 1000 * 10);

function getLatestBlock() {
  utils.redisGet('_currentBlock').then(function(result) {
    _currentBlock = result._id;
    if (_currentBlock % 10 === 0) {
      return console.log('** CURRENT BLOCK IS: ' + _currentBlock);
    }
  });
}

function launchAssetUpdate() {

  utils.redisGet('marketOps').then(function(ops) {
    console.log('** RECENT | all:',_assetRunningAll,'recent:',_assetRunningRecent);

    if (!_assetRunningRecent && !_assetRunningAll) {
      _assetRunningRecent = true;
      console.log('** UPDATING RECENTLY USED ASSETS **');

      return assetInfo('recent', ops).then(function(result, ops) {
        _assetRunningRecent = !result.done;
        if (_debug) {
          // console.log(result);
          console.log('RECENTLY USED ASSETS: Time taken: ', (result.end - result.start) / 1000, 'seconds');
        }
        console.log('** FINISHED UPDATING RECENTLY USED ASSETS **');
      });

    } else {
      return console.log('** RECENTLY USED ASSETS ALREADY RUNNING**');
    }
  });
}

function updateAll() {
  console.log('** ALL | all:',_assetRunningAll,'recent:',_assetRunningRecent);
  if (!_assetRunningAll && !_assetRunningRecent) {
    _assetRunningAll = true;
    console.log('** UPDATING ALL ASSETS **');
    return assetInfo('all').then(function(result) {
      _assetRunningAll = !result.done;
      if (_debug) {
        // console.log(result);
        console.log('ALL ASSETS: Time taken: ', (result.end - result.start) / 1000, 'seconds');
      }
      console.log('** FINISHED UPDATING ALL ASSETS **');
    });
  } else {
    return console.log('** ALL ASSETS ALREADY RUNNING**');
  }
}

// function updateMarketAssets() {
//   if (!_assetRunningMarket) {
//     _assetRunningMarket = true;
//     console.log('** UPDATING MARKET ASSETS **');
//     return assetInfo('market').then(function(result) {
//       _assetRunningMarket = !result.done;
//       if (_debug) {
//         console.log('Market Assets Time taken: ', (result.end - result.start) / 1000, 'seconds');
//       }
//       console.log('** FINISHED UPDATING MARKET ASSETS **');
//     });
//   } else {
//     return console.log('** MARKET ASSETS ALREADY RUNNING**');
//   }
// }

function assetInfo(type, selections) {
  var deferred = Q.defer();

  var assetSelection = selections;

  var recentUpdates = false;
  console.log('last updated assets at block:', _lastUpdateBlock);
  if (selections) {
    assetSelection.forEach(function(block, index) {
      if (block._id > _lastUpdateBlock && (block.assetCount > 0 || block.assetCreate > 0)) {
        recentUpdates = true;
      }
    });
  }

  if (selections && recentUpdates === false) {
    // if (_assetRunningRecent) {
    //   _assetRunningRecent = false;
    // }
    // if (_assetRunningRecent) {
    //   _assetRunningRecent = false;
    // }
    deferred.resolve({
      done: true
    });

  } else {
    var start = Date.now();

    var i, j;
    var updatePromises = [];

    var delegatesPromise = [];

    Q.all([
        utils.rpcCall('blockchain_list_assets', [0, 9999]),
        assetsCollection.find({}, {
          sort: {
            _id: 1
          }
        })
      ])
      .then(function(results) {

        var assets = results[0];
        var existingAssets = results[1];
        var assetCount = assets.length,
          updateCounter = 0;

        // Prepare asset combinations
        var assetSymbols = {};
        var combinations = {};

        if (assetSelection) {
          // First create ID => Symbol mapping
          assets.forEach(function(asset) {
            assetSymbols[asset.id] = asset.symbol;
          });
          // Loop over selections
          assetSelection.forEach(function(block, index) {
            // If an asset has been created we will update it
            if (block._id > (_lastUpdateBlock - 15) && block.assetCreate > 0) {
              for (var newAssetID in block.newAssets) {
                console.log('NEW ASSET ID:', newAssetID);
                combinations[newAssetID] = [];
                combinations[newAssetID].push(0);
              }
            }
            // If an asset has had transactions we will add it
            if (block._id > (_lastUpdateBlock - 15) && block.assetCount > 0) {
              console.log('Asset updates:', block._id, ' > ', _lastUpdateBlock - 15);
              for (var base in block.assets) {
                block.assets[base].forEach(function(quote) {
                  var exists = false;
                  if (!combinations[quote]) {
                    combinations[quote] = [];
                  }
                  for (var i = 0; i < combinations[quote].length; i++) {
                    if (combinations[quote][i] === base) {
                      exists = true;
                    }
                  }
                  if (!exists) {
                    combinations[quote].push(base);
                  }

                });

              }
            }
          });

          console.log('combinations:', combinations);
        }

        console.log('nr of assets found:', assets.length);

        assets.forEach(function(asset, index) {
          var oldAsset = {},
            i, found;
          // asset._id = parseInt(asset.id, 10);

          // if (assetSelection) { // Looping over the recent combinations of asset pairs
          switch (type) {
            case 'recent':
              _lastUpdateBlock = _currentBlock;
              for (var quoteAsset in combinations) {
                if (asset.id === parseInt(quoteAsset, 10) || asset.symbol === quoteAsset) {
                  found = false;
                  for (i = 0; i < existingAssets.length; i++) {
                    if (existingAssets[i]._id === parseInt(quoteAsset, 10)) {
                      oldAsset = existingAssets[i];
                      found = true;
                    }
                  }
                  if (!found) {
                    oldAsset = asset;
                  }

                  // console.log('Found matching asset, quoteAsset:', quoteAsset, 'newasset:', asset.id, 'oldAsset:', oldAsset._id);
                  // combinations[quoteAsset].forEach(function(base) {
                  for (var j = 0; j < combinations[quoteAsset].length; j++) {

                    var base = combinations[quoteAsset][j];
                    // console.log('quoteAsset:', quoteAsset, 'asset.id:', asset.id, 'baseAsset:', assetSymbols[base]);
                    // console.log(asset);
                    updatePromises.push(updateAsset(asset, assetSymbols[base], oldAsset));
                  }


                  // });
                }
              }
              break;
              // } else { // Update ALL assets with base pair of BTS
            case 'all':
              _lastUpdateBlock = _currentBlock;
              found = false;
              for (i = 0; i < existingAssets.length; i++) {
                if (existingAssets[i]._id === asset.id) {
                  oldAsset = existingAssets[i];
                  found = true;
                  console.log('found match:', asset.symbol, '==', existingAssets[i].symbol);
                  updatePromises.push(updateAsset(asset, _baseUnit, oldAsset));
                }

              }
              if (!found) {
                console.log('new asset:', asset.symbol);
                updatePromises.push(updateAsset(asset, _baseUnit, asset));
              }

              break;
              // }
            case 'market':
              if (asset.issuer_account_id === 0 || asset.issuer_account_id === -2) {
                _lastUpdateBlock = _currentBlock;
                for (i = 0; i < existingAssets.length; i++) {
                  // console.log(existingAssets[i]);
                  if (existingAssets[i]._id === parseInt(quoteAsset, 10)) {
                    oldAsset = existingAssets[i];
                  }
                }
                updatePromises.push(updateAsset(asset, _baseUnit, oldAsset));
              }
              break;
          }

        });
        Q.all(updatePromises).then(function(result) {
            deferred.resolve({
              done: true,
              start: start,
              end: Date.now()
            });
          })
          .catch(function(error) {
            // console.log(error);
          });
      })
      .catch(function(err) {
        console.log(err);
        if (marketBoolean) {
          _assetRunningMarket = false;
        } else if (_assetRunningRecent) {
          _assetRunningRecent = false;
        } else if (_assetRunningAll) {
          _assetRunningAll = false;
        } else {
          _assetRunningUser = false;
        }
      });


  }
  return deferred.promise;
}

function updateAsset(asset, baseAsset, oldAsset) {

  var start = Date.now();
  var deferred = Q.defer();

  var medianFeedsPromise = [],
    shortsPromise = [],
    coversPromise = [];
  // console.log('oldAsset:',oldAsset);
  // console.log('asset:',asset);
  if (asset.issuer_account_id === -2 && baseAsset === _baseUnit) {
    medianFeedsPromise = feedsCollection.findOne({
      symbol: asset.symbol
    }, {
      fields: {
        medianFeed: 1
      }
    });

    shortsPromise = utils.rpcCall('blockchain_market_list_shorts', [oldAsset.symbol]);

    coversPromise = utils.rpcCall('blockchain_market_list_covers', [oldAsset.symbol, baseAsset]);
  }

  // console.log('BEFORE: old asset _id:',oldAsset._id, 'asset id:',asset.id);
  if (!oldAsset._id) {
    // console.log('!oldAsset');
    oldAsset = asset;
    oldAsset._id = asset.id;
    // delete oldAsset.id;
  }
  // console.log('AFTER: old asset _id:',oldAsset._id, 'asset _id:',asset._id,'\n');

  utils.rpcCall('blockchain_market_status', [oldAsset.symbol, baseAsset])
    .then(function(status) {
      Q.all([
          utils.rpcCall('blockchain_market_list_asks', [oldAsset.symbol, baseAsset]),
          utils.rpcCall('blockchain_market_list_bids', [oldAsset.symbol, baseAsset]),
          shortsPromise,
          coversPromise,
          utils.rpcCall('blockchain_market_price_history', [oldAsset.symbol, baseAsset, "20140719T031850", 25920000, "each_hour"]),
          medianFeedsPromise,
          utils.rpcCall('blockchain_market_order_history', [oldAsset.symbol, baseAsset, 0, 999]),
          priceHistoryCollection.findOne({
            _id: oldAsset._id
          })
        ])
        .then(function(results) {

          if (!oldAsset.base) {
            oldAsset.base = {};
          }
          if (!oldAsset.base[baseAsset]) {
            oldAsset.base[baseAsset] = {};
          }

          oldAsset.last_update = new Date();

          // Assign values from RPC calls
          oldAsset.base[baseAsset].status = status;
          oldAsset.base[baseAsset].asks = results[0];
          oldAsset.base[baseAsset].bids = results[1];
          oldAsset.base[baseAsset].shorts = results[2];
          oldAsset.base[baseAsset].covers = results[3];
          var price_history = results[4];
          oldAsset.base[baseAsset].medianFeed = results[5].medianFeed || 0;

          // console.log('asset:', oldAsset.symbol, 'medianFeed:', oldAsset.medianFeed);
          if (!oldAsset.base.order_history) {
            oldAsset.base[baseAsset].order_history = [];
          }
          oldAsset.base[baseAsset].order_history = results[6];

          var oldPriceHistory = (results[7] !== null && results[7]._id) ? results[7] : {
            _id: parseInt(oldAsset._id, 10),
            symbol: asset.symbol
          };

          oldAsset.current_share_supply = asset.current_share_supply / asset.precision;
          oldAsset.maximum_share_supply = asset.maximum_share_supply / asset.precision;
          oldAsset.reg_date_ISO = utils.get_ISO_date(asset.registration_date);

          oldAsset.base[baseAsset].status.ask_depth = 0;
          oldAsset.base[baseAsset].status.bid_depth = 0;

          // Calculate ask and bid depths
          var i, j;
          var yesterday = new Date(Date.now());
          yesterday.setDate(yesterday.getDate() - 1);

          if (oldAsset.base[baseAsset].asks[0] && oldAsset.base[baseAsset].asks[0].state) {
            for (j = 0; j < oldAsset.base[baseAsset].asks.length; j++) {
              oldAsset.base[baseAsset].status.ask_depth += oldAsset.base[baseAsset].asks[j].state.balance;
            }
            oldAsset.base[baseAsset].status.ask_depth /= 100000;
          }
          if (oldAsset.base[baseAsset].bids[0] && oldAsset.base[baseAsset].bids[0].state) {
            for (j = 0; j < oldAsset.base[baseAsset].bids.length; j++) {
              oldAsset.base[baseAsset].status.bid_depth += (oldAsset.base[baseAsset].bids[j].state.balance / oldAsset.precision) / (oldAsset.base[baseAsset].bids[j].market_index.order_price.ratio * 100000 / oldAsset.precision);
            }
          }

          // Loop over price history array
          price_history.forEach(function(entry, index) {
            entry.timestampOriginal = entry.timestamp;
            entry.timestamp = utils.get_ISO_date(entry.timestamp).getTime();
            entry.order /= 100000;
          });

          // Calculate daily volume, find recent prices
          var sumPrices = 0;
          var halfDay = new Date(Date.now()),
            lastHour = new Date(),
            halfDayVolume = 0,
            sumPricesHalfDay = 0,
            lastXVolume = 0,
            lastXPrices = 0,
            lastVolume = 0,
            lastPrices = 0,
            lastCounter = 0,
            lastDate,
            currentPrice = false,
            hourVolume,
            hourPrice;

          halfDay.setHours(halfDay.getHours() - 12);
          lastHour.setHours(lastHour.getHours() - 1);
          oldAsset.base[baseAsset].dailyVolume = 0;

          // Loop over order history array
          var volume = 0,
            priceRatio = 100000 / asset.precision,
            lastVolume = 0,
            hourVolume = 0;
          oldAsset.base[baseAsset].dailyVolume = 0;

          var historyLength = oldAsset.base[baseAsset].order_history.length;
          oldAsset.base[baseAsset].order_history.forEach(function(order, index) {

            var currentDate = utils.get_ISO_date(order.timestamp);
            volume = order.bid_received.amount / config.basePrecision;

            if (currentDate > yesterday) { // Only include data if data is within last 24 hrs
              oldAsset.base[baseAsset].dailyVolume += volume;
              sumPrices += volume * order.ask_price.ratio * priceRatio;

              if (currentDate > halfDay) {
                halfDayVolume += volume;
                sumPricesHalfDay += volume * order.ask_price.ratio * priceRatio;

                if ((historyLength - index) < 11) {
                  lastXVolume += volume;
                  lastXPrices += volume * order.ask_price.ratio * priceRatio;
                }
              }
              // Set current price to latest price to weighted average of the last hour
              if (currentDate > lastHour) {
                hourVolume += volume;
                hourPrice += volume * order.ask_price.ratio * priceRatio;

              }
            }

            // Capture two most recent orders regardless of timestamp
            if ((index) < 3) {
              lastCounter++;
              lastVolume += volume;
              lastPrices += volume * order.ask_price.ratio * priceRatio;
              lastDate = order.timestamp;
            }
          });

          

          // Set volume weighted average prices
          oldAsset.base[baseAsset].vwap = sumPrices / oldAsset.base[baseAsset].dailyVolume || oldAsset.base[baseAsset].medianFeed;
          oldAsset.base[baseAsset].vwapHalf = sumPricesHalfDay / halfDayVolume || oldAsset.base[baseAsset].medianFeed;
          oldAsset.base[baseAsset].vwapLastX = lastXPrices / lastXVolume || oldAsset.base[baseAsset].medianFeed;

          oldAsset.base[baseAsset].lastUpdate = new Date();

          oldAsset.base[baseAsset].initialized = true;

          if (baseAsset === _baseUnit) { // For ease of use in api calls, set BTS values to root
            oldAsset.medianFeed = results[5].medianFeed || 0;
            oldAsset.dailyVolume = oldAsset.base[baseAsset].dailyVolume;
            oldAsset.status = status;
            oldAsset.vwap = oldAsset.base[baseAsset].vwap;
            oldAsset.lastPrice = lastPrices / lastVolume || 0;
            oldAsset.lastDate = lastDate;
            oldAsset.initialized = true;

            oldAsset.lastOrder = (oldAsset.base[baseAsset].order_history.length > 0) ? oldAsset.base[baseAsset].order_history[0].ask_price.ratio * priceRatio : 0;

            // Set current price
            currentPrice = lastPrices / lastVolume;
            // Set current price to feed if no orders in last 1 hour
            if (!currentPrice) {
              currentPrice = oldAsset.medianFeed;
            }
            // Set current price to feed price if no supply
            currentPrice = (oldAsset.current_share_supply > 0) ? currentPrice : oldAsset.medianFeed;
            // Set current price to feed if no volume
            currentPrice = (oldAsset.dailyVolume > 1000) ? currentPrice : oldAsset.medianFeed;
            oldAsset.lastPrice = currentPrice;
            oldAsset.currentPrice = currentPrice;
          }

          // Push updates to DB
          var updatePromises = [];

          updatePromises.push(assetsCollection.update({
            '_id': parseInt(oldAsset._id)
          }, oldAsset, {
            'upsert': true
          }));

          if (!oldPriceHistory.base) {
            oldPriceHistory.base = {};
          }
          if (!oldPriceHistory.base) {
            oldPriceHistory.base = {};
          }

          oldPriceHistory.base[baseAsset] = price_history;

          updatePromises.push(priceHistoryCollection.update({
            '_id': parseInt(oldAsset._id)
          }, oldPriceHistory, {
            'upsert': true
          }));

          // Wait for all updates to finish
          Q.all(updatePromises)
            .then(function(result) {
              console.log(oldAsset.symbol, '/', baseAsset, 'wrote asset and price history');
              deferred.resolve({
                asset: asset.symbol,
                time: (Date.now() - start) / 1000,
                done: true
              });
            })
            .catch(function(error) {
              console.log(oldAsset.symbol, '/', baseAsset, 'unable to update:', error);
            });
        })
        .catch(function(err) {
          console.log(oldAsset.symbol, '/', baseAsset, 'batch of rpc calls failed:', err);
        });
    })
    .catch(function(err) {

      if (!oldAsset.base) {
        oldAsset.base = {};
      }
      if (!oldAsset.base[baseAsset]) {
        oldAsset.base[baseAsset] = {};
      }
      if (baseAsset === _baseUnit) {
        oldAsset.status = {};
        oldAsset.status = {};
        oldAsset.status.bid_depth = 0;
        oldAsset.status.ask_depth = 0;
        oldAsset.status.center_price = 0;
        oldAsset.vwap = 0;
        oldAsset.dailyVolume = 0;
        oldAsset.initialized = false;
        oldAsset.lastPrice = 0;
      }
      oldAsset.base[baseAsset].order_history = [];
      oldAsset.base[baseAsset].status = {};
      oldAsset.base[baseAsset].status.bid_depth = 0;
      oldAsset.base[baseAsset].status.ask_depth = 0;
      oldAsset.base[baseAsset].status.center_price = 0;
      oldAsset.base[baseAsset].vwap = 0;
      oldAsset.base[baseAsset].initialized = false;
      assetsCollection.update({
          '_id': parseInt(oldAsset._id)
        }, oldAsset, {
          'upsert': true
        }).success(function(result) {
          deferred.resolve({
            asset: oldAsset.symbol,
            time: (Date.now() - start) / 1000,
            done: true
          });
        })
        .error(function(err) {
          console.log('failed to write asset:', err);
        });
    });
  return deferred.promise;
}

module.exports = {
  launchAssetUpdate: launchAssetUpdate,
  updateAll: updateAll
};