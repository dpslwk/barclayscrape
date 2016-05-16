#!/usr/bin/env casperjs
var casper = require('casper').create({
    verbose: true,
    logLevel: "info",
    pageSettings: {
        webSecurityEnabled: false
    }
});
var fs = require('fs');
var config = require("./config");

casper.start(config.hmsURL + '/members/login', function login() {
    // this.capture("hms-login.png");
    // do log in stuff
    this.fill('form#UserLoginForm', {
        'data[User][usernameOrEmail]': config.hmsUser,
        'data[User][password]':  config.hmsPass
    }, true);
});

casper.then(function () {
    casper.waitForSelector('a#logout', uploadCSV(), function loginTimeout(response) {
        this.capture("hms-login-error.png");
        this.echo("UserName: " + config.hmsUser);
        this.die("Login timeout. Check credentials. Screenshot saved to hms-login-error.png.", 2);
    });
});

function uploadCSV() {
    casper.thenOpen(config.hmsURL + '/bankTransactions/uploadCsv', function() {
        // work out filename to upload
        var list = fs.list(config.exportFolder);
        list.sort();
        // casper.capture("hms-csv.png");
        var filename = config.exportFolder + list[list.length - 1];
        // do csv upload stuff
        this.fill('form#uploadCsvForm', {
        'data[filename]': filename
        }, true);
        this.then(function () {
            this.waitForSelector('div#flashMessage', runAudit(), function uploadTimeout(response) {
                this.capture("hms-csv-error.png");
                this.die("Failed to uplaod csv", 2);
            });
        });
    });
}

function runAudit() {
    casper.thenOpen(config.hmsURL + '/auditMembers/audit', function() {
        // wait for audit to finish
        this.then(function () {
            this.waitForSelector('div#flashMessage', function end() {
                this.exit();
            }, function auditFailed(response) {
                this.capture("hms-audit-error.png");
                this.die("Failed to run audit");
            });
        });
        
    });
}
casper.run();