#!/usr/bin/env node

var minimist = require('minimist')
var zelda = require('../')

var argv = minimist(process.argv.slice(2), {
  alias: {
    i: 'install',
    p: 'production',
    h: 'help',
    v: 'version'
  },
  boolean: [
    'install',
    'production',
    'help',
    'version'
  ],
  default: {
    install: true
  }
})

if (argv.version) {
  console.log(require('../package.json').version)
  process.exit(0)
}

if (argv.help) {
  usage()
  process.exit(0)
}

zelda(process.cwd(), argv)

function usage () {
  console.log('Usage: zelda CODE_DIR [OPTIONS]')
  console.log('')
  console.log('CODE-DIR - the folder where all your packages live')
  console.log('')
  console.log('OPTIONS:')
  console.log('  --no-install  skip `npm install` on each package')
  console.log('  --production  only `npm install` production dependencies')
  console.log('  -h, --help    show help message')
  console.log('  -v, --version    show version')
}
