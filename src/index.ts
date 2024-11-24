import setupDbParams from "./utils/connect-db"

const express = require("express");
const cors = require("cors") // ?
const cookieParser = require('cookie-parser');
const app = express();
const PortNo = 4900;

app.use(express.json());
app.use(cookieParser());

function logRequestDetails(req, res, next) {
	console.log(`${req.method} ${req.originalUrl}`)
	next()
}

function validateConnectionStr(req, res, next) {
	if (!req.cookies.serverSpecs && req.originalUrl !== "/verify-connect-str") {
		console.log("Invalid connection string")
		res.status(400).json({errorMsg: "Bad Request! No connection string was sepcified", data: null})
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

async function processReq(connectionStr, sqlQuery) {
	const pool = setupDbParams(connectionStr)
	let client;
	try {
		client = await pool.connect();
	}catch(error) {
		// add better error message i.e server doesn't support ssl, invalid connection strings
		console.log(error)
		return {errorMsg: error.message, data: null};
	} 

	let data = null;
	try {
		data = await client.query(sqlQuery);
		// console.log(data);
		return {errorMsg: null, data};
	}catch(error) {
		console.log(error.message, error.code)
		return {errorMsg: `Something went wrong! Error: ${error.code}`, data};
	}finally {
		client.release();
	}
}


async function getDbDetails(connectionStr) {
	const pool = setupDbParams(connectionStr)
	let client;
	try {
		client = await pool.connect();
	}catch(error) {
		console.log(error)
		return {errorMsg: error.message, data: null}
	}

	try { // fix double table bug
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
		
		return {errorMsg: null, data};
	}catch(error) {
		console.log(error)
		client.release();
		return {errorMsg: "Something went wrong!", data: null};
	}finally {
		client.release();
	}
}

app.post("/update-table", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const results = await processReq(connectionStr, req.body.query)
	let updates = null;

	for (let data of results.data) {
		if (data.command === "SELECT" && !updates) {
			updates = data;
			break;
		}
	}

	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		const processedData = {rows: updates.rows, fields: updates.fields.map(field => field.name)};
		res.status(200).json({errorMsg: null, data: processedData})
	}

})

app.post("/mutate-dbData", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const results = await processReq(connectionStr, req.body.query);
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		if (req.body.queryType === "insert")
			res.status(200).json({rowCount: results.data.rowCount});
		else
			res.status(200).json({data: "", errorMsg: null})
	}
})

app.post("/query-table", async (req, res) => { // Add robust processing for relations that doesn't exist
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	// console.log(req.body.query, 'tf?: ', req.body.targetDb, ' :?tf')
	const results = await processReq(connectionStr, req.body.query)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		const processedData = {rows: results.data.rows, fields: results.data.fields.map(field => field.name)};
		res.status(200).json({errorMsg: null, data: processedData})
	}
})

app.post("/drop-table", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const cascadeString = req.body.cascade ? "CASCADE" : "RESTRICT";
	const results = await processReq(connectionStr, `DROP TABLE ${req.body.tableName} ${cascadeString};`)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg})
	}else {
		res.status(200).json({errorMsg: results.errorMsg})
	}
})

app.post("/delete-row", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const {targetTable, rowId} = req.body
	const results = await processReq(connectionStr, `DELETE FROM ${targetTable} WHERE ctid = '${rowId}';`)
	if (!results.errorMsg) {
		res.status(200).json({errorMsg: null})
	}else {
		res.status(400).json({errorMsg: results.errorMsg})
	}
})

app.post('/get-db-details', async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const processedData = await getDbDetails(connectionStr)
	if (processedData.errorMsg) {
		res.status(400).json({errorMsg: processedData.errorMsg, data: null})
	}else res.status(200).json(processedData);
})

app.post("/", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const results = await processReq(connectionStr, "SELECT rolname FROM pg_roles; SELECT datname FROM pg_database;")
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		const dbData = results.data;
		const responseData = {roles: [], dataBases: []};
		responseData.roles = dbData[0].rows.map(row => row[dbData[0].fields[0].name]);
		responseData.dataBases = dbData[1].rows.map(row => row[dbData[1].fields[0].name]);
		res.status(200).json({errorMsg: null, data: responseData})
	}
	
})

app.post("/verify-connect-str", async (req, res) => {
	let connectionStr = `${req.body.serverSpecs}/${req.body.targetDb}`
	const pool = setupDbParams(connectionStr);
	let client, statusCode:number;
	try {
		client = await pool.connect();
		statusCode = 200;
	}catch(error) {
		// add better error message i.e server doesn't support ssl, invalid connection strings
		console.log(error)
		statusCode = 400;
	}finally {
		client.release();
	}
	if (statusCode === 200) {
		res.cookie('serverSpecs', req.body.serverSpecs,
		{httpOnly: true, secure: true, maxAge: 6.04e8}) // 7 days
	}
	res.status(statusCode).send()
})
console.log(`Listening on port ${PortNo}`)
app.listen(4900)