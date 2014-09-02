var port = 3000;
//var port = 3100;
var env = require('../env.js');
var dbUri = env.ProdDbUri;
var emPass = env.emailPass;
//var dbUri = require('../env.js').DevDbUri;


// External modules
var express = require('express');
var nm      = require('nodemailer');
var logfmt  = require('logfmt');
var mongo   = require('mongodb');
var ejs     = require('ejs');
var pg      = require("pg");

// Native Node modules
var path = require('path');

// App modules
var contactForm = require('./app_modules/contactform');

var app = express();

// Uses logfmt for the console log
app.use(logfmt.requestLogger());

// Sets up /public as a static directory serving files at /assets
app.use('/assets', express.static(path.join(__dirname + '/public')));

// Use express's JSON for object serialization / JSON parsing
app.use(express.json());

// Sets up /views as a views directory
app.set('views', path.join(__dirname, '/views'));

// Sets up EJS as the template engine for html files
app.engine('html', ejs.renderFile);

// Sets up the Postgres client via contactForm
var client = initPgClient(dbUri);

//Initializes the contacts table
contactForm.initTable(client);

app.get('/', function(req, res) {
  res.render('index.html');
});

app.post('/contact', function(req, res) {
  validateContactAndRespond(req, res);
});

app.listen(port, function() {
  console.log('Listening on ' + port);
});

var smtpTrans = nm.createTransport('SMTP', {
  service: "Gmail",
  auth: {
    user: "plutoniumiomail@gmail.com",
    pass: emPass
  }
});

function validateContactAndRespond(req, res) {
  contactForm.validate(req.body, function(errors) {
    // if errors is empty, then there are no errors, complete request
    if (Object.keys(errors).length === 0) {
      var emailOptions = {
        from: "plutoniumiomail@gmail.com",
        to: "neutronstar@gmail.com",
        subject: "New Lead: " + req.body.name,
        text: "Name: " + req.body.name + "\n" +
              "Email: " + req.body.email + "\n" +
              "Message: " + req.body.message
      };
      smtpTrans.sendMail(emailOptions, function(error, response) {
        if (error) {
          console.log(error);
        } else {
          console.log("Email sent");
        }
      });
      contactForm.insert(client, req.body, function(error) {
        if (error) {
          res.json(500, {"error":"Internal Server Error (insertion)"});
          return console.error("Row Insertion Error", error);
        } else {
          res.json(200, {ok: true});
        }
      });
    } else { 
      // respond with errors
      res.json(400, {error: errors});
    }
  });
}

function initPgClient(dbUri) {
  var newClient = new pg.Client(dbUri);
  newClient.connect(function(error) {
    if (error) {
      return console.error("connection error", error);
    }
  });

  return newClient;
};
