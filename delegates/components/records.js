'use strict';

const config = require('../..config.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var _currentBlock = 1;
var _activeDelegatesCount = 101;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var delegatesRecord = db.get('delegatesRecord');
var blocksCollection = db.get('blocks');
var missedCollection = db.get('missed');

getLatestBlock();

setInterval(getLatestBlock, 10000);

function getLatestBlock() {
	utils.redisGet('_currentBlock').then(function(result) {
		// console.log(result);
		_currentBlock = result._id;
		return console.log('** CURRENT BLOCK IS: ' + _currentBlock);
	});
}

function updateActiveDelegateRecords() {
	console.log('UPDATING ACTIVE DELEGATE RECORDS');

	delegatesListCollection.find({
		'rank': {
			$lte: _activeDelegatesCount
		}
	}, {
		fields: {
			'name': 1
		}
	}).
	success(function(docs) {
		var batchNames = [];
		var ids = [];
		var blockNumber = [];

		for (var i = 0; i < docs.length; i++) {
			batchNames.push([docs[i].name, -1 * _currentBlock, 50]);
			blockNumber.push([docs[i].block_number]);
			ids.push(docs[i]._id);
		}
		utils.rpcCall('batch', ['blockchain_get_delegate_slot_records', batchNames]).then(function(result) {
				console.log('found ' + result.length + ' slot records');
				result.forEach(function(slotrecord, outerindex) {
					var history = {};
					slotrecord.forEach(function(record, innerindex) {
						record.start_time_ISO = utils.get_ISO_date(record.start_time);
					});
					history.slotrecord = slotrecord;
					history.name = batchNames[outerindex][0];
					history._id = ids[outerindex];
					if (outerindex < 2) {}
					delegatesRecord.update({
							'_id': parseInt(history._id)
						}, history, {
							'upsert': true
						})
						.error(function(err) {
							console.log(err);
							throw err;
						})
						.success(function(doc) {});
				});
			})
			.fail(function(err) {
				console.log(err);
				console.log('batch call failed');
				throw err;
			});
	});
}

// delegateRecordsNew();
// function delegateRecordsNew() {
// 	console.log('UPDATING ACTIVE DELEGATE RECORDS');
// 	delegatesListCollection.find({
// 		'rank': {
// 			$lte: _activeDelegatesCount
// 		}
// 	}, {
// 		fields: {
// 			'name': 1
// 		}
// 	}).success(function(activeDelegates) {
// 		for (var i = 0; i < activeDelegates.length; i++) {
// 			let delegateName = activeDelegates[i].name;
// 			blocksCollection.find({
// 				signee: delegateName
// 			}, {
// 				limit: 50
// 			}).success(function(signedBlocks) {
// 				// console.log(signedBlocks);
// 				missedCollection.find({
// 						delegate: 'vz'
// 					}).success(function(missedBlocks) {
// 						console.log(missedBlocks);
// 					})
// 					.error(function(error) {
// 						console.log('missed collection failed');
// 						console.log(error);
// 					});
// 			});
// 		}
// 	});
// }

module.exports = {
	update: updateActiveDelegateRecords
};