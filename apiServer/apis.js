var enode = require('enode');
var Q = require("q");
var config = require('../config.json');
var messenger = require("messenger");

module.exports = function(io) {

    function reconnect(type) {
        console.log('going to reconnect', type)
        // setTimeout(connect,config.dnodeReconnect)
    }

    function init_messenger() {        
        return messenger.createSpeaker(config.messengerPort)
    }

    function init_socketio() {
        var deferred = Q.defer();
        io.on('connection', function(socket) {
            console.log('a user connected');

            socket.on('disconnect', function() {
                console.log('user disconnected');
            });

            socket.on('subscribe', function(room) {
                console.log('joining room', room);
                socket.join(room);
            })

            socket.on('unsubscribe', function(room) {
                socket.leave(room);
            })

            deferred.resolve(socket);

        });

        return deferred.promise;
    }

    return {
        init_messenger: init_messenger,
        init_socketio: init_socketio
    };
}