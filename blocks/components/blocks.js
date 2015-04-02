'use strict';

const config = require('../../config_dvs.json');
var utils = require('../../utils/utils.js');
var accounts = require('./accounts');
var missed = require('./missingBlocks');
var pay = require('./pay');
var Q = require('q');

var _updateRunning = false;
var _currentBlock = 1;
var _getInfo;
var _previousStamp;
var _redisAssets = [];

// DB DEF
var db = require('monk')('localhost/' + config.database);
var blocksCollection = db.get('blocks');
var transactionsCollection = db.get('transactions');


var setIndex = true;
if (setIndex) {
	blocksCollection.ensureIndex({
		user_transaction_ids: 1
	});
	blocksCollection.ensureIndex({
		signee: 1,
		_id: 1,
		latency: 1
	});
	blocksCollection.ensureIndex({
		reg_date_ISO: 1
	});
	blocksCollection.ensureIndex({
		trxLength: 1
	});

	transactionsCollection.ensureIndex({
		reg_date_ISO: 1
	});
	transactionsCollection.ensureIndex({
		short_ids: 1
	});
	transactionsCollection.ensureIndex({
		full_ids: 1
	});
	transactionsCollection.ensureIndex({
		reg_date_ISO: 1,
		types: 1
	});

	transactionsCollection.ensureIndex({
		types: 1,
		_id: -1
	});

	transactionsCollection.ensureIndex({
		"burns.0": 1
	});

	transactionsCollection.ensureIndex({
		types: 1
	});

}

// FUNCTIONS
utils.redisGet('marketOps').then(function(result) {
	if (result.length > 0) {
		_redisAssets = result;
	} else {
		_redisAssets = [];
	}
});

function getAllBlocks() {
	console.log('** RUNNING BLOCK UPDATE **');

	utils.rpcCall('getinfo', []).
	then(function(result) {
			_getInfo = result;
			utils.redisSet('_getInfo', _getInfo);
			_currentBlock = result.blockchain_head_block_num;
			if (_currentBlock % 10 === 0) {
				console.log('current max block: ' + _currentBlock);
			}
			blocksCollection.find({}, {
				limit: 1,
				sort: {
					_id: -1
				}
			}).success(function(docs) {
				var lastSavedBlock;
				if (docs.length === 0) {
					lastSavedBlock = 0;
				} else {
					lastSavedBlock = docs[0].block_num;
				}
				if (_updateRunning === false) {
					_updateRunning = true;
					return updateBlock(lastSavedBlock).then(function(result) {
						_updateRunning = false;
					});
				} else {
					return console.log('update blocks already running');
				}
			});
		})
		.catch(function(error) {
			console.log(' get block rpc failed:');
			console.log(error);
		});
}

function updateBlock(blockHeight) {
	var deferred = Q.defer();
	// console.log('blockHeight:',blockHeight,'_currentBlock:',_currentBlock);

	if (blockHeight < _currentBlock) {
		if ((blockHeight + 1) % 10 === 0) {
			console.log('UPDATING BLOCK: ' + (blockHeight + 1));
		}
		var missedBlock = false;
		var block, trxInfo;
		utils.rpcCall('blockchain_list_blocks', [blockHeight + 1, 1])
			.then(function(result) {
				// console.log('found block:',result);
				var promises = [];
				var missing = false,
					missingIndex, trx = false;
				// if (blockHeight + 1 !== 172642) { // DVS FIX FOR BLOCKS WITH ASSERT EXCEPTION
				promises.push(utils.rpcCall('blockchain_get_block_signee', [blockHeight + 1]));
				// }

				block = result[0];
				block._id = block.block_num;
				block.reg_date_ISO = utils.get_ISO_date(block.timestamp);
				block.trxLength = block.user_transaction_ids.length;

				if (block.trxLength > 0) {
					promises.push(utils.rpcCall('blockchain_get_block_transactions', [block.block_num]));
					trx = true;
				} else {
					promises.push([]);
				}

				if (blockHeight > 0 && ((block.reg_date_ISO - _previousStamp) > 10000)) {
					promises.push(utils.rpcCall('blockchain_list_missing_block_delegates', [blockHeight + 1]));
					missing = true;
					missingIndex = (trx) ? 2 : 1;
				}
				_previousStamp = utils.get_ISO_date(block.timestamp);
				Q.all(promises)
					.then(function(results) {
						// console.log('found info:', results);
						var updatePromises = [];
						block.signee = results[0];
						if (trx) {
							// block.transactions = results[1];

							trxInfo = trxLoop(results[1], {
								blockNum: block.block_num,
								reg_date_ISO: block.reg_date_ISO
							});

							updatePromises.push(transactionsCollection.update({
								'_id': trxInfo.transactions._id
							}, trxInfo.transactions, {
								'upsert': true
							}));

							trxInfo.accountOperations.forEach(function(update) {
								// console.log('updating account: ' + update.accountID);
								updatePromises.push(accounts.updateAccount(update.accountID, false, block.block_num));
							});
						}

						updatePromises.push(blocksCollection.update({
							'_id': block.block_num
						}, block, {
							'upsert': true
						}));

						if (missing) {
							updatePromises.push(missed.updateBlock(block.block_num, false));
						}

						updatePromises.push(utils.redisSet('_currentBlock', block));
						updatePromises.push(utils.redisSet('marketOps', _redisAssets));

						Q.all(updatePromises)
							.then(function(success) {
								// console.log(success);
								// console.log('wrote block '+(blockHeight+1));
								// if (success.length > 2) {
								//  console.log(success);
								// }
								if (trxInfo && trxInfo.payUpdate) {
									pay.updateDelegate(trxInfo.transactions._id - 1, false).then(function(result) {
										deferred.resolve(updateBlock(blockHeight + 1));
									});
								} else {
									deferred.resolve(updateBlock(blockHeight + 1));
								}
							})
							.catch(function(error) {
								console.log('updatePromises error');
								console.log(error);
								deferred.resolve(error);
							});
					})
					.catch(function(error) {
						console.log(error);
					});
			});
	} else {
		deferred.resolve('AT CURRENT BLOCK');
	}
	return deferred.promise;
}

function trxLoop(trx, block) {
	var promises = [];

	var transactions = {};
	transactions._id = block.blockNum;
	transactions.reg_date_ISO = block.reg_date_ISO;
	if (trx === undefined) {
		transactions.totalvalue = 0;
		return transactions;
	}
	transactions.transactions = trx;
	transactions.trxLength = trx.length;

	transactions.totalvalue = {};
	var nrTrx = trx.length;
	transactions.fees = {};
	transactions.types = [];
	transactions.full_ids = [];
	transactions.short_ids = [];

	var payUpdate = false;
	var accountOperations = [];

	var assets = {},
		newAssets = {},
		assetCount = 0,
		assetCreate = 0;
	var marketOps = ['ask_index', 'bid_index', 'cover_index', 'short_index'];
	trx.forEach(function(transaction, index) {

		transactions.full_ids.push(transaction[0]);
		transactions.short_ids.push(transaction[0].substr(0, 8));

		for (var jj = 0; jj < transaction[1].balance.length; jj++) {
			if (!transactions.fees[transaction[1].balance[jj][0]]) {
				transactions.fees[transaction[1].balance[jj][0]] = 0;
			}
			transactions.fees[transaction[1].balance[jj][0]] += transaction[1].balance[jj][1];
		}
		for (jj = 0; jj < transaction[1].withdraws.length; jj++) {
			let withdraws = transaction[1].withdraws[jj];
			var withdrawnAsset, withdrawnAmount;

			withdrawnAsset = (withdraws[1].asset_id) ? withdraws[1].asset_id : withdraws[0];
			withdrawnAmount = (withdraws[1].amount) ? withdraws[1].amount : withdraws[1];

			// console.log('withdrawnAsset',withdrawnAsset);
			// console.log('withdrawnAmount',withdrawnAmount);

			if (!transactions.totalvalue[withdrawnAsset]) {
				transactions.totalvalue[withdrawnAsset] = 0;
			}
			transactions.totalvalue[withdrawnAsset] += withdrawnAmount;
		}
		transactions.transactions[index][1].type = 'transfer';


		transaction[1].trx.operations.forEach(function(op) {
			var baseAsset = false;
			var quoteAsset = false;
			if (op.type === 'create_asset_op_type') {
				assetCreate++;
				console.log('asset creation trx');
				baseAsset = op.data.symbol;
				newAssets[baseAsset] = true;
			}

			if (op.type === 'issue_asset_op_type') {
				console.log(op);
				assetCount++;
				console.log('asset issue trx');
				baseAsset = 0;
				quoteAsset = op.data.amount.asset_id;
			}

			var i;
			for (i = 0; i < marketOps.length; i++) {
				if (op.data[marketOps[i]]) {
					assetCount++;
					// console.log('FOUND MARKET OP');
					baseAsset = op.data[marketOps[i]].order_price.base_asset_id;
					quoteAsset = op.data[marketOps[i]].order_price.quote_asset_id;
					// console.log(marketOps[i], 'baseAsset:', baseAsset, 'quoteAsset:', quoteAsset);
				}
			}

			if (baseAsset >= 0 && quoteAsset) {
				if (!assets[baseAsset]) {
					assets[baseAsset] = [];
				}
				var exists = false;
				for (i = 0; i < assets[baseAsset].length; i++) {
					if (assets[baseAsset][i] === quoteAsset) {
						exists = true;
					}
				}
				if (!exists) {
					assets[baseAsset].push(quoteAsset);
				}


			}
		});

		// console.log('assets:', assets);

		for (var kk = 0; kk < transaction[1].trx.operations.length; kk++) {
			if (transaction[1].trx.operations[kk].type === 'withdraw_pay_op_type') {
				transactions.transactions[index][1].type = 'withdraw_pay';
				payUpdate = true;
			}
			// if (transaction[1].trx.operations[kk].type === 'define_delegate_slate_op_type') {
			//  transactions.transactions[index][1].type = 'define_slate'; 
			// }

			if (transaction[1].trx.operations[kk].type === 'update_account_op_type') {
				transactions.transactions[index][1].type = 'account_update';
				accountOperations.push({
					accountID: transaction[1].trx.operations[kk].data.account_id
				});
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'ask_op_type') {
				transactions.transactions[index][1].type = 'asset_ask';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.ask_index.order_price.quote_asset_id;
				transactions.transactions[index][1].base_asset = transaction[1].trx.operations[kk].data.ask_index.order_price.base_asset_id;
				transactions.transactions[index][1].ratio = transaction[1].trx.operations[kk].data.ask_index.order_price.ratio;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'bid_op_type') {
				transactions.transactions[index][1].type = 'asset_bid';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.bid_index.order_price.quote_asset_id;
				transactions.transactions[index][1].baseasset = transaction[1].trx.operations[kk].data.bid_index.order_price.base_asset_id;
				transactions.transactions[index][1].ratio = transaction[1].trx.operations[kk].data.bid_index.order_price.ratio;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'short_op_type' || transaction[1].trx.operations[kk].type === 'short_op_v2_type') {
				transactions.transactions[index][1].type = 'asset_short';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.short_index.order_price.quote_asset_id;
				transactions.transactions[index][1].baseasset = transaction[1].trx.operations[kk].data.short_index.order_price.base_asset_id;
				transactions.transactions[index][1].ratio = transaction[1].trx.operations[kk].data.short_index.order_price.ratio;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'cover_op_type') {
				transactions.transactions[index][1].type = 'asset_cover';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.cover_index.order_price.quote_asset_id;
				transactions.transactions[index][1].baseasset = transaction[1].trx.operations[kk].data.cover_index.order_price.base_asset_id;
				transactions.transactions[index][1].ratio = transaction[1].trx.operations[kk].data.cover_index.order_price.ratio;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'create_asset_op_type') {
				transactions.transactions[index][1].type = 'asset_create';
				transactions.transactions[index][1].assetName = transaction[1].trx.operations[kk].data.name;
				console.log('asset creation');
				transactions.transactions[index][1].assetSymbol = transaction[1].trx.operations[kk].data.symbol;
				transactions.transactions[index][1].assetDescription = transaction[1].trx.operations[kk].data.description;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'add_collateral_op_type') {
				transactions.transactions[index][1].type = 'add_collateral';
				transactions.transactions[index][1].amount = transaction[1].trx.operations[kk].data.amount;
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.cover_index.order_price.quote_asset_id;
				transactions.transactions[index][1].baseasset = transaction[1].trx.operations[kk].data.cover_index.order_price.base_asset_id;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'update_feed_op_type') {
				transactions.transactions[index][1].type = 'update_feed';
				break;
			}

			if (transaction[1].trx.operations[kk].type === 'issue_asset_op_type') {
				transactions.transactions[index][1].type = 'asset_issue';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.amount.asset_id;
				transactions.transactions[index][1].amount = transaction[1].trx.operations[kk].data.amount.amount;
				break;
			}
			if (transaction[1].trx.operations[kk].type === 'burn_op_type') {
				transactions.transactions[index][1].type = 'burn';
				transactions.transactions[index][1].asset = transaction[1].trx.operations[kk].data.amount.asset_id;
				transactions.transactions[index][1].amount = transaction[1].trx.operations[kk].data.amount.amount;
				if (!transactions.burns) {
					transactions.burns = {};
				}
				if (transactions.burns && !transactions.burns[transactions.transactions[index][1].asset]) {
					transactions.burns[transactions.transactions[index][1].asset] = [];
				}
				transactions.burns[transactions.transactions[index][1].asset].push(transactions.transactions[index][1].amount);
				transactions.transactions[index][1].account_id = transaction[1].trx.operations[kk].data.account_id;
				transactions.transactions[index][1].message = transaction[1].trx.operations[kk].data.message;
				accountOperations.push({
					accountID: transaction[1].trx.operations[kk].data.account_id
				});

				break;
			}
			if (transaction[1].trx.operations[kk].type === 'register_account_op_type') {
				transactions.transactions[index][1].type = 'account_register';

				accountOperations.push({
					accountID: transaction[1].trx.operations[kk].data.name
				});
				break;
			}
		}

		transactions.types.push(transactions.transactions[index][1].type);


	});

	// for (var asset in assets) {
	//   // console.log('asset:',asset);
	//   for (var i = 1; i < assets[asset].length; i++) {
	//     console.log(assets[asset][i].quoteAsset === assets[asset][i - 1].quoteAsset);
	//   }
	// }

	_redisAssets.push({
		_id: transactions._id,
		assets: assets,
		assetCount: assetCount,
		newAssets: newAssets,
		assetCreate: assetCreate
	});
	if (_redisAssets.length > 10) {
		_redisAssets.splice(0, 1);
	}
	// console.log(_redisAssets);

	return {
		transactions: transactions,
		accountOperations: accountOperations,
		payUpdate: payUpdate
	};
}

// launchTransactionUpdates(1657679);


function launchTransactionUpdates(index) {
	console.log('** LAUNCHING TRANSACTIONS UPDATE **');
	// transactionsCollection.drop();
	// var index=0;
	return updateTransactionsOnly(index).then(function(result) {
		console.log(result);
	});
}

function updateTransactionsOnly(index) {
	var deferred = Q.defer();
	if (index <= _currentBlock) {

		blocksCollection.findOne({
			'trxLength': {
				$gt: 0
			},
			_id: {
				$gt: index
			}
		}, {
			fields: {
				'_id': 1,
				'reg_date_ISO': 1
			},
			sort: {
				'_id': 1
			}
		}).success(function(block) {
			if (block) {
				utils.rpcCall('blockchain_get_block_transactions', [block._id]).then(function(transaction) {
					if (transaction) {

						var updatePromises = [];

						console.log('Updating trx for block: ' + block._id);
						var trxInfo = trxLoop(transaction, {
							blockNum: block._id,
							reg_date_ISO: block.reg_date_ISO
						});

						trxInfo.accountOperations.forEach(function(update) {
							// console.log('updating account: ' + update.accountID);
							updatePromises.push(accounts.updateAccount(update.accountID, false, block._id));
						});

						updatePromises.push(transactionsCollection.update({
							'_id': trxInfo.transactions._id
						}, trxInfo.transactions, {
							'upsert': true
						}));

						updatePromises.push(utils.redisSet('marketOps', _redisAssets));

						Q.all(updatePromises)
							.then(function(result) {
								deferred.resolve(updateTransactionsOnly(block._id));
							});
					} else {
						deferred.resolve('no more transactions to update');
					}
				});
			} else {
				deferred.resolve('no more transactions to update');
			}
		});


	} else {
		deferred.resolve('done updating transactions only');
	}
	return deferred.promise;
}

module.exports = {
	update: getAllBlocks,
	transactionUpdates: launchTransactionUpdates,
	updateBlock: updateBlock,
	updateTransaction: updateTransactionsOnly
};