'use strict';
var Q = require("q");
var config = require('../config.json');
var redis = require("redis");

var app = require('express')();
var logger = require('morgan');
app.use(logger('dev'));
app.all('*', function(req, res, next) {
  res.header('Content-Type', 'application/json');
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});
var http = require('http').Server(app);
var io = require('socket.io')(http);
var apis = require("./apis")(io);

// dnodeRemote.getObject("2.0.0", result => {
//   console.log("woot I got object:", result);
//   d.end();
// })

var redisSub = redis.createClient();

Q.all([
  apis.init_messenger()
]).then(results => {
  let client = results[0];

  // setInterval(function(){
  //   client.request('give it to me', {}, (data) => {
  //     console.log(data);
  //   });
  // }, 1000);

  // let socket = results[1];
  // 
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
      console.log('unsubscribe room', room);
      socket.leave(room);
    })
  })

  require('./routes/newBlocksApi.js')(app, io, redisSub, client);
  require('./routes/newDelegatesApi.js')(app, io, redisSub, client);

  // remote.getObject("2.0.0", result => {
  //   console.log("woot I got object:", result);
  //   // d.end();
  // })

}).finally(() => {

  app.get('/hello', function(req, res) {
    return res.jsonp(")]}',\n" + JSON.stringify("Hello World"));
  });

  http.listen(config.ws_port, function() {
    console.log('listening on *:', config.ws_port);
  });
});



// redisSub.subscribe('new_block');
// redisSub.on('message', function(channel, data) {
//   console.log('message:', channel, data);
// })