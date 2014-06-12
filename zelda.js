#!/usr/bin/env node

var cp = require('child_process')
var findRoot = require('find-root')
var fs = require('fs')
var uniq = require('lodash.uniq')
var path = require('path')
var rimraf = require('rimraf')
var series = require('run-series')

var codeFolder = process.argv[2]

function usage () {
  console.error('Usage: zelda <code-folder>\n<code-folder> = the folder where all your packages live!')
}

if (!codeFolder) {
  return usage()
}

var entries
var packageRoot = findRoot(process.cwd())

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
    done(new Error('Could not find a package.json -- must run command from inside a node project'))
    return
  }

  toInstall.push(pkg.name)

  var deps = []

  ;['dependencies', 'devDependencies', 'optionalDependencies'].forEach(function (depType) {
    if (typeof pkg[depType] === 'object') {
      deps.push.apply(deps, Object.keys(pkg[depType]))
    }
  })

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
  console.log('NPM INSTALL: ' + pkgName, cwd)

  var child = cp.spawn('npm', ['install'], { cwd: cwd, stdio: 'inherit' })

  child.on('exit', function () {
    cb(null)
  })
  child.on('error', cb)
}
