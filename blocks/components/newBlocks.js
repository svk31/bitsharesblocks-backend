var redis = require("redis");
var redisPub = redis.createClient();

module.exports = function(db_api) {

    return {
        latestBlocks: function() {
                console.log("latestBlocks");
                var subFunction = sub => {
                    if (sub && sub.length > 0) {
                        sub.forEach(result => {

                            // Dynamic global object
                            if (result.id === "2.1.0") {
                                db_api.call("get_block", [result.head_block_number]).then(block => {
                                    console.log("got head block:", result.head_block_number, block);
                                    block.id = result.head_block_number;
                                    redisPub.publish('new_block', JSON.stringify(block));
                                }).catch(err => {
                                    console.log("get block error:", err);
                                })
                            }
                        });
                    }

                    // console.log("sub length:", sub.length, sub[0]);
                    // for (var i = 0; i < sub[0].length; i++) {
                    //     console.log("sub[0][i]:", sub[0][i]);
                    // };
                    // console.log("subFunction calldback:", sub);
                }

                db_api.call("get_objects", [["2.0.0", "2.1.0"]]).then(function(result) {
                    // console.log("get_objects:", result);
                }).catch(err => {
                    console.log("subscribe_to_objects error:", err);
                })
        }
    }

}