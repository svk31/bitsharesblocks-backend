'use strict';

const config = require('../../config_play.json');
var utils = require('../../utils/utils.js');

var Q = require('q');
var _voteUpdateRunning = false;
var _rankRunning = false;
var _delegateRunning = false;
var _currentBlock = 1;

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var votesCollection = db.get('votes');
var votesByIDCollection = db.get('votesById');
var ranksHistoryCollection = db.get('ranksHistory');
var votesSumCollection = db.get('votesSum');
var delegatesRankCollection = db.get('delegatesRanks');
var transactionsCollection = db.get('transactions');

// votesCollection.remove({_id:{$gt:0}});
// votesByIDCollection.remove({_id:{$gt:0}});
// votesSumCollection.remove({_id:{$gt:0}});
// ranksHistoryCollection.remove({_id:{$gt:0}});

// db.createCollection( "ranksHistory", { capped: true, size: 150000000 } )
// db.runCommand({"convertToCapped": "ranksHistory", size: 150000000});

// db.createCollection( "votesSum", { capped: true, size: 150000000 } );
// db.runCommand({"convertToCapped": "votesSum", size: 150000000});

getLatestBlock();

setInterval(getLatestBlock, 10000);

function getLatestBlock() {
	utils.redisGet('_currentBlock').then(function(result) {
		_currentBlock = result._id;
		return console.log('** CURRENT BLOCK IS: ' + _currentBlock);
	});
}

function voteUpdateLauncher() {
	if (_voteUpdateRunning === false) {
		_voteUpdateRunning = true;
		console.log('** CHECKING FOR NEW VOTES ** ');
		votesCollection.findOne({}, {
			sort: {
				_id: -1
			}
		}).success(function(lastVotes) {
			// console.log(lastVotes);
			var lastBlock = (lastVotes === null) ? 0 : lastVotes._id;
			return voteUpdater(lastBlock);
		});
	} else {
		return console.log('** VOTES UPDATE ALREADY RUNNING **');
	}
}

function voteUpdater(lastBlock) {
	console.log('last block:' + lastBlock + ' - current block:' + _currentBlock);
	var delegateID;
	if (lastBlock <= _currentBlock) {
		transactionsCollection.findOne({
				'_id': {
					$gt: lastBlock
				}
			}, {
				sort: {
					_id: 1
				}
			}).success(function(transaction) {
				var votesFound = false,
					updatePromises = [];
				if (transaction !== null) {
					lastBlock = transaction._id;
					var votes = {};
					votes._id = lastBlock;
					votes.votes = {};
					var votesCount = 0;
					var delegateIds = [];
					transaction.transactions.forEach(function(transaction, i) {
						let net_votes = (transaction[1].delegate_vote_deltas) ? transaction[1].delegate_vote_deltas :
							(transaction[1].delta_votes) ? transaction[1].delta_votes :
							transaction[1].net_delegate_votes;
						if (net_votes.length > 0) {
							votesFound = true;
							net_votes.forEach(function(vote, index) {
								var amount = (vote[1].votes_for) ? vote[1].votes_for : vote[1];
								if (typeof(amount) === 'number' && amount !== 0) {
									delegateID = vote[0];
									if (!votes.votes[delegateID]) {
										votes.votes[delegateID] = 0;
										votesCount += 1;
										delegateIds.push(delegateID);
									}
									votes.votes[delegateID] += amount;
								}
							});
						}
					});

					if (votesFound && votesCount > 0) {
						votes.votesCount = votesCount;

						votesCollection.update({
								'_id': lastBlock
							}, votes, {
								'upsert': true
							})
							.success(function(doc) {

								var i, updateCounter = 0;


								for (i = 0; i < delegateIds.length; i++) {

									updatePromises.push(
										votesByIDCollection.update({
											'_id': delegateIds[i]
										}, {
											$push: {
												'votes': {
													'block': lastBlock,
													'vote': votes.votes[delegateIds[i]]
												}
											}
										}, {
											'upsert': true
										}));
								}

								Q.all(updatePromises)
									.then(function(result) {
										return voteUpdater(lastBlock);
									});

							})
							.error(function(error) {
								console.log('Failed to update votesCollection');
								return console.log(error);
							});
					} else {
						return voteUpdater(lastBlock);
					}
				} else {
					console.log('No new transactions found and launching votesSum');
					return votesSumLauncher();
				}
			})
			.error(function(error) {
				_voteUpdateRunning = false;
				return console.log(error);
			});
	} else {
		console.log('No new transactions found and stopping');
		_voteUpdateRunning = false;
		return;
	}
}

function votesSumLauncher() {
	votesSumCollection.findOne({}, {
		sort: {
			'_id': -1
		}
	}).success(function(lastVotesSum) {
		var lastBlock = (lastVotesSum !== null) ? lastVotesSum._id : 0;
		var votesSum = (lastVotesSum !== null) ? lastVotesSum : {};
		console.log('Last saved sum block:' + lastBlock);
		return updateVotesSum(lastBlock, votesSum, 1);
	});
}

function updateVotesSum(lastBlock, votesSum, counter) {
	console.log('Votes sum - last block:' + lastBlock);
	votesCollection.findOne({
		_id: {
			$gt: lastBlock
		}
	}).success(function(votes) {
		if (votes !== null) { // Found some new votes
			lastBlock = votes._id;

			if (!votesSum._id) { // Clean start, no previous sum found
				votesSum.votes = votes.votes;
				votesSum._id = votes._id;
			} else { // Adding new votes to existing sums
				votesSum._id = votes._id;
				for (var delegateID in votes.votes) {
					if (!votesSum.votes[delegateID]) { // No previous votes found for this delegate
						votesSum.votes[delegateID] = 0;
					}
					votesSum.votes[delegateID] += votes.votes[delegateID]; // Add new votes to previous sum
				}
			}

			// Prune id's with cumulative zero balance
			var tempSum = {};
			for (var delegateID in votesSum.votes) {
				if (votesSum.votes[delegateID] !== 0) {
					tempSum[delegateID] = votesSum.votes[delegateID];
					// console.log(typeof(tempSum[delegateID]));
				} else {
					console.log('not keeping zero value');
				}
			}

			votesSum.votes = tempSum;

			// Counter lets us save at only every 10 blocks containing votes to save space and time
			if (counter < 10) {
				counter++;
				return updateVotesSum(lastBlock, votesSum, counter);
			} else {
				votesSumCollection.update({
						'_id': votesSum._id
					}, votesSum, {
						'upsert': true
					})
					.success(function(doc) {
						return updateVotesSum(lastBlock, votesSum, 1);
					});
			}
		} else {
			console.log('no new votes found');
			_voteUpdateRunning = false;
			return rankHistory();
		}


	});
}

function rankHistory() {
	if (_rankRunning === false && _delegateRunning === false) {
		_rankRunning = true;
		console.log('** UPDATING RANK HISTORY **');
		console.log('current block: ' + _currentBlock);
		ranksHistoryCollection.findOne({}, {
			sort: {
				'_id': -1
			}
		}).success(function(ranks) {
			var lastBlock;
			if (ranks === null) {
				lastBlock = 0;
			} else {
				lastBlock = ranks._id;
			}
			console.log('last _id:' + lastBlock);

			return updateRanks(lastBlock);

		});
	}
}

function updateRanks(lastBlock) {
	console.log('Update ranks: checking block nr: ' + lastBlock);
	var votesCutoff = 10000000;

	if (lastBlock <= _currentBlock) {
		votesSumCollection.findOne({
			'_id': {
				$gt: lastBlock
			}
		}, {
			sort: {
				'_id': 1
			}
		}).success(function(votesSum) {
			if (votesSum !== null) {
				lastBlock = votesSum._id;
				var init = true;
				var rankedList = [];
				var counter = 0,
					id;
				var testArray = [];
				for (id in votesSum.votes) {
					if (votesSum.votes[id] > votesCutoff) { // Only push delegates with votes over a threshold
						testArray.push({
							id: id,
							votes: votesSum.votes[id]
						});
					}
				}

				var sortedArray = testArray.sort(function(a, b) {
					return (b.votes - a.votes !== 0) ? b.votes - a.votes : a.id - b.id;
				});

				// console.log(sortedArray[0]);

				for (var i = 0; i < sortedArray.length; i++) {
					rankedList.push(sortedArray[i].id);
				}

				// for (id in votesSum.votes) {
				//   if (votesSum.votes[id] > votesCutoff) {
				//     counter++;
				//     if (init) {
				//       rankedList.push(id);
				//       init = false;
				//     } else {
				//       if (votesSum.votes[rankedList[0]] < votesSum.votes[id]) { // current highest smaller than new sum
				//         rankedList.unshift(id);
				//       } else if (votesSum.votes[rankedList[rankedList.length - 1]] > votesSum.votes[id]) { // current lowest larger than new sum
				//         rankedList.push(id);
				//       } else {
				//         for (var j = 0; j < rankedList.length; j++) {
				//           if (votesSum.votes[rankedList[j]] <= votesSum.votes[id]) { // current iteration lower than or equal to new sum
				//             rankedList.splice(j, 0, id);
				//             break;
				//           }
				//         }
				//       }
				//     }
				//   }
				// }

				// for (var i = 0; i < rankedList.length; i++) {
				//   console.log('rank:', i + 1, 'rankedList id:', rankedList[i], 'testArray:', sortedArray[i]);
				// }


				ranksHistoryCollection.update({
					'_id': lastBlock
				}, {
					'_id': lastBlock,
					'ranks': rankedList
				}, {
					'upsert': true
				}).success(function(docs) {
					console.log('updated ranks history');
					return updateRanks(lastBlock);
				});
			} else {
				console.log('** RANK HISTORY: No new vote sums found');
				_rankRunning = false;
				return getRankMovement();
			}
		});
	}
}

// getRankMovement();

function getRankMovement() {
	console.log('** UPDATING RANK CHANGES **');
	var oneDay = 6 * 60 * 24;
	var oneWeek = 6 * 60 * 24 * 7;
	var ranks = {};
	ranks.current = {};
	var dayRanks = {};
	var weekRanks = {};
	var currentId;
	var changeDay = {};
	var changeWeek = {};
	var i;

	ranksHistoryCollection.findOne({}, {
		sort: {
			'_id': -1
		}
	}).success(function(doc) {
		if (doc) {
			currentId = doc._id;
			console.log('current id:' + currentId);
			for (var i = 0; i < doc.ranks.length; i++) {
				ranks.current[doc.ranks[i]] = i;
				// if (doc.ranks[i]==10323) {
				//   console.log('current rank:'+i);
				// }
			}

			ranksHistoryCollection.findOne({
				'_id': {
					$gte: (currentId - oneDay)
				}
			}, {
				sort: {
					'_id': 1
				}
			}).success(function(dayRanks) {
				console.log('yesterday id:' + dayRanks._id);
				for (i = 0; i < dayRanks.ranks.length; i++) {
					changeDay[dayRanks.ranks[i]] = i - ranks.current[dayRanks.ranks[i]];
					// if (dayRanks.ranks[i]==10323) {
					//   console.log('yesterday rank:'+i);
					// }
				}
				console.log('one day of blocks:', oneDay);
				console.log('one week of blocks:', oneWeek);

				console.log('week, block greater than:', currentId - oneWeek);
				ranksHistoryCollection.findOne({
					'_id': {
						$gte: (currentId - oneWeek)
					}
				}, {
					sort: {
						'_id': 1
					}
				}).success(function(weekRanks) {
					console.log('last week id:' + weekRanks._id);
					for (i = 0; i < weekRanks.ranks.length; i++) {
						changeWeek[weekRanks.ranks[i]] = i - ranks.current[weekRanks.ranks[i]];
						// if (weekRanks.ranks[i]==10323) {
						//   console.log('last week rank:'+i);
						// }
					}

					delegatesRankCollection.update({
						'_id': 1
					}, {
						'_id': 1,
						'dayChange': changeDay,
						'weekChange': changeWeek
					}, {
						upsert: true
					}).success(function(doc) {
						return console.log('wrote ranks');
					});
				}); // week
			});
		}
	});
}

module.exports = {
	update: voteUpdateLauncher
};