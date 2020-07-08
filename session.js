const puppeteer = require('puppeteer');
const u = require('./utils.js');
const Account = require('./account.js');
const mqtt = require('mqtt');
const WaitQueue = require('wait-queue');
const wq = new WaitQueue();

class Session {
  async init(options) {
    this.browser = await puppeteer.launch(options);
    this.page = await this.browser.newPage();
    this.logged_in = false;
    //this.page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    await this.page.setViewport({width: 1000, height: 1500});
    await this.page.goto('https://businessinternetbanking.tsb.co.uk/business/logon/login/#/login');
  }

  async close() {
    this.browser.close();
  }

  async loginStage1(credentials) {
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Stage 1 of login - enter username.
    await u.wait(this.page, '#userIdInput > input');
    await sleep(500);
    await u.fillFields(this.page, {
      '#userIdInput > input': credentials['username'],
    });
    await u.click(this.page, 'button[type="submit"]');
    console.log("Stage username login complete");
  }

  async loginSMSOTP(credentials, mqtt) {
    // need to wait for something thats on both the OTP select page and the logged-in page #experienceathead ?
    await u.wait(this.page, '#experienceathead');

    // now are do we have the otp panel?
    await u.wait(this.page, 'button[ng-click="$parent.selectPhone(phone)"]');

    // fire up mqtt? an subscribe
    await this.mqttSetup(mqtt);

    // select radio based on value="mobile" value="work" ? from credentials.phoneType
    let selector = '';

    if (credentials.phoneType == 'home') {
      selector += '#authenticationPanelPhonesRadio1';
    } else if (credentials.phoneType == 'mobile') {
      selector += '#authenticationPanelPhonesRadio2';
    } else if (credentials.phoneType == 'work') {
      selector += '#authenticationPanelPhonesRadio3';
    }

    await u.wait(this.page, selector);
    const sel = await this.page.$(selector);

    if (sel) {
      await this.page.$eval(selector, el => { el.click() });
    }

    // sumbit
    // #signaturePanel > div > div.col-xs-12.ng-scope > button
    // await u.click(this.page, 'button[ng-click="$parent.selectPhone(phone)"]');
    await this.page.$eval('button[ng-click="$parent.selectPhone(phone)"]', el => { el.click() });
    // await u.click(this.page, '#signaturePanel > div > div.col-xs-12.ng-scope > button');

    // await sms from mqtt
    console.log('Waiting for OTP SMS');
    const otp = await wq.shift();

    // fill in the OPT
    await u.fillFields(this.page, {
      'input#OTPInput': otp,
    });

    // and submit
    await this.page.$eval('button[ng-click="checkValidation()"]', el => { el.click() });

    // need to give the damn modal time to show
    await this.page.waitFor(3000);
    await u.wait(this.page, 'button[ng-click="dontTrust()"]');
    await u.click(this.page, 'button[ng-click="dontTrust()"]');
    console.log("Stage OTP login complete");
  }

  async ensureLoggedIn() {
    // Check that we're looking at the logged in homepage and throw an
    // error if we aren't.
    await u.wait(this.page, 'button#lnkCustomerLogoff');
    this.logged_in = true;
  }

  async loginMemInfo(credentials, mqtt) {
    // Log in using memorable info
    await this.loginStage1(credentials);
    await u.wait(this.page, 'span[translate-values="{charZPos : chars.charZPos}"]');

    await u.fillFields(this.page, {
      '#passwordInput > input': credentials['password'],
    });

    const xText = await this.page.$eval('span[translate-values="{charXPos : chars.charXPos}"]', el => el.textContent);
    const yText = await this.page.$eval('span[translate-values="{charYPos : chars.charYPos}"]', el => el.textContent);
    const zText = await this.page.$eval('span[translate-values="{charZPos : chars.charZPos}"]', el => el.textContent);
    const xInt = parseInt(xText.split(" ")[1][0])-1
    const yInt = parseInt(yText.split(" ")[1][0])-1
    const zInt = parseInt(zText.split(" ")[1][0])-1

    await u.selectOptionByValue(this.page, '#charXPos', credentials.memInfo.charAt(xInt));
    await u.selectOptionByValue(this.page, '#charYPos', credentials.memInfo.charAt(yInt));
    await u.selectOptionByValue(this.page, '#charZPos', credentials.memInfo.charAt(zInt));

    await u.click(this.page, 'button[ng-click="submit(memorableInformationForm)"]');

    console.log("Stage memInfo login complete");

    await this.loginSMSOTP(credentials, mqtt);

    await this.ensureLoggedIn();
    console.log("Stage Login complete");
  }

  async accounts() {
    await u.wait(this.page, 'span:not(.text-lg)[ng-bind]')
    const accs = await this.page.$$('span:not(.text-lg)[ng-bind]');
    let res = [];
    for (let a of accs) {
      const number = await this.page.evaluate(el => el.innerText, a);
      res.push(
        new Account(
          this,
          number.split(', ')[0],
          number.split(', ')[1]
        ),
      );
    }
    return res;
  }

  async home() {
    await u.click(this.page, 'a[ui-sref="holdingListBiz.holdingListBiz"]');
    await u.wait(this.page, 'proteo-ui-account-summary');
  }

  async mqttSetup(mqttDetails) {
    let client  = mqtt.connect('mqtt://' + mqttDetails.host + ':' + mqttDetails.port);

    client.on('connect', function () {
      client.subscribe(mqttDetails.topic, function (err) {
        if (err) {
          // bugger
        }
      });
    });

    client.on('message', function (topic, payload) {
      // no need to match the topic since we only subscribe to one

      // payload is Buffer
      // console.log(payload.toString());
      const sms = JSON.parse(payload.toString()) // payload is a buffer

      // parse out the OTP
      const regex = /\d{6}/gm;
      const found = sms.text.match(regex);

      if (found != null) {
        // and pass this over to loginSMSOTP??
        found.forEach(otp => wq.push(otp));

        client.end();
      }
    });
  }
}

exports.launch = async (options) => {
  const sess = new Session();
  await sess.init(options);
  return sess;
};
