TSBscrape v2.0
==============
Yet again I've completely hacked Russ's great work to to TSB businness accounts for Nottinghack



Barclayscrape v3.0
==================
Code to programmatically manipulate Barclays online banking using
[Puppeteer](https://github.com/GoogleChrome/puppeteer).

Installation
------------

Barclayscrape requires node.js version 10 or above which can be
installed through your OS's package manager or Homebrew. Once Node
is installed, barclayscrape can be installed on your system using:

    $ sudo npm install -g barclayscrape

The `barclayscrape` executable will be installed in your path.

Alternatively, if you don't want to run npm as root, you can install
it into `node_modules` in your home directory with:

    $ npm install barclayscrape

And you can then execute barclayscrape with:

    $ npx barclayscrape

Usage
-----
```
Options:

  -V, --version       output the version number
  --otp [pin]         Pinsentry PIN code
  --motp [pin]        Mobile Pinsentry PIN code
  --no-headless       Show browser window when interacting
  -h, --help          output usage information

Commands:

  list                List all available accounts
  get_ofx <out_path>  Fetch .ofx files for all accounts into out_path
  config              Set up login details
```

To start, `barclayscrape config` will ask you for your basic login
details. You can test that the login works by running:

    $ barclayscrape --otp <pin> list

Where `<pin>` is the eight-digit code generated by your PINSentry device.
If you're using the mobile PINSentry facility then use `--motp <pin>`
instead of `--otp <pin>`.

To download bank statements in OFX format, you can run:

    $ barclayscrape --otp <pin> get_ofx ./output_dir/

This will download one file per account and place them in `./output_dir/`.

Automating PINSentry Generation
-------------------------------

Typing in your OTP every time is a pain, but there are ways of
automating the process entirely using a USB smartcard reader.

**SECURITY NOTE:** This somewhat defeats the purpose of two-factor
authentication, so please do not implement this unless you are confident
in your ability to adequately secure the machine running it. It is your
money at risk.

The [python-emv](https://github.com/russss/python-emv) package contains
a tool to generate a one-time password on the command line. It can be
hooked up to barclayscrape like so:

    $ barclayscrape --otp `emvtool -p <PIN> cap` get_ofx ./output/

Please be aware that if you're putting this command into cron, any error
emails will include your PIN in the subject line. It's worth using a small
shell script to prevent this.
