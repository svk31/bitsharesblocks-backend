'use strict';

const config = require('../../config_dvs.json');
var utils = require('../../utils/utils.js');

var moment = require('moment');
var Q = require('q');

var _trxChartRunning = [false, false, false];

// db def
var db = require('monk')('localhost/' + config.database);
var blocksCollection = db.get('blocks');
var transactionsCollection = db.get('transactions');
var transactionChartCollectionHour = db.get('trxChartsHour');
var transactionChartCollectionDay = db.get('trxChartsDay');
var transactionChartCollectionWeek = db.get('trxChartsWeek');
var feesChartCollectionHour = db.get('feesChartsHour');
var feesChartCollectionDay = db.get('feesChartsDay');
var feesChartCollectionWeek = db.get('feesChartsWeek');

// transactionChartCollectionHour.remove({_id:{$gt:0}});
// transactionChartCollectionDay.remove({_id:{$gt:0}});

function updateTransactionChart(interval, runnerIndex) {
  var inputs = {};
  var promises = [];
  if (_trxChartRunning[runnerIndex] === false) {
    _trxChartRunning[runnerIndex] = true;
    if (interval === 'hourly') {
      promises.push(transactionChartCollectionHour.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    } else if (interval === 'daily') {
      promises.push(transactionChartCollectionDay.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    } else if (interval === 'weekly') {
      promises.push(transactionChartCollectionWeek.findOne({}, {
        sort: {
          '_id': -1
        }
      }));
    }
    Q.all(promises)
      .then(function(result) {
        var chartTransactions = result[0];
        // chartTransactions = null;   
        if (chartTransactions === null) {
          inputs.latestBlock = 1;
          inputs.totalNumTrx = 0;
          inputs.totalAssetTrx = 0;
          transactionsCollection.findOne({}, {
            sort: {
              _id: 1
            }
          }).success(function(firstTransaction) {
            console.log(firstTransaction.reg_date_ISO);
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

            return transactionChartData(1, inputs, interval, runnerIndex);
          });

        } else {
          inputs.latestBlock = chartTransactions.latestBlock;
          inputs.totalNumTrx = chartTransactions.totalNumTrx;
          inputs.totalAssetTrx = chartTransactions.totalAssetTrx;

          inputs.currentDay = chartTransactions.date;
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

          // console.log('current day:', inputs.currentDay);
          // console.log('next day:', inputs.nextDay);
          return transactionChartData(parseInt(chartTransactions._id) + 1, inputs, interval, runnerIndex);
        }
      })
      .catch(function(error) {
        console.log(error);
      });
  } else {
    console.log('** TRX CHARTS ALREADY RUNNING **');
  }
}

function transactionChartData(id, inputs, interval, runnerIndex) {
  // console.log('id:' + id + ' _currentBlock:' + _currentBlock);
  // console.log('currentDay:', inputs.currentDay);
  // console.log('nextDay:', inputs.nextDay);
  // console.log('timezone offset:', inputs.currentDay.getTimezoneOffset());
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
    console.log('** UPDATING TRX CHARTS DATA');

    var countSum = 0;
    var valueSum = 0;
    var latestBlock = inputs.latestBlock;
    var totalNumTrx = inputs.totalNumTrx;
    var totalAssetTrx = inputs.totalAssetTrx;


    var currentHour;
    var currentDay;
    var currentMonth;
    var currentYear;
    var transactions;

    // console.log('latestBlock: ' + latestBlock);
    console.log('Searching in interval: ' + new Date(inputs.currentDay) + '< date <' + new Date(inputs.nextDay));
    transactionsCollection.find({
      'reg_date_ISO': {
        $gte: new Date(inputs.currentDay),
        $lt: new Date(inputs.nextDay)
      }
    }, {
      sort: {
        _id: 1
      }
    }).success(function(transactions) {
      console.log('Found', transactions.length, 'transactions in the interval');
      if (transactions.length > 0) {
        // console.log('nr of trx found: ' + transactions.length);
        // console.log(transactions[0].reg_date_ISO);
        currentHour = transactions[0].reg_date_ISO.getUTCHours();
        currentDay = transactions[0].reg_date_ISO.getUTCDate();
        currentMonth = transactions[0].reg_date_ISO.getUTCMonth();
        currentYear = transactions[0].reg_date_ISO.getUTCFullYear();

        // var utcDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // var lowerDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // var higherDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, currentHour, 0, 0));
        // utcDate.setHours(utcDate.getHours()+6);
        // lowerDate.setHours(lowerDate.getHours() - 6);
        // higherDate.setHours(higherDate.getHours() + 6);

        var transactionChart = sumTrx(transactions);
        var feesChart = sumFees(transactions);

        transactionChart._id = id;
        feesChart._id = id;
        transactionChart.date = new Date(new moment.utc(inputs.currentDay));
        // console.log(transactionChart);
        transactionChart.timestamp = transactionChart.date.getTime();

        feesChart.date = new Date(new moment.utc(inputs.currentDay));
        feesChart.timestamp = transactionChart.date.getTime();
        transactionChart.totalNumTrx = totalNumTrx + transactionChart.numberTransactions;
        transactionChart.totalAssetTrx = totalAssetTrx + transactionChart.askCount + transactionChart.bidCount + transactionChart.shortCount + transactionChart.coverCount;
        inputs.latestBlock = transactionChart.latestBlock;
        inputs.totalNumTrx = transactionChart.totalNumTrx;
        inputs.totalAssetTrx = transactionChart.totalAssetTrx;

        var updatePromises = [];

        if (interval === 'hourly') {
          inputs.currentDay.setHours(inputs.currentDay.getHours() + 1);
          inputs.nextDay.setHours(inputs.nextDay.getHours() + 1);
          updatePromises.push(transactionChartCollectionHour.update({
            '_id': id
          }, transactionChart, {
            'upsert': true
          }));

          updatePromises.push(feesChartCollectionHour.update({
            '_id': id
          }, feesChart, {
            'upsert': true
          }));
        } else if (interval === 'daily') {
          inputs.currentDay.setDate(inputs.currentDay.getDate() + 1);
          inputs.nextDay.setDate(inputs.nextDay.getDate() + 1);
          updatePromises.push(transactionChartCollectionDay.update({
            '_id': id
          }, transactionChart, {
            'upsert': true
          }));

          updatePromises.push(feesChartCollectionDay.update({
            '_id': id
          }, feesChart, {
            'upsert': true
          }));

        } else if (interval === 'weekly') {
          inputs.currentDay.setDate(inputs.currentDay.getDate() + 7);
          inputs.nextDay.setDate(inputs.nextDay.getDate() + 7);
          updatePromises.push(transactionChartCollectionWeek.update({
            '_id': id
          }, transactionChart, {
            'upsert': true
          }));

          updatePromises.push(feesChartCollectionWeek.update({
            '_id': id
          }, feesChart, {
            'upsert': true
          }));
        }

        Q.all(updatePromises)
          .then(function(doc) {
            console.log('wrote trx chart collection');
            return transactionChartData(id + 1, inputs, interval, runnerIndex);
          })
          .catch(function(error) {
            console.log('failed to write trx chart');
            console.log(error);
          });
        // });
      } else {
        console.log('No trx found, searching next interval');
        // inputs.latestBlock = latestBlock + 60 * 6 + 100 - 1;
        // inputs.currentDay.setHours(+24);
        // inputs.nextDay.setHours(+24);
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
        return transactionChartData(id, inputs, interval, runnerIndex);
      }
    });
  } else {
    console.log('current Day > today');
    _trxChartRunning[runnerIndex] = false;
  }

  function sumTrx(array, lowerDate, higherDate) {
    var returnArray = {};
    var sumValue = 0;
    var numberTransactions = 0;
    var askCount = 0;
    var transferCount = 0;
    var shortCount = 0;
    var feedCount = 0;
    var registrationCount = 0;
    var updateCount = 0;
    var bidCount = 0,
      coverCount = 0,
      burnCount = 0,
      lastBlock;

    if (array.length > 0) {
      for (var i = 0; i < array.length; i++) {
        // if (array[i].reg_date_ISO > lowerDate && array[i].reg_date_ISO < higherDate) {
        // console.log(i);
        // console.log(lowerDate);
        // console.log(array[i].reg_date_ISO);
        // console.log(higherDate);

        lastBlock = array[i]._id;
        if (array[i].totalvalue[0]) {
          sumValue += array[i].totalvalue[0] / 100000;
        }

        numberTransactions += array[i].transactions.length;
        if (array[i].transactions.length > 0) {
          for (var j = 0; j < array[i].transactions.length; j++) {
            transferCount += 1;
            for (var kk = 0; kk < array[i].transactions[j][1].trx.operations.length; kk++) {
              if (array[i].transactions[j][1].trx.operations[kk].type === 'update_account_op_type') {
                updateCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'ask_op_type') {
                askCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'bid_op_type') {
                bidCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'short_op_type' || array[i].transactions[j][1].trx.operations[kk].type === 'short_op_v2_type') {
                shortCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'cover_op_type') {
                coverCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'update_feed_op_type') {
                feedCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'register_account_op_type') {
                registrationCount += 1;
                transferCount -= 1;
                break;
              }
              if (array[i].transactions[j][1].trx.operations[kk].type === 'burn_op_type') {
                burnCount += 1;
                transferCount -= 1;
                break;
              }
            }
          }

        }
        // }
      }

    }

    returnArray.sumValue = sumValue;
    returnArray.numberTransactions = numberTransactions;
    returnArray.latestBlock = lastBlock;
    returnArray.updateCount = updateCount;
    returnArray.transferCount = transferCount;
    returnArray.askCount = askCount;
    returnArray.shortCount = shortCount;
    returnArray.feedCount = feedCount;
    returnArray.bidCount = bidCount;
    returnArray.coverCount = coverCount;
    returnArray.registrationCount = registrationCount;
    returnArray.burnCount = burnCount;

    return returnArray;
  }

  function sumFees(array) {
    var returnArray = {};
    var _sumFees = {},
      lastBlock;

    // if (array.length > 0) {
    for (var i = 0; i < array.length; i++) {
      // if (array[i].reg_date_ISO > lowerDate && array[i].reg_date_ISO < higherDate) {

      for (var assetId in array[i].fees) {
        if (!_sumFees[assetId]) {

          _sumFees[assetId] = 0;
        }
        _sumFees[assetId] += array[i].fees[assetId];
      }
      // }
    }
    // }

    returnArray.sumFees = _sumFees;

    return returnArray;
  }
}

module.exports = {
  update: updateTransactionChart
};