'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js')

var Q = require('q');

// db def
var db = require('monk')('localhost/' + config.database);
var assetsCollection = db.get('assets_v2');
var delegatesListCollection = db.get('delegatesList');
var feedsCollection = db.get('feeds');
var oldFeedsHistoryCollection = db.get('feedsHistory');
var feedsHistoryCollection = db.get('feedsHistory_v2');

var _feedsHistoryRunning = false;
var _feedUpdateRunning = false;

function launchFeedUpdate() {

  console.log('UPDATING FEEDS FOR MARKET ASSETS');
  if (!_feedUpdateRunning) {
    _feedUpdateRunning = true;

    var updatePromises = [];
    var start = Date.now();

    Q.all([
        utils.rpcCall('blockchain_list_assets', [0, 9999]),
        delegatesListCollection.find({
          rank: {
            $lt: 102
          }
        })
      ])
      .then(function(results) {
        var assets = results[0];
        var activeDelegates = results[1];
        console.log('FEED UPDATE: nr of assets found:', assets.length);
        assets.forEach(function(asset, index) {
          if (asset.issuer_account_id === -2) {
            updatePromises.push(_updateFeeds(asset, activeDelegates));
          }
        });

        Q.all(updatePromises).then(function(result) {
            _feedUpdateRunning = false;
            console.log('** FINISHED UPDATING FEEDS **');
          })
          .catch(function(error) {
            console.log(error);
          });
      });
  } else {
    console.log('FEEDS UPDATE ALREADY RUNNING');
  }
}

function _updateFeeds(asset, activeDelegates) {
  var start = Date.now();
  var deferred = Q.defer();
  Q.all([
      utils.rpcCall('blockchain_get_feeds_for_asset', [asset.symbol]),
      utils.rpcCall('blockchain_median_feed_price', [asset.symbol])
    ])
    .then(function(results) {
      asset.feeds = results[0];
      asset.medianFeed = results[1] || 0;
      var total = 0;
      var filteredTotal = 0;
      var yesterday = new Date(Date.now());
      var temp = [],
        match, i, j;
      yesterday.setDate(yesterday.getDate() - 1);
      if (asset.feeds.length > 0) {
        for (i = 0; i < asset.feeds.length; i++) {
          activeDelegates.forEach(function(delegate) {
            if (asset.feeds[i].delegate_name === delegate.name) {
              total += asset.feeds[i].price;
              match = asset.feeds[i].last_update.match(utils.R_ISO8601_STR);
              var currentDate = new Date(Date.UTC(match[1], match[2] - 1, match[3], match[4], match[5], match[6]));
              if (currentDate > yesterday) {
                temp.push(asset.feeds[i]);
                filteredTotal += asset.feeds[i].price;
              }
            }
          });

        }
        asset.averagefeed = total / asset.feeds.length;
        asset.numberFeeds = asset.feeds.length;

        asset.averageValidFeeds = (temp.length) ? filteredTotal / temp.length : 0;
        asset.numberValidFeeds = temp.length;
      } else {
        asset.medianFeed = 0;
        asset.averagefeed = 0;
        asset.numberFeeds = 0;
        asset.averageValidFeeds = 0;
        asset.numberValidFeeds = 0;
      }

      asset._id = parseInt(asset.id, 10);

      feedsCollection.update({
          '_id': asset._id
        }, asset, {
          'upsert': true
        }).success(function(doc) {
          // console.log('wrote feeds for', asset.symbol);
          deferred.resolve({
            asset: asset.symbol,
            time: (Date.now() - start) / 1000,
            done: true
          });
        })
        .error(function(err) {
          deferred.reject(err);
        });


    })
    .catch(function(err) {
      _feedUpdateRunning = false;
      console.log(asset.symbol, 'FEEDS FAILED:', err);
    });
  return deferred.promise;
}


function transferFeedsHistory() {
  feedsHistoryCollection.find({}).success(function(doc) {
    if (doc.length === 0) {
      oldFeedsHistoryCollection.find({}).success(function(feedsHistory) {
        feedsHistory.forEach(function(history) {
          feedsHistoryCollection.update({
            _id: history._id
          }, history, {
            upsert: true
          }).success(function(succes) {
            console.log('transferred feeds history:', history.symbol);
          });
        });
      });
    }
    console.log('--- new feedsHistoryCollection is not empty, aborting transfer ---');
  });
}

function feedHistory() {
  console.log('UPDATING FEED HISTORY');
  if (!_feedsHistoryRunning) {
    Q.all([
        assetsCollection.find({
          issuer_account_id: -2
        }, {
          fields: {
            base: 1,
            symbol: 1,
            precision: 1,
            current_share_supply: 1,
            dailyVolume: 1,
            medianFeed: 1,
            vwap: 1,
            last_update: 1
          }
        }),
        feedsCollection.find({}, {
          fields: {
            symbol: 1,
            medianFeed: 1
          }
        })
      ])
      .then(function(results) {
        var assets = results[0];
        var feeds = results[1];
        var start = Date.now();

        var updatePromises = [];
        var currentTime = new Date();
        var lastHour = new Date(),
          timestamp;
        lastHour.setHours(lastHour.getHours() - 1);

        // Loop over all market assets
        assets.forEach(function(asset) {
          for (var i = 0; i < feeds.length; i++) {
            if (asset.symbol === feeds[i].symbol) {
              console.log('setting new feed value');
              asset.medianFeed = feeds[i].medianFeed;
              break;
            }
          }

          if (asset.symbol === 'USD') {
            console.log(asset);
          }
          asset.medianFeed = (!asset.medianFeed) ? 0 : asset.medianFeed;
          var currentPrice = (asset.base.BTS.order_history.length > 0) ? (config.basePrecision / asset.precision) * (parseFloat(asset.base.BTS.order_history[0].bid_price.ratio) + parseFloat(asset.base.BTS.order_history[0].ask_price.ratio)) / 2 : asset.medianFeed;

          var volumeSum = 0,
            priceSum = 0,
            foundRecent = false;
          var assetRatio = (config.basePrecision / asset.precision);

          // Loop over order history if there is one
          if (asset.base.BTS.order_history.length > 0) {
            asset.base.BTS.order_history.forEach(function(order, index) {
              timestamp = utils.get_ISO_date(order.timestamp);
              if (timestamp > lastHour) {
                console.log('recent order:', asset.symbol, 'price:', assetRatio * (parseFloat(order.bid_price.ratio) + parseFloat(order.ask_price.ratio)) / 2);
                foundRecent = true;
                volumeSum += order.bid_received.amount;
                priceSum += order.bid_received.amount * assetRatio * (parseFloat(order.bid_price.ratio) + parseFloat(order.ask_price.ratio)) / 2;
              }
            });
            currentPrice = priceSum / volumeSum;
          }

          if (!foundRecent) {
            currentPrice = asset.medianFeed;
          }


          var deviation24h = (asset.medianFeed !== 0) ? 100 - 100 * asset.vwapLastX / asset.medianFeed : 100;
          var tempObject = {};

          currentPrice = (asset.current_share_supply > 0) ? currentPrice : asset.medianFeed;
          currentPrice = (asset.dailyVolume > 1000) ? currentPrice : asset.medianFeed;

          console.log(asset.symbol, ': Current price:', currentPrice);

          // console.log(asset.symbol,'VWAP: ',asset.vwap);          
          // if ((Date.now() - asset.last_date) > 1000*60*60) {
          //   asset.vwap = asset.medianFeed;
          //   console.log('OLD PRICE DATA, USING FEED: ',asset.medianFeed);    
          // }
          updatePromises.push(feedsHistoryCollection.update({
            _id: asset._id
          }, {
            $set: {
              symbol: asset.symbol,
              price: currentPrice
            },
            $push: {
              vwap24hrs: [currentTime.getTime(), asset.vwap],
              currentPrice: [currentTime.getTime(), currentPrice],
              feed: [currentTime.getTime(), asset.medianFeed]
            }
          }, {
            upsert: true
          }));

        });
        Q.all(updatePromises).then(function(result) {
          console.log('feedsHistoryCollection update done, time taken:', (Date.now() - start) / 1000, 's');
        });
      });
  }
}

function fixFeedsHistory() {
  feedsHistoryCollection.find({}, {
    sort: {
      _id: 1
    }
  }).success(function(history) {
    console.log('asset: ', history[21].symbol);
    for (var i = history[22].feed.length-1; i >=0;  i--) {
      if (history[21].feed[i][1] === 0) {
        console.log('i:', i, 'date:', new Date(history[22].feed[i][0]), 'value:', history[22].feed[i][1]);
        history[21].feed.splice(i,1);
        history[21].currentPrice.splice(i,1);
        history[21].vwap24hrs.splice(i,1);
      }
    }

    feedsHistoryCollection.update({_id:22},history[21],{upsert:true});
  });
}

module.exports = {
  launchFeedUpdate: launchFeedUpdate,
  feedHistory: feedHistory,
  transferFeedsHistory: transferFeedsHistory,
  fixFeedsHistory: fixFeedsHistory
};