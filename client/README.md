# Guide to all the JS stuff
1. Use nvm to install node (required for... everything)
  * `sudo apt update`
  * `sudo apt install build-essential checkinstall libssl-dev`
  * `curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.35.3/install.sh | bash` # Note, version number in link
  * `source ~/.bashrc`
  * `nvm install --lts=erbium`
  * `source ~/.bashrc`
  * There should be no errors; `nvm ls` should return v12.16.3 (or so), default -> lts/erbium (-> v12.16.3)
2. Use 'yarn', not 'npm'; the reason is because npm installs a spaghetti mess of dependencies, and yarn avoids it.
  * `curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -`
  * `echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list`
  * `sudo apt remove cmdtest`
  * `sudo apt update && sudo apt install --no-install-recommends yarn`
  * `yarn --version` should be ~~1.22.4
  * If a purely dev tool needs to be added, use `yarn add --dev PKG`, else `yarn add PKG`
  * If installing from an existing package.json/yarn.lock file pair, do `yarn install`
3. Webpack is used to compile the code into a unified distributable
  * All static assets go into the dist/ folder (html, css, images)
  * All raw source code goes into the src/ folder (js)
  * Webpack compiles src/index.js + dependencies (via import/export) into dist/main.js
  * The cli interface should be installed via yarn
  * To run: `yarn run build` (see the 'scripts' in package.json)
  * To real-time run webpack, hotfix changes, use `yarn run dev` to see the site at `http://localhost:8080`
  * This is the test that the code is minimumly working, if it doesn't fail to compile
  * See Dev-Debug-FeebackLoop
4. Firebase is used to host the site
  * Yarn should install the cli as a dev tool and the sdk as a dependency
  * The hosted site is in `dist/`; this is where assets & raw html goes (warning, don't open main.js!)
  * You can run commands with `yarn firebase ARGS`
  * To use, `import` into the js the needed modules
  * The required config obj comes from [online console]/Project Settings/Your apps/CARRI/Config, grab newer version if added firebase functionality.
  * Most key function - deploy: `yarn firebase deploy -m "[PROJ VER in package.json]"`
5. Dev-Debug-FeedbackLoop
  * This is how you should make changes & test, locally, on own computer.
  * Make sure you've updated the local pkgs by running `yarn install` in the correct dir(s) (see package.json workspaces)
  * See the cmd line 'scripts' in package.json
  1. Terminal 1 (cd CoBot/client): `yarn dev-recompile`
    * Anytime a file identified as a dependency via package.json changes, it recompiles the `dist/main.js`.
  2. Terminal 2 (cd CoBot/client): `yarn dev-localhost`
    * This has firebase locally host the website at `http://localhost:5000`
    * It will use the files in `dist/`, but it won't update unless you REFRESH
  3. Have your console/inspector/debugger open (Ctrl-Shift-I in FF), usually under webdev tools.
    * In the debugger tab, make sure to Pause on Exceptions.
    * Watch in console for errors that get thrown.
  4. Allowed/expected warnings:
    * onaddstreams depreciated, use addtrack instead; it's ok (JWCS)