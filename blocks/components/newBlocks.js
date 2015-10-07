var utils = require("../../utils/utils");
var redis = require("redis");
var redisClient = redis.createClient();
import objectClasses from "../object_classes/objects";

module.exports = function(db_api, redisServer, db, ChainStateApi) {
    var transactionsCollection = db.get('transactions');

    let blockMethods = {
        getBlock: (height, headBlock) => {
            return ChainStateApi.fetchBlock(height).then(block => {
                if (headBlock) {
                    let shortBlock = objectClasses.shortBlock(block);
                    ChainStateApi.addBlock(shortBlock);
                    redisServer.publish('new_block', JSON.stringify(shortBlock));
                }

                if (block.transactions.length) {
                    // console.log("got block with transactions:", height, block);
                    block._id = height;
                    block.trxCount = block.transactions.length;
                    block.types = [];

                    block.transactions.forEach(trx => {
                        trx.operations.forEach(op => {
                            block.types.push(utils.getOperationType(op[0]));
                        })
                    });
                    transactionsCollection.update({
                        '_id': height
                    }, block, {
                        'upsert': true
                    })
                }
            }).catch(err => {
                console.log("getBlock error:", err);
            })
        },
        getAllBlocks: () => {
            console.log("try to getAllBlocks 1 ->", ChainStateApi.getHeadBlock());
            for (let i = 1; i <= ChainStateApi.getHeadBlock(); i++) {
                blockMethods.getBlock(i);
            };
        }
    }

    redisClient.subscribe("dynamic_global_property");

    redisClient.on("message", function(channel, data) {
        data = JSON.parse(data);
        switch (channel) {
            case "dynamic_global_property":
                blockMethods.getBlock(data.head, true);
                break;

            default:

                break;
        }
    });

    // Fetch 20 latest blocks on launch
    ChainStateApi.getObject("2.1.0").then(object => {
        for (var i = object.head_block_number - 19; i <= object.head_block_number; i++) {
            blockMethods.getBlock(i, true);
        };
    })

    return blockMethods;

}