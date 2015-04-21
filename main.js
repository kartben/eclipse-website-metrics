//"use strict";

var Promise = require("bluebird");
var moment = require("moment");
var csv = require('ya-csv');
var Spreadsheet = require('edit-google-spreadsheet');

var google = require('googleapis');
var analytics = google.analytics('v3');

var readline = require('readline');



var profiles = {
  'iot.eclipse.org': 'ga:63928974',
  'mihini': 'ga:64239904',
  'ponte': 'ga:80018159',
  'eclipsescada': 'ga:82155641',
  'smarthome': 'ga:92615398',
  'mosquitto': 'ga:23958822',
  'paho': 'ga:71389553',
  'om2m': 'ga:86366758',
  'kura': 'ga:92866690',
  'californium': 'ga:93166606',
  'vorto': 'ga:100864100'
}

var dimensions = [
  'ga:year',
  'ga:month',
  //  'ga:week'
];

var metrics = [
  'ga:sessions'
];

var writer = csv.createCsvFileWriter('/Users/kartben/Desktop/web-metrics.csv', {
  separator: ',', // must remove in writeStream.write()
  quote: '',
  escape: ''
});

writer.writeRecord([
  'project',
  'date',
  'sessions'
]);

var spreadsheetRows = [];

function processGAResultsCallback(projectName, spreadsheet) {
  return (function(err, result) {
    if (err) {
      console.log(err);
      return Promise.reject("Get error: " + err);
    }

    result.rows.forEach(function(entry) {
      var m = moment({
        year: entry[0],
        month: entry[1] - 1,
        day: 1
      });
      m.add(1, 'month').subtract(1, 'day');

      var row = {}
      row.project = projectName;
      row.date = m.format("YYYY-MM-DD");

      var record =
        [
          projectName,
          m.format("YYYY-MM-DD")
        ];
      var i = 0;
      metrics.forEach(function(metric) {
        record.push(entry[2 + i]);
        row[metric.replace('ga:', '')] = entry[2 + i];
        i++
      });

      writer.writeRecord(record);
      spreadsheetRows.push(record);
    });

    console.log(projectName + '... DONE.');

  });
}

var CLIENT_ID = '1097649384357-ub99a5gmnil3lpv3mfr30o6im0phuid9.apps.googleusercontent.com'
var CLIENT_SECRET = '7HgurxhOVv7BggqYqPr-BTST'
var REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob'
var SCOPES = ['https://www.googleapis.com/auth/analytics', 'https://www.googleapis.com/auth/analytics.readonly', 'https://spreadsheets.google.com/feeds']

var OAuth2 = google.auth.OAuth2;
var oauth2Client = new OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URL);

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function getAccessToken(oauth2Client, callback) {
  // generate consent page url
  var url = oauth2Client.generateAuthUrl({
    access_type: 'offline', // will return a refresh token
    scope: SCOPES
  });

  console.log('Visit the url: ', url);
  rl.question('Enter the code here:', function(code) {
    // request access token
    oauth2Client.getToken(code, function(err, tokens) {
      // set tokens to the client
      // TODO: tokens should be set by OAuth2 client.
      oauth2Client.setCredentials(tokens);
      callback();
    });
  });
}


getAccessToken(oauth2Client, function() {
  console.log(oauth2Client.credentials.access_token);
  Spreadsheet.load({
    debug: false,
    spreadsheetId: '1MT8vUectDG7qnt83LBts-B7oECMsICXyB4Tn4Kxl64U',
    worksheetId: 'oc6pmuf',
    accessToken: {
      type: 'Bearer',
      token: oauth2Client.credentials.access_token
    }
  }, function sheetReady(err, spreadsheet) {

    if (err)
      console.log("Spreadsheet Error: " + err);

    for (var p in profiles) {
      var options = {
        'auth': oauth2Client,
        'ids': profiles[p],
        'start-date': '2012-05-01',
        'end-date': moment().format("YYYY-MM-DD"),
        'dimensions': dimensions.join(','),
        'metrics': metrics.join(','),
        //      'sort': 'ga:date',
        'max-results': '10000',
      };

      analytics.data.ga.get(options, processGAResultsCallback(p, spreadsheet));
    }

    setTimeout(function() {
      spreadsheet.add({
        2: spreadsheetRows
      });
      //    console.log(spreadsheet);
      spreadsheet.send(function(err) {
        if (err) {
          throw err;
        }

        console.log('Spreadsheet has been updated.');
        process.exit()

      });
    }, 12000);

  });

});