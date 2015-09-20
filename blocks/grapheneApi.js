module.exports = function(onCloseCallback) {

'use strict'

var WebSocket = require('ws');
var Q = require('q');
var Apis;

function WebsocketAPI(url) {

    this.url = url;
    this.current_callback_id = 1;
    this.sub_callback_id = 1;
    var ws;

    var retryDelay = 2500;
    var that;

    this.init = function(promise) {
        console.log("init of ws");
        var initPromise = promise || Q.defer();
        try {
            ws = new WebSocket(url);
            ws.on("error", function(error) {
                console.log("on error:", error);
                // Retry on error
                return setTimeout(() => {return that.init(initPromise); }, retryDelay) ;
            });
            ws.on("open", function(data, err) {
                if (err) {
                    console.log("on open error:", err);
                    initPromise.reject(err);
                } else {
                    initPromise.resolve(data);
                }

                ws.on("message", function(message) {
                    messageHandler(JSON.parse(message));
                });
            })

            ws.on("close", function() {
                console.log("ws closed");
                // Retry on close
                return onCloseCallback();
            });
        }
        catch (err) {
            console.log("init failed:", err);
            return onCloseCallback();
        }

        return initPromise.promise;
    }

    that = this;

    var callbacks = {};
    var subs = {};

    var messageHandler = function(response) {
        if (response) {
            if (response.method === "notice") {
                // console.log("ws response:", JSON.stringify(response));
                return subs[response.params[0]].callback(response.params[1]);
            }
            callbacks[response.id].resolve(response.result);
        } else {
            console.log("some weird response:", response);
        }
    }

    this.call = function(params) {
        var deferred = Q.defer();
        if (params[1] === "set_subscribe_callback" || params[1] === "subscribe_to_market") {
            subs[this.current_callback_id] = {
                callback: params[2][0],
                params: params[2][1]
            }
            params[2][0] = this.current_callback_id;
        }

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
        console.log("trying to open WebsocketAPI connection");
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

return Apis;

}
