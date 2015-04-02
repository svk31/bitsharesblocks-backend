'use strict';

module.exports = function(db, app, versionData, versionData_v2, maintenance, apicache) {

  // VARIABLES
  var Q = require('q');
  var delegatesListCollection = db.get('delegatesList');
  var delegatesRecord = db.get('delegatesRecord');
  var delegateBlocks = db.get('delegateBlocks');
  var delegatesRankCollection = db.get('delegatesRanks');
  var latencyCollection = db.get('latencies');
  var feedsCollection = db.get('delegateFeeds');
  var votesByIDCollection = db.get('votesById');
  var payCollection = db.get('delegatePay');
  var slatesCollection = db.get('slates');
  var delegateFields = {
    '_id': 1,
    'name': 1,
    'delegate_info': 1,
    'rank': 1,
    'reliability': 1,
    'public_data': 1
  };

  var config = require('../../config_dvs.json');
  var basePrecision = config.basePrecision;
  var votesCutoff = 100000;

  // ROUTES
  app.get('/v1/delegateNames', apicache('90 seconds'), function(req, res) {
    delegatesListCollection.find({}, {
        'fields': {
          '_id': 1,
          'name': 1
        }
      }).success(function(names) {
        if (names) {
          return res.jsonp(")]}',\n" + JSON.stringify(names));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/slate/:name', apicache('90 seconds'), function(req, res) {
    slatesCollection.findOne({
        name: req.params.name
      }).success(function(slate) {
        if (slate) {
          return res.jsonp(")]}',\n" + JSON.stringify(slate));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });


  app.get('/v1/delegatebyname/:query', apicache('90 seconds'), function(req, res) {
    // console.log('query:', req.params.query);
    if (req.params.query !== undefined) {
      var regexp = new RegExp(req.params.query, 'g');
      delegatesListCollection.find({
          name: regexp
        }, {
          'fields': {
            '_id': 0,
            'name': 1
          }
        }).success(function(delegates) {
          if (delegates) {
            return res.jsonp(")]}',\n" + JSON.stringify(delegates));
          } else {
            return res.status(404).send();
          }
        })
        .error(function(err) {
          return res.status(500).send();
        });
    } else {
      return res.status(404).send();
    }
  });

  app.get('/v1/delegatenamebyid/:id', apicache('90 seconds'), function(req, res) {
    delegatesListCollection.findOne({
        _id: parseInt(req.params.id, 10)
      }, {
        'fields': {
          '_id': 0,
          'name': 1
        }
      }).success(function(delegate) {
        if (delegate) {
          return res.jsonp(")]}',\n" + JSON.stringify(delegate));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v2/delegates/:query', apicache('90 seconds'), function(req, res) {
    var returnObject = {};
    returnObject.versions_v2 = versionData_v2;
    returnObject.maintenance = maintenance;

    var query = {},
      searchQuery;

    try {
      query = JSON.parse(req.params.query);
    } catch (err) {
      query.active = true;
    }

    query.active = query.active || false;
    query.standby = query.standby || false;

    if (query.active === true && query.standby === false) {
      searchQuery = {
        rank: {
          $lte: 101
        }
      };

    } else if (query.active === false && query.standby === true) {
      searchQuery = {
        rank: {
          $gt: 101
        },
        'delegate_info.votes_for': {
          '$gt': votesCutoff
        }
      };

    } else if (query.active === true && query.standby === true) {
      searchQuery = {
        'delegate_info.votes_for': {
          '$gt': votesCutoff
        }
      };
    }

    if (query.active !== true && query.active !== false) {
      query.active = true;
    }

    if (query.standby !== true && query.standby !== false) {
      query.standby = false;
    }

    Q.all([
        delegatesListCollection.find(searchQuery, {
          sort: {
            'rank': 1
          },
          fields: delegateFields
        }),
        delegatesRankCollection.find({}),
        latencyCollection.find({}),
        feedsCollection.find({}, {
          fields: {
            'activeFeeds': 1,
            'uniqueCount': 1
          }
        })
      ])
      .then(function(results) {
        if (results[0] && results[1] && results[2] && results[3]) {

          returnObject.delegates = results[0];
          returnObject.ranks = results[1][0];
          if (!returnObject.ranks) {
            returnObject.ranks = {};
            returnObject.ranks.dayChange = {};
            returnObject.ranks.weekChange = {};
          }
          returnObject.latencies = results[2];
          returnObject.activeFeeds = results[3];

          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });

  });

  app.get('/v1/delegates', apicache('90 seconds'), function(req, res) {
    var returnObject = {};
    returnObject.versions = versionData;
    returnObject.versions_v2 = versionData_v2;
    returnObject.maintenance = maintenance;

    Q.all([
        delegatesListCollection.find({
          'delegate_info.votes_for': {
            '$gt': 0
          }
        }, {
          sort: {
            'rank': 1
          },
          fields: delegateFields
        }),
        delegatesRankCollection.find({}),
        latencyCollection.find({}),
        feedsCollection.find({}, {
          fields: {
            'activeFeeds': 1,
            'uniqueCount': 1
          }
        })
      ])
      .then(function(results) {
        if (results[0] && results[1] && results[2] && results[3]) {
          var delegates = results[0];
          for (var i = 0; i < delegates.length; i++) {
            delete delegates[i].delegate_info.next_secret_hash;
            delete delegates[i].delegate_info.votes_for;
            delete delegates[i].delegate_info.block_signing_key;
            delete delegates[i].delegate_info.signing_key_history;
          }
          returnObject.delegates = delegates;
          returnObject.ranks = results[1][0];
          returnObject.latencies = results[2];
          returnObject.activeFeeds = results[3];

          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });

  });

  app.get('/v1/activedelegates', apicache('90 seconds'), function(req, res) {
    var returnObject = {},
      i;
    returnObject.versions = versionData;
    returnObject.versions_v2 = versionData_v2;
    returnObject.maintenance = maintenance;

    Q.all([
        delegatesListCollection.find({
          'rank': {
            '$lt': 102
          }
        }, {
          sort: {
            'rank': 1
          },
          fields: delegateFields
        }),
        delegatesRankCollection.find({}),
        latencyCollection.find({}),
        feedsCollection.find({}, {
          fields: {
            'activeFeeds': 1,
            'uniqueCount': 1
          }
        })
      ])
      .then(function(results) {
        if (results[0] && results[1] && results[2] && results[3]) {
          var delegates = results[0];
          for (i = 0; i < delegates.length; i++) {
            delete delegates[i].delegate_info.next_secret_hash;
            delete delegates[i].delegate_info.votes_for;
            delete delegates[i].delegate_info.block_signing_key;
            delete delegates[i].delegate_info.signing_key_history;
          }
          returnObject.delegates = delegates;
          var returnRanks = {};
          returnRanks.dayChange = {};
          returnRanks.weekChange = {};
          for (i = 0; i < returnObject.delegates.length; i++) {
            returnRanks.dayChange[returnObject.delegates[i]._id] = results[1][0].dayChange[returnObject.delegates[i]._id];
            returnRanks.weekChange[returnObject.delegates[i]._id] = results[1][0].weekChange[returnObject.delegates[i]._id];
          }
          returnObject.ranks = returnRanks;
          returnObject.latencies = results[2];
          returnObject.activeFeeds = results[3];

          return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });

  });

  app.get('/v1/delegatevotes/:id', apicache('90 seconds'), function(req, res) {
    var returnObject = {};

    delegatesListCollection.findOne({
        'name': req.params.id
      }, {}).success(function(delegate) {
        if (delegate !== null && delegate._id !== undefined) {

          votesByIDCollection.findOne({
              '_id': delegate._id
            }, {}).success(function(votes) {
              if (votes) {
                // console.log('nr of votes:', votes.votes.length);
                returnObject.votesCount = votes.votes.length;
                var maxVote = 0;
                for (var i = 0; i < votes.votes.length; i++) {
                  votes.votes[i].vote /= basePrecision;
                  if (votes.votes[i].vote > maxVote) {
                    maxVote = votes.votes[i].vote;
                  }
                }
                returnObject.votesSum = sumVotes(votes.votes, 'block', 'vote', maxVote / 1000, true);
                returnObject.votes = reduceVotes(votes.votes);
              }
              return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
            })
            .error(function(err) {
              return res.status(500).send();
            });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/delegates/:id', apicache('90 seconds'), function(req, res) {
    var returnObject = {};
    returnObject.versions = versionData;
    returnObject.versions_v2 = versionData_v2;

    delegatesListCollection.findOne({
        'name': req.params.id
      }, {})
      .success(function(delegate) {
        if (delegate !== null && delegate._id !== undefined) {
          returnObject.delegate = delegate;

          Q.all([
              latencyCollection.find({}),
              delegatesRankCollection.find({}),
              feedsCollection.find({
                '_id': delegate._id
              }, {
                fields: {
                  'feedFrequency': 0
                }
              }),
              payCollection.findOne({
                _id: delegate._id
              })
            ])
            .then(function(results) {
              if (results[0] && results[1] && results[2]) {
                var latencies = results[0];
                returnObject.latencies = latencies[0].latencies[delegate._id];
                var ranks = results[1];
                returnObject.ranks = {
                  'dayChange': ranks[0].dayChange[returnObject.delegate.id],
                  'weekChange': ranks[0].weekChange[returnObject.delegate.id]
                };

                var feeds = results[2];
                returnObject.feeds = feeds;

                var pay = results[3];
                if (pay !== null) {
                  var totalFees = 0;
                  if (pay.fees) {
                    for (var i = 0; i < pay.fees.length; i++) {
                      totalFees += pay.fees[i][2];
                    }
                  }
                  returnObject.withdrawals = [];
                  if (pay.withdrawals) {
                    returnObject.withdrawals = sumVotes(pay.withdrawals, '0', '2', 0, false);
                  }
                  returnObject.totalFees = totalFees;
                  returnObject.initialFee = pay.fees[0][0];
                  // delegatesRecord.findOne({'_id':doc._id}).success(function(record) {
                  //   var recentRecord=[];
                  //   if (record !== null && record.slotrecord.length > 50) {
                  //     recentRecord = record.slotrecord.slice(-50);
                  //   }
                  //   else if (record !==undefined && record !==null && record.slotrecord !== null){
                  //    recentRecord=record.slotrecord;
                  //  }
                  //  else {
                  //     // console.log('delegate null');
                  //     recentRecord = [];
                  //   }
                  //   returnObject.record = recentRecord;
                }
                return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
              } else {
                return res.status(404).send();
              }
            });
        } else {
          return res.status(404).send();
        }
      });
  });



  app.get('/v1/delegatesbyrank/:rank', apicache('45 seconds'), function(req, res) {
    var returnObject = {};
    delegatesListCollection.findOne({
        'rank': parseInt(req.params.rank)
      }, {})
      .success(function(delegate) {
        if (delegate !== null && delegate._id !== undefined) {
          returnObject.delegate = delegate;
          Q.all([
              latencyCollection.find({}),
              feedsCollection.find({
                '_id': delegate._id
              }),
              delegatesRankCollection.find({}),
              payCollection.findOne({
                _id: delegate._id
              })
            ])
            .then(function(results) {
              if (results[0] && results[1] && results[2]) {
                var latencies = results[0];
                returnObject.latencies = latencies[0].latencies[delegate._id];
                var feeds = results[1];
                returnObject.feeds = feeds;
                var ranks = results[2];
                returnObject.ranks = {
                  'dayChange': ranks[0].dayChange[returnObject.delegate.id],
                  'weekChange': ranks[0].weekChange[returnObject.delegate.id]
                };
                // delegatesRecord.findOne({'_id':delegate._id}).success(function(record) {
                //   var recentRecord=[];
                //   if (record !== null && record.slotrecord.length > 50) {
                //     recentRecord = record.slotrecord.slice(-50);
                //   }
                //   else if (record !==undefined && record !==null && record.slotrecord !== null){
                //    recentRecord=record.slotrecord;
                //  }
                //  else {
                //   // console.log('delegate null');
                //   recentRecord = [];
                // }
                // returnObject.record = recentRecord;
                var pay = results[3];
                if (pay !== null) {
                  var totalFees = 0;
                  if (pay.fees) {
                    for (var i = 0; i < pay.fees.length; i++) {
                      totalFees += pay.fees[i][2];
                    }
                  }
                  // returnObject.fees = sumVotes(pay.fees,'1','2',0,false);
                  returnObject.withdrawals = [];
                  if (pay.withdrawals) {
                    returnObject.withdrawals = sumVotes(pay.withdrawals, '0', '2', 0, false);
                  }
                  returnObject.totalFees = totalFees;
                  returnObject.initialFee = pay.fees[0][0];
                }
                return res.jsonp(")]}',\n" + JSON.stringify(returnObject));
              } else {
                return res.status(404).send();
              }
            })
            .catch(function(err) {
              return res.status(500).send();
            });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  // FUNCTIONS
  function sumVotes(array, x, y, cutoff, flat) {
    // console.log('cutoff:'+cutoff);
    var returnArray = [];
    var sum = 0;
    for (var i = 0; i < array.length; i++) {

      // if (i > 0 && array[i][x] === array[i-1][x]) {
      // console.log('double array values');
      // console.log('x: '+array[i][x]+ ' y: '+array[i][y])
      // }
      // if (!isNaN(sum)) {
      //   console.log(array[i]);
      // }

      if (i === 0) {
        sum = sum + array[i][y];
        returnArray.push([array[i][x],
          sum
        ]);
      } else if ((Math.abs(array[i][y]) > cutoff && array[i][x] - array[i - 1][x] !== 0) || (array[i][x] - returnArray[returnArray.length - 1][0]) > 50000) {
        if (flat) {
          returnArray.push([
            array[i][x] - 0.01,
            returnArray[returnArray.length - 1][1]
          ]);
        }
        sum = sum + array[i][y];
        returnArray.push([array[i][x],
          sum
        ]);
      } else if (i === array.length - 1) {
        if (flat) {
          returnArray.push([
            array[i][x] - 0.01,
            returnArray[returnArray.length - 1][1]
          ]);
        }
        sum = sum + array[i][y];
        returnArray.push([array[i][x],
          sum
        ]);
      } else {
        sum += array[i][y];
      }
      // if (!isNaN(sum)) {
      //   console.log('sum:', sum);
      // }
    }
    // console.log('final array length: '+returnArray.length);
    return returnArray;
  }

  function reduceVotes(array) {
    var returnArray = {};
    returnArray.votes = [];
    for (var i = 0; i < array.length; i++) {
      if (Math.abs(array[i].vote) >= 10000) {
        returnArray.votes.push({
          block: array[i].block,
          vote: array[i].vote
        });
      }
    }
    return returnArray;
  }

};