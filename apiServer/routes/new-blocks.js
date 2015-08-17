var latestBlocks = [];

module.exports = function(io, sub) {


    socket.on('get_blocks', function(channel, data) {
        console.log('looking for these blocks:', latestBlocks);
        socket.emit('get_blocks', JSON.stringify(latestBlocks));
    })

    /*
    New block route
     */
    console.log('init new-blocks.js');
    sub.subscribe('new_block');
    sub.on('message', function(channel, data) {
        // console.log('block message:', channel, data);

        if (channel === 'new_block') {
            latestBlocks.unshift(JSON.parse(data));
            if (latestBlocks.length > 20) {
                latestBlocks.drop();
            }
            io.sockets.in('new_block').emit('new_block', data);
        }
    });

}