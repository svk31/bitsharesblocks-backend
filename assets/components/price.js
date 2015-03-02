'use strict';

const config = require('../../config.json');

var request = require('request');

// db def
var db = require('monk')('localhost/' + config.database);
var blocksCollection = db.get('blocks');
var btsPriceCollection = db.get('btsxPrice');

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

module.exports = {
  update: fetchPrice
};