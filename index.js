module.exports = zelda

var cp = require('child_process')
var findRoot = require('find-root')
var fs = require('fs')
var path = require('path')
var rimraf = require('rimraf')

var NPM_EXEC = process.platform === 'win32'
  ? 'npm.cmd'
  : 'npm'

/**
 * @param  {string} rootPath path to project (ex: '~/code/my-project')
 */
function zelda (rootPath, opts) {
  if (!opts) opts = {}

  // Use folder with nearest package.json as root
  rootPath = findRoot(rootPath)

  var rootName = require(path.join(rootPath, 'package.json')).name
  var codePath = path.resolve(rootPath, '..')
  var codePathName = path.basename(codePath)

  if (!rootName) throw new Error('root package must have a name ')

  // add node_modules symlink in code folder - magic!
  try {
    fs.symlinkSync('.', path.join(codePath, 'node_modules'), 'dir')
    console.log('[zelda] Created symlink . => ' + codePathName + '/node_modules')
  } catch (err) {
    // ignore err (symlink already exists)
  }

  // get packages in code folder
  var codePkgs = getCodePkgs(codePath)

  if (opts.install) npmInstall(rootPath, opts.production)

  var pkgsToPurge = {}
  traverseNodeModules(rootPath, function (pkgName, pkgPath) {
    if (codePkgs[pkgName]) pkgsToPurge[pkgName] = true
  })

  var len = Object.keys(pkgsToPurge).length
  console.log('[zelda] Found ' + len + ' local packages for ' + rootName)
  Object.keys(pkgsToPurge).forEach(function (pkgToPurge) {
    console.log('  - ' + pkgToPurge)
  })

  pkgsToPurge[rootName] = true

  Object.keys(pkgsToPurge).forEach(function (pkgToPurge) {
    var pkgPath = path.join(codePath, pkgToPurge)

    if (opts.install && pkgToPurge !== rootName) {
      npmInstall(pkgPath, opts.production)
    }
  })

  traverseNodeModules(rootPath, function (pkgName, pkgPath) {
    if (pkgsToPurge[pkgName]) rimraf.sync(pkgPath)
  })

  // Outer loop of packages to purge
  Object.keys(pkgsToPurge).map(function (pkgOuter) {
    // Inner loop of packages to purge
    Object.keys(pkgsToPurge).map(function (pkgInner) {
      try {
        // Check for the packages existence
        fs.readdirSync(`${codePath}/${pkgOuter}/node_modules/${pkgInner}`)
        console.log(`Removing '${pkgInner}' from ${codePath}/${pkgOuter}`)
        rimraf.sync(`${codePath}/${pkgInner}/node_modules/${pkgOuter}`)
      } catch (err) {
        // Nothing to error out on here
      }
    })
  })

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

function npmInstall (pkgPath, production) {
  console.log('[zelda] npm install ' + path.basename(pkgPath))
  rimraf.sync(path.join(pkgPath, 'node_modules'))

  var args = ['install']
  if (production) args.push('--production')

  cp.spawnSync(NPM_EXEC, args, {
    cwd: pkgPath,
    stdio: 'inherit'
  })
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
