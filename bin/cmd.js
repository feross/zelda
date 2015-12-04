#!/usr/bin/env node

var minimist = require('minimist')
var zelda = require('../')

var argv = minimist(process.argv.slice(2), {
  alias: {
    h: 'help',
    i: 'install'
  },
  boolean: [
    'help',
    'install',
    'production'
  ]
})

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
  console.log('  -h, --help     show help message')
  console.log('  -i, --install  run `npm install` on each package')
  console.log('  --production   only install produdction dependencies')
}
