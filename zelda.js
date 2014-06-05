#!/usr/bin/env node

var cp = require('child_process')
var findRoot = require('find-root')
var fs = require('fs')
var series = require('run-series')
var path = require('path')
var remove = require('rm-r/sync')

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

zelda(packageRoot)

function zelda (root, done) {
  var pkg
  try {
    pkg = require(path.join(root, 'package.json'))
  } catch (e) {
    console.log('Could not find a package.json -- must run command from inside a node project')
  }

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
  series(deps.map(function (dep) {
    return function (cb) {
      if (myPackages[dep]) {
        var src = path.resolve(codeFolder, myPackages[dep])
        var dst = path.join(root, 'node_modules', dep)

        try {
          remove(dst)
        } catch (e) {
          // ignore -- nothing to remove
        }

        try {
          fs.symlinkSync(src, dst)
          console.log('creating... ' + dep + ' = ' + dst)
        } catch (e) {
          console.log('using existing symlink... ' + dst)
          // ignore -- symlink already exists
        }

        linkedDeps.push(dep)
        npmInstall(src, cb)
      } else {
        cb(null)
      }
    }
  }), function (err) {
    if (err) throw err
    npmInstall(root, function (err) {
      if (err) throw err
      if (linkedDeps.length === 0) {
        done()
      } else {
        var tasks = linkedDeps.map(function (linkedDep) {
          return function (cb) {
            zelda(path.join(root, 'node_modules', linkedDep), cb)
          }
        })
        series(tasks, done)
      }
    })
  })

  function npmInstall (cwd, cb) {
    var pkgName = path.basename(cwd)
    console.log('npm installing ' + pkgName + ' deps')

    var child = cp.spawn('npm', ['install'], { cwd: cwd })

    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)

    child.on('close', function () {
      cb(null)
    })
    child.on('error', cb)
  }
}
