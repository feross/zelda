# zelda [![npm](http://img.shields.io/npm/v/zelda.svg)](https://npmjs.org/package/webtorrent) [![npm](http://img.shields.io/npm/dm/zelda.svg)](https://npmjs.org/package/webtorrent)

Automatically `npm link` all your modules together!

![link spin attack](https://raw.githubusercontent.com/feross/zelda/master/img/link-attack.jpg)

Sometimes Link needs a little help from Zelda.

### usage

1. Install it globally.

  ```bash
  npm install -g zelda
  ```

2. Run `zelda` from your node project directory. Pass it a single argument -- the directory where all your code lives.

  ```bash
  zelda ~/code
  ```

`zelda` finds all the node packages in your code folder (`~/code/` in the example). If any of these packages are listed as a dependency in the nearest `package.json` of your working directory, it automatically symlinks it for you.

### what you might do if you're clever

1. Clone a cool project.

  ```bash
  cd ~/code
  git clone git@github.com:feross/webtorrent.git
  ```

2. Clone the project dependencies you plan to work on.

  ```bash
  git clone git@github.com:feross/bittorrent-protocol.git
  git clone git@github.com:feross/bittorrent-swarm.git
  git clone git@github.com:feross/bittorrent-dht.git
  ```

3. Recursively `npm install` all project dependencies, but `npm link` the ones that are local.

  ```bash
  cd webtorrent
  zelda ~/code
  ```

Gone are the days of running tons of `npm link` commands by hand!

### features

- Automatically `npm link` all your modules together
- Supports `dependencies`, `devDependencies`, and `optionalDependencies`
- Recursively runs `npm install` so your freshly cloned projects are ready to go!

### link is better with zelda!

![link](https://raw.githubusercontent.com/feross/zelda/master/img/link-zelda.png)

## License

MIT. Copyright [Feross Aboukhadijeh](https://www.twitter.com/feross).
