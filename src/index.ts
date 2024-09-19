import setupDbParams from "./utils/connect-db"

const express = require("express");
const cors = require("cors")
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
		return {errorMsg: null, data};
	}catch(error) {
		console.log(error)
		client.release();
		return {errorMsg: "Something went wrong!", data};
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
			"SELECT schema_name, table_name FROM information_schema.tables, information_schema.schemata WHERE schema_name = information_schema.tables.table_schema;"
			);
		const schemaNameKey = schemaData.fields[0].name;
		const tableNameKey = schemaData.fields[1].name;

		const data: {name: string, tables: string[]}[] = [];

		for (let i=0; i<schemaData.rows.length; i++) {
			if (data.length === 0) {
				data.push({name: schemaData.rows[i][schemaNameKey], tables: [schemaData.rows[i][tableNameKey]]})
				continue;
			}
			for (let j=0; j<data.length; j++) {
				if (data[j].name === schemaData.rows[i][schemaNameKey]) {
					data[j].tables.push(schemaData.rows[i][tableNameKey])
					break;
				}
				if (j === data.length-1) {
					data.push({name: schemaData.rows[i][schemaNameKey], tables: [schemaData.rows[i][tableNameKey]]})
				}
			}
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

app.post("/create-table", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const results = await processReq(connectionStr, req.body.query);
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		res.status(200).json({tableName: "", errorMsg: null})
	}
})

app.post("/query-table", async (req, res) => {
	let connectionStr = `${req.cookies.serverSpecs}/${req.body.targetDb}`
	const results = await processReq(connectionStr, req.body.query)
	if (results.errorMsg) {
		res.status(400).json({errorMsg: results.errorMsg, data: null})
	}else {
		console.log(results.data.rows)
		const processedData = {rows: results.data.rows, fields: results.data.fields.map(field => field.name)};
		res.status(200).json({errorMsg: null, data: processedData})
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
		{httpOnly: true, secure: true, maxAge: 604800}) // 7 days
	}
	return res.status(statusCode).send()
})
console.log(`Listening on port ${PortNo}`)
app.listen(4900)