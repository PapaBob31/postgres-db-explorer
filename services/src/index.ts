// import setupDbParams from "./utils/connect-db"
const { Pool } = require("pg")
const { saveNewServerDetail, getSavedServersDetails } = require("./savedServers")
const express = require("express");
// const cors = require("cors") // ?
const cookieParser = require('cookie-parser');
const app = express();
const PortNo = 4900;
const poolMap = {}
// don't forget to implement clean exit
// implement csrf protection && XSS

function generateUniqueId() {
  let key = "";
  const alphaNumeric = "0abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for (let i=0; i<15; i++) {
    const randIndex = Math.floor(Math.random()  * alphaNumeric.length);
    key += alphaNumeric[randIndex];
  }
  return key
}


async function createNewPool(connectionConfig: any) {
	let newPool = new Pool({...connectionConfig, idleTimeoutMillis: 300000, application_name: "postgres_db_explorer"}) // timeout is 5 minutes
	let poolId = ""
	try { // test if connectionConfig is valid
		let testClient = await newPool.connect()
		poolId = generateUniqueId()
		poolMap[poolId] = newPool
		testClient.release()
	}catch(err) {
		console.log(err)
		poolId = ""
	}
	return poolId
}


app.use(express.json());
app.use(cookieParser());

function logRequestDetails(req, res, next) {
	console.log(`${req.method} ${req.originalUrl}`)
	next()
}

function setCorsHeaders(req, res, next) {
	res.set('Access-Control-Allow-Origin', 'http://localhost:5173') // TODO: make it environment dependent
	res.set('Access-Control-Allow-Headers', 'Content-Type')
	res.set("Access-Control-Allow-Credentials", "true");
	res.set("Access-Control-Max-Age", "86400");	// 24 hours, should change later
	res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
	if (req.method === "OPTIONS") {
		res.status(204).send()
	}else next()
}

function validateConnParams(req, res, next) {
	const whitelist  =  ["/connect-db", "/saved-servers"]
	if (whitelist.includes(req.originalUrl)) {
		next();
		return;
	}

	const pool = poolMap[req.body.connectionId]

	if (!pool){
		res.status(400).json({msg: null, errorMsg: "Bad request! Invalid `connectionId`", data: null})
		return
	}else next()
}

app.use(logRequestDetails, setCorsHeaders, validateConnParams)

app.use(["/query-table", "/create-table", "/get-tables", "/get-views"], (req, res, next) => {
	if (!req.body.query){ // TODO: learn how to prevent sql injection
		res.status(400).json({errorMsg: "Invalid data body", data: null})
	}else next();
})

async function processReq(sqlQuery, pool) {
	let client;
	try {
		client = await pool.connect()
	}catch(error) {
		console.log(error) // add better error message i.e server doesn't support ssl, invalid connection strings
		return {msg: null, errorMsg: `Something went wrong while trying to connect to server`, data: null};
	}

	let data = null;
	try {
		data = await client.query(sqlQuery);
		// console.log(data);
		return {msg: null, errorMsg: null, data};
	}catch(error) {
		console.log(error.message, error.code)
		return {msg: null, errorMsg: `Something went wrong! Error: ${error.code}`, data};
	}finally {
		client.release();
	}
}

interface ConnectionParams {
	user?: string;
	password?: string;
	host?: string;
	port?: string;
	ssl?: string;
	database?: string;
}

export interface ServerDetails {
	name: string;
	isConnUri: boolean;
	connectionUri: string;
	connectionParams: ConnectionParams;
	saveConnDetails: boolean;
}

app.post("/connect-db", async (req, res) => {
	const poolId = await createNewPool(req.body.connectionParams)
	if (!poolId) {
		res.status(400).json({msg: null, errorMsg: "Something went wrong while trying to connect to the db", data: null});
		return;
	}

	if (req.body.saveConnDetails && !req.body.name) {
		res.status(400).json({msg: null, errorMsg: "Error! no 'name' field for the server", data: null})
		return;
	}else if (req.body.saveConnDetails) {
		saveNewServerDetail(req.body)
	}
	const queryResults = await processReq("SELECT datname FROM pg_stat_activity WHERE application_name='postgres_db_explorer'", poolMap[poolId])
	res.status(200).json({data: {connectionId: poolId, name: queryResults.data.rows[0].datname}, errorMsg: null, msg: null})
})

app.get("/saved-servers", (_req, res) => {
	const servers = getSavedServersDetails();
	res.status(200).send(servers)
})

app.post("/update-table", async (req, res) => {
	const pool =  poolMap[req.body.connectionId]

	if (!pool){
		res.status(400).json({msg: null, errorMsg: "Bad request! Invalid `connectionId`", data: null})
		return
	}
	const results = await processReq(req.body.query, pool)
	let updates = null;

	for (let data of results.data) {
		if (data.command === "SELECT" && !updates) {
			updates = data;
			break;
		}
	}

	if (results.errorMsg) {
		res.status(400).json({msg: null, errorMsg: results.errorMsg, data: null})
	}else {
		const processedData = {rows: updates.rows, fields: updates.fields.map(field => field.name)};
		res.status(200).json({msg: null, errorMsg: null, data: processedData})
	}
})

app.post("/alter-table", async (req, res) => {
	const pool =  poolMap[req.body.connectionId]
	const results = await processReq(req.body.query, pool);
	if (results.errorMsg) {
		res.status(400).json({msg: null, errorMsg: results.errorMsg, data: null})
	}else
		res.status(200).json({msg: null, data: "", errorMsg: null})
})

app.post("/mutate-dbData", async (req, res) => {
	const pool =  poolMap[req.body.connectionId]
	const results = await processReq(req.body.query, pool);
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		if (req.body.queryType === "insert")
			res.status(200).json({data: null, errorMsg: null, msg: results.data.rowCount});
		else
			res.status(200).json({data: null, errorMsg: null, msg: null})
	}
})

app.post("/query-table", async (req, res) => { // Add robust processing for relations that doesn't exist
	const pool =  poolMap[req.body.connectionId]
	const results = await processReq(req.body.query, pool)
	if (results.errorMsg) {
		res.status(400).json({msg: null, errorMsg: results.errorMsg, data: null})
	}else {
		const processedData = {rows: results.data.rows, fields: results.data.fields.map(field => field.name)};
		res.status(200).json({msg: null, errorMsg: null, data: processedData})
	}
})

app.post("/drop-table", async (req, res) => {
	const cascadeString = req.body.cascade ? "CASCADE" : "RESTRICT";
	const pool = poolMap[req.body.connectionId]
	const results = await processReq(`DROP TABLE ${req.body.tableName} ${cascadeString};`, pool)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg})
	}else {
		res.status(200).json({errorMsg: results.errorMsg})
	}
})

app.post("/delete-row", async (req, res) => {
	const pool = poolMap[req.body.connectionId]
	const {targetTable, rowId} = req.body
	const results = await processReq(`DELETE FROM ${targetTable} WHERE ctid = '${rowId}';`, pool)
	if (!results.errorMsg) {
		res.status(200).json({errorMsg: null, msg: null, data: null})
	}else {
		res.status(400).json({errorMsg: results.errorMsg, msg: null, data: null})
	}
})

app.post("/", async (req, res) => {
	const pool = poolMap[req.body.connectionId]
	const results = await processReq("SELECT rolname FROM pg_roles; SELECT datname FROM pg_database;", pool)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null, msg: null})
	}else {
		const dbData = results.data;
		const responseData = {roles: [], databases: []};
		responseData.roles = dbData[0].rows.map(row => row[dbData[0].fields[0].name]);
		responseData.databases = dbData[1].rows.map(row => row[dbData[1].fields[0].name]);
		res.status(200).json({errorMsg: null, data: responseData, msg: null})
	}
})

app.post("/get-tables", async (req, res) => {
	const pool =  poolMap[req.body.connectionId]
	const results = await processReq(req.body.query, pool)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null, msg: null})
	}else {
		const responseData: string[] = results.data.rows.map(row => row["table_name"])
		res.status(200).json({errorMsg: null, data: responseData, msg: null})
	}
})

app.post("/get-views", async (req, res) => {
	const pool = poolMap[req.body.connectionId]
	const results = await processReq(req.body.query, pool)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null, msg: null})
	}else {
		const responseData: string[] = results.data.rows.map(row => row["table_name"])
		res.status(200).json({errorMsg: null, data: responseData, msg: null})
	}
})

app.post("/get-db-schemas", async (req, res) => {
	const pool =  poolMap[req.body.connectionId]
	const queryResult = await processReq("SELECT schema_name FROM information_schema.schemata", pool)

	if (queryResult.errorMsg) {
		res.status(400).json(queryResult)
	}else {
		const responseData: string[] = queryResult.data.rows.map(row => row["schema_name"])
		res.status(200).json({errorMsg: null, data: responseData, msg: null})
	}
})

console.log(`Listening on port ${PortNo}`)
app.listen(4900)