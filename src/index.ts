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

function setCorsHeaders(req, res, next) {
	res.set('Access-Control-Allow-Origin', 'http://localhost:5173') // TODO: make it environment dependent
	res.set('Access-Control-Allow-Headers', 'Content-Type')
	res.set("Access-Control-Allow-Credentials", "true");
	res.set("Access-Control-Max-Age", "86400");	// 24 hours, should change later
	res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
	next()
}

app.use(logRequestDetails, setCorsHeaders)

async function processReq(connectionStr) {
	const pool = setupDbParams(connectionStr)
	let client;
	try {
		client = await pool.connect();
	}catch(error) {
		// add better error message i.e server doesn't support ssl, invalid connection strings
		console.log(error)
		return {statusCode: 400, info: {errorMsg: error.message, data: null}};
	} 

	let data = null;
	try {
		// SELECT table_name FROM information_schema.tables where table_schema = 'public';
		data = await client.query("SELECT datname FROM pg_database; SELECT rolname FROM pg_roles;");
		return {statusCode: 200, info: {errorMsg: null, data}};
	}catch(error) {
		console.log(error)
		client.release();
		return {statusCode: 500, info: {errorMsg: "Something went wrong!", data}};
	}finally {
		client.release();
	}
}

async function connectPrevConnectedDb(req, res) {
	if (req.cookies.connectionStr) {
		const connectResults = await processReq(req.cookies.connectionStr)
		res.status(connectResults.statusCode).json(connectResults.info)
	}else res.status(400).json({errorMsg: "no db was specified!", data: null})
}

app.get('/', connectPrevConnectedDb);

app.options('/connect-db', (req, res) => {
	res.status(204).send()
})

app.post('/connect-db', async (req, res, next) => {
	let connectResults;
	if (req.body.str) {
		connectResults = await processReq(req.body.str)
	}else {
		res.status(400).json(connectResults.info)
		return 
	}

	if (connectResults.statusCode == 200) {
		res.cookie('connectionStr', req.body.str, 
		{httpOnly: true, secure: true, maxAge: 604800} // 7 days
		)
	}
	res.status(connectResults.statusCode).json(connectResults.info)
})

console.log(`Listening on port ${PortNo}`)
app.listen(4900)