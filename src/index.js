import {DaemonApi} from 'js-oip'

var rp = require('request-promise')
var Twit = require('twit')
var getJSON = require('get-json')
var T = new Twit(require('../config.js'))
var JsonDB = require('node-json-db');

const ta = require('../lib/timeago.js')
var db = new JsonDB("flodatabotdb", true, false);

let api = new DaemonApi()
const limit = 50

const getArtifacts = async () => {
  let {success, artifacts, error} = await api.getLatestArtifacts(limit)
  for (let artifact of artifacts) {
    console.log(artifact.meta.txid, ta.ago(artifact.meta.time * 1000))
    if (typeof artifact.FileObjects != "undefined") {
      for (let file in artifact.FileObjects) {
        console.log(file)
      }
    }
    console.log("-----")
    //console.log(artifacts)
  }
}

function post(statusText) {
  T.post('statuses/update', { status: statusText }, function(err, data, response) {
    if (typeof err == "undefined") {
      console.log("[TWEET]statuses/update: ", statusText)
    } else {
      console.log("[TWEET]statuses/update ERROR: ", err.message)
    }
    //console.log(data)
  })
}

const getExplorerBlockHeight = () => {
  return getJSON('http://network.flo.cash/api/getblockcount')
    .then(function(response) {
      return response
    }).catch(function(error) {
      console.log("Error getting explorer block height:", error)
    })
}

const getBlockHashFromId = (id) => {
  return rp('http://network.flo.cash/api/getblockhash?index=' + id)
    .then(function(data) {
      return data
    })
    .catch(function(err) {
      console.log("Error getting block hash from id " + id + ":", error)
    })
}

const getRawTransaction = (tx) => {
  return getJSON('http://network.flo.cash/api/getrawtransaction?txid=' + tx + '&decrypt=1')
    .then(function(response) {
      return response
    }).catch(function(error) {
      console.log("Error getting raw transaction " + tx + " from network.flo.cash:", error)
    })
}

const getBlockData = (blockhash) => {
  return getJSON('http://network.flo.cash/api/getblock?hash=' + blockhash)
    .then(function(response) {
      return response
    }).catch(function(error) {
      console.log("Error getting block data from network.flo.cash", error)
    })
}

function getIncomingTransactions() {
getJSON('http://network.flo.cash/ext/getaddress/F7Rr4zfGR7ZBR5ukSVdSkuKt5tuX5kmYdY')
  .then(function(response) {

    // Search for vouts to my address
    for (let tx of response.last_txs) {
      if (tx.type == "vout") {
        // Get txcomment from address
        getJSON('http://network.flo.cash/api/getrawtransaction?txid=' + tx.addresses + '&decrypt=1')
          .then(function(response) {
            if (!existsInDB("/donation/" + tx.addresses)) {
              // Add up amounts and make sure it's over 50
              let total = 0
              for (let i = 0; i < response.vout.length; i++) {
                for (let j = 0; j < response.vout[i].scriptPubKey.addresses.length; j++) {
                  if (response.vout[i].scriptPubKey.addresses[j] == "F7Rr4zfGR7ZBR5ukSVdSkuKt5tuX5kmYdY") total += response.vout[i].value 
                }
              }
              if (total >= 50) {
                post("📣 " + response.floData.substring(0, 250) + "\nhttp://network.flo.cash/tx/" + tx.addresses)
                addToDB("/donation/" + tx.addresses)
              }
            }
          }).catch(function(error) {
            console.log(error)
            console.log("Error getting raw transaction from network.flo.cash on address", tx.addresses)
          })
      }
    }
  }).catch(function(error) {
    console.log("Error getting incoming transactions", error)
  })
///F7Rr4zfGR7ZBR5ukSVdSkuKt5tuX5kmYdY
}

function getLatestTransactions() {
  getJSON('http://network.flo.cash/ext/getlasttxs/10/100')
    .then(function(response) {
      //console.log(response)
      for (let d of response.data) {

        // Report on amounts > 100k FLO sent
        if (d.total > 10000000000000) {
          // If we haven't tweeted about it already...
          if (!existsInDB("/bigtx/" + d.txid)) {
            console.log("Transaction with " + d.total + " FLO detected at txid " + d.txid)
            addToDB("/bigtx" + d.txid)
          }
        }

        // Report on blocks divisible by 100
        if (d.blockindex % 100 == 0) {
          // If we haven't tweeted about it already...
          if (!existsInDB("/block100/" + d.blockindex)) {
            // Find coinbase transaction
            for (let v of d.vin) {
              if (v.addresses == "coinbase") { 
                let miner = "unknown"
                if (d.txcomment_exists) miner = d.txcomment
                post("⛏️ FLO block #" + d.blockindex + " mined by " + miner + " ⛏️\nhttp://network.flo.cash/block/" + d.blockhash)
                addToDB("/block100/" + d.blockindex)
              }
            }
          }
        }
      }
    }).catch(function(error) {
      console.log("Error getting latest transactions", error)
    })
}

function addToDB(path) {
  try {
    let response = db.push(path, true)
  } catch(e) {
    console.log("addToDB database error:", e)
  }
}

function existsInDB(path) {
  try {
    let response = db.getData(path)
  } catch(e) {
    if (e.id == 5) {
      return false
    }
  }
  return true
}

function testDB() {
  console.log(existsInDB("/bigtx/asdf"))
  db.push("/bigtx/asdf", true)
  console.log(existsInDB("/bigtx/asdf"))
}

//testDB()

async function getLatestBlocks() {
  // Find last block id we know about
  // MIN_BLOCK_HEIGHT starts the database at a certain block
  const MIN_BLOCK_HEIGHT = 3218995
  if (!existsInDB("/blockheight")) db.push("/blockheight", MIN_BLOCK_HEIGHT)

  var dbBlockHeight = db.getData("/blockheight");
  let explorerHeight = await getExplorerBlockHeight()
  while (dbBlockHeight < explorerHeight) {
    let blockhash = await getBlockHashFromId(dbBlockHeight)
    let block = await getBlockData(blockhash)
    let transactions = block.tx

    // Parse transactions in block
    for (let i = 0; i < transactions.length; i++) {
      let tx = await getRawTransaction(transactions[i])
      // Tweet about every 100 blocks mined
      console.log("  Parsing tx " + tx.txid + " in block " + dbBlockHeight + " [" + blockhash + "]")

      // Look for coinbase if we're in a block divisible by 100
      if (dbBlockHeight % 100 == 0) {
        // If we haven't tweeted about it already...
        if (!existsInDB("/block100/" + dbBlockHeight)) {
          // Find coinbase transaction
          for (let v of tx.vin) {
            if (typeof(tx.vin.coinbase != "undefined")) { 
              let miner = "unknown"
              if (tx.floData != "" && typeof(tx.floData) != "undefined") miner = tx.floData
              post("⛏️ FLO block #" + dbBlockHeight + " mined by " + miner + " ⛏️\nhttp://network.flo.cash/block/" + blockhash)
              addToDB("/block100/" + dbBlockHeight)
            }
          }
        }
      }

      // Look for transactions with over 100k FLO transacted
      let total = 0
      for (let v of tx.vout) {
        total += v.value
      }
      if (total > 100000) {
        // If we haven't tweeted about it already...
        if (!existsInDB("/bigtx/" + tx.txid)) {
          console.log("Transaction with " + total + " FLO detected at txid " + tx.txid)
          addToDB("/bigtx" + tx.txid)
        }
      }
    }
    dbBlockHeight++
    db.push("/blockheight", dbBlockHeight)
  }
}
//getArtifacts()
getLatestBlocks()
getIncomingTransactions()

setInterval(getLatestBlocks, 1000 * 30)
setInterval(getIncomingTransactions, 1000 * 30)

