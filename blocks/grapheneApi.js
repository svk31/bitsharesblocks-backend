'use strict'

var WebSocket = require('ws');
var Q = require('q');


function WebsocketAPI(url) {

    this.url = url;
    this.current_callback_id = 1;
    var ws;

    this.init = function() {
        console.log("init of ws");
        var initPromise = Q.defer();
        ws = new WebSocket(url);
        ws.on("open", function(data, err) {
            if (err) {
                initPromise.reject(err);
            } else {
                initPromise.resolve(data);
            }

            ws.on("message", function(message) {
                messageHandler(JSON.parse(message));
            })
        })

        return initPromise.promise;
    }

    var callbacks = {};
    var subs = {};

    var messageHandler = function(message) {
        console.log("ws message:", message);
        callbacks[message.id].resolve(message.result);
    }

    this.call = function(params) {
        var deferred = Q.defer();
        callbacks[this.current_callback_id] = {
            resolve: deferred.resolve,
            reject: deferred.reject
        };
        ws.send(JSON.stringify({
            method: "call",
            params: params,
            id: this.current_callback_id
        }))

        this.current_callback_id++;
        return deferred.promise;
    }

    this.login = function(user, pass) {
        var that = this;
        return this.init().then(function(result) {
            return that.call([1, "login", [user, pass]])
        })
    }
}

function ApiConnection(apiName, ws) {
    this.ws = ws;
    this.db_name = apiName;
    this.db_id = null;
    var that = this;

    this.init = function() {

        return this.ws.call([1, apiName, []]).then(function(id) {
            return (that.db_id = id);
        });
    };

    this.call = function(method, params) {
        console.log("ApiConnection call:", params);
        if (this.db_id) {
            return this.ws.call([this.db_id, method, params]);
        }
    };
}

var Apis = (function() {
    var apis;
    var db;
    var history;
    var wsConnection;

    function init() {
        var initPromise = Q.defer();
        wsConnection = new WebsocketAPI("ws://127.0.0.1:8090");
        wsConnection.login("", "").then(function(success) {
            if (success) {
                db = new ApiConnection("database", wsConnection);
                history = new ApiConnection("history", wsConnection);
                Q.all([
                    db.init(),
                    history.init()
                ]).then(function() {
                    initPromise.resolve(true);
                });
            }
        });

        return {
            initPromise: initPromise.promise,
            close: function() {
                wsConnection.close();
                apis = null;
            },
            db: function() {
                return db;
            },
            history: function() {
                return history;
            }
        };
    }

    return {
        instance: function() {
            // console.log("launching Apis.instance", apis);
            if (!apis) {
                apis = init();
            }
            return apis;
        }
    };



})();

module.exports = Apis;
