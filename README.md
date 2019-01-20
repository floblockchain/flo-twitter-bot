# FLO twitter bot
![FLO](res/flobot5_small.jpg)
https://twitter.com/flodatabot

## Install
Install packages using `npm` and configure your twitter API keys in `config.js`.
```
npm install 
mv config.js.example config.js
```
## Run
Compile with `npm run compile`.

Then, run the bot using `npm start` or `npm run dbtest`.

### dbtest
dbtest is included for fast access to database functions. FLO twitter bot users are encouraged to create their own dbtest functionality and add it to this repo.

## Features
The FLO twitter bot tweets when:
* You send it a certain amount of FLO with a message
* New OIP data is added to the chain
* Someone moves over 100,000 FLO on the blockchain
* Every 100th block is mined

## Debugging
Run the chrome debugger front-end using `node inspect`:
```
node inspect index.js
http://127.0.0.1:9229/json/list
```

## Dependencies
FLO twitter bot depends on `js-oip` and the FLO explorer at network.flo.cash
