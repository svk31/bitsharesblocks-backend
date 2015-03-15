'use strict';

const config = require('../../config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');

// DB DEF
var db = require('monk')('localhost/' + config.database);
var transactionsCollection = db.get('transactions');
var payCollection = db.get('delegatePay');
var payStateCollection = db.get('delegatePayState');

// FUNCTIONS

function updatePay() {
  console.log('** RUNNING PAY UPDATE **');
  payStateCollection.findOne({}, {
    fields: {
      'lastId': 1
    }
  }).success(function(payState) {
    var previousBlock = 0;
    if (payState !== null) {
      previousBlock = payState.lastId;
    }

    getPay(previousBlock, true).then(function(result) {
      return console.log(result);
    });
  });
}

function getPay(lastblock, loopBoolean) {
  console.log('FETCHING PAY DATA: ' + lastblock);
  var deferred = Q.defer();

  transactionsCollection.findOne({
    _id: {
      $gt: lastblock
    }
  }).success(function(transaction) {
    if (transaction !== null) {
      lastblock = transaction._id;
      var pay = {};
      var amount = [],
        delegateId = [],
        fees = [],
        deposit = [];
      var foundWithdrawal = false;
      var i, j;
      var counter = 0;
      for (i = 0; i < transaction.transactions.length; i++) {
        let trx = transaction.transactions[i][1].trx;
        for (j = 0; j < trx.operations.length; j++) {
          if (trx.operations[j].type === 'withdraw_pay_op_type') {
            console.log('Found withdrawal');
            amount.push(trx.operations[j].data.amount);
            deposit.push(trx.operations[trx.operations.length - 1].data.amount);
            if (amount[counter] !== deposit[counter]) {
              fees.push(amount[counter] - deposit[counter]);
              amount[counter] -= fees[counter];
            } else {
              fees.push(deposit[counter]);
              amount[counter] = 0;
            }
            delegateId.push(trx.operations[j].data.account_id);
            foundWithdrawal = true;
            counter++;
            break;
          }
        }
      }

      if (foundWithdrawal === true) {
        var promises = [];
        for (i = 0; i < counter; i++) {
          pay._id = delegateId[i];
          var toPush = {};
          toPush.fees = [transaction.reg_date_ISO.getTime(), transaction._id, fees[i] / config.basePrecision];
          if (amount[i] !== 0) {
            toPush.withdrawals = [transaction.reg_date_ISO.getTime(), transaction._id, amount[i] / config.basePrecision];
          }

          promises.push(payCollection.update({
            _id: delegateId[i]
          }, {
            $push: toPush
          }, {
            'upsert': true
          }));
        }

        Q.all(promises).then(function(result) {
          payStateCollection.update({
            _id: 1
          }, {
            _id: 1,
            lastId: lastblock
          }, {
            'upsert': true
          }).success(function(doc) {
            console.log('updated pay state at block: ' + lastblock);
            if (loopBoolean) {
              deferred.resolve(getPay(lastblock, loopBoolean));
            } else {
              deferred.resolve('wrote pay for block');
            }
          });
        });
      } else {

        if (loopBoolean) {
          deferred.resolve(getPay(lastblock, loopBoolean));
        } else {
          deferred.resolve('wrote pay for block');
        }
      }
    } else {
      deferred.resolve('** No new pay transactions **');
    }
  });
  return deferred.promise;
}

module.exports = {
  update: updatePay,
  updateDelegate: getPay
};