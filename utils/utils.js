'use strict';

const config = require('../config_dvs.json');
var moment = require('moment');
var jayson = require('jayson');
var Q = require('q');
var redis = require("redis"),
	redisClient = redis.createClient();

var _jaysonClient = jayson.client.http({
	port: config.rpc_port,
	hostname: '127.0.0.1',
	path: '/rpc',
	auth: (config.rpc_username + ':' + config.rpc_password),
});

module.exports = {
	R_ISO8601_STR: /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,
	get_ISO_date: function(timestamp) {
		if (timestamp.length === 15) {
			return new Date(new moment.utc(timestamp, 'YYYYMMDD hhmms'));
		} else if (timestamp.length === 19) {
			return new Date(new moment.utc(timestamp));
		}

	},
	rpcCall: function(method, inputParams) {
		var params = inputParams || [];
		var deferred = Q.defer();
		_jaysonClient.request(method, params, function(err, error, result) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve(result);
			}
		});
		return deferred.promise;
	},
	redisSet: function(key, value) {
		var deferred = Q.defer();
		redisClient.set(key, JSON.stringify(value), function(err, replies) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve(replies);
			}
		});

		return deferred.promise;
	},
	redisGet: function(key) {
		var deferred = Q.defer();
		redisClient.get(key, function(err, replies) {
			if (err) {
				deferred.reject(err);
			} else {
				try {
					deferred.resolve(JSON.parse(replies));
				} catch (error) {
					console.log(error);
					deferred.resolve({});
				}


			}
		});

		return deferred.promise;
	}
};