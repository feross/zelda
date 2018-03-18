module.exports = zelda

var cp = require('child_process')
var findRoot = require('find-root')
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')

var NPM_EXEC = process.platform === 'win32'
  ? 'npm.cmd'
  : 'npm'
var YARN_EXEC = process.platform === 'win32'
  ? 'yarn.cmd'
  : 'yarn';

var PKG_MGR_EXEC = NPM_EXEC;

function zelda (rootPath, opts) {
  if (!opts) opts = {}
  
  if (opts.yarn) {
    PKG_MGR_EXEC = YARN_EXEC;
  }

  // Use folder with nearest package.json as root
  rootPath = findRoot(rootPath)

  var rootName = require(path.join(rootPath, 'package.json')).name
  var codePath = path.resolve(rootPath, '..')

  if (!rootName) throw new Error('root package must have a name ')

  // add node_modules symlink in code folder - magic!
  try {
    console.log('[zelda] cd ' + codePath + ' && ln -s . node_modules')
    if (!opts['dry-run']) fs.symlinkSync('.', path.join(codePath, 'node_modules'), 'dir')
  } catch (err) {
    // ignore err (symlink already exists)
  }

  // get packages in code folder
  var codePkgs = getCodePkgs(codePath)

  if (opts.install) npmInstall(rootPath)

  var pkgsToPurge = {}
  pkgsToPurge[rootName] = true

  traverseNodeModules(rootPath, function (pkgName, pkgPath) {
    if (codePkgs[pkgName]) {
      pkgsToPurge[pkgName] = true
      if (opts.install) npmInstall(path.join(codePath, pkgName))
    }
  })

  traverseNodeModules(rootPath, function (pkgName, pkgPath) {
    if (pkgsToPurge[pkgName]) {
      rmDir(pkgPath)
    }
  })

  Object.keys(pkgsToPurge).forEach(function (pkgToPurge) {
    if (pkgToPurge === rootName) return

    var pkgPath = path.join(codePath, pkgToPurge)
    traverseNodeModules(pkgPath, function (pkgName, pkgPath) {
      if (pkgsToPurge[pkgName]) rmDir(pkgPath)
    })
  })

  function rmDir (dirPath) {
    console.log('[zelda] rm -rf ' + dirPath)
    if (!opts['dry-run']) rimraf.sync(dirPath)
  }

  function npmInstall (pkgPath) {
    console.log(`[zelda] cd ' + pkgPath + ' && rm node_modules/ && ${PKG_MGR_EXEC} install`)

    var args = ['install']
    if (opts.production) args.push('--production')

    if (!opts['dry-run']) {
      rimraf.sync(path.join(pkgPath, 'node_modules'))
      cp.spawnSync(PKG_MGR_EXEC, args, {
        cwd: pkgPath,
        stdio: 'inherit'
      })
    }
  }
}

function getCodePkgs (codePath) {
  var entries
  try {
    entries = fs.readdirSync(codePath)
  } catch (err) {
    throw new Error('Could not find ' + codePath + '. ' + err.message)
  }

  var pkgs = {}

  entries.forEach(function (entry) {
    var pkgPath = path.join(codePath, entry)
    var pkg
    try {
      pkg = require(path.join(pkgPath, 'package.json'))
    } catch (err) {
      return // ignore folders without package.json
    }
    pkgs[pkg.name] = pkgPath
  })

  return pkgs
}

function traverseNodeModules (pkgPath, fn) {
  var modulesPath = path.join(pkgPath, 'node_modules')
  var entries
  try {
    entries = fs.readdirSync(modulesPath)
  } catch (err) {
    return // nothing to traverse (no node_modules)
  }

  entries = entries.filter(function (entry) {
    var stat = fs.lstatSync(path.join(modulesPath, entry))
    return !stat.isSymbolicLink()
  })

  entries.forEach(function (entry) {
    var entryPath = path.join(modulesPath, entry)
    traverseNodeModules(entryPath, fn)
    fn(entry, entryPath)
  })
}
