import Q from "q";
import utils from "../utils/utils";
import objectClasses from "./object_classes/objects";
import _ from "lodash";

let objectsById = {};
let accounts = new Map();
let accountNamesById = {};
let fullWitnesses = new Map();
let shortWitnesses = new Map();
let witnessNamesById = new Map();
let latestBlocks = [];
let headBlock = 1;
let blocks = new Map();
let maxBlocks = 20;

module.exports = function(redisServer, api) {

	function _fetchObject(id) {
		// console.log("chainstate _fetchObject:", id);
		var deferred = Q.defer();
		api.db().call("get_objects", [
			[id]
		]).then(object => {
			let objects = [];
			objects.push(object);
			chainStateApi.updateObjects(objects);
			deferred.resolve(object[0]);
		});

		return deferred.promise;
	}

	function _fetchBlock(id) {
		var deferred = Q.defer();
		api.db().call("get_block", [
			id
		]).then(block => {
			block.id = id;
            chainStateApi.getWitness(block.witness).then(witness => {
            	chainStateApi.getAccount(witness.witness_account).then(witness_account => {
            		block.witness_name = witness_account.name;
            		blocks.set(block.id, block);
					deferred.resolve(block);
            	});
            });
		});

		return deferred.promise;
	}

	let chainStateApi = {
		updateObjects: objects => {
			objects[0].forEach(object => {
				// console.log("object:", object);
				switch (utils.getObjectType(object.id ? object.id : object)) {

					case "account":
						accountNamesById[object.id] = object.name;
						accounts.set(object.id, object);
						// console.log("updated account:", object.id);
						break;

					case "dynamic_global_property":
						headBlock = object.head_block_number;						
						redisServer.publish("dynamic_global_property", JSON.stringify(objectClasses.dynGlobalProperty(object)));
						objectsById[object.id] = object;
						break;

					case "global_property":
						console.log("updateObjects global_property");
						redisServer.publish("global_property", JSON.stringify(object));
						objectsById[object.id] = object;
						break;

					case "witness":
						witnessNamesById.set(object.id, object.name);
						Q.all([
							chainStateApi.getObject(object.witness_account),
							chainStateApi.getObject(object.pay_vb)
						]).then(results => {
							// console.log("pay:", results[1]);
							chainStateApi.getObject(results[1].id).then(balance => {
								// console.log("balance:", balance);

								object.name = results[0].name;
								object.balance = balance.balance;

								fullWitnesses.set(object.id, object);
								shortWitnesses.set(object.id, objectClasses.shortWitness(object));
								redisServer.publish("witness_update", JSON.stringify([object.id, shortWitnesses.get(object.id)]));
							})
						});
						// console.log("updated witness:", object.id);
						break;

					default:
						objectsById[object.id] = object;

						break;
				}
				// console.log("object Type:", utils.getObjectType(object.id));
			})
		},
		addBlock: block => {
			// console.log("addBlock:", block, !_.some(latestBlocks, blk => {
			// 	return blk.id === block.id;
			// }));
			
			if (!_.some(latestBlocks, blk => {
				return blk.id === block.id;
			})) {
				latestBlocks.unshift(block);
				console.log("addBlock", block.id, latestBlocks.length);

			}
			while (latestBlocks.length > maxBlocks) {
				latestBlocks.pop();
			}
			// }
		},
		getLatestBlocks: () => {
			return latestBlocks;
		},
		getBlock: (id) => {
			var deferred = Q.defer();

			if (blocks.get(id)) {
				deferred.resolve(blocks.get(id));
			} else {
				_fetchBlock(id).then(block => {					
					deferred.resolve(block);
				});
			}

			return deferred.promise;
		},
		getHeadBlock: () => {
			return headBlock;
		},
		getObject: id => {
			// console.log("chainStateApi getObject:", id);
			if (!utils.isObjectId(id)) {
				throw Error(id + " is not a valid object id");
			}
			var deferred = Q.defer();
			if (objectsById[id]) {
				deferred.resolve(objectsById[id]);
			} else {
				_fetchObject(id).then(object => {
					deferred.resolve(object);
				})
			}

			return deferred.promise;
		},
		getWitness: id => {
			// console.log("chainStateApi get witness:", id);
			if (!utils.isObjectId(id) || utils.getObjectType(id) !== "witness") {
				throw Error(id + " is not a valid witness id");
			}
			var deferred = Q.defer();
			if (fullWitnesses.get(id)) {
				deferred.resolve(fullWitnesses.get(id));
			} else {
				_fetchObject(id).then(witness => {
					deferred.resolve(witness);
				})
			}

			return deferred.promise;
		},

		getActiveWitnesses: () => {
			return shortWitnesses;
		},

		getAccount: id => {
			// console.log("chainStateApi get account:", id);
			if (!utils.isObjectId(id) || utils.getObjectType(id) !== "account") {
				throw Error(id + " is not a valid account id");
			}
			var deferred = Q.defer();
			if (accounts.get(id)) {
				deferred.resolve(accounts.get(id));
			} else {
				_fetchObject(id).then(object => {
					deferred.resolve(object);
				})
			}

			return deferred.promise;
		},
		getMarket: (quote, base) => {
			// console.log("chainStateApi get market:", quote, base);
			if (!utils.isObjectId(quote) || utils.getObjectType(quote) !== "asset") {
				throw Error(quote + " is not a valid account id");
			}
			if (!utils.isObjectId(base) || utils.getObjectType(base) !== "asset") {
				throw Error(base + " is not a valid account id");
			}

			let ID = quote + "_" + base;

			var deferred = Q.defer();
			if (marketsByID[id]) {
				deferred.resolve(marketsByID[id]);
			} else {
				_fetchObject(id).then(object => {
					deferred.resolve(object);
				})
			}

			return deferred.promise;
		},
		fetchBlock: _fetchBlock
	}

	return chainStateApi;
}