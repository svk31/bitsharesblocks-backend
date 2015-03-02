'use strict';

module.exports = function(db, app, maintenance, hardFork, apicache) {

  // VARIABLES
  var moment = require('moment');

  var forkSupplyBTS = 2498764341.60685;

  var transactionChartCollection = db.get('trxCharts');
  var transactionChartCollectionHour = db.get('trxChartsHour');
  var transactionChartCollectionDay = db.get('trxChartsDay');
  var transactionChartCollectionWeek = db.get('trxChartsWeek');
  var accountChartCollection = db.get('accountCharts');
  var delegatesListCollection = db.get('delegatesList');
  var homeCollection = db.get('home');
  var missedCollection = db.get('missed');
  var accountsCollection = db.get('accounts');
  var forksCollection = db.get('forks');
  var genesisCollection = db.get('genesisBTS');
  var securityCollection = db.get('security');
  var genesisBTSXCollection = db.get('genesisBTSX');
  var supplyCollection = db.get('supply');
  var uniqueAccountsCollection = db.get('uniqueAccounts');

  var Q = require('q');

  // var sizeof = require('sizeof');

  // ROUTES
  app.get('/v1/volume', apicache('10 minutes'), function(req, res) {
    var start = Date.now();
    transactionChartCollection.find({}, {
        sort: {
          _id: 1
        }
      })
      .success(function(trxs) {
        var volume = {};
        if (trxs) {
          volume.transactions = reduceSum(trxs, 'timestamp', 'numberTransactions', 'sumValue', 'updateCount',
            'transferCount', 'askCount', 'shortCount', 'feedCount', 'registrationCount', 'bidCount', 'coverCount');
          accountChartCollection.find({})
            .success(function(accounts) {
              if (accounts) {
                volume.accounts = reduceAcc(accounts, 'timestamp', 'totalAccounts', 'numberAccounts');
              }
              return res.jsonp(")]}',\n" + JSON.stringify(volume));
            });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/charts/:query', apicache('10 minutes'), function(req, res) {
    var start = Date.now();
    var query;
    try {
      query = JSON.parse(req.params.query);
    } catch (err) {
      return res.status(500).send();
    }

    var returnObject = {};
    var searchPromises = [];

    var accountsIndex = 0,
      trxIndex = 0;

    if (query.accounts) {
      searchPromises.push(accountChartCollection.find({}));
      trxIndex++;
    }

    if (query.trx) {
      searchPromises.push(transactionChartCollection.find({}, {
        sort: {
          _id: 1
        }
      }));
    }

    Q.all(searchPromises)
      .then(function(results) {
        if (results.length > 0) {
          if (query.accounts) {
            var accounts = results[accountsIndex];
            returnObject.accounts = createPlotArray(accounts, ['timestamp', 'totalAccounts', 'numberAccounts']);
          }

          if (query.trx) {
            var trxs = results[trxIndex];
            returnObject.transactions = createPlotArray(trxs, ['timestamp', 'numberTransactions', 'sumValue', 'updateCount',
              'transferCount', 'askCount', 'shortCount', 'feedCount', 'registrationCount', 'bidCount', 'coverCount'
            ]);
          }
          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v2/charts/:query', function(req, res) {
    // var start = Date.now();
    var oneDay = 1000 * 60 * 60 * 24;
    var oneWeek = 7 * oneDay;
    var oneMonth = 30 * oneDay;
    var query = {},
      dateQuery = {},
      sortQuery = {
        sort: {
          _id: 1
        }
      };
    try {
      query = JSON.parse(req.params.query);
    } catch (err) {
      query.start = 'error';
    }

    var start = new Date(query.start) || undefined;
    var end = new Date(query.end) || undefined;

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

    var returnObject = {};
    var searchPromises = [];

    var accountsIndex = 0,
      trxIndex = 0;

    if (query.accounts) {
      searchPromises.push(accountChartCollection.find({}, sortQuery));
      trxIndex++;
      searchPromises.push(uniqueAccountsCollection.find({}, sortQuery));
      trxIndex++;
    }

    if (query.trx) {
      if (!isNaN(end - start) && end - start < oneWeek) {
        searchPromises.push(transactionChartCollectionHour.find(dateQuery, sortQuery));
      } else if (!isNaN(end - start) && end - start < 12 * oneMonth) {
        searchPromises.push(transactionChartCollectionDay.find(dateQuery, sortQuery));
      } else if (!isNaN(end - start) && end - start >= 12 * oneMonth) {
        searchPromises.push(transactionChartCollectionWeek.find(dateQuery, sortQuery));
      } else {
        searchPromises.push(transactionChartCollectionDay.find({}, sortQuery));
      }
    }

    Q.all(searchPromises)
      .then(function(results) {
        if (results.length > 0) {
          if (query.accounts) {
            var accounts = results[accountsIndex];
            var uniqueAccounts = results[accountsIndex + 1];
            returnObject.accounts = createPlotArray(accounts, ['timestamp', 'totalAccounts', 'numberAccounts']);
            returnObject.uniqueAccounts = createPlotArray(uniqueAccounts, ['timestamp', 'unique', 'sum']);
          }

          if (query.trx) {
            var trxs = results[trxIndex];
            returnObject.transactions = createPlotArray(trxs, ['timestamp', 'numberTransactions', 'sumValue', 'updateCount',
              'transferCount', 'askCount', 'shortCount', 'feedCount', 'registrationCount', 'bidCount', 'coverCount'
            ]);
          }
          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/info', apicache('90 seconds'), function(req, res) {
    var info = {};
    info.maintenance = maintenance;
    // info.version = versionData;
    securityCollection.find({}).success(function(security) {
        if (security) {
          info.clientVersion = security[0].getInfo.client_version;
          return res.jsonp(")]}',\n" + JSON.stringify(info));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });

  });

  app.get('/v1/genesis', apicache('12 hours'), function(req, res) {

    genesisCollection.find({}).success(function(genesis) {
        if (genesis) {
          return res.jsonp(")]}',\n" + JSON.stringify(genesis));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/genesisbtsx', apicache('12 hours'), function(req, res) {

    genesisBTSXCollection.find({}).success(function(genesis) {
        if (genesis) {
          return res.jsonp(")]}',\n" + JSON.stringify(genesis));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });


  app.get('/v1/home', apicache('30 seconds'), function(req, res) {
    var yesterday = new moment.utc();
    yesterday = yesterday.subtract(1, 'days');
    var returnObject = {};
    var startDay = new Date(yesterday.year(), yesterday.month(), yesterday.date(), yesterday.hour(), yesterday.minute());

    Q.all([
        homeCollection.findOne({}),
        missedCollection.find({}, {
          sort: {
            _id: -1
          },
          limit: 10
        }),
        accountsCollection.find({}, {
          fields: {
            name: 1,
            registration_date: 1,
            reg_block: 1
          },
          sort: {
            _id: -1
          },
          limit: 10
        }),
        forksCollection.find({
          timestampISO: {
            $gte: startDay
          }
        })
      ])
      .then(function(results) {
        if (results[0] && results[1] && results[2] && results[3]) {
          var home = results[0];
          var missed = results[1];
          var newusers = results[2];
          var forks = results[3];

          returnObject = home;
          returnObject.userAssets = home.userAssets;
          returnObject.assetCount = home.assetCount;
          returnObject.hardFork = hardFork;

          returnObject.missed = missed;
          returnObject.maintenance = maintenance;

          returnObject.newUsers = newusers;

          if (forks.length === 0) {
            forksCollection.findOne({}, {
              sort: {
                _id: -1
              }
            }).success(function(lastfork) {
              returnObject.forks = {
                'count24hrs': 0,
                'previous': lastfork
              };
              return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
            });
          } else {
            returnObject.forks = {
              'count24hrs': forks.length,
              'previous': forks[forks.length - 1]
            };
            return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
          }
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/inflation', apicache('5 minutes'), function(req, res) {
    var inflation = {};
    inflation.inflation = [];

    Q.all([
      supplyCollection.findOne({
        _id: 0
      }),
      homeCollection.findOne({})
      ])    
      .then(function(results) {
        var bts = results[0];
        var currentPay = results[1].averagePay;
        if (bts && currentPay) {
          inflation.inflation.push([bts.supply[0][0], 0]);
          for (var i = 1; i < bts.supply.length; i++) {
            inflation.inflation.push([bts.supply[i][0], bts.supply[i][1] - bts.supply[i - 1][1]]);
          }
          inflation.supply = bts.supply;
          inflation.currentPay = currentPay;
          return res.jsonp(")]}',\n" + JSON.stringify(inflation));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });



  // FUNCTIONS
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

  function reduceSum(array, x, y, z, a, b, c, d, e, f, g, h) {
    var start = Date.now();
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
    // console.log('reduceSum time taken:', (Date.now() - start) * 1000, 'mms');
    return returnArray;
  }

  function reduceAcc(array, x, y, z) {
    var start = Date.now();
    var returnArray = [];
    for (var i = 0; i < array.length; i++) {
      returnArray.push([array[i][x],
        array[i][y],
        array[i][z]
      ]);
    }
    // console.log('reduceAcc time taken:', (Date.now() - start) * 1000, 'mms');
    return returnArray;
  }

};