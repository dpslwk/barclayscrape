var config = require("./config");

casper.selectOptionByValue = function(selector, valueToMatch){
    this.evaluate(function(selector, valueToMatch){
        var select = document.querySelector(selector),
            found = false;
        Array.prototype.forEach.call(select.children, function(opt, i){
            if (!found && opt.value.indexOf(valueToMatch) !== -1) {
                select.selectedIndex = i;
                found = true;
            }
        });
        // dispatch change event in case there is some kind of validation
        var evt = document.createEvent("UIEvents"); // or "HTMLEvents"
        evt.initUIEvent("change", true, true);
        select.dispatchEvent(evt);
    }, selector, valueToMatch);
};

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
    casper.thenOpen('https://businessinternetbanking.tsb.co.uk/business/logon/login/#/login', function loginStageOne() {
        this.log("Login stage 1");
        var last5;
        if (config.cardNumber && loginOpts.otp) {
            last5 = config.cardNumber.slice(11, 16);
            this.log('Last 5 digits: ' + last5, 'debug');
        } else if (!config.memInfo) {
            this.die("Please provide cardNum and otp or memInfo", 3);
        }
        if (this.exists("form[name=loginForm]")) {
            this.fill("form[name=loginForm]", {
                'userId': config.userID,
                'password': config.pwd
            });
           this.click('button[ng-click="submit(loginForm)"]');
            this.waitForSelector('form[name="memorableInformationForm"]', function loginStageTwo() {
                this.log("Login stage 2");
                if (loginOpts.otp) {
                    this.fill('form[name="memorableInformationForm"]', {
                        'txtCardNumber': config.cardNumber,
                        'txtPassCode': loginOpts.otp
                    });
                    this.click('button[ng-click="submit(memorableInformationForm)"]');
                } else {
                    // this.log('Request 1: ' + this.fetchText('span[translate-values="{charXPos : chars.charXPos}"]').split(" ")[1][0], 'debug');
                    // this.log('Request 2: ' + this.fetchText('span[translate-values="{charYPos : chars.charYPos}"]').split(" ")[1][0], 'debug');
                    // this.log('Request 3: ' + this.fetchText('span[translate-values="{charZPos : chars.charZPos}"]').split(" ")[1][0], 'debug');
                    this.selectOptionByValue('#charXPos', config.memInfo.charAt(parseInt(this.fetchText('span[translate-values="{charXPos : chars.charXPos}"]').split(" ")[1][0])-1));
                    this.selectOptionByValue('#charYPos', config.memInfo.charAt(parseInt(this.fetchText('span[translate-values="{charYPos : chars.charYPos}"]').split(" ")[1][0])-1));
                    this.selectOptionByValue('#charZPos', config.memInfo.charAt(parseInt(this.fetchText('span[translate-values="{charZPos : chars.charZPos}"]').split(" ")[1][0])-1));
                    this.click('button[ng-click="submit(memorableInformationForm)"]');
                }
                                 

            }, function loginStageTwoTimeout() {
                this.capture("login-error.png");
                this.debugHTML();
                this.die("Login stage 2 timeout. Screenshot saved to login-error.png.", 2);
            }, 20000);
        }
    });

    casper.then(function completeLogin() {
        this.log("Waiting to be logged in", "debug");
        this.waitForSelector('button#lnkCustomerLogoff', function waitForLogin() { //lnkCustomerLogoff //lnkCustomerLogoffM01Header
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
        }, 20002);
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