'use strict';

const config = require('../../config_dvs.json');

var request = require('request');

// db def
var db = require('monk')('localhost/' + config.database);
var blocksCollection = db.get('blocks');
var btsPriceCollection = db.get('btsxPrice');
var metaMarketsCollection = db.get('metaX');

// FUNCTIONS 

function fetchPrice() {
  console.log('** UPDATING EXTERNAL PRICE ** ');
  var _id;
  btsPriceCollection.findOne({}, {
    sort: {
      _id: -1
    }
  }).success(function(price) {
    if (price === null) {
      _id = 1;
    } else {
      _id = parseInt(price._id, 10) + 1;
    }
    request('http://coinmarketcap.northpole.ro/api/v5/BTS.json', function(error, response, body) {
      if (!error && response.statusCode == 200) {
        body = JSON.parse(body);
        body._id = parseInt(_id, 10);
        delete body.marketCap;
        delete body.change7d;
        delete body.change7h;
        delete body.change1h;
        btsPriceCollection.update({
            '_id': body._id
          }, body, {
            'upsert': true
          }).success(function(doc) {
            return console.log('** EXTERNAL PRICE UPDATE DONE ** ');
          })
          .error(function(err) {
            console.log('price failed');
            console.log(err);
          });
      }
    });
  });
}

function getMetaMarkets() {
  request.get('https://metaexchange.info/api/1/getAllMarkets', function(error, response, body) {
    if (!error && response) {
      var _metaMarkets = JSON.parse(response.body);

      metaMarketsCollection.update({
          _id: 1
        }, {
          _id: 1,
          markets: _metaMarkets
        }, {
          upsert: true
        }).success(function(result) {
          // console.log('wrote meta collection');
        })
        .error(function(err) {
          console.log('meta update error:', err);
        });
    } else {
      metaMarketsCollection.update({
          _id: 1
        }, {
          _id: 1,
          markets: []
        }, {
          upsert: true
        }).success(function(result) {
          console.log('metaX api error, wrote blank meta collection', error);
        })
        .error(function(err) {
          console.log('meta update error:', err);
        });
    }
  });
}

module.exports = {
  update: fetchPrice,
  updateMetaX: getMetaMarkets
};