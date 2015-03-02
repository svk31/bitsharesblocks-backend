'use strict';

module.exports = function(db, app, apicache) {

  // VARIABLES / CONSTANTS
  var btsxPriceCollection = db.get('btsxPrice');
  require('../price_history.js');

  // ROUTES
  app.get('/v1/price', apicache('15 minutes'), function(req, res) {
    btsxPriceCollection.find({}).success(function(doc) {
        if (doc) {
          doc = doc[0];
          return res.jsonp(")]}',\n" + JSON.stringify(doc));
        } else {
          return res.status(404).send();
        }
      })
      .error(function(err) {
        return res.status(500).send();
      });
  });

  app.get('/v1/homeprice/:symbol', apicache('15 minutes'), function(req, res) {
    var symbol = req.params.symbol;
    var timestamp = new Date(Date.now());
    timestamp.setDate(timestamp.getDate() - 30);

    if (symbol === 'USD' || symbol === 'BTC' || symbol === 'CNY' || symbol === 'EUR') {
      btsxPriceCollection.find({
          timestamp: {
            $gte: timestamp.getTime() / 1000
          }
        })
        .success(function(realprice) {
          if (realprice) {
            var realPrice = reduceFullRealPrice(realprice, symbol, timestamp.getTime());
            return res.jsonp(")]}',\n" + JSON.stringify(realPrice));
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

  app.get('/v1/price/:symbol', apicache('15 minutes'), function(req, res) {
    var symbol = req.params.symbol;
    if (symbol === 'USD' || symbol === 'BTC' || symbol === 'CNY' || symbol === 'EUR') {
      btsxPriceCollection.find({})
        .success(function(realprice) {
          if (realprice) {
            var realPrice = reduceFullRealPrice(realprice, symbol);
            return res.jsonp(")]}',\n" + JSON.stringify(realPrice));
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

  // FUNCTIONS
  function reduceFullRealPrice(array, assetName, timeStamp) {
    var returnArray = [];
    var historical;
    var i, value;

    var timestamp = (timeStamp) ? timeStamp : 0;
    if (assetName === 'USD') {
      historical = usd_price_full;

    } else if (assetName === 'BTC') {
      historical = btc_price_full;
    }
    if (historical) {
      for (i = 0; i < historical.length; i++) {
        if (historical[i][0] >= timestamp) {
          returnArray.push(historical[i]);
        }
      }
    }

    for (i = 0; i < array.length; i++) {
      if (i === 0 || i % 9 === 0 || i === (array.length - 1)) {
        value = parseFloat(array[i].price[assetName.toLowerCase()]);
        if (value !== 0) {
          returnArray.push([parseInt(array[i].timestamp + '000', 10),
            value
          ]);
        }
      }
    }
    return returnArray;
  }
};