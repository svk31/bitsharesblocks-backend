'use strict';

const config = require('../../config_play.json');
var utils = require('../../utils/utils.js');

var Q = require('q');

// DB DEF
var db = require('monk')('localhost/' + config.database);
var delegatesListCollection = db.get('delegatesList');
var slatesCollection = db.get('slates');

var setIndex = false;
if (setIndex) {
	// slatesCollection.ensureIndex({
	// 	_id: 1,
	// 	name: 1,
	// 	slate: 1
	// });
}

function updateSlates() {
	console.log('** UPDATING SLATES');
	delegatesListCollection.find({
			rank: {
				$lt: 501
			}
		}, {
			fields: {
				name: 1,
				_id: 1
			},
			sort: {
				rank: 1
			}
		})
		.success(function(delegates) {
			var slatePromises = [];
			// console.log(delegates);
			for (var i = 0; i < delegates.length; i++) {
				slatePromises.push(updateSlate(delegates[i]));
			}
			Q.all(slatePromises)
				.then(function(result) {
					console.log('** SLATE UPDATE DONE **');
				})
				.catch(function(error) {
					console.log('slate update failed');
					console.log(error);
				});
		});
}

function updateSlate(delegate) {
	var deferred = Q.defer();
	utils.rpcCall('blockchain_get_slate', [delegate.name])
		.then(function(slate) {
			slatesCollection.update({
					_id: delegate._id
				}, {
					_id: delegate._id,
					name: delegate.name,
					slate: slate
				}, {
					upsert: true
				})
				.success(function(doc) {
					deferred.resolve(true);
				})
				.error(function(error) {
					deferred.reject(error);
				});
		})
		.catch(function(error) {
			console.log(error);
			deferred.reject(error);
		});
	return deferred.promise;
}

module.exports = {
	updateSlate: updateSlate,
	update: updateSlates
};