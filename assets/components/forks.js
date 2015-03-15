'use strict';

const config = require('../..config.json');
var utils = require('../../utils/utils.js');
var Q = require('q');

// db def
var db = require('monk')('localhost/' + config.database);
var forksCollection = db.get('forks');

function updateForks() {
  console.log('** UPDATING RECENT FORKS **');
  utils.rpcCall('blockchain_list_forks', []).then(function(forks) {
    var promises = [];
    for (var i = 0; i < forks.length; i++) {

      promises.push(forksCollection.update({
        '_id': forks[i][0]
      }, {
        '_id': forks[i][0],
        'timestampISO': utils.get_ISO_date(forks[i][1][1].timestamp),
        'forkInfo': forks[i][1]
      }, {
        'upsert': true
      }));
    }
    Q.all(promises)
      .then(function(result) {
        console.log('** DONE UPDATING FORKS **');
      });
  });
}

module.exports = {
  update: updateForks
};