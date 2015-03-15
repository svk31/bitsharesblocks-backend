'use strict';

const config = require('../..config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var moment = require('moment');

var _feedsRunning = false;
var _activeDelegatesCount = 101;
var R_ISO8601_STR = /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var delegateFeedsCollection = db.get('delegateFeeds');
var feedsCollection = db.get('feeds');
var transactionsCollection = db.get('transactions');

// FUNCTIONS

function updateActiveDelegateFeeds() {
  if (_feedsRunning === false) {
    var promises = [];
    _feedsRunning = true;
    console.log('UPDATING ACTIVE DELEGATE FEEDS');
    // console.log((new Date()));

    var feeds = {};
    // GET DELEGATE NAMES AND FEEDS FOR EACH ASSET
    Q.all([
        delegatesListCollection.find({
          'rank': {
            $lte: _activeDelegatesCount * 5
          }
        }, {
          fields: {
            'name': 1,
            '_id': 1
          }
        }),
        feedsCollection.find({}, {
          fields: {
            'feeds': 1,
            'symbol': 1
          }
        })
      ])
      // success(function(delegates) {
      .then(function(results) {
        var delegates = results[0];
        var assets = results[1];
        for (var i = 0; i < assets.length; i++) {
          for (var j = 0; j < assets[i].feeds.length; j++) {
            for (var k = 0; k < delegates.length; k++) {
              if (assets[i].feeds[j].delegate_name === delegates[k].name) {
                if (!feeds[delegates[k].name]) {
                  feeds[delegates[k].name] = {};
                }
                if (!feeds[delegates[k].name].feeds) {
                  feeds[delegates[k].name].feeds = {};
                  feeds[delegates[k].name]._id = delegates[k]._id;
                }
                feeds[delegates[k].name].feeds[assets[i]._id] = {
                  'symbol': assets[i].symbol,
                  'price': assets[i].feeds[j].price,
                  'last_update': assets[i].feeds[j].last_update
                };
              }
            }
          }
        }

        // COUNT AND FILTER FEEDS
        var yesterday = new moment.utc();
        yesterday = yesterday.subtract(1, 'days');
        yesterday = new Date(Date.UTC(yesterday.year(), yesterday.month(), yesterday.date(), yesterday.hour(), yesterday.minute()));
        var temp = [],
          match;
        // console.log('yesterday: dates larger than: '+yesterday);

        for (var key in feeds) {
          feeds[key].activeFeeds = 0;
          feeds[key].totalFeeds = 0;
          for (var feed in feeds[key].feeds) {
            feeds[key].totalFeeds++;
            match = feeds[key].feeds[feed].last_update.match(R_ISO8601_STR);
            var currentDate = new Date(Date.UTC(match[1], match[2] - 1, match[3], match[4], match[5], match[6]));
            // console.log('yes: '+yesterday);
            // console.log('now: '+currentDate);

            if (currentDate > yesterday) {
              feeds[key].activeFeeds++;
            }
          }
        }

        var twodays = new moment.utc();
        twodays = twodays.subtract(2, 'days');

        var startDay = new Date(Date.UTC(twodays.year(), twodays.month(), twodays.date(), twodays.hour(), twodays.minute()));
        // console.log('2 days: dates larger than: '+startDay);
        // console.log(startDay);
        var feedFrequency = {};
        var feedCounter = 0;
        transactionsCollection.find({
          reg_date_ISO: {
            $gte: startDay
          },
          types: 'update_feed'
        }).success(function(transactions) {
          console.log('Number of blocks with feed transactions last two days:' + transactions.length);
          if (transactions.length > 0) {
            console.log('block of two days ago:' + transactions[0]._id);
            for (var i = 0; i < transactions.length; i++) {
              // console.log(i);
              var uniqueBooleans = {};
              for (var j = 0; j < transactions[i].transactions.length; j++) {
                // console.log(transactions[i].transactions[j][1].trx.operations);
                // console.log(transactions[i].transactions[j][1].type);

                if (transactions[i].transactions[j][1].type == 'update_feed') {
                  // console.log(transactions[i]._id);
                  feedCounter++;
                  let feedData = transactions[i].transactions[j][1].trx.operations[0].data;
                  var delegateId = (feedData.index) ? feedData.index.delegate_id : feedData.feed.delegate_id;
                  // console.log(delegateId);
                  if (!feedFrequency[delegateId]) {
                    feedFrequency[delegateId] = {};
                    feedFrequency[delegateId].count = 1;
                    feedFrequency[delegateId].uniqueCount = 1;
                    if (!uniqueBooleans[delegateId]) {
                      uniqueBooleans[delegateId] = true;
                    }
                    feedFrequency[delegateId].updates = [];
                    feedFrequency[delegateId].updates.push({
                      'timestamp': transactions[i].reg_date_ISO,
                      'asset': feedData.value.quote_asset_id,
                      'ratio': feedData.value.ratio
                    });
                  } else {
                    feedFrequency[delegateId].count++;
                    feedFrequency[delegateId].updates.push({
                      'timestamp': transactions[i].reg_date_ISO,
                      'asset': feedData.value.quote_asset_id,
                      'ratio': feedData.value.ratio
                    });
                    if (!uniqueBooleans[delegateId]) {
                      feedFrequency[delegateId].uniqueCount++;
                      uniqueBooleans[delegateId] = true;
                    }
                  }
                }
              }
            }
            console.log('total number of feed transactions found:' + feedCounter);

            // WRITE TO DB
            for (var newkey in feeds) {
              // console.log('newkey:', newkey);
              var object = {};
              object.feeds = feeds[newkey].feeds;
              object._id = feeds[newkey]._id;
              object.feedFrequency = feedFrequency[object._id];
              // console.log(object.feedFrequency);
              object.name = newkey;
              object.uniqueCount = (feedFrequency[object._id] === undefined) ? 0 : feedFrequency[object._id].uniqueCount;
              object.activeFeeds = feeds[newkey].activeFeeds;
              object.totalFeeds = feeds[newkey].totalFeeds;
              promises.push(delegateFeedsCollection.update({
                '_id': object._id
              }, object, {
                'upsert': true
              }));
            }
            Q.all(promises).then(function(result) {
                _feedsRunning = false;
                return console.log('wrote feeds');
              })
              .catch(function(error) {
                _feedsRunning = false;
                console.log(error);
                return console.log('error writing feeds');
              });
          } else {
            _feedsRunning = false;
            return console.log('No feed trx found');
          }
        });
      });
    // });
  }
}

module.exports = {
  update: updateActiveDelegateFeeds
};