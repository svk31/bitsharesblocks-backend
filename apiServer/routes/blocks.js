'use strict';

module.exports = function(db, app, apicache) {

  // VARIABLES
  var blocksCollection = db.get('blocks');
  var transactionsCollection = db.get('transactions');
  var utils = require('../../utils/utils.js');
  var Q = require('q');

  var limitTo = 20; // max number of blocks to return
  var blockFields = {
    '_id': 1,
    'timestamp': 1,
    'signee': 1,
    'trxLength': 1,
    'types': 1
  };
  var _currentBlock, _currentBlockData;
  var approvedOperations = ['burn', 'asset_short', 'asset_ask', 'asset_bid', 'asset_cover', 'asset_issue', 'asset_create',
    'account_register', 'account_update', 'update_feed', 'transfer', 'add_collateral', 'withdraw_pay', 'all'
  ];


  // ROUTES
  app.get('/v1/transactions/:query', apicache('5 seconds'), function(req, res) {
    var trxType;
    var approved = false;
    var query, types = [],
      i, j, sort = {},
      idSearch = {};

    query = JSON.parse(req.params.query);
    sort = (query.sort) ? {
      _id: query.sort
    } : {
      _id: 1
    };
    if (query.block) {
      idSearch = (query.inverse) ? {
        '$gt': query.block
      } : {
        '$lte': query.block
      };
    }
    var typesQuery = {
      $in: []
    };
    for (i = 0; i < query.types.length; i++) {
      for (j = 0; j < approvedOperations.length; j++) {
        if (query.types[i] === approvedOperations[j]) {
          types.push(query.types[i]);
          typesQuery.$in.push(query.types[i]);
          approved = true;
        }
      }
    }

    if (approved) {

      var searchQuery = {
        types: typesQuery,
        _id: idSearch
      };


      // console.log(types);
      if (types[0] === 'all') {
        delete searchQuery.types;
      }
      // else if (types.length === 1) {
      //   delete searchQuery.types;
      //   searchQuery.types = types[0].types;
      // }

      if (!query.block) {
        delete searchQuery._id;
      }

      var start = Date.now();
      // console.log(searchQuery);
      transactionsCollection.find(searchQuery, {
        limit: limitTo,
        sort: sort
      }).success(function(transactions) {
        if (transactions) {
          console.log('time taken for types: ', (Date.now() - start) / 1000, 'seconds');
          // console.log(transactions);
          var ids = [];
          for (var i = 0; i < transactions.length; i++) {
            ids.push(transactions[i]._id);
          }

          start = Date.now();
          var promises = [];
          promises.push(blocksCollection.find({
            '_id': {
              $in: ids
            }
          }, {
            fields: blockFields
          }));

          if (types[0] !== 'all') {
            promises.push(transactionsCollection.findOne({
              types: typesQuery
            }, {
              sort: {
                _id: -1
              }
            }));
          } else {
            promises.push(transactionsCollection.findOne({}, {
              sort: {
                _id: -1
              }
            }));
          }

          Q.all(promises)
            .then(function(results) {
              if (results[0] && results[1]) {
                // var transactions = results[0];
                var blocks = results[0],
                  count = 0;

                count = results[1]._id;
                // console.log('most recent trx found:', count);

                blocks = addTrxInfo(blocks, transactions);
                console.log('time taken for blocks and count: ', (Date.now() - start) / 1000, 'seconds');

                return res.jsonp(")]}',\n" + JSON.stringify({
                  blocks: blocks,
                  maxBlock: count
                }));
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
      });
    } else {
      console.log('no approved operations');
      return res.status(404).send();
    }
  });

  app.get('/v1/burns', apicache('60 seconds'), function(req, res) {
    var query, burns = [],
      i, j, sort = {};

    var typesQuery = {
      types: {
        $in: ['burn']
      }
    };

    transactionsCollection.find(typesQuery, {
        limit: 15,
        sort: {
          _id: -1
        }
      }).success(function(blocks) {
        if (blocks) {
          blocks.forEach(function(block, i) {
            block.types.forEach(function(type, index) {
              if (type === 'burn') {
                burns.push({
                  burn: block.transactions[index][1].trx,
                  _id: block._id
                });
              }
            });
          });
          return res.jsonp(")]}',\n" + JSON.stringify(burns));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        console.log('burns error:',err);
        return res.status(500).send();
      });

  });

  app.get('/v1/burns/:sort', apicache('60 seconds'), function(req, res) {
    var sortQuery, burns = [],
      i, j, options;

    var typesQuery = {
      types: {
        $in: ['burn']
      }
    };

    options = {
      limit: 15
    };

    sortQuery = req.params.sort;
    if (sortQuery !== '_id' && sortQuery !== 'burns.0') {
      sortQuery = "burns.0";
    }

    options.sort = {};
    options.sort[sortQuery] = -1;

    transactionsCollection.find(typesQuery, options)
      .success(function(blocks) {
        if (blocks) {
          blocks.forEach(function(block, i) {
            block.types.forEach(function(type, index) {

              if (type === 'burn' && blocks[i].transactions[index][1].account_id !== 1092) {
                burns.push({
                  burn: block.transactions[index][1].trx,
                  _id: block._id
                });
              }
            });
          });
          return res.jsonp(")]}',\n" + JSON.stringify(burns));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        console.log('v1/burns error:',err);
        return res.status(500).send();
      });

  });

  app.get('/v1/blocks/new', apicache('5 seconds'), function(req, res) {
    blocksCollection.find({}, {
        sort: {
          '_id': -1
        },
        limit: limitTo,
        fields: blockFields
      }).success(function(blocks) {
        if (blocks) {
          transactionsCollection.find({
            '_id': {
              '$gte': blocks[limitTo - 1]._id
            }
          }, {
            sort: {
              '_id': -1
            },
            limit: limitTo
          }).success(function(transactions) {
            if (transactions) {
              blocks = addTrxInfo(blocks, transactions);
            }
            return res.jsonp(")]}',\n" + JSON.stringify(blocks));
          });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/blocks/new/:mostrecent', function(req, res) {
    req.params.mostrecent = Math.min(_currentBlock, parseInt(req.params.mostrecent, 10));
    req.params.mostrecent = parseInt(req.params.mostrecent, 10);
    var searchPromise = [];
    if (req.params.mostrecent === 'undefined' || req.params.mostrecent === undefined || req.params.mostrecent === null || isNaN(req.params.mostrecent)) {
      blocksCollection.findOne({}, {
        fields: blockFields,
        sort: {
          _id: -1
        }
      }).
      success(function(block) {
        if (block) {
          return res.jsonp(")]}',\n" + JSON.stringify(block));
        } else {
          return res.status(404).send();
        }
      });
    } else {
      req.params.mostrecent = Math.max(req.params.mostrecent, _currentBlock - 101);
      if (req.params.mostrecent >= _currentBlock) {
        searchPromise.push(_currentBlockData);
      } else {
        searchPromise.push(blocksCollection.find({
          '_id': {
            '$gt': parseInt(req.params.mostrecent)
          }
        }, {
          fields: blockFields,
          limit: limitTo
        }));
      }
      Q.all(searchPromise)
        .then(function(result) {
          if (result[0] !== null && result[0] !== undefined) {
            var blocks = result[0];

            var ids = [];
            for (var i = 0; i < blocks.length; i++) {
              ids.push(blocks[i]._id);
            }

            transactionsCollection.find({
                '_id': {
                  $in: ids
                }
              })
              .success(function(transactions) {
                if (transactions !== null && transactions !== undefined) {
                  blocks = addTrxInfo(blocks, transactions);
                  return res.jsonp(")]}',\n" + JSON.stringify(blocks));
                } else {
                  return res.jsonp(")]}',\n" + JSON.stringify(blocks));
                }
              });
          } else {
            return res.status(404).send();
          }
        })
        .catch(function(err) {
          return res.status(500).send();
        });
    }
  });

  app.get('/v1/blocks/:id', apicache('30 minutes'), function(req, res) {
    var block = [];
    if (req.params.id > _currentBlock) {
      req.params.id = _currentBlock;
    }
    blocksCollection.findOne({
        '_id': parseInt(req.params.id)
      }, {
        fields: {
          'transaction_digest': 0,
          'delegate_signature': 0,
          'reg_date_ISO': 0
        }
      }).success(function(block) {
        if (block) {
          transactionsCollection.findOne({
              '_id': parseInt(req.params.id, 10)
            }).success(function(transaction) {
              if (transaction === null) {
                block.transactions = [];
                block.totalvalue = 0;
                block.fees = 0;
              } else {
                block.transactions = transaction.transactions;
                block.totalvalue = transaction.totalvalue;
                block.fees = transaction.fees;
              }
              return res.jsonp(")]}',\n" + JSON.stringify(block));
            })
            .error(function(err) {
              throw err;
            });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/blocks/page/:id', function(req, res) {
    var id = parseInt(req.params.id, 10);
    id = Math.max(limitTo, id);
    id = Math.min(_currentBlock, id);

    blocksCollection.find({
        '_id': {
          $lte: id
        }
      }, {
        sort: {
          '_id': -1
        },
        limit: limitTo,
        fields: blockFields
      }).success(function(blocks) {
        if (blocks) {
          var ids = [];

          for (var i = 0; i < blocks.length; i++) {
            ids.push(blocks[i]._id);
          }

          transactionsCollection.find({
            '_id': {
              $in: ids
            }
          }, {
            sort: {
              '_id': -1
            },
            limit: limitTo
          }).success(function(transactions) {
            blocks = addTrxInfo(blocks, transactions);
            return res.jsonp(")]}',\n" + JSON.stringify(blocks));
          });
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  // WITH TRANSACTIONS
  app.get('/v1/blocksbytrx/:trxid', function(req, res) {

    Q.all([
        transactionsCollection.findOne({
          'full_ids': req.params.trxid
        }, {
          'fields': {
            '_id': 1
          }
        }),
        transactionsCollection.findOne({
          'short_ids': req.params.trxid
        }, {
          'fields': {
            '_id': 1
          }
        })
      ])
      .then(function(result) {
        var block;
        if (result[0]) {
          block = result[0];
        } else if (result[1]) {
          block = result[1];
        }

        if (block !== undefined) {
          return res.jsonp(")]}',\n" + JSON.stringify(block));
        } else {
          return res.status(404).send();
        }
      })
      .catch(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/blockstrx/new', apicache('10 seconds'), function(req, res) {
    blocksCollection.find({
        'trxLength': {
          $gt: 0
        }
      }, {
        fields: blockFields,
        sort: {
          '_id': -1
        },
        limit: limitTo
      }).success(function(blocks) {
        if (blocks) {
          var ids = [];
          for (var i = 0; i < blocks.length; i++) {
            ids.push(blocks[i]._id);
          }
          transactionsCollection.find({
              '_id': {
                $in: ids
              }
            }, {
              sort: {
                '_id': -1
              }
            }).success(function(transactions) {
              if (transactions) {
                blocks = addTrxInfo(blocks, transactions);
              }
              return res.jsonp(")]}',\n" + JSON.stringify(blocks));
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

  app.get('/v1/blockstrx/new/:mostrecent', function(req, res) {
    req.params.mostrecent = Math.min(_currentBlock, parseInt(req.params.mostrecent, 10));
    if (req.params.mostrecent === 'undefined' || req.params.mostrecent === undefined || req.params.mostrecent === null || isNaN(req.params.mostrecent)) {
      return res.status(404).send();
    } else {
      req.params.mostrecent = Math.max(req.params.mostrecent, _currentBlock - 100);
      blocksCollection.find({
          '_id': {
            '$gt': req.params.mostrecent
          },
          'trxLength': {
            $gt: 0
          }
        }, {
          fields: blockFields,
          limit: limitTo
        })
        .success(function(blocks) {
          if (blocks) {
            var ids = [];

            for (var i = 0; i < blocks.length; i++) {
              ids.push(blocks[i]._id);
            }

            transactionsCollection.find({
                '_id': {
                  $in: ids
                }
              }, {
                sort: {
                  '_id': -1
                }
              }).success(function(transactions) {
                blocks = addTrxInfo(blocks, transactions);
                return res.jsonp(")]}',\n" + JSON.stringify(blocks));
              })
              .error(function(err) {
                throw err;
              });
          } else {
            return res.status(404).send();
          }
        })
        .error(function(err) {
          return res.status(500).send();
        });
    }
  });

  app.get('/v1/blockstrx/page/:id', function(req, res) {
    var id = parseInt(req.params.id, 10);
    id = Math.max(2023, id);
    id = Math.min(_currentBlock, id);
    transactionsCollection.count().success(function(trxCount) {
      if (trxCount) {
        blocksCollection.find({
            'trxLength': {
              $gt: 0
            },
            '_id': {
              $lte: id
            }
          }, {
            fields: blockFields,
            sort: {
              '_id': -1
            },
            limit: limitTo
          })
          .success(function(blocks) {
            if (blocks) {
              var ids = [];

              for (var i = 0; i < blocks.length; i++) {
                ids.push(blocks[i]._id);
              }

              transactionsCollection.find({
                '_id': {
                  $in: ids
                }
              }, {
                sort: {
                  '_id': -1
                }
              }).success(function(transactions) {
                if (transactions) {
                  blocks = addTrxInfo(blocks, transactions);
                }
                return res.jsonp(")]}',\n" + JSON.stringify({
                  'blocks': blocks,
                  'trxCount': trxCount
                }));
              });
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
  });

  app.get('/v1/blockstrx/pageinverse/:id', function(req, res) {
    var id = parseInt(req.params.id, 10);
    id = Math.max(2023, id);
    id = Math.min(_currentBlock, id);
    transactionsCollection.count().success(function(trxCount) {
        if (trxCount) {
          blocksCollection.find({
              'trxLength': {
                $gt: 0
              },
              '_id': {
                $gt: id
              }
            }, {
              fields: blockFields,
              sort: {
                '_id': 1
              },
              limit: limitTo
            }).success(function(blocks) {
              if (blocks) {
                var ids = [];

                for (var i = 0; i < blocks.length; i++) {
                  ids.push(blocks[i]._id);
                }

                transactionsCollection.find({
                    '_id': {
                      $in: ids
                    }
                  }, {
                    sort: {
                      '_id': -1
                    }
                  }).success(function(transactions) {
                    blocks = addTrxInfo(blocks, transactions);
                    // console.log('IP: '+req.ip);
                    return res.jsonp(")]}',\n" + JSON.stringify({
                      'blocks': blocks,
                      'trxCount': trxCount
                    }));
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
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  // HOME
  app.get('/v1/homeblocks', apicache('10 seconds'), function(req, res) {
    var homeLimit = 10;
    blocksCollection.find({}, {
        fields: {
          _id: 1,
          timestamp: 1,
          signee: 1,
          trxLength: 1
        },
        sort: {
          '_id': -1
        },
        limit: homeLimit
      }).success(function(blocks) {
        if (blocks) {
          transactionsCollection.find({
              '_id': {
                '$gte': blocks[homeLimit - 1]._id
              }
            }, {
              sort: {
                '_id': -1
              },
              limit: homeLimit
            }).success(function(transactions) {
              if (transactions) {
                blocks = addTrxInfo(blocks, transactions);
              }
              return res.jsonp(")]}',\n" + JSON.stringify(blocks));
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

  app.get('/v1/currentblock', apicache('5 seconds'), function(req, res) {
    if (_currentBlock) {
      return res.jsonp(")]}',\n" + JSON.stringify({
        height: _currentBlock
      }));
    } else {
      return res.status(404).send();
    }
  });

  // FUNCTIONS
  function getLatestBlock() {
    utils.redisGet('_currentBlock').then(function(result) {
      // console.log('redis result:',result);
        _currentBlockData = {
          _id: result._id,
          timestamp: result.timestamp,
          trxLength: result.trxLength,
          signee: result.signee
        };
        _currentBlock = result._id;
        return;
      })
      .catch(function(err) {
        console.log('redis error:',err);
        return;
      });
  }

  getLatestBlock();
  setInterval(getLatestBlock, 10000);

  function addTrxInfo(blocks, transactions) {
    if (transactions !== null && transactions !== undefined) {
      for (var i = 0; i < transactions.length; i++) {
        for (var j = 0; j < blocks.length; j++) {
          if (transactions[i]._id === blocks[j]._id) {
            blocks[j].transactions = {};
            blocks[j].transactions.totalvalue = transactions[i].totalvalue;
            blocks[j].fees = transactions[i].fees;
            blocks[j].types = transactions[i].types;
          }
        }
      }
    }
    return blocks;
  }
};