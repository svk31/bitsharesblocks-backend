var utils = require("../../utils/utils");
var redis = require("redis");
var redisClient = redis.createClient();

// var witness_list = 
let current_witness = null;
let global_property;
module.exports = function(db_api, redisServer, db, chainStateApi) {

    var witnessCollection = db.get('witnesses');

    redisClient.subscribe("global_property");

    redisClient.on("message", function(channel, data) {
        data = JSON.parse(data);
        // console.log("channel:", channel, "data:", data);
        switch (channel) {
            case "global_property":

                break;

            default:

                break;
        }
    });

    chainStateApi.getObject("2.0.0").then(object => {
        // console.log("global object:", object);
        global_property = object;

        witnessMethods.getAllWitnesses();
    });

    let witnessMethods = {
        getAllWitnesses: () => {
            console.log("try to getAllWitnesses");
            chainStateApi.getWitness(global_property.active_witnesses[0]).then(witness => {
                // console.log("got witness:", witness);
            })
            for (let i = global_property.active_witnesses.length - 1; i >= 0; i--) {
                chainStateApi.getWitness(global_property.active_witnesses[i]).then(witness => {
                    chainStateApi.getAccount(witness.witness_account);
                })
            };
        }
    }



    return witnessMethods;

}