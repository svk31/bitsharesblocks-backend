module.exports = function(app, io, redisSub, client) {

    console.log('init new-blocks.js');

    var blocksPerPage = 20;
    var timeOutLength = 2000;
    
    function timeOutFunction(res) {
        return setTimeout(() => {
            return res.status(404).send();
        }, timeOutLength)
    };

    // Traditional GET routes
    app.get('/v1/blocks/recent', function(req, res) {
        console.log("req /v1/blocks/recent");
        timeOutFunction(res);
        client.request("recentBlocks", {}, blocks => {
            console.log("woot I got latest blocks:", blocks.length);
            return res.json(blocks);
        });        
    });

    app.get('/v1/blocks/:height', function(req, res) {
        var height = Math.max(1, parseInt(req.params.height, 10));
        console.log("req /v1/blocks/:height", height);
        timeOutFunction(res);
        if (typeof height !== "number") {
            res.status(404).send();
        }
        client.request("getBlock", height, block => {
            console.log("woot I got a block:", block);
            return res.json(block);
        });        
    });

    app.get('/v1/blocks/page/:top', function(req, res) {
        console.log("req /v1/blocks/page");
        var top = parseInt(req.params.top, 10);
        client.request("blocksPage", {top: top}, blocks => {
            console.log("woot I got blocks page:", blocks.length);
            return res.json(blocks);
        });
    });

    // WebSocket push events
    redisSub.subscribe('new_block');
    redisSub.subscribe('dynamic_global_property');
    redisSub.subscribe('global_property');
    
    redisSub.on('message', function(channel, data) {
        if (channel === 'new_block') {
            io.sockets.in('head_block').emit('head_block', data);
        }

        if (channel === 'dynamic_global_property') {
            io.sockets.in('dyn_global').emit('dyn_global', data);
        }
    });
}
