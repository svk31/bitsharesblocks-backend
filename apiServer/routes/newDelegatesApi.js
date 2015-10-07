module.exports = function(app, io, redisSub, client) {

    console.log('init witnesses.js');

    // Traditional GET routes
    app.get('/v1/witnesses', function(req, res) {
        console.log("req /v1/witnesses");
        client.request("activeWitnesses", {}, witnesses => {
            // console.log("woot I got witnesses:", witnesses);
            return res.json(witnesses);
        });
    });


    // WebSocket push events
    redisSub.subscribe('witness_update');
    redisSub.on('message', function(channel, data) {
        if (channel === 'witness_update') {
            // console.log("witness_update:", data);
            io.sockets.in('witness_update').emit('witness_update', data);
        }
    });

}