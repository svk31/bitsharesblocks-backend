  'use strict';

  var config = require('../config.json');

  var express = require('express');
  var logger = require('morgan');
  var bodyParser = require('body-parser');
  var router = express.Router();
  var compression = require('compression');

  var apicache = require('apicache').options({
    debug: false
  }).middleware;

  var app = express();

  app.use(logger('dev'));
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded());
  app.use(compression({
    threshold: 25
  }));

  // db def
  console.log('using database: ' + config.database);
  var db = require('monk')('localhost/' + config.database);

  var versionData = {
    'main': 4,
    'increment': {
      'current': 27,
      'previous': 26,
      'old': 999
    },
    'RC': {
      'current': 1,
      'previous': 999,
      'old': 999,
      'multiplier': 1
    }
  };

  var versionData_v2 = {
    major: 0,
    minor: 8,
    patch: 1,
    premajor: 0
  };

  var hardFork = 2460000;
  var maintenance = false;

  var currentBlock;
  var limitTo = 20; // max number of blocks to return
  var blockFields = {
    '_id': 1,
    'timestamp': 1,
    'signee': 1,
    'trxLength': 1
  };

  /*
   */
  app.all('*', function(req, res, next) {
    res.header('Content-Type', 'application/json');
  //   // res.header("Access-Control-Allow-Origin", "*");
  //   // res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
  });

  require('./routes/blocks.js')(db, app, apicache);
  require('./routes/misc.js')(db, app, maintenance, hardFork, apicache);
  require('./routes/assets.js')(db, app, apicache);
  require('./routes/delegates.js')(db, app, versionData, versionData_v2, maintenance, apicache);
  require('./routes/price.js')(db, app, apicache);
  require('./routes/accounts.js')(db, app, apicache);

  // require('./routes/handlebars.js')(db, app);

  module.exports = app;