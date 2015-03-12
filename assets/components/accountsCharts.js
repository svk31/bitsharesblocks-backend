'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js');

var moment = require('moment');
var Q = require('q');

// db def
var db = require('monk')('localhost/' + config.database);
var accountChartCollection = db.get('accountCharts');
var accountsCollection = db.get('accounts');
var transactionsCollection = db.get('transactions');
var uniqueAccountsCollection = db.get('uniqueAccounts');
var uniqueIDSCollection = db.get('uniqueIDS');

// FUNCTIONS

function updateaccountsChartData() {
  accountChartCollection.findOne({}, {
    sort: {
      '_id': -1
    }
  }).success(function(chartAccounts) {
    if (chartAccounts === null) {
      return accountsChartData(1);
    } else {
      return accountsChartData(parseInt(chartAccounts._id) + 1);
    }
  });
}

function accountsChartData(id) {
  console.log('** UPDATING ACCOUNT CHARTS DATA');
  var countSum = 0;
  var valueSum = 0;
  var latestAccount;
  var totalAccounts;
  accountChartCollection.findOne({}, {
    sort: {
      '_id': -1
    }
  }).success(function(chartAccounts) {
    if (chartAccounts !== null) {
      latestAccount = chartAccounts.lastAccount;
      totalAccounts = chartAccounts.totalAccounts;
    } else {
      latestAccount = 0;
      totalAccounts = 0;
    }
    // console.log(chartAccounts);
    console.log('latestAccount: ' + totalAccounts);
    accountsCollection.find({
      '_id': {
        $gt: (latestAccount),
        $lt: (latestAccount + 5000)
      }
    }, {
      sort: {
        'reg_date_ISO': 1
      }
    }).success(function(accounts) {

      if (accounts.length > 0) {
        console.log('_id:' + accounts[0]._id);
        console.log('nr of accounts found: ' + accounts.length);

        var currentHour = accounts[0].reg_date_ISO.getUTCHours();
        var currentDay = accounts[0].reg_date_ISO.getUTCDate();
        var currentMonth = accounts[0].reg_date_ISO.getUTCMonth();
        var currentYear = accounts[0].reg_date_ISO.getUTCFullYear();

        var utcDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        var lowerDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        var higherDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        var timeOffset = 6;
        // utcDate.setHours(utcDate.getHours()+timeOffset);
        lowerDate.setHours(lowerDate.getHours() - timeOffset);
        higherDate.setHours(higherDate.getHours() + timeOffset);

        var accountsChart = sumAcc(accounts, lowerDate, higherDate);
        // console.log(accountsChart);
        accountsChart._id = id;
        accountsChart.date = utcDate;
        accountsChart.timestamp = utcDate.getTime();
        accountsChart.totalAccounts = totalAccounts + accountsChart.numberAccounts;

        if (accountsChart.lastAccount !== undefined && accountsChart.lastAccount !== 999999999999) {
          accountChartCollection.update({
            '_id': id
          }, accountsChart, {
            'upsert': true
          }).success(function(doc) {
            console.log('wrote accounts chart collection');
            return accountsChartData(id + 1);
          });
        }
      }

      function sumAcc(array) {
        var returnArray = {};
        var numberAccounts = 0;
        var lastAccount = 999999999999;

        for (var i = 0; i < array.length; i++) {
          if (array[i].reg_date_ISO >= lowerDate && array[i].reg_date_ISO < higherDate) {
            numberAccounts += 1;
          } else {
            lastAccount = Math.min(parseInt(array[i]._id) - 1, lastAccount);
          }
        }

        returnArray.numberAccounts = numberAccounts;
        returnArray.lastAccount = lastAccount;

        return returnArray;
      }
    });
  });
}

function launchUniqueAccounts() {

  uniqueAccountsCollection.findOne({}, {
    sort: {
      _id: -1
    }
  }).success(function(result) {
    console.log(result);
    if (result === null) {
      transactionsCollection.findOne({
          types: "account_register"
        }, {
          fields: {
            transactions: 1,
            reg_date_ISO: 1
          },
          sort: {
            _id: 1
          }
        })
        .success(function(result) {
          console.log('initial block:', result);
          var nextDay = new Date(result.reg_date_ISO);
          nextDay.setHours(0);
          nextDay.setMinutes(0);
          nextDay.setSeconds(0);
          nextDay.setDate(nextDay.getDate() + 1);
          console.log('nextDay:', nextDay);
          uniqueAccounts(result.reg_date_ISO, nextDay, {
            _id: 1,
            sum: 0
          });
        });
    } else {
      var startDay = new Date(result.reg_date_ISO);
      startDay.setHours(0);
      startDay.setMinutes(0);
      startDay.setSeconds(0);
      startDay.setDate(startDay.getDate() + 1);
      var nextDay = new Date(result.reg_date_ISO);
      nextDay.setHours(0);
      nextDay.setMinutes(0);
      nextDay.setSeconds(0);
      nextDay.setDate(nextDay.getDate() + 2);
      console.log('min date:', startDay, 'upper date:', nextDay);
      uniqueAccounts(startDay, nextDay, result);
    }
  });
}

function uniqueAccounts(date, nextDay, previous) {
  var _id = previous._id;
  var sum = previous.sum;

  console.log('start date:', date, 'now:', new Date(), 'nextDay:', nextDay);
  if (nextDay < new Date()) {

    Q.all([
        transactionsCollection.find({
          types: "account_register",
          reg_date_ISO: {
            $gte: new Date(date),
            $lt: new Date(nextDay)
          }
        }, {
          fields: {
            transactions: 1
          }

        }),
        uniqueIDSCollection.findOne({})
      ])
      .then(function(results) {
        var transactions = results[0];
        if (transactions !== null && transactions.length > 0) {
          var balanceIDS = (results[1] === null) ? {} : results[1].ids;
          var counter = 0;
          for (var i = 0; i < transactions.length; i++) {
            for (var j = 0; j < transactions[i].transactions.length; j++) {
              for (var k = 0; k < transactions[i].transactions[j][1].trx.operations.length; k++) {
                let ops = transactions[i].transactions[j][1].trx.operations;
                if (transactions[i].transactions[j][1].trx.operations[k].type === 'register_account_op_type') {
                  var id = ops[ops.length - 1].data.balance_id;
                  if (!balanceIDS[id]) {
                    balanceIDS[id] = 1;
                    counter++;
                  } else {
                    balanceIDS[id] ++;
                  }
                  break;
                }

              }
            }
          }

          console.log('number of ids found:', counter);

          Q.all([
              uniqueAccountsCollection.update({
                _id: _id
              }, {
                reg_date_ISO: date,
                timestamp: date.getTime(),
                unique: counter,
                sum: sum + counter
              }, {
                upsert: true
              }),
              uniqueIDSCollection.update({
                _id: 1
              }, {
                ids: balanceIDS
              }, {
                upsert: true
              })
            ])
            .then(function(doc) {
              // console.log('wrote')
              var newDay = new Date(nextDay);
              newDay.setHours(0);
              newDay.setMinutes(0);
              newDay.setSeconds(0);
              newDay.setDate(newDay.getDate() + 1);
              return uniqueAccounts(nextDay, newDay, {
                _id: _id + 1,
                sum: sum + counter
              });
            });
        } else {
          return console.log('No more transactions');
        }
      })
      .catch(function(err) {
        console.log(err);
        console.log('FAILED TO FIND TRX');
      });
  } else {
    return console.log('Day not yet finished');
  }
}

module.exports = {
  update: updateaccountsChartData,
  updateUnique: launchUniqueAccounts
};