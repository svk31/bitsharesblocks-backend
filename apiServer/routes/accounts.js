'use strict';

module.exports = function(db, app, apicache) {

  // VARIABLES
  var accountsCollection = db.get('accounts');

  // ROUTES
  app.get('/v1/accounts/:id', apicache('2 minutes'), function(req, res) {
    accountsCollection.findOne({
      'name': req.params.id
    }, {}).success(function(account) {
      if (account !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify(account));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/subaccounts/:id', apicache('2 minutes'), function(req, res) {
    accountsCollection.find({
      name: new RegExp('\\.'+req.params.id+'$')     
    }, {fields: {
      name:1,
      reg_date_ISO:1,
      isDelegate:1
    }}).success(function(account) {
      if (account !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify(account));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/accountsbynr/:nr', apicache('2 minutes'), function(req, res) {
    if (req.params.nr === '-2') {
      return res.jsonp(")]}',\n" + JSON.stringify('MARKET'));
    }
    // console.log('accountsbynr/:nr: ' + req.params.nr);
    accountsCollection.findOne({
      '_id': parseInt(req.params.nr, 10)
    }, {}).success(function(account) {
      if (account !== null) {
        // console.log(account);
        return res.jsonp(")]}',\n" + JSON.stringify(account));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/accounts', apicache('2 minutes'), function(req, res) {

    accountsCollection.find({}, {
      limit: 20,
      sort: {
        _id: -1
      }
    }).success(function(accounts) {
      if (accounts !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify(accounts));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/accountscount', apicache('10 seconds'), function(req, res) {

    accountsCollection.count().success(function(account) {
      if (account !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify({
          count: account
        }));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/accountspage/:id', apicache('2 minutes'), function(req, res) {

    var topId = parseInt(req.params.id, 10);
    accountsCollection.find({
      _id: {
        $lte: topId
      }
    }, {
      limit: 20,
      sort: {
        _id: -1
      }
    }).success(function(accounts) {
      if (accounts !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify(accounts));
      } else {
        return res.status(404).send();
      }
    });
  });

  app.get('/v1/accountssearch/:query', apicache('1 minutes'), function(req, res) {
    accountsCollection.find({
      'name': {
        $regex: req.params.query
      }
    }, {
      sort: {
        _id: -1
      }
    }).success(function(accounts) {
      if (accounts !== null) {
        return res.jsonp(")]}',\n" + JSON.stringify(accounts));
      } else {
        return res.status(404).send();
      }
    });
  });
};