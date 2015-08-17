  // 'use strict';

  var config = require('../config.json');
  var redis = require("redis");
  
  var app = require('express')();

  var logger = require('morgan');

  app.use(logger('dev'));

  var sub = redis.createClient();

  var http = require('http').Server(app);
  var io = require('socket.io')(http);

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


  });

  require('./routes/new-blocks.js')(io, sub);

  // sub.subscribe('new_block');
  // sub.on('message', function(channel, data) {
  //   console.log('message:', channel, data);
  // })

  http.listen(config.ws_port, function() {
    console.log('listening on *:', config.ws_port);
  });
