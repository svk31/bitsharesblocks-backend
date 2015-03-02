[![GPL License][license-image]][license-url]
#Bitsharesblocks backend

Repo for the source code of the backend behind https://www.bitsharesblocks.com

##Setup
Clone into your directory of choice, then do "npm install" in each of the subdirectories.

There are four scripts that run independently:

- Blocks related collections
- Delegates related collections
- Assets related collections
- Api server

The scripts communicate via redis, so you need to do "apt-get install redis-server"

Mongodb must be installed and running

```
npm install -g forever
npm install -g nodemon
```

Two collections must be initialized manually in a mongo shell for performance reasons:

```
db.createCollection( "ranksHistory", { capped: true, size: 150000000 } )
db.createCollection( "votesSum", { capped: true, size: 150000000 } );
```

##Use
Launch each collection script independently with "npm start"

At first launch, start with the blocks script as a lot of the other functions depend on the blocks database. On first launch you might see errors due to missing data, but it should sort itself out once all the different functions have run.

Under Ubuntu I recommend Robomongo to view the mongo collections.

[license-image]: http://img.shields.io/badge/license-GPL3-blue.svg?style=flat
[license-url]: LICENSE
