// import setupDbParams from "./utils/connect-db"
const { Pool } = require("pg")
const { saveNewServerDetail, getSavedServersDetails } = require("./savedServers")
const express = require("express");
// const cors = require("cors") // ?
const cookieParser = require('cookie-parser');
const app = express();
const PortNo = 4900;

interface PoolObj {
	connectionConfig: any
	pool: any
}
// don't forget to implement clean exit
const pools:PoolObj[] = []

function bothAreEqual(config1: any, config2: any) { // this is rubbish, come back to rewrite asap
	for (let key in Object.keys(config1)) {
		if (config1[key] !== config2[key]) {
			return false
		}
	}
	return true
}

function getPool(connectionConfig: any) {
	for (const pool of pools) {
		if (bothAreEqual(pool.connectionConfig, connectionConfig)){
			console.log("PERFECT!")
			return pool.pool;
		}
	}
	return null
}

async function createNewPool(connectionConfig: any) {
	let newPool = new Pool(connectionConfig)
	let testClient;

	try { // test if connectionConfig is valid
		testClient = await newPool.connect()
		pools.push({connectionConfig, pool: newPool})
		await testClient.release()
	}catch(err) {
		console.log(err)
		newPool = null;
	}
	return newPool
}

async function createPoolIfNotExists(connectionConfig: any) {
	const existingPool = getPool(connectionConfig)
	if (existingPool) {
		return existingPool
	}

	return await createNewPool(connectionConfig)
}


app.use(express.json());
app.use(cookieParser());

function logRequestDetails(req, res, next) {
	console.log(`${req.method} ${req.originalUrl}`)
	next()
}

// to implement later
function sessionIdIsValid(sessionId: string) {
	return true
}


function validateConnectionStr(req, res, next) { // change name later
	if (req.originalUrl === "/connect-db" || req.originalUrl === "/saved-servers") {
		next()
		return;
	}
	const pool = getPool(req.body.config)
	if (!pool){
		res.status(400).json({errorMsg: "Connect to the db first", data: null, msg: null});
		return;
	}

	if (!req.cookies.sessionId || !sessionIdIsValid(req.cookies.sessionId)) {
		console.log("Invalid connection string")
		res.status(401).json({errorMsg: "Unauthorised", data: null, msg: null})
	}else {
		next()
	}
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

app.use(logRequestDetails, setCorsHeaders, validateConnectionStr)

app.use(["/query-table", "/create-table"], (req, res, next) => {
	if (!req.body.query){ // TODO: learn how to prevent sql injection
		console.log("Invalid request body")
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

async function getDbDetails(pool) {
	let client;
	try {
		client = await pool.connect()
	}catch(error) {
		console.log(error)
		return {msg: null, errorMsg: `Something went wrong while getting db details`, data: null};
	}

	try {
		let schemaData = await client.query(
			"SELECT table_schema, table_name FROM information_schema.tables;"
			);
		const schemaNameKey = schemaData.fields[0].name;
		const tableNameKey = schemaData.fields[1].name;

		// Array of key-value pairs where key is a schema name and 
		// value is an array of the names of the tables present in the schema
		const data: {name: string, tables: string[]}[] = [];

		for (let i=0; i<schemaData.rows.length; i++) {
			let schemaObj: {name: string, tables: string[]} = null;
			for (let j=0; j<data.length; j++) {
				if (data[j].name === schemaData.rows[i][schemaNameKey]) {
					schemaObj = data[j];
					break;
				}
			}
			if (!schemaObj) {
				schemaObj = {name: schemaData.rows[i][schemaNameKey], tables: [schemaData.rows[i][tableNameKey]]};
				data.push(schemaObj);
			}else schemaObj.tables.push(schemaData.rows[i][tableNameKey])
		}
		
		return {msg: null, errorMsg: null, data};
	}catch(error) {
		console.log(error)
		return {msg: null, errorMsg: "Something went wrong!", data: null};
	}finally {
		client.release()
	}
}

function getServerConfig(reqBody: any) {
	const config = Object()
	const restricted = ["name", "isConnUri", "connectionUri", "saveConnDetails"]

	for (let key in reqBody) {
		if (!restricted.includes(key)) {
			config[key] = reqBody[key]
		}
	}

	return config;
}

app.post("/connect-db", async (req, res) => {
	let config = getServerConfig(req.body)

	const pool = await createPoolIfNotExists(config) // readup more on this pooling stuff
	if (!pool) {
		res.status(400).json({msg: null, errorMsg: "Something went wrong while trying to connect to the db", data: null});
		return;
	}

	if (req.body.saveConnDetails && !req.body.name) {
		res.status(400).json({msg: null, errorMsg: "Error! no 'servername' field", data: null})
		return;
	}else if (req.body.saveConnDetails) {
		saveNewServerDetail(req.body)
	}

	res.cookie('sessionId', 'super-secure-unimplemented-id',
	{httpOnly: true, secure: true, maxAge: 4.32e7}) // 12 hours, change to a session cookie later
	res.status(200).json({msg: "Db connected successfully", errorMsg: null, data: null})
})

app.get("/saved-servers", (_req, res) => {
	const servers = getSavedServersDetails();
	res.status(200).send(servers)
})

app.post("/update-table", async (req, res) => {
	const pool = getPool(req.body.config)
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
	const pool = getPool(req.body.config)
	const results = await processReq(req.body.query, pool);
	if (results.errorMsg) {
		res.status(400).json({msg: null, errorMsg: results.errorMsg, data: null})
	}else
		res.status(200).json({msg: null, data: "", errorMsg: null})
})

app.post("/mutate-dbData", async (req, res) => {
	const pool = getPool(req.body.config)
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
	const pool = getPool(req.body.config)
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
	const pool = getPool(req.body.config)
	const results = await processReq(`DROP TABLE ${req.body.tableName} ${cascadeString};`, pool)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg})
	}else {
		res.status(200).json({errorMsg: results.errorMsg})
	}
})

app.post("/delete-row", async (req, res) => {
	const pool = getPool(req.body.config)
	const {targetTable, rowId} = req.body
	const results = await processReq(`DELETE FROM ${targetTable} WHERE ctid = '${rowId}';`, pool)
	if (!results.errorMsg) {
		res.status(200).json({errorMsg: null, msg: null, data: null})
	}else {
		res.status(400).json({errorMsg: results.errorMsg, msg: null, data: null})
	}
})

app.post('/get-db-details', async (req, res) => {
	const pool = getPool(req.body.config)
	const processedData = await getDbDetails(pool)
	if (processedData.errorMsg) {
		res.status(400).json({errorMsg: processedData.errorMsg, data: null, msg: null})
	}else res.status(200).json(processedData);
})

app.post("/", async (req, res) => {
	const pool = getPool(req.body.config)
	const results = await processReq("SELECT rolname FROM pg_roles; SELECT datname FROM pg_database;", pool)
	console.log(results)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null, msg: null})
	}else {
		const dbData = results.data;
		const responseData = {roles: [], dataBases: []};
		responseData.roles = dbData[0].rows.map(row => row[dbData[0].fields[0].name]);
		responseData.dataBases = dbData[1].rows.map(row => row[dbData[1].fields[0].name]);
		res.status(200).json({errorMsg: null, data: responseData, msg: null})
	}
	
})

console.log(`Listening on port ${PortNo}`)
app.listen(4900)