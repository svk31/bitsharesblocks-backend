var Q = require('q');
var utils = require("../utils/utils");

let objectsById = {};
let accountsById = {};
let accountNamesById = {};
let witnessesById = {};
let witnessNamesById = {};


let updateObjects = function(objects) {
	objects[0].forEach(object => {

		switch (utils.getObjectType(object.id)) {

			case "account":
				accountNamesById[object.id] = object.name;
				accountsById[object.id] = object;
				console.log("updated account:", object.id);
			break;

			case "witness":
				console.log("try to updat witness:", object);
				witnessNamesById[object.id] = object.name;
				witnessesById[object.id] = object;
				console.log("updated witness:", object.id);
			break;

			default: 
				objectsById[object.id] = object;

			break;
		}
		// console.log("object Type:", utils.getObjectType(object.id));
	})
}

let getObject = function(id) {
	var deferred = Q.defer();

	deferred.resolve(objectsById[id]);

	return deferred.promise;
}

module.exports = updateObjects;
