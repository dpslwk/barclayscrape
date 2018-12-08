#!/usr/bin/env node
const util = require('util');
const path = require('path');
const fs = require('fs');
const fs_writeFile = util.promisify(fs.writeFile);

const program = require('commander');
const Configstore = require('configstore');
const prompt = require('syncprompt');

const pkg = require('./package.json');
const session = require('./session.js');

const conf = new Configstore(pkg.name);

program
  .version(pkg.version)
  .description('Programmatic access to TSB online banking.')
  .option('--no-headless', 'Show browser window when interacting');

program
  .command('list')
  .description('List all available accounts')
  .action(async options => {
    var sess;
    try {
      sess = await auth();
    } catch (err) {
      console.error(err);
      return;
    }

    try {
      const accounts = await sess.accounts();
      console.log(accounts.map(acc => acc.number));
    } catch (err) {
      console.error(err);
    } finally {
      await sess.close();
    }
  });

program
  .command('get_csv <out_path>')
  .description('Fetch .csv files for all accounts into out_path')
  .action(async (out_path, options) => {
    var sess;
    try {
      sess = await auth();
    } catch (err) {
      console.error(err);
      return;
    }

    try {
      const accounts = await sess.accounts();
      for (let account of accounts) {
        const transactions = await account.statementCSV(conf);
        if (transactions) {
          // console.log(transactions[0]);
          var d = new Date();
          var fileDate = d.getFullYear().toString() + zeroPad(d.getMonth()+1, 2) + zeroPad(d.getDate(), 2) + '_' + zeroPad(d.getHours(), 2) + zeroPad(d.getMinutes(), 2);
          var filename = 'tsb_' + account.number + '_' + fileDate + '.csv';
          
          // map trancasctions to csv
          var csvLines = transactions.map(function (d) {
              var txnDate = new Date(d['date']);
              // casper.echo(txnDate);
              var dateString = zeroPad(txnDate.getDate(), 2) + '/' + zeroPad(txnDate.getMonth()+1, 2)  + '/' + txnDate.getFullYear();
              // casper.echo(dateString)
              return  dateString + ',' + d['type'] + ",'" + account.sortCode + ',' + account.number + ',' + d['description'] + ' ,' + d['out'].replace(/[£,]/g, '')+ ',' + d['in'].replace(/[£,]/g, '')+ ',' + d['balance'].replace(/[£,]/g, '');
          });

          // prepend headers 
          // Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance,
          csvLines.unshift("Transaction Date,Transaction Type,Sort Code,Account Number,Transaction Description,Debit Amount,Credit Amount,Balance,")

          // write out object to csv file
          await fs_writeFile(path.join(out_path, filename), [].join.call(csvLines, '\n'));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      await sess.close();
    }
  });

program
  .command('config')
  .description('Set up login details')
  .action(options => {
    var username = prompt('Enter your username: ');
    conf.set('username', username);
    var password = prompt('Enter your password: ');
    conf.set('password', password);
    var memInfo = prompt('Enter your memorible info: ');
    conf.set('memInfo', memInfo);
    conf.set('tracking', new Date())
    console.log('\nTSBscrape is now configured.');
  });

program.parse(process.argv);

async function auth() {
  if (!(conf.has('username') && conf.has('password') && conf.has('memInfo'))) {
    console.error(
      'TSBscrape has not been configured. Please run `tsbscrape config`',
    );
    program.help();
  }

  // The --no-sandbox argument is required here for this to run on certain kernels
  // and containerised setups. My understanding is that disabling sandboxing shouldn't
  // cause a security issue as we're only using one tab anyway.
  const sess = await session.launch({
    headless: program.headless,
    args: ['--no-sandbox'],
  });

  try {
    await sess.loginMemInfo({
      username: conf.get("username"),
      password: conf.get("password"),
      memInfo: conf.get("memInfo")
    });
  } catch (err) {
    try {
      await sess.close();
    } catch (e) {}
    throw err;
  }
  return sess;
}

function zeroPad(num, places) {
  var zero = places - num.toString().length + 1;
  return Array(+(zero > 0 && zero)).join("0") + num;
}