const puppeteer = require('puppeteer');
const u = require('./utils.js');
const Account = require('./account.js');

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
    // Stage 1 of login - enter surname and membership number.
    await u.wait(this.page, '#userIdInput > input');
    await u.fillFields(this.page, {
      '#userIdInput > input': credentials['username'],
      '#passwordInput > input': credentials['password'],
    });
    await u.click(this.page, 'button[ng-click="submit(loginForm)"]');
    console.log("Stage 1 login complete");
  }

  async ensureLoggedIn() {
    // Check that we're looking at the logged in homepage and throw an
    // error if we aren't.
    await u.wait(this.page, 'button#lnkCustomerLogoff');
    this.logged_in = true;
  }

  async loginMemInfo(credentials) {
    // Log in using memorable info
    await this.loginStage1(credentials);
    await u.wait(this.page, 'span[translate-values="{charZPos : chars.charZPos}"]');
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
    await this.ensureLoggedIn();
    console.log("Stage 2 login complete");
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
}

exports.launch = async (options) => {
  const sess = new Session();
  await sess.init(options);
  return sess;
};
