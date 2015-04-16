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

var accountChartCollectionHour = db.get('accountChartsHour');
var accountChartCollectionDay = db.get('accountChartsDay');
var accountChartCollectionWeek = db.get('accountChartsWeek');

var _accountChartRunning = [false, false, false];

// FUNCTIONS

function updateAccountsChart(interval, runnerIndex) {
  var inputs = {};
  var promises = [];

  // Check if an update is already running
  if (_accountChartRunning[runnerIndex] === false) {
    _accountChartRunning[runnerIndex] = true;

    // If no update running, check which type of interval then look for the existing data of that interval
    if (interval === 'hourly') {
      promises.push(accountChartCollectionHour.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    } else if (interval === 'daily') {
      promises.push(accountChartCollectionDay.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    } else if (interval === 'weekly') {
      promises.push(accountChartCollectionWeek.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    }

    // Wait for db lookup to finish, then:
    Q.all(promises)
      .then(function(result) {
        var chartTransactions = result[0];
        // null means there is no existing data, so initialize it
        if (chartTransactions === null) {
          inputs.totalAccounts = 0;

          // Search the transactions database for the very first transaction
          transactionsCollection.findOne({}, {
            sort: {
              _id: 1
            }
          }).success(function(firstTransaction) {
            console.log('first transaction date:', firstTransaction.reg_date_ISO);
            inputs.currentDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate());
            inputs.nextDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate());

            if (interval === 'hourly') {
              inputs.currentDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate(), firstTransaction.reg_date_ISO.getUTCHours());
              inputs.nextDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate(), firstTransaction.reg_date_ISO.getUTCHours());
              inputs.currentDay.setHours(inputs.currentDay.getHours() - inputs.currentDay.getTimezoneOffset() / 60);
              inputs.nextDay.setHours(inputs.nextDay.getHours() + 1 - inputs.nextDay.getTimezoneOffset() / 60);
            } else if (interval === 'daily') {
              inputs.nextDay.setHours(+24);
            } else if (interval === 'weekly') {
              inputs.nextDay.setHours(+24 * 7);
            }

            // Launch the update
            return accountsChartData(1, inputs, interval, runnerIndex);
          });

          // If not null we're updating an existing set, start from the last data saved
        } else {
          inputs.totalAccounts = chartTransactions.totalAccounts;
          inputs.currentDay = chartTransactions.date;

          // Set the interval to search in depending on the type of update
          if (interval === 'hourly') {
            inputs.currentDay = new Date(inputs.currentDay.getUTCFullYear(), inputs.currentDay.getUTCMonth(), inputs.currentDay.getUTCDate(), inputs.currentDay.getUTCHours());
            inputs.currentDay.setHours(inputs.currentDay.getHours() + 1 - inputs.currentDay.getTimezoneOffset() / 60);
            inputs.nextDay = new Date(inputs.currentDay.getUTCFullYear(), inputs.currentDay.getUTCMonth(), inputs.currentDay.getUTCDate(), inputs.currentDay.getUTCHours());
            inputs.nextDay.setHours(inputs.nextDay.getHours() + 1 - inputs.nextDay.getTimezoneOffset() / 60);
          } else if (interval === 'daily') {
            inputs.currentDay.setHours(+24);
            inputs.nextDay = new Date(inputs.currentDay);
            inputs.nextDay.setHours(+24);
          } else if (interval === 'weekly') {
            inputs.currentDay.setHours(+24 * 7);
            inputs.nextDay = new Date(inputs.currentDay);
            inputs.nextDay.setHours(+24 * 7);
          }

          // Launch the update
          return accountsChartData(parseInt(chartTransactions._id) + 1, inputs, interval, runnerIndex);
        }
      })
      .catch(function(error) {
        console.log(error);
      });
  } else {
    console.log('** TRX CHARTS ALREADY RUNNING **');
  }
}

function accountsChartData(id, inputs, interval, runnerIndex) {
  var offset = inputs.currentDay.getTimezoneOffset();
  var now = new Date();
  var today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (interval !== 'hourly') {
    inputs.currentDay.setHours(-offset / 60);
    inputs.nextDay.setHours(-offset / 60);
  } else {
    today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours());
  }

  if (inputs.currentDay < today) {
    console.log('** UPDATING ACCOUNT CHARTS DATA');
    // console.log('id:', id, 'inputs:', inputs);

    // var latestAccount;
    // accountChartCollection.findOne({}, {
    //   sort: {
    //     '_id': -1
    //   }
    // }).success(function(chartAccounts) {
    //   if (chartAccounts !== null) {
    //     latestAccount = chartAccounts.lastAccount;
    //     totalAccounts = chartAccounts.totalAccounts;
    //   } else {
    //     latestAccount = 0;
    //     totalAccounts = 0;
    //   }
    // console.log(chartAccounts);
    // console.log('latestAccount: ' + totalAccounts);

    console.log('Searching in interval: ' + new Date(inputs.currentDay) + '< date <' + new Date(inputs.nextDay));
    accountsCollection.find({
      'reg_date_ISO': {
        $gte: new Date(inputs.currentDay),
        $lt: new Date(inputs.nextDay)
      }
    }, {
      sort: {
        '_id': 1
      }
    }).success(function(accounts) {

      if (accounts.length > 0) {
        console.log('nr of accounts found: ' + accounts.length);

        // var currentHour = accounts[0].reg_date_ISO.getUTCHours();
        // var currentDay = accounts[0].reg_date_ISO.getUTCDate();
        // var currentMonth = accounts[0].reg_date_ISO.getUTCMonth();
        // var currentYear = accounts[0].reg_date_ISO.getUTCFullYear();

        // var utcDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // var lowerDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // var higherDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // var timeOffset = 6;
        // utcDate.setHours(utcDate.getHours()+timeOffset);
        // lowerDate.setHours(lowerDate.getHours() - timeOffset);
        // higherDate.setHours(higherDate.getHours() + timeOffset);

        var accountsChart = sumAcc(accounts);
        accountsChart._id = id;
        accountsChart.date = new Date(new moment.utc(inputs.currentDay));
        accountsChart.timestamp = accountsChart.date.getTime();
        accountsChart.totalAccounts = inputs.totalAccounts + accountsChart.numberAccounts;

        inputs.totalAccounts = accountsChart.totalAccounts;

        var updatePromises = [];

        if (interval === 'hourly') {
          inputs.currentDay.setHours(inputs.currentDay.getHours() + 1);
          inputs.nextDay.setHours(inputs.nextDay.getHours() + 1);
          updatePromises.push(accountChartCollectionHour.update({
            '_id': id
          }, accountsChart, {
            'upsert': true
          }));

        } else if (interval === 'daily') {
          inputs.currentDay.setDate(inputs.currentDay.getDate() + 1);
          inputs.nextDay.setDate(inputs.nextDay.getDate() + 1);
          updatePromises.push(accountChartCollectionDay.update({
            '_id': id
          }, accountsChart, {
            'upsert': true
          }));

        } else if (interval === 'weekly') {
          inputs.currentDay.setDate(inputs.currentDay.getDate() + 7);
          inputs.nextDay.setDate(inputs.nextDay.getDate() + 7);
          updatePromises.push(accountChartCollectionWeek.update({
            '_id': id
          }, accountsChart, {
            'upsert': true
          }));

        }

        Q.all(updatePromises)
          .then(function(doc) {
            console.log('wrote accounts chart collection');
            return accountsChartData(id + 1, inputs, interval, runnerIndex);
          })
          .catch(function(error) {
            console.log('failed to write accounts chart');
            console.log(error);
            _accountChartRunning[runnerIndex] = false;
          });

      } else {
        console.log('no accounts found, searching next interval');
        if (interval === 'hourly') {
          inputs.currentDay.setHours(inputs.currentDay.getHours() + 1);
          inputs.nextDay.setHours(inputs.nextDay.getHours() + 1);
        } else if (interval === 'daily') {
          inputs.currentDay.setHours(+24);
          inputs.nextDay.setHours(+24);
        } else if (interval === 'weekly') {
          inputs.currentDay.setHours(+24 * 7);
          inputs.nextDay.setHours(+24 * 7);
        }
        return accountsChartData(id, inputs, interval, runnerIndex);
      }
    });
    // });
  } else {
    console.log('current Day > today');
    _accountChartRunning[runnerIndex] = false;
  }
}

function sumAcc(array) {
  var returnObject = {};
  var numberAccounts = 0;

  if (array.length > 0) {
    for (var i = 0; i < array.length; i++) {
      numberAccounts += 1;
    }

    returnObject.numberAccounts = numberAccounts;
  }

  return returnObject;
}

function launchUniqueAccounts() {
  var inputs = {};
  uniqueAccountsCollection.findOne({}, {
    sort: {
      _id: -1
    }
  }).success(function(uniqueAccountsResult) {
    console.log(uniqueAccountsResult);
    if (uniqueAccountsResult === null) {
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
        .success(function(firstTransaction) {
          console.log('initial block:', firstTransaction);
          // var nextDay = new Date(result.reg_date_ISO);
          inputs.currentDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate());
          inputs.nextDay = new Date(firstTransaction.reg_date_ISO.getUTCFullYear(), firstTransaction.reg_date_ISO.getUTCMonth(), firstTransaction.reg_date_ISO.getUTCDate());
          inputs.nextDay.setHours(+24);
          inputs._id = 1;
          inputs.sum = 0;
          // nextDay.setHours(0);
          // nextDay.setMinutes(0);
          // nextDay.setSeconds(0);
          // nextDay.setDate(nextDay.getDate() + 1);
          // console.log('nextDay:', nextDay);
          return uniqueAccounts(inputs);
        });
    } else {
      // var startDay = new Date(uniqueAccounts.reg_date_ISO);
      inputs.currentDay = uniqueAccountsResult.date;
      // startDay.setHours(0);
      // startDay.setMinutes(0);
      // startDay.setSeconds(0);
      // startDay.setDate(startDay.getDate() + 1);
      var nextDay = new Date(uniqueAccountsResult.date);
      inputs.currentDay.setHours(+24);
      inputs.nextDay = new Date(inputs.currentDay);
      inputs.nextDay.setHours(+24);
      inputs._id = uniqueAccountsResult._id;
      inputs.sum = uniqueAccountsResult.sum;
      // nextDay.setHours(0);
      // nextDay.setMinutes(0);
      // nextDay.setSeconds(0);
      // nextDay.setDate(nextDay.getDate() + 2);
      console.log('min date:', inputs.currentDay, 'upper date:', inputs.nextDay);
      return uniqueAccounts(inputs);
    }
  });
}

function uniqueAccounts(inputs) {
  var _id = inputs._id;
  var sum = inputs.sum;

  var offset = inputs.currentDay.getTimezoneOffset();
  inputs.currentDay.setHours(-offset / 60);
  inputs.nextDay.setHours(-offset / 60);

  // console.log('start date:', date, 'now:', new Date(), 'nextDay:', nextDay);
  var now = new Date();
  var today = new Date(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  if (inputs.currentDay < today) {

    console.log('Searching in interval: ' + new Date(inputs.currentDay) + '< date <' + new Date(inputs.nextDay));
    Q.all([
        transactionsCollection.find({
          types: "account_register",
          reg_date_ISO: {
            $gte: new Date(inputs.currentDay),
            $lt: new Date(inputs.nextDay)
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
          var date = new Date(new moment.utc(inputs.currentDay));
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

          inputs.sum = sum + counter;

          Q.all([
              uniqueAccountsCollection.update({
                _id: _id
              }, {
                date: date,
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
              // var newDay = new Date(nextDay);
              // newDay.setHours(0);
              // newDay.setMinutes(0);
              // newDay.setSeconds(0);
              // newDay.setDate(newDay.getDate() + 1);
              inputs.currentDay.setDate(inputs.currentDay.getDate() + 1);
              inputs.nextDay.setDate(inputs.nextDay.getDate() + 1);
              inputs._id++;
              return uniqueAccounts(inputs);
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
  update: updateAccountsChart,
  updateUnique: launchUniqueAccounts
};