var SSH2Stream = require('../lib/ssh');
var MESSAGE = require('../lib/constants').MESSAGE;

var basename = require('path').basename,
    inspect = require('util').inspect,
    assert = require('assert'),
    path = require('path'),
    fs = require('fs');

var t = -1,
    group = path.basename(__filename, '.js') + '/',
    SERVER_KEY = fs.readFileSync(__dirname + '/fixtures/ssh_host_rsa_key');

function no_kexinit(impl) {
  function run() {
    var what = 'no_kexinit: ';

    var server = new SSH2Stream({
      server: true,
      privateKey: SERVER_KEY
    }), client = new SSH2Stream();

    function tryDone() {
      next();
    }
    var faultyImpl = (impl === 'server') ? client : server;
    // Remove 'header' listeners to inject out-of-order 'NEWKEYS' packet
    faultyImpl.removeAllListeners('header');
    faultyImpl.on('header', function (header) {
      var NEWKEYS_PACKET = new Buffer([MESSAGE.NEWKEYS]);
      faultyImpl._send(NEWKEYS_PACKET, undefined, true);
    });
    faultyImpl.on('error', function (err) {
      assert.equal('PROTOCOL_ERROR', err.message,
        makeMsg(what, 'Expected Error: PROTOCOL_ERROR Got Error: ' +
          err.message));
      tryDone();
    });
    client.pipe(server).pipe(client);
  }
  return { run: run };
}

var tests = [
  no_kexinit('server'),
  no_kexinit('client'),
];

function next() {
  if (Array.isArray(process._events.exit))
    process._events.exit = process._events.exit[1];
  if (++t === tests.length)
    return;

  var v = tests[t];
  v.run.call(v);
}

function makeMsg(what, msg) {
  return '[' + group + what + ']: ' + msg;
}

process.once('exit', function() {
  assert(t === tests.length,
         makeMsg('_exit',
                 'Only finished ' + t + '/' + tests.length + ' tests'));
});

next();
