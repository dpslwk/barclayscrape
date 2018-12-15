#!/usr/bin/env node
const util = require('util');
const path = require('path');
const fs = require('fs');
const fs_writeFile = util.promisify(fs.writeFile);

const program = require('commander');
const Configstore = require('configstore');
const prompt = require('syncprompt');

const pkg = require('./package.json');
const session = require('./hmssession.js');

const conf = new Configstore(pkg.name);

program
  .version(pkg.version)
  .description('Programmatic upload CSV to hms.')
  .option('--no-headless', 'Show browser window when interacting');

program
  .command('audit')
  .description('Trigger a members audit')
  .action(async options => {
    var sess;
    try {
      sess = await auth();
    } catch (err) {
      console.error(err);
      return;
    }

    try {
      await sess.audit();      
    } catch (err) {
      console.error(err);
    } finally {
      await sess.close();
    }
  });

program
  .command('upload_csv <in_path>')
  .description('Upload latest .csv file from in_path')
  .action(async (in_path, options) => {
    var sess;
    try {
      sess = await auth();
    } catch (err) {
      console.error(err);
      return;
    }

    try {
      let list = fs.readdirSync(in_path, function fsReadDir(err, items) {
        return items;
      });

      list.sort();
      
      var filename = path.join(path.resolve(in_path), list[list.length - 1]);
    
      console.log('Uploading: '+filename)
      await sess.uploadCsv(filename);
      
      await sess.audit();

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
    var username = prompt('Enter your hms username: ');
    conf.set('hmsUsername', username);
    var password = prompt('Enter your hms password: ');
    conf.set('hmsPassword', password);
    var url = prompt('Enter the HMS URL (inc http://): ');
    conf.set('hmsurl', url);
    console.log('\nHMSupload is now configured.');
  });

program.parse(process.argv);

async function auth() {
  if (!(conf.has('hmsUsername') && conf.has('hmsPassword') && conf.has("hmsurl"))) {
    console.error(
      'nHMSupload has not been configured. Please run `hmsupload config`',
    );
    program.help();
  }

  // The --no-sandbox argument is required here for this to run on certain kernels
  // and containerised setups. My understanding is that disabling sandboxing shouldn't
  // cause a security issue as we're only using one tab anyway.
  const sess = await session.launch({
    headless: program.headless,
    args: ['--no-sandbox'],
  },
  hmsUrl = conf.get("hmsurl")
  );

  try {
    await sess.login({
      username: conf.get("hmsUsername"),
      password: conf.get("hmsPassword"),
    });
  } catch (err) {
    try {
      await sess.close();
    } catch (e) {}
    throw err;
  }
  return sess;
}
