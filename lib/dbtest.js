"use strict";

var JsonDB = require('node-json-db');

var db = new JsonDB("flodatabotdb", true, false);
db.delete("/blockheight");
db.delete("/block100");