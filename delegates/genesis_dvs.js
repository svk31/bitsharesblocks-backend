'use strict';

const config = require('../config.json');

// db def
var db = require('monk')('localhost/' + config.database);
// var genesisBTSXCollection = db.get('genesisBTSX');
var genesisBTSCollection = db.get('genesisBTS');

// CONSTANTS
var basePrecision = 100000;

// SCRIPTS
genesisStats();

function genesisStats() {
  var genesis = require('../../genesis_dvs.json');

  for (var key in genesis) {
    console.log('key:',key);
    for (var subkey in genesis[key]) {
      // console.log('subkey:',subkey);
    }
  }

  genesis._id = 1;
  var genesisPrecisionBTSX = basePrecision;
  var genesisPrecisionBTS = basePrecision;
  console.log('initial_balances using precision: ' + genesisPrecisionBTSX);
  console.log('sharedrop_balances using precision: ' + genesisPrecisionBTS);
  
  var percentSum = 0;
  var initialSum = 0;
  var maxBalance = 0;
  var i;
  var cutOffs = [5 * Math.pow(10, 7), Math.pow(10, 7), Math.pow(10, 6), Math.pow(10, 5), Math.pow(10, 4), Math.pow(10, 3), Math.pow(10, 2), Math.pow(10, 1)];
  var counts = [0, 0, 0, 0, 0, 0, 0, 0];

  var newShares = [];
  var btsxBalance = 0,
    btsBalance = 0;

  let initBalance = genesis.initial_balances;
  for (i = 0; i < initBalance.length; i++) {
    newShares.push([initBalance[i].raw_address, initBalance[i].balance / genesisPrecisionBTSX]);
    btsxBalance += initBalance[i].balance;
  }
  let sharedrop = genesis.sharedrop_balances.vesting_balances;
  for (i = 0; i < sharedrop.length; i++) {
    newShares.push([sharedrop[i].raw_address, sharedrop[i].balance / genesisPrecisionBTS]);
    btsBalance += sharedrop[i].balance;
  }

  genesis.shareDrop = btsBalance / genesisPrecisionBTS;

  console.log('BTSX balance: ' + btsxBalance / genesisPrecisionBTSX);
  console.log('BTS balance: ' + btsBalance / genesisPrecisionBTS);

  genesis.balanceCount = newShares.length;
  console.log('number of balances: ' + genesis.balanceCount);
  for (i = 0; i < newShares.length; i++) {
    if (typeof(newShares[i][1]) !== 'number') {
      console.log(typeof(newShares[i][1]));
      console.log(i);

    }
    initialSum += newShares[i][1];
    // console.log(initialSum);

    maxBalance = Math.max(maxBalance, newShares[i][1]);
    for (var j = 0; j < cutOffs.length; j++) {
      if ((newShares[i][1]) > cutOffs[j]) {
        counts[j] ++;
      }

    }
  }

  genesis.initialSum = initialSum;
  genesis.maxBalance = maxBalance;

  // genesis.cumulativePercent = cumulativePercent;
  console.log(counts);
  genesis.counts = counts;
  genesis.cutOffs = cutOffs;
  newShares = newShares.sort(function(a, b) {
    return b[1] - a[1];
  });

  var percentCutoffs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  var percentCutoffs2 = [28.9, 28.9 + 21.5, 28.9 + 21.5 + 24.8, 28.9 + 21.5 + 24.8 + 20.7, 100];
  var cumulativePercent = [],
    individualPercent = [],
    cumulativePercentPlot = [];
  var sumPercent = 0;
  var previousPercent = 0,
    previousI = 0;

  genesis.topBalances = [];

  var percentCounter = 0,
    percentCounter2 = 0,
    addressSum = 0,
    addressSum2 = 0,
    cumSum = 0;
  genesis.percentAddressCount = [];
  genesis.percentAddressCount2 = [];

  for (i = 0; i < newShares.length; i++) {
    sumPercent += newShares[i][1] / initialSum * 100;
    cumulativePercent.push(sumPercent);
    individualPercent.push(newShares[i][1] / initialSum * 100);
    if (i === 0) {
      cumulativePercentPlot.push([i, sumPercent]);
    } else if (sumPercent - previousPercent > 0.25 || (i - previousI === 5000)) {
      previousPercent = sumPercent;
      cumulativePercentPlot.push([i, sumPercent]);
      previousI = i;
    } else if (i === (newShares.length - 1)) {
      console.log(i);
      cumulativePercentPlot.push([i, sumPercent]);
    }

    if (sumPercent >= percentCutoffs[percentCounter]) {
      genesis.percentAddressCount.push({
        percentage: Math.round(sumPercent * 100) / 100,
        addressCount: (i + 1) - addressSum
      });
      addressSum = i + 1;
      percentCounter++;
    }

    if (sumPercent >= percentCutoffs2[percentCounter2]) {
      console.log('cumSum:', cumSum);
      genesis.percentAddressCount2.push([
        ((i + 1) - addressSum2).toFixed(0), Math.round((sumPercent - cumSum) * 100) / 100
      ]);
      addressSum2 = i + 1;
      percentCounter2++;
      cumSum = sumPercent;
    }

    if (i < 100) {
      genesis.topBalances.push([newShares[i][0], newShares[i][1], individualPercent[i], cumulativePercent[i]]);
    }
  }

  genesis.percentAddressCount.push({
    percentage: Math.round(sumPercent * 100) / 100,
    addressCount: (i + 1) - addressSum
  });

  // genesis.percentAddressCount2.push([
  //   ((i + 1) - addressSum2).toFixed(0), Math.round((sumPercent - cumSum) * 100) / 100
  // ]);

  console.log(genesis.percentAddressCount);
  console.log(genesis.percentAddressCount2);
  // genesis.cumulativePercent = cumulativePercent;
  // genesis.individualPercent = individualPercent;
  genesis.cumulativePercentPlot = cumulativePercentPlot;

  delete genesis.initial_balances;
  delete genesis.names;
  delete genesis.delegates;
  delete genesis.sharedrop_balances;

  // for (var key in genesis) {
  //   console.log(key);

  // }

  genesisBTSCollection.update({
      _id: 1
    }, genesis, {
      upsert: true
    }).success(function(doc) {
      console.log('wrote genesis');
    })
    .error(function(error) {
      console.log('unable to write genesis');
      console.log(error);
    })
  console.log('total sum: ' + initialSum + ' BTS');
  console.log('max Balance: ' + maxBalance + ' BTS');

}