// Example express application adding the parse-server module to expose Parse
// compatible API routes.

var express = require('express');
var ParseServer = require('parse-server').ParseServer;
var path = require('path');
var yelp = require('./yelpHelpers.js');

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'myAppId',
  masterKey: process.env.MASTER_KEY || '', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse',  // Don't forget to change to https if needed
  liveQuery: {
    classNames: ["Event"] // List of classes to support for query subscriptions
  },
  push: {
    ios: [
      {
        pfx: './certificate.p12',
        bundleId: 'com.NJC.Foodie',
        production: false
      },
      {
        pfx: './certificate-prod.p12',
        bundleId: 'com.NJC.Foodie',
        production: true
      }
    ]
  }
});
// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.status(200).send('I dream of being a website.  Please star the parse-server repo on GitHub!');
});

app.get('/yelp', function(req, res) {
  console.log("In endpoint")
  console.log(req.query);
  var term = {
    "term" : req.query.category_filter,
    "radius_filter" : req.query.radius_filter,
    "cll" : req.query.cll,
    "location" : req.query.location
  }
  console.log(term);
  yelp.search(term).then(function(data) {
    // console.log("DATA: " + data.businesses);
    res.send(data);
  }, function(error) {
    res.error(error);
  });
});

app.get('/businesses', function(req, res) {
  var id = req.query.business_id;
  console.log("\t\tQUERYING BUSINESS ID!!!: " + id);
  yelp.businesses(id).then(function(data) {
    res.send(data);
  }, function(error) {
    res.error(error);
  });
  // .then(function(data) {
  //   res.send(data);
  // }, function(error) {
  //   res.error(error);
  // });
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});

var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
    console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
