'use strict';

var Q = require('q');
var redis = require("redis"),
	redisClient = redis.createClient();
var chainTypes = require("./chain_types");

let id_regex = /\b\d+\.\d+\.(\d+)\b/;

module.exports = {
	R_ISO8601_STR: /^(\d{4})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,
	get_ISO_date: function(timestamp) {
		if (timestamp.length === 15) {
			return new Date(new moment.utc(timestamp, 'YYYYMMDD hhmms'));
		} else if (timestamp.length === 19) {
			return new Date(new moment.utc(timestamp));
		}

	},

	isObjectId(obj_id) {
        if( 'string' !== typeof obj_id ) {
        	return false;
        };
        let match = id_regex.exec(obj_id);
        return (match !== null && obj_id.split(".").length === 3);
	},

	getObjectType(object) {
		if (!this.isObjectId(object)) {
			return console.log(object + " is not a valid object id");
		}

		let idParts = object.split(".");
		// console.log("chainTypes:", object, idParts, chainTypes)

		if (idParts[0] === "1") { 
			for (let type in chainTypes.object_type) {
				if (chainTypes.object_type[type] === parseInt(idParts[1], 10)) {
					return type;
				}
			}
		} else if (idParts[0] === "2") {
			for (let type in chainTypes.impl_object_type) {
				if (chainTypes.impl_object_type[type] === parseInt(idParts[1], 10)) {
					return type;
				}
			}
		}

		console.log("Object type not found for object: " + JSON.stringify(idParts));

		return "unknown";

	},
	getOperationType(op_id) {

		for (let type in chainTypes.operations) {
			if (chainTypes.operations[type] === parseInt(op_id, 10)) {
				return type;
			}
		}

		console.log("Operation type not found for Operation: " + op_id);

		return "unknown";

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