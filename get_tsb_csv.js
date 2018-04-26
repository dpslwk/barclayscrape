#!/usr/bin/env casperjs
var casper = require('casper').create({
    verbose: true,
    logLevel: "info",
    pageSettings: {
        webSecurityEnabled: false
    }
});
var config = require("./config");
var fs = require("fs");
var tsbscrape = require("./tsbscrape");
var x = require('casper').selectXPath;
casper.start();

var tracking = loadTracking();
// for this account load up from our tracking config, how far back in time we went on last run
var lastDate = new Date(tracking.date);
lastDate.setHours(-24); // adjust date to go back one more
var pageCount = 0;

// empty records array/object
var allTransactions = [];

// this is called inside a asycn waitForSelector
function praseHMTLtoCSV() {
    casper.echo("Prase HML to CSV", "INFO")

    casper.thenClick('a[ng-click="goToStatements(data)"]', function waitForFirst() {    // click into the account we want statement page (HSNOTTS only has one so just click the generic link)
        casper.waitForSelector('#statementComponentsId', scrapeLoop /*, 
            function gotoStatmentTimeout() {
                this.capture("statement-error.png");
                this.debugHTML();
                this.die("Go to statement timeout. Screenshot saved to statement-error.png.", 2);
            }, 20000 */);
    });
}

function scrapeLoop() {
    // casper.capture('./scrape' + pageCount + '.png');
    // process this pages transactions
    scrapeThisPage();

     // if lastDate reached return false
    if (new Date(allTransactions[allTransactions.length - 1].date) <= lastDate) {
        casper.echo("Gone far enough back");
        stopScrapeing("gone far enough");
        return;
    }
    // click previous page button
    // casper.echo("Loading previous transaction page", "INFO");
    casper.thenClick('a[action="previous"]', function waitForPrevious() {
        casper.echo("Moving to previous transactions", "INFO")
        // casper.wait(1000);
        casper.waitForSelectorTextChange('#statementTable table tbody tr:nth-child(1) td:nth-child(6)', scrapeLoop, 
            function gotoPreviousTimeout() {
                this.capture("previous-error.png");
                this.debugHTML();
                this.die("Go to previous timeout. Screenshot saved to previous-error.png.", 2);
            }, 20000);
    });
}

function scrapeThisPage() {
    casper.echo("Scraping this page for transactions", "INFO");
    // move into the page for the next bit
    var res;
    res = casper.evaluate(function parseStatement() {
        var txnList = []; // transaction list for this page

        // parse all records out from this page into object
        var rows = document.querySelectorAll('table[class="table table-std"] tbody tr');
        // make sure we got something
        if (rows.length) {
            // for each row in table 
            [].forEach.call(rows, function (row) {
                var txd; // blank to hold transaction data for this row
                txd = {}; // make it a dict
                txnList.push(txd); // push on page list
                // grab:-
                // date (convert form 23 Feb 15 to 23/02/15 UK)
                txd['date'] = new Date(row.childNodes[0].innerText);
                // recombine description
                txd['description'] = row.childNodes[1].innerText;
                // type
                txd['type'] = row.childNodes[2].innerText;
                // in amount
                txd['in'] = row.childNodes[3].innerText;
                // out amount
                txd['out'] = row.childNodes[4].innerText;
                // blance
                txd['balance'] = row.childNodes[5].innerText;
            });
        }
        return txnList;                
    }); 

    // Back out the page now
    // join the trasnaction form this page onto the rest
    allTransactions = allTransactions.concat(res);
    // require('utils').dump(res);
    // require('utils').dump(allTransactions);
    pageCount += 1;
    casper.echo('Current transaction count: ' + allTransactions.length);
}

function stopScrapeing() {
    casper.echo("Finished scraping " + pageCount + " pages", "INFO");

    // export what we have to disk
    filename = writeCsv(allTransactions);

    // write out date we got to in tracking config
    tracking.date = new Date(allTransactions[0].date);
    saveTracking(tracking);
    casper.exit();
}

function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}

function writeCsv(transactions) {
    var d = new Date();
    var fileDate = d.getFullYear().toString() + zeroPad(d.getMonth()+1, 2) + zeroPad(d.getDate(), 2) + '_' + zeroPad(d.getHours(), 2) + zeroPad(d.getMinutes(), 2);
    var filename = 'tsb_' + accountNumber + '_' + fileDate + '.csv';
    
    // map trancasctions to csv
    var csvLines = transactions.map(function (d) {
        var txnDate = new Date(d['date']);
        // casper.echo(txnDate);
        var dateString = zeroPad(txnDate.getDate(), 2) + '/' + zeroPad(txnDate.getMonth()+1, 2)  + '/' + txnDate.getFullYear();
        // casper.echo(dateString)
        return  dateString + ',' + d['type'] + ",'" + sortCode + ',' + accountNumber + ',' + d['description'] + ' ,' + d['out'].replace(/[£,]/g, '')+ ',' + d['in'].replace(/[£,]/g, '')+ ',' + d['balance'].replace(/[£,]/g, '');
    });

    // prepend headers 
    // Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance,
    csvLines.unshift("Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance,")

    // write out object to csv file (file in static fields as we go?)
    fs.write(config.exportFolder + filename, [].join.call(csvLines, '\n'), 'w');
    casper.echo("Exporting account: " + accountNumber + " (" + csvLines.length + " rows) to file: " + filename);
    return filename;
}

function loadTracking(){
    var contents = fs.read('./tracking.json');
    // Define to JSON type
    var tracking = JSON.parse(contents);
    return tracking;
}

function saveTracking(tracking){
    fs.write('./tracking.json', JSON.stringify(tracking), function (err) {
        if(err){
            casper.log("Failed to save tracking file" + err, "err");
        }
    });
}


tsbscrape.login(casper, {
    onAccounts: function (accounts) {
        // Iterate through each account and export it
        for (var accountName in accounts) {
            accountNumber = accounts[accountName].accountNumber;
            sortCode = accounts[accountName].sortCode;
            // downloadCSV(accountName, accountNumber);    // download via there CSV form
            praseHMTLtoCSV(); // make a csv up from html pages
        }
    }
});

casper.run();
