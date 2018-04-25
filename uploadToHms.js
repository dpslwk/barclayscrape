#!/usr/bin/env casperjs
var casper = require('casper').create({
    verbose: true,
    logLevel: "debug",
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
    casper.waitForSelector('a#logout', uploadCSV, function loginTimeout(response) {
        this.capture("hms-login-error.png");
        this.echo("UserName: " + config.hmsUser);
        this.die("Login timeout. Check credentials. Screenshot saved to hms-login-error.png.", 2);
    });
});

function uploadCSV() {
    casper.thenOpen(config.hmsURL + '/bankTransactions/uploadCsv', function afterOpenCSV() {
        // this.capture("hms-afterOpenCSV.png"); // should show un filled csv form
        // work out filename to upload
        var list = fs.list(config.exportFolder);
        list.sort();
        // casper.capture("hms-csv.png");
        var filename = config.exportFolder + list[list.length - 1];
        this.log("Atempting to upload file" + filename, 'info');
        // do csv upload stuff
        this.fill('form#uploadCsvForm', {
        'data[filename]': filename
        }, true);
        // this.capture("hms-afterFill.png");
        this.then(function thenWaitUploadFlash() {
            // this.capture("hms-after-wiatUpload.png"); // should shows filled csv form
            this.waitForSelector('div#flashMessage', runAudit, function uploadTimeout(response) {
                this.capture("hms-csv-error.png");
                this.die("Failed to uplaod csv", 2);
            }, 20000);
        });
    });
}

function runAudit() {
    casper.capture("hms-before-open-audit.png"); // check here for susecfull csv upload box
    casper.thenOpen(config.hmsURL + '/auditMembers/audit', function afterOpenAudti() {
        // wait for audit to finish
        this.then(function thenWaitAuditFlash() {
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