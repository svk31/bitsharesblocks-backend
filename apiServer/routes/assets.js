'use strict';

module.exports = function(db, app, apicache) {

  var Q = require('q');
  var cors = require('cors');

  var config = require('../..config.json');
  var _baseUnit = config.baseSymbol;
  console.log('** USING BASE ASSET:', _baseUnit);
  var request = require('request');

  // VARIABLES
  var assetsCollection = db.get('assets');
  var assetsCollectionv2 = db.get('assets_v2');
  var btsxPriceCollection = db.get('btsxPrice');
  var transactionChartCollection = db.get('trxCharts');
  var transactionChartCollectionHour = db.get('trxChartsHour');
  var transactionChartCollectionDay = db.get('trxChartsDay');
  var transactionChartCollectionWeek = db.get('trxChartsWeek');
  var feesChartCollectionHour = db.get('feesChartsHour');
  var feesChartCollectionDay = db.get('feesChartsDay');
  var feesChartCollectionWeek = db.get('feesChartsWeek');
  var feesChartCollection = db.get('feesCharts');
  var accountChartCollection = db.get('accountCharts');
  var supplyCollection = db.get('supply');
  var priceHistoryCollection = db.get('priceHistory');
  var priceHistoryCollectionv2 = db.get('priceHistory_v2');
  var feedDeviationCollection = db.get('feedsHistory');
  var feedDeviationCollectionv2 = db.get('feedsHistory_v2');
  var feedsCollection = db.get('feeds');
  var metaMarketsCollection = db.get('metaX');

  // ROUTES
  app.get('/v1/cmc', cors(), function(req, res) {
    Q.all([
        assetsCollectionv2.find({
          issuer_account_id: {
            $lte: 0
          }
        }, {
          sort: {
            _id: 1
          },
          fields: {
            base: 0,
            status: 0
          }
        }),
        feedsCollection.find({}, {
          fields: {
            medianFeed: 1,
            symbol: 1
          },
          sort: {
            '_id': 1
          }
        })
      ])
      .then(function(results) {
        if (results) {
          var lastHour = new Date();
          lastHour.setHours(lastHour.getHours() - 1);
          var i;
          var assets = results[0];
          var feeds = results[1];
          var returnObject = {};
          returnObject.assets = [];

          // BTS Supply data
          returnObject.BTS = {
            symbol: assets[0].symbol,
            supply: assets[0].current_share_supply / 100000
          };

          // Market assets data
          for (i = 1; i < assets.length; i++) {
            if (!returnObject.assets[i - 1]) {
              returnObject.assets[i - 1] = {};
            }

            for (var j = 0; j < feeds.length; j++) {

              if (feeds[j].symbol === assets[i].symbol) {
                assets[i].medianFeed = feeds[j].medianFeed;
                break;
              }
            }

            if (assets[i]._id !== 0) {
              returnObject.assets[i - 1].symbol = assets[i].symbol;
              returnObject.assets[i - 1].price = assets[i].lastPrice || 0; // Use vw current price for last two transactions within last hour
              returnObject.assets[i - 1].price = (assets[i].dailyVolume > 1000) ? returnObject.assets[i - 1].price : assets[i].medianFeed;
              returnObject.assets[i - 1].price = (assets[i].current_share_supply > 0) ? returnObject.assets[i - 1].price : assets[i].medianFeed;
              returnObject.assets[i - 1].supply = assets[i].current_share_supply;
              returnObject.assets[i - 1].volume24h = assets[i].dailyVolume;

              if (assets[i].lastDate < lastHour) {
                returnObject.assets[i - 1].price = assets[i].medianFeed;
              }

            }
          }

          returnObject.units = {
            price: 'ASSET/BTS',
            supply: 'ASSET',
            'volume24h': 'BTS'
          };

          return res.json(JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v2/cmc', apicache('60 seconds'), function(req, res) {
    Q.all([
        assetsCollectionv2.find({
          issuer_account_id: {
            $lte: 0
          }
        }, {
          sort: {
            _id: 1
          },
          fields: {
            base: 0,
            status: 0
          }
        }),
        feedsCollection.find({}, {
          fields: {
            medianFeed: 1,
            symbol: 1
          },
          sort: {
            '_id': 1
          }
        })
      ])
      .then(function(results) {
        if (results) {
          var lastHour = new Date();
          lastHour.setHours(lastHour.getHours() - 1);
          var i;
          var assets = results[0];
          var feeds = results[1];
          var returnObject = {};
          returnObject.assets = [];

          // BTS Supply data
          returnObject.BTS = {
            symbol: assets[0].symbol,
            supply: assets[0].current_share_supply / 100000
          };

          // Market assets data
          for (i = 1; i < assets.length; i++) {
            if (!returnObject.assets[i - 1]) {
              returnObject.assets[i - 1] = {};
            }

            for (var j = 0; j < feeds.length; j++) {

              if (feeds[j].symbol === assets[i].symbol) {
                assets[i].medianFeed = feeds[j].medianFeed;
                break;
              }
            }

            if (assets[i]._id !== 0) {
              returnObject.assets[i - 1].symbol = assets[i].symbol;
              returnObject.assets[i - 1].price = assets[i].lastPrice || 0; // Use vw current price for last two transactions within last hour
              returnObject.assets[i - 1].price = (assets[i].dailyVolume > 1000) ? returnObject.assets[i - 1].price : assets[i].medianFeed;
              returnObject.assets[i - 1].price = (assets[i].current_share_supply > 0) ? returnObject.assets[i - 1].price : assets[i].medianFeed;
              returnObject.assets[i - 1].supply = assets[i].current_share_supply;
              returnObject.assets[i - 1].volume24h = assets[i].dailyVolume;

              if (assets[i].lastDate < lastHour) {
                returnObject.assets[i - 1].price = assets[i].medianFeed;
              }

            }
          }

          returnObject.units = {
            price: 'ASSET/BTS',
            supply: 'ASSET',
            'volume24h': 'BTS'
          };

          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/assetvolume', apicache('10 minutes'), function(req, res) {
    transactionChartCollection.find({}, {
        sort: {
          _id: 1
        }
      }).success(function(trxs) {
        if (trxs) {
          var volume = {};
          volume.transactions = reduceSum(trxs, 'timestamp', 'askCount', 'bidCount', 'shortCount', 'coverCount');
          return res.jsonp(")]}',\n" + JSON.stringify(volume));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        throw err;
      });
  });

  app.get('/v1/assetvolume2/:days', apicache('10 minutes'), function(req, res) {
    var queryDate = new Date(Date.now());
    queryDate.setHours(-24 * Math.max(0, req.params.days));
    transactionChartCollection.find({
        'date': {
          $gte: new Date(queryDate)
        }
      }, {
        sort: {
          _id: 1
        }
      }).success(function(trxs) {
        if (trxs) {
          var volume = {};
          volume.transactions = reduceSum(trxs, 'timestamp', 'askCount', 'bidCount', 'shortCount', 'coverCount');
          return res.jsonp(")]}',\n" + JSON.stringify(volume));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        throw err;
      });
  });

  app.get('/v2/assetvolume/:query', function(req, res) {

    var promises = [],
      query = {},
      dateQuery = {},
      sortQuery = {
        sort: {
          _id: 1
        }
      };

    var oneDay = 1000 * 60 * 60 * 24;
    var oneWeek = 7 * oneDay;
    var oneMonth = 30 * oneDay;

    try {
      query = JSON.parse(req.params.query);
    } catch (err) {
      // console.log(err);
      query.start = 'error';
    }

    var start = new Date(query.start) || undefined;
    var end = new Date(query.end) || undefined;

    // console.log('start date:', start);
    // console.log('end date:', end);
    // console.log(end - start);

    if (start) {
      dateQuery.date = {};
      dateQuery.date.$gte = start;
    } else {
      start = 0;
    }
    if (end) {
      if (!dateQuery.date) {
        dateQuery.date = {};
      }
      dateQuery.date.$lt = end;
    }

    if (!isNaN(end - start) && end - start <= 2 * oneWeek) {
      // console.log('hourly');
      promises.push(transactionChartCollectionHour.find(dateQuery, sortQuery));
    } else if (!isNaN(end - start) && end - start < 12 * oneMonth) {
      promises.push(transactionChartCollectionDay.find(dateQuery, sortQuery));
    } else if (!isNaN(end - start) && end - start >= 12 * oneMonth) {
      promises.push(transactionChartCollectionWeek.find(dateQuery, sortQuery));
    } else {
      // console.log('else');
      promises.push(transactionChartCollectionDay.find({}, sortQuery));
    }

    Q.all(promises)
      .then(function(result) {
        if (result[0]) {
          var transactions = result[0];
          var volume = {};
          volume.transactions = reduceSum(transactions, 'timestamp', 'askCount', 'bidCount', 'shortCount', 'coverCount');
          return res.jsonp(")]}',\n" + JSON.stringify(volume));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v2/fees/:query', function(req, res) {
    var promises = [],
      query = {},
      dateQuery = {},
      sortQuery = {
        sort: {
          _id: 1
        }
      };

    var oneDay = 1000 * 60 * 60 * 24;
    var oneWeek = 7 * oneDay;
    var oneMonth = 30 * oneDay;

    try {
      query = JSON.parse(req.params.query);
    } catch (err) {
      // console.log('unable to parse JSON:', err);
      query.start = 'error';
      // return res.status(500).send();
    }

    var start = new Date(query.start) || undefined;
    var end = new Date(query.end) || undefined;

    if (!isNaN(end - start) && end - start <= 2 * oneWeek) {
      // console.log('hourly');
      promises.push(feesChartCollectionHour.find(dateQuery, sortQuery));
    } else if (!isNaN(end - start) && end - start < 12 * oneMonth) {
      promises.push(feesChartCollectionDay.find(dateQuery, sortQuery));
    } else if (!isNaN(end - start) && end - start >= 12 * oneMonth) {
      promises.push(feesChartCollectionWeek.find(dateQuery, sortQuery));
    } else {
      // console.log('else');
      promises.push(feesChartCollectionDay.find({}, sortQuery));
    }

    Q.all(promises)
      .then(function(result) {
        if (result[0]) {
          var fees = result[0];
          var returnArray = {};
          returnArray.fees = reduceFees(fees, 0);
          return res.jsonp(")]}',\n" + JSON.stringify(returnArray));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        throw err;
      });
  });

  app.get('/v1/fees', apicache('10 minutes'), function(req, res) {
    feesChartCollection.find({}, {
        sort: {
          _id: 1
        }
      }).success(function(fees) {
        if (fees) {
          var returnArray = {};
          returnArray.fees = reduceFees(fees, 0);
          return res.jsonp(")]}',\n" + JSON.stringify(returnArray));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        throw err;
      });
  });

  app.get('/v1/pricehistory/:symbol', apicache('10 minutes'), function(req, res) {
    priceHistoryCollection.findOne({
      symbol: req.params.symbol
    }).success(function(result) {

      if (result && result.history) {
        var returnHistory = reduceHistory(result.history);
        return res.jsonp(JSON.stringify(returnHistory));
      } else {
        return res.jsonp(")]}',\n" + JSON.stringify({
          price: []
        }));
      }
    });
  });

  app.get('/v2/pricehistory/:symbol', apicache('30 seconds'), function(req, res) {
    priceHistoryCollectionv2.findOne({
      symbol: req.params.symbol
    }).success(function(result) {
      if (result && result.base && result.base[_baseUnit]) {
        var returnHistory = reduceHistory(result.base[_baseUnit]);
        return res.jsonp(JSON.stringify(returnHistory));
      } else {
        return res.jsonp(")]}',\n" + JSON.stringify({
          price: []
        }));
      }
    });
  });

  app.get('/v1/feedstats/:symbol', apicache('60 seconds'), function(req, res) {

    feedDeviationCollectionv2.find({}, {
      fields: {
        symbol: 1
      }
    }).success(function(assets) {
      if (assets) {
        var symbol = 'USD'; // Default value - return USD
        for (var i = 0; i < assets.length; i++) { // Check the query if data exists for it
          if (req.params.symbol === assets[i].symbol) {
            symbol = req.params.symbol;
            break;
          }
        }
        feedDeviationCollectionv2.findOne({
          symbol: symbol
        }).success(function(stats) {
          if (stats) {
            return res.jsonp(JSON.stringify({
              assets: assets,
              stats: stats
            }));
          } else {
            return res.jsonp(")]}',\n" + JSON.stringify({
              assets: assets,
              stats: []
            }));
          }

        });
      } else {
        return res.status(404).send();
      }
    });

  });

  app.get('/v3/pricehistory/:symbol/:query', apicache('30 seconds'), function(req, res) {
    var query = req.params.query;
    console.log(req.params.query);
    try {
      query = JSON.parse(query);
    } catch (err) {
      console.log('v3/pricehistory error:', err);
      query.days = 'error';
      // return res.status(500).send();
    }

    var start = new Date();
    start.setDate(start.getDate() - query.days);
    var end = new Date();

    console.log('start:', start);
    // console.log('end:', end);

    // console.log({
    //   $gte: start.getTime(),
    //   $lte: end.getTime(),
    //   symbol: req.params.symbol
    // });
    var matchKey = "base." + _baseUnit + ".timestamp";
    var matchQuery = {};
    matchQuery[matchKey] = {
      $gte: start.getTime(),
      $lte: end.getTime()
    };

    priceHistoryCollectionv2.col.aggregate({
      $match: {
        symbol: req.params.symbol
      }
    }, {
      $unwind: "$base." + _baseUnit
    }, {
      $match: matchQuery
    }, {
      $group: {
        _id: '$_id',
        list: {
          $push: "$base." + _baseUnit
        }
      }
    }, function(error, result) {
      if (error) {
        console.log('v3/pricehistory error:', error);
      }
      // console.log('result length:', result.length);
      if (!error && result.length > 0 && result[0].list) {
        var returnHistory = reduceHistory(result[0].list);
        return res.jsonp(JSON.stringify(returnHistory));
      } else {
        return res.jsonp(")]}',\n" + JSON.stringify({
          price: []
        }));
      }
    });
  });

  app.get('/v1/getprecision/:id', apicache('30 minutes'), function(req, res) {
    assetsCollectionv2.findOne({
        '_id': parseInt(req.params.id, 10)
      }, {
        fields: {
          'precision': 1,
          'symbol': 1
        }
      }).success(function(precision) {
        if (precision) {
          return res.jsonp(")]}',\n" + JSON.stringify(precision));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        throw err;
      });
  });

  app.get('/v1/assetdetail', apicache('30 seconds'), function(req, res) {
    assetsCollectionv2.find({}, {
        fields: {
          'precision': 1,
          'symbol': 1
        }
      }).success(function(assets) {
        if (assets) {
          return res.jsonp(")]}',\n" + JSON.stringify(assets));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        throw err;
      });
  });

  app.get('/v1/assets', apicache('29 seconds'), function(req, res) {
    var returnObject = {};
    Q.all([assetsCollection.find({
          issuer_account_id: -2
        }, {
          'fields': {
            'precision': 1,
            'maximum_share_supply': 1,
            'status': 1,
            'symbol': 1,
            'issuer_account_id': 1,
            'current_share_supply': 1,
            'dailyVolume': 1,
            'numberValidFeeds': 1,
            'averageValidFeeds': 1,
            'collected_fees': 1,
            'medianFeed': 1
          }
        }),
        supplyCollection.find({
          marketAsset: true
        }, {
          fields: {
            currentCollateral: 1
          }
        }),
        btsxPriceCollection.findOne({}, {
          sort: {
            '_id': -1
          }
        })
      ])
      .then(function(results) {
        if (results) {
          returnObject.assets = results[0];
          returnObject.supply = results[1];
          returnObject.btsxprice = results[2];
          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(error) {
        return res.status(500).send();
      });
  });

  app.get('/v2/assets', apicache('29 seconds'), function(req, res) {
    var returnObject = {};
    Q.all([assetsCollectionv2.find({
          issuer_account_id: -2
        }, {
          fields: {
            'precision': 1,
            'maximum_share_supply': 1,
            'status': 1,
            'symbol': 1,
            'issuer_account_id': 1,
            'current_share_supply': 1,
            'dailyVolume': 1,
            'collected_fees': 1,
            'lastOrder': 1
          },
          sort: {
            '_id': 1
          }
        }),
        supplyCollection.find({
          marketAsset: true
        }, {
          fields: {
            currentCollateral: 1
          }
        }),
        btsxPriceCollection.findOne({}, {
          sort: {
            '_id': -1
          }
        }),
        feedsCollection.find({}, {
          fields: {
            medianFeed: 1,
            numberValidFeeds: 1
          },
          sort: {
            '_id': 1
          }
        })
      ])
      .then(function(results) {
        if (results) {
          returnObject.assets = results[0];
          returnObject.supply = results[1];
          returnObject.btsxprice = results[2];
          returnObject.feeds = results[3];
          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(error) {
        return res.status(500).send();
      });
  });

  app.get('/v1/userassets', apicache('300 seconds'), function(req, res) {
    var returnObject = {};
    assetsCollection.find({
        issuer_account_id: {
          $ne: -2
        }
      }, {
        'fields': {
          'initialized': 1,
          'maximum_share_supply': 1,
          'status': 1,
          'symbol': 1,
          'issuer_account_id': 1,
          'current_share_supply': 1,
          'dailyVolume': 1,
          'vwap': 1,
          'lastOrder': 1
        }
      })
      .success(function(userassets) {
        if (userassets) {
          returnObject.assets = userassets;
          btsxPriceCollection.findOne({}, {
            sort: {
              '_id': -1
            }
          }).success(function(price) {
            if (price) {
              returnObject.btsxprice = price;
            }
            return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
          });
        } else {
          return res.status(404).send();
        }
      });
  });

  app.get('/v2/userassets', apicache('300 seconds'), function(req, res) {
    var returnObject = {};
    Q.all([assetsCollectionv2.find({
          issuer_account_id: {
            $gt: 0
          }
        }, {
          'fields': {
            'initialized': 1,
            'maximum_share_supply': 1,
            'status': 1,
            'symbol': 1,
            'issuer_account_id': 1,
            'current_share_supply': 1,
            'dailyVolume': 1,
            'vwap': 1,
            'lastPrice': 1,
            'precision': 1
          }
        }),
        btsxPriceCollection.findOne({}, {
          sort: {
            '_id': -1
          }
        })
      ])
      .then(function(results) {
        if (results) {
          returnObject.assets = results[0];
          returnObject.btsxprice = results[1];
        }
        return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
      })
      .catch(function(error) {
        return res.status(500).send();
      });
  });

  app.get('/v1/assets/:id', apicache('29 seconds'), function(req, res) {
    var ratioToPrice;
    var buyOrders = [],
      sellOrders = [],
      promises = [];
    var asset;

    assetsCollection.findOne({
        'symbol': req.params.id
      }).success(function(result) {
        asset = result;
        if (asset !== null && asset !== undefined) {
          asset.sum = {};
          ratioToPrice = 100000 / asset.precision;

          if (!asset.asks) {
            asset.asks = [];
          }
          if (!asset.shorts) {
            asset.shorts = [];
          }
          if (!asset.bids) {
            asset.bids = [];
          }

          if (asset.bids !== undefined && asset.bids !== null) {
            asset.sum.bids = sumOrders(asset.bids, false, false, true);
            asset.bids = reduceOrders(asset.bids, true);
          }
          if (asset.asks !== undefined && asset.asks !== null) {
            asset.sum.asks = sumOrders(asset.asks, false);
            asset.asks = reduceOrders(asset.asks);
            asset.sum.asks.sort(function(a, b) {
              return a[0] - b[0];
            });
          }

          if (asset.shorts !== undefined && asset.shorts !== null) {
            asset.shorts = reduceShorts(asset.shorts, false);
          }
          if (asset.price_history !== undefined && asset.price_history !== null) {
            var price_history = reduceHistory(asset.price_history);
            delete asset.price_history;
            asset.price_history = price_history;
          }

          promises = [];
          promises.push(supplyCollection.findOne({
            _id: asset._id
          }));
          // if (req.params.id === 'USD' || req.params.id === 'BTC' || req.params.id === 'CNY') {
          //   promises.push(btsxPriceCollection.find({}));
          // }

          Q.all(promises)
            .then(function(results) {
              // asset.supply = results[0].supply;
              asset.supply = reduceArray(results[0].supply, 10000);
              if (results[0].collateral) {
                // asset.collateral = results[0].collateral;
                asset.collateral = reduceArray(results[0].collateral, 10000);
              } else {
                asset.collateral = 0;
              }
              // console.log(asset.collateral);
              // if (results[1]) {
              //   asset.realPrice = reduceRealPrice(results[1], req.params.id);
              // }

              return res.jsonp(")]}',\n" + JSON.stringify(asset));
            })
            .catch(function(err) {
              return res.status(500).send();
            });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(404).send();
      });

    function reduceOrders(array, usePrecision) {
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];

      for (var i = 0; i < array.length; i++) {
        if (usePrecision === false) {
          returnArray.push({
            price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
            amount: array[i].state.balance / 100000
          });
        } else {
          returnArray.push({
            price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
            amount: array[i].state.balance / asset.precision
          });
        }
      }
      return returnArray;
    }

    function reduceShorts(array, usePrecision) {
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      for (var i = 0; i < array.length; i++) {
        if (usePrecision === false) {
          // price, amount, interest, collateral, quantity
          returnArray.push({
            interest: Math.round(array[i].interest_rate.ratio * 100000) / 100000 * 100,
            collateral: array[i].collateral / 100000,
            price_limit: (array[i].state.limit_price === null) ? 'None' : array[i].state.limit_price.ratio * ratioToPrice
          });

          // quantity:(array[i].state.balance/100000)*array[i].market_index.order_price.ratio*100000/asset.precision
        } else {
          returnArray.push({
            interest: array[i].interest_rate.ratio * 100,
            collateral: array[i].collateral
          });
        }
      }
      return returnArray;
    }

    function sumOrders(array, inverse, filter, usePrecision) {
      filter = (filter === undefined) ? false : filter;
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      var sum = 0,
        duplicateCounter = 0;
      var i;
      var offset = 0;
      if (inverse) {
        for (i = array.length - 1; i > 0; i--) {
          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i < (array.length - 1) && xValue === array[i + 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }

          } else if (filter === true && xValue * ratioToPrice < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }
          }
        }
      } else {

        for (i = 0; i < array.length; i++) {

          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i > 1 && xValue === array[i - 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              // console.log('i:', i);
              // console.log(returnArray);
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }


          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }
          } else if (filter === true && xValue < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          }
        }
      }
      return returnArray;
    }
  });

  app.get('/v2/assets/:id', apicache('120 seconds'), function(req, res) {
    var ratioToPrice;
    var buyOrders = [],
      sellOrders = [],
      promises = [];
    var asset;
    Q.all([
        assetsCollectionv2.findOne({
          symbol: req.params.id
        }, {
          fields: {
            base: 0,
            asks: 0,
            shorts: 0,
            covers: 0,
            bids: 0
          }
        }),
        feedsCollection.findOne({
          symbol: req.params.id
        })
      ])
      .then(function(results) {
        if (results[0] !== null && results[0] !== undefined) {
          asset = results[0];
          asset.medianFeed = (results[1] !== null) ? results[1].medianFeed : 0;
          asset.numberValidFeeds = (results[1] !== null) ? results[1].numberValidFeeds : 0;

          asset.feeds = (results[1] !== null) ? results[1].feeds : [];

          asset.sum = {};
          ratioToPrice = 100000 / asset.precision;

          promises = [];
          promises.push(supplyCollection.findOne({
            _id: asset._id
          }));

          Q.all(promises)
            .then(function(results) {
              asset.supply = reduceArray(results[0].supply, 10000);
              if (results[0].collateral) {
                asset.collateral = reduceArray(results[0].collateral, 10000);
              } else {
                asset.collateral = 0;
              }

              return res.jsonp(")]}',\n" + JSON.stringify(asset));
            })
            .catch(function(err) {
              // console.log('Find supply failed:',err);
              asset.supply = [];
              asset.collateral = [];
              return res.jsonp(")]}',\n" + JSON.stringify(asset));
            });
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        console.log(err);
        return res.status(500).send();
      });
  });

  app.get('/v1/orderbook/:id', apicache('29 seconds'), function(req, res) {
    var ratioToPrice;
    var buyOrders = [],
      sellOrders = [],
      promises = [];
    var asset;

    assetsCollection.findOne({
        'symbol': req.params.id
      }, {
        fields: {
          asks: 1,
          bids: 1,
          shorts: 1,
          covers: 1,
          precision: 1,
          symbol: 1,
          medianFeed: 1,
          issuer_account_id: 1
        }
      }).success(function(result) {
        if (result !== null && result !== undefined) {
          asset = result;

          asset.sum = {};
          ratioToPrice = 100000 / asset.precision;

          if (!asset.asks) {
            asset.asks = [];
          }
          if (!asset.shorts) {
            asset.shorts = [];
          }
          if (!asset.bids) {
            asset.bids = [];
          }

          if (asset.bids !== undefined && asset.bids !== null) {
            asset.sum.bids = sumOrders(asset.bids, false, false, true);
            asset.bids = reduceOrders(asset.bids, true);
          }
          if (asset.asks !== undefined && asset.asks !== null) {
            asset.sum.asks = sumOrders(asset.asks, false);
            asset.asks = reduceOrders(asset.asks);
            asset.sum.asks.sort(function(a, b) {
              return a[0] - b[0];
            });
          }

          if (asset.shorts !== undefined && asset.shorts !== null) {
            asset.shorts = reduceShorts(asset.shorts, false);
          }

          return res.jsonp(")]}',\n" + JSON.stringify(asset));

        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        console.log(err);
        return res.status(500).send();
      });

    function reduceOrders(array, usePrecision) {
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];

      for (var i = 0; i < array.length; i++) {
        if (usePrecision === false) {
          returnArray.push({
            price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
            amount: array[i].state.balance / 100000
          });
        } else {
          returnArray.push({
            price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
            amount: array[i].state.balance / asset.precision
          });
        }
      }
      return returnArray;
    }

    function reduceShorts(array, usePrecision) {
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      for (var i = 0; i < array.length; i++) {
        if (usePrecision === false) {
          // price, amount, interest, collateral, quantity
          returnArray.push({
            interest: Math.round(array[i].interest_rate.ratio * 100000) / 100000 * 100,
            collateral: array[i].collateral / 100000,
            price_limit: (array[i].state.limit_price === null) ? 'None' : array[i].state.limit_price.ratio * ratioToPrice
          });

          // quantity:(array[i].state.balance/100000)*array[i].market_index.order_price.ratio*100000/asset.precision
        } else {
          returnArray.push({
            interest: array[i].interest_rate.ratio * 100,
            collateral: array[i].collateral / asset.precision
          });
        }
      }
      return returnArray;
    }

    function sumOrders(array, inverse, filter, usePrecision) {
      filter = (filter === undefined) ? false : filter;
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      var sum = 0,
        duplicateCounter = 0;
      var i;
      var offset = 0;
      if (inverse) {
        for (i = array.length - 1; i > 0; i--) {
          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i < (array.length - 1) && xValue === array[i + 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }

          } else if (filter === true && xValue * ratioToPrice < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }
          }
        }
      } else {

        for (i = 0; i < array.length; i++) {

          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i > 1 && xValue === array[i - 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              // console.log('i:', i);
              // console.log(returnArray);
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }


          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }
          } else if (filter === true && xValue < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          }
        }
      }
      return returnArray;
    }
  });

  app.get('/v2/orderbook/:id', apicache('15 seconds'), function(req, res) {
    var ratioToPrice;
    var buyOrders = [],
      sellOrders = [],
      promises = [];
    var asset = {};

    var baseAsset = 'BTS';

    Q.all([
        assetsCollectionv2.findOne({
          'symbol': req.params.id
        }, {
          fields: {
            base: 1,
            precision: 1,
            symbol: 1,
            medianFeed: 1,
            issuer_account_id: 1,
            dailyVolume: 1
          }
        }),
        feedsCollection.findOne({
          symbol: req.params.id
        }, {
          fields: {
            medianFeed: 1
          }
        }),
        metaMarketsCollection.findOne()
      ])
      .then(function(results) {
        if (results[0]) {

          results[0].base = results[0].base[baseAsset];
          asset = results[0];
          asset.baseAsset = baseAsset;
          asset.asks = results[0].base.asks || [];
          asset.bids = results[0].base.bids || [];
          asset.shorts = results[0].base.shorts || [];
          asset.covers = results[0].base.covers || [];
          asset.order_history = results[0].base.order_history || [];
          asset.medianFeed = (results[1] !== null) ? results[1].medianFeed : 0;
          var metaMarkets = (results[2]) ? results[2].markets : [];
          delete asset.base;
          asset = results[0];
          asset.sum = {};
          ratioToPrice = 100000 / asset.precision;

          if (asset.bids !== undefined && asset.bids !== null) {
            asset.sum.bids = sumOrders(asset.bids, false, false, true);
            asset.bids = reduceOrders(asset.bids, true, asset.precision, ratioToPrice);
          }
          if (asset.asks !== undefined && asset.asks !== null) {
            asset.sum.asks = sumOrders(asset.asks, false);
            asset.asks = reduceOrders(asset.asks, false, asset.precision, ratioToPrice);
            asset.sum.asks.sort(function(a, b) {
              return a[0] - b[0];
            });
          }

          if (asset.shorts !== undefined && asset.shorts !== null) {
            asset.shorts = reduceShorts(asset.shorts, false);
          }

          asset.metaMarket = null;

          if (metaMarkets.length > 0) {
            for (var i = 0; i < metaMarkets.length; i++) {
              if ('bit' + asset.symbol === metaMarkets[i].asset_name) {
                asset.metaMarket = metaMarkets[i];
                break;
              }
            }
          }

          return res.jsonp(")]}',\n" + JSON.stringify(asset));

        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });



    function reduceShorts(array, usePrecision) {
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      for (var i = 0; i < array.length; i++) {
        if (usePrecision === false) {
          // price, amount, interest, collateral, quantity
          returnArray.push({
            interest: Math.round(array[i].interest_rate.ratio * 100000) / 100000 * 100,
            collateral: array[i].collateral / 100000,
            price_limit: (array[i].state.limit_price === null) ? 'None' : array[i].state.limit_price.ratio * ratioToPrice
          });

          // quantity:(array[i].state.balance/100000)*array[i].market_index.order_price.ratio*100000/asset.precision
        } else {
          returnArray.push({
            interest: array[i].interest_rate.ratio * 100,
            collateral: array[i].collateral / asset.precision
          });
        }
      }
      return returnArray;
    }

    function sumOrders(array, inverse, filter, usePrecision) {
      filter = (filter === undefined) ? false : filter;
      usePrecision = (usePrecision === undefined) ? false : usePrecision;
      var returnArray = [];
      var sum = 0,
        duplicateCounter = 0;
      var i;
      var offset = 0;
      if (inverse) {
        for (i = array.length - 1; i > 0; i--) {
          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i < (array.length - 1) && xValue === array[i + 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }

          } else if (filter === true && xValue * ratioToPrice < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }
          }
        }
      } else {

        for (i = 0; i < array.length; i++) {

          let duplicate = false;
          let xValue = array[i].market_index.order_price.ratio;
          if (i > 1 && xValue === array[i - 1].market_index.order_price.ratio) {
            duplicate = true;
          }

          if (filter === false && usePrecision === false) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              // console.log('i:', i);
              // console.log(returnArray);
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }


          } else if (filter === false && usePrecision === true) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += (array[i].state.balance / asset.precision) * (1 / (xValue * ratioToPrice))
              ];
              duplicateCounter++;
            }
          } else if (filter === true && xValue < 1.1 * asset.status.center_price) {
            if (duplicate === false) {
              returnArray.push([1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ]);
            } else {
              returnArray[i - 1 - duplicateCounter] = [1 / (xValue * ratioToPrice),
                sum += array[i].state.balance / 100000
              ];
              duplicateCounter++;
            }

          }
        }
      }
      return returnArray;
    }
  });

  function reduceOrders(array, usePrecision, precision, ratioToPrice) {
    usePrecision = (usePrecision === undefined) ? false : usePrecision;
    var returnArray = [];

    for (var i = 0; i < array.length; i++) {
      if (usePrecision === false) {
        returnArray.push({
          price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
          amount: array[i].state.balance / 100000
        });
      } else {
        returnArray.push({
          price: 1 / (array[i].market_index.order_price.ratio * ratioToPrice),
          amount: array[i].state.balance / precision
        });
      }
    }
    return returnArray;
  }

  // FUNCTIONS
  function reduceSum(array, x, y, z, a, b, c, d, e, f, g, h) {
    var returnArray = [],
      i;
    if (c === undefined) {
      for (i = 0; i < array.length; i++) {
        returnArray.push([array[i][x],
          array[i][y],
          array[i][z],
          array[i][a],
          array[i][b]
        ]);
      }
      return returnArray;
    }

    for (i = 0; i < array.length; i++) {
      returnArray.push([array[i][x],
        array[i][y],
        Math.round(array[i][z] * 100) / 100 / 100000,
        array[i][a],
        array[i][b],
        array[i][c],
        array[i][d],
        array[i][e],
        array[i][f],
        array[i][g],
        array[i][h]
      ]);
    }

    return returnArray;
  }

  function reduceFees(array, assetId) {
    var returnArray = [];
    var fees;
    for (var i = 0; i < array.length; i++) {
      fees = (array[i].sumFees[assetId]) ? array[i].sumFees[assetId] / 100000 : 0;
      returnArray.push(
        [array[i].timestamp,
          fees,
        ]);
    }
    return returnArray;
  }

  function reduceHistory(array) {
    var returnArray = {};
    returnArray.price = [];
    returnArray.volume = [];
    var precision = 1000000;
    var oc_avg;
    for (var i = 0; i < array.length; i++) {
      oc_avg = (array[i].opening_price + array[i].closing_price) / 2;
      if (array[i].highest_bid / oc_avg < 0.75 || array[i].highest_bid / oc_avg > 1.25) {
        array[i].highest_bid = 0.9 * Math.max(array[i].opening_price, array[i].closing_price);
      }

      if (oc_avg / array[i].lowest_ask < 0.75 || oc_avg / array[i].lowest_ask > 1.25) {
        array[i].lowest_ask = 1.1 * Math.min(array[i].opening_price, array[i].closing_price);
      }

      returnArray.price.push([array[i].timestamp,
        Math.round(precision * 1 / array[i].opening_price) / precision,
        Math.round(precision * 1 / array[i].highest_bid) / precision,
        Math.round(precision * 1 / array[i].lowest_ask) / precision,
        Math.round(precision * 1 / array[i].closing_price) / precision
      ]);
      returnArray.volume.push([array[i].timestamp,
        Math.round((array[i].volume / config.basePrecision) * 100) / 100
      ]);
    }
    return returnArray;
  }

  function reduceRealPrice(array, assetName) {
    var returnArray = [];
    var i;
    if (assetName === 'USD') {
      for (i = 0; i < usd_price.length; i++) {
        returnArray.push([usd_price[i][0], 1 / usd_price[i][1]]);
      }
    } else if (assetName === 'BTC') {
      for (i = 0; i < btc_price.length; i++) {
        returnArray.push([btc_price[i][0], 1 / btc_price[i][1]]);
      }
    }
    for (i = 0; i < array.length; i++) {
      if (i === 0 || i % 9 === 0 || i === (array.length - 1)) {
        returnArray.push([parseInt(array[i].timestamp + '000', 10),
          1 / parseFloat(array[i].price[assetName.toLowerCase()])
        ]);
      }
    }
    return returnArray;
  }

  function reduceArray(array, threshold) {
    // console.log('length of incoming array:', array.length);
    var i, value, returnArray = [];
    returnArray.push([array[0][0],
      array[0][1]
    ]);
    for (i = 1; i < array.length; i++) {
      if (i === 0 || i % 6 === 0 || Math.abs(array[i][1] - array[i - 1][1]) > threshold || i === (array.length - 1)) {
        returnArray.push([array[i][0],
          array[i][1]
        ]);
      }
    }
    // console.log('length of outgoing array:', returnArray.length);
    return returnArray;
  }

  function createPlotArray(array, fieldsArray) {
    var start = Date.now();
    var returnArray = [],
      temp;
    for (var i = 0; i < array.length; i++) {
      temp = [];
      for (var j = 0; j < fieldsArray.length; j++) {
        temp.push(array[i][fieldsArray[j]]);
      }
      returnArray.push(temp);
    }

    // console.log('createPlotArray time taken:', (Date.now() - start) * 1000, 'mms');
    return returnArray;
  }

};