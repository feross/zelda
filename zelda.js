#!/usr/bin/env node

var cp = require('child_process')
var findRoot = require('find-root')
var fs = require('fs')
var minimist = require('minimist')
var path = require('path')
var rimraf = require('rimraf')
var series = require('run-series')
var uniq = require('lodash.uniq')

var argv = minimist(process.argv.slice(2), {
  alias: {
    s: 'skip-install',
    u: 'unlink'
  },
  boolean: [ // options that are always boolean
    'skip-install',
    'unlink'
  ]
})

function usage () {
  console.log('Usage: zelda CODE_DIR [OPTIONS]')
  console.log('')
  console.log('CODE-DIR = the folder where all your packages live')
  console.log('')
  console.log('OPTIONS:')
  console.log(' -s, --skip-install  do not run `npm install` on linked packages')
  console.log(' -u, --unlink        remove all linked packages and re-run npm install')
  console.log('')
}

var entries
var packageRoot = findRoot(process.cwd())

if (argv.unlink) {
  var rootpkg = require(path.join(packageRoot, 'package.json'))

  var deps = getDeps(rootpkg)

  deps.forEach(function (dep) {
    var dst = path.join(packageRoot, 'node_modules', dep)

    if (!fs.existsSync(dst)) return

    var lstat = fs.lstatSync(dst)
    if (lstat.isSymbolicLink(dst)) {
      rimraf.sync(dst)
      console.log('NPM UNLINK: ' + dst)
    }
  })

  if (argv['skip-install']) {
    console.log('Done! (skipping `npm install`)')
    return
  }

  npmInstall(packageRoot, function(err) {
    if (err) return console.error(err.stack || err.message || err)
  })

  return
}

var codeFolder = argv._[0]

if (!codeFolder) {
  return usage()
}

codeFolder = path.resolve(packageRoot, codeFolder)

try {
  entries = fs.readdirSync(codeFolder)
} catch (e) {
  console.error('Could not read folder "' + codeFolder + '"')
  return usage()
}
var myPackages = {}
entries.forEach(function (entry) {
  try {
    var pkg = require(path.join(codeFolder, entry, 'package.json'))
    myPackages[pkg.name] = entry
  } catch (e) {
    // ignore folders that don't contain package.json -- they're not node packages
  }
})

var toInstall = []

zelda(packageRoot, function (err) {
  if (err) return console.error(err.stack || err.message || err)

  if (argv['skip-install']) {
    console.log('Done! (skipping `npm install`)')
    return
  }

  // npm install everything
  toInstall = uniq(toInstall)
  series(toInstall.map(function (dep) {
    return function (cb) {
      npmInstall(path.join(codeFolder, myPackages[dep]), cb)
    }
  }), function (err) {
    if (err) return console.error(err.stack || err.message || err)
    else console.log('Done!')
  })
})

function zelda (root, done) {
  var pkg
  try {
    pkg = require(path.join(root, 'package.json'))
  } catch (e) {
    done(new Error('Could not find a package.json in ' + root + '-- run command from inside a node project'))
    return
  }

  toInstall.push(pkg.name)

  var deps = getDeps(pkg)

  try {
    fs.mkdirSync(path.join(root, 'node_modules'))
  } catch (e) {
    // ignore -- node_modules already exists
  }

  var linkedDeps = []
  deps.forEach(function (dep) {
    if (myPackages[dep]) {
      var src = path.resolve(codeFolder, myPackages[dep])
      var dst = path.join(root, 'node_modules', dep)

      try {
        rimraf.sync(dst)
      } catch (e) {
        // ignore -- nothing to remove
      }

      try {
        fs.symlinkSync(src, dst)
        console.log('NPM LINK: ' + dst + ' => ' + src)
      } catch (e) {
        console.log('using existing symlink... ' + dst)
        // ignore -- symlink already exists
      }

      linkedDeps.push(dep)
      toInstall.push(dep)
    }
  })

  var tasks = linkedDeps.map(function (linkedDep) {
    return function (cb) {
      zelda(path.join(root, 'node_modules', linkedDep), cb)
    }
  })
  series(tasks, done)
}

function npmInstall (cwd, cb) {
  var pkgName = path.basename(cwd)
  var npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  console.log('NPM INSTALL: ' + pkgName, cwd)

  var child = cp.spawn(npmExecutable, ['install'], { cwd: cwd, stdio: 'inherit' })

  child.on('exit', function () {
    cb(null)
  })
  child.on('error', cb)
}

function getDeps (pkg) {
  var deps = []
  ;['dependencies', 'devDependencies', 'optionalDependencies'].forEach(function (depType) {
    if (typeof pkg[depType] === 'object') {
      deps.push.apply(deps, Object.keys(pkg[depType]))
    }
  })
  return deps
}
