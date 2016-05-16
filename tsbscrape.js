var config = require("./config");

function login(casper, loginOpts) {
    loginOpts = loginOpts || {};
    if (casper.cli.has("otp")) {
        loginOpts.otp = String(casper.cli.get('otp'));
    }

    casper.on('error', function(msg, backtrace) {
        this.capture('error.png');
        this.die(msg, 1);
    });
    casper.userAgent('Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.1; WOW64; Trident/6.0)');

    casper.on('remote.message', function(msg) {
        this.log('console message: ' + msg, 'debug');
    });
    casper.on("page.error", function(msg, backtrace) {
        this.log('JS error: ' + msg, 'debug');
        this.log(JSON.stringify(backtrace), 'debug');
    });
    casper.thenOpen('https://online-business.tsb.co.uk/business/logon/login.jsp', function loginStageOne() {
        this.log("Login stage 1");
        var last5;
        if (config.cardNumber && loginOpts.otp) {
            last5 = config.cardNumber.slice(11, 16);
            this.log('Last 5 digits: ' + last5, 'debug');
        } else if (!config.memInfo) {
            this.die("Please provide cardNum and otp or memInfo", 3);
        }
        if (this.exists("form#frmLogin")) {
            this.fill("form#frmLogin", {
                'frmLogin:strCustomerLogin_userID': config.userID,
                'frmLogin:strCustomerLogin_pwd': config.pwd
            }, true);
//            this.click('input#fsubmitAction');
            this.waitForSelector('form#secondaryauthcommercial', function loginStageTwo() {
                this.log("Login stage 2");
                if (loginOpts.otp) {
                    this.fill('form#secondaryauthcommercial', {
                        'secondaryauthcommercial:txtCardNumber': config.cardNumber,
                        'secondaryauthcommercial:txtPassCode': loginOpts.otp
                    });
                    this.click('input#secondaryauthcommercial\\:btnContinue3');
                } else {
                    // this.log('Request 1: ' + this.fetchText('label[for$="memInfo1"]').split(" ")[2], 'debug');
                    // this.log('Request 2: ' + this.fetchText('label[for$="memInfo2"]').split(" ")[2], 'debug');
                    // this.log('Request 3: ' + this.fetchText('label[for$="memInfo3"]').split(" ")[2], 'debug');
                    this.fill('form#secondaryauthcommercial', {
                        'secondaryauthcommercial:strEnterMemorableInformation_memInfo1': '&nbsp;'+config.memInfo.charAt(parseInt(this.fetchText('label[for$="memInfo1"]').split(" ")[2])-1),
                        'secondaryauthcommercial:strEnterMemorableInformation_memInfo2': '&nbsp;'+config.memInfo.charAt(parseInt(this.fetchText('label[for$="memInfo2"]').split(" ")[2])-1),
                        'secondaryauthcommercial:strEnterMemorableInformation_memInfo3': '&nbsp;'+config.memInfo.charAt(parseInt(this.fetchText('label[for$="memInfo3"]').split(" ")[2])-1)
                    });
                    this.click('input#secondaryauthcommercial\\:btnContinue123');
                }
                                 

            }, function loginStageTwoTimeout() {
                this.capture("login-error.png");
                this.debugHTML();
                this.die("Login stage 2 timeout. Screenshot saved to login-error.png.", 2);
            }, 10000);
        }
    });

    casper.then(function completeLogin() {
        this.log("Waiting to be logged in", "debug");
        this.waitForSelector('a#lnkCustomerLogoffM01Header', function waitForLogin() { //lnkCustomerLogoff //lnkCustomerLogoffM01Header
            this.echo("Successfully logged in", "INFO");
            if (loginOpts.onAccounts) {
                fetchAccounts(this, loginOpts.onAccounts);
            }
        }, function loginTimeout(response) {
            this.capture("login-error.png");
            this.echo("UserID: " + config.userID);
            // this.echo("Password: " + config.pwd);
            this.echo("Card Number: " + config.cardNumber);
            // this.echo("Memorable Info: " + config.memInfo);
            this.die("Login timeout. Check credentials. Screenshot saved to login-error.png.", 2);
        }, 10002);
    });
}

// Obtain a list of all accounts
function fetchAccounts(casper, then) {
    if (config.accounts) {
        then(config.accounts);
    } else {
        var accounts = { 
            "13007568": { 
                accountNumber: "13007568",
                sortCode: "77-22-24"
            }
        };
        then(accounts);
    }
}

module.exports = {login: login};