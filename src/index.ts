import setupDbParams from "./utils/connect-db"

const express = require("express");
const cors = require("cors")
var cookieParser = require('cookie-parser');
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
	res.set("Access-Control-Max-Age", "86400");	// 24 hours, should cha nge later
	res.set("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
	next()
}

app.use(logRequestDetails, setCorsHeaders)

async function processReq(req, res) {
	if (req.cookies.connectionStr) {
		const pool = setupDbParams(req.cookies.connectionStr)
		const client = await pool.connect()
		let data = null;
		try {
			data = await client.query("SELECT table_name FROM information_schema.tables where table_schema = 'public';");
			res.status(200).json({data})
		}catch(error) {
			res.status(500).json({msg: "Something went wrong!"})
		}finally {
			client.release();
		}
	}else res.status(400).json({msg: "no db was specified!"})
}

app.get('/', processReq);


app.options('/connect-db', (req, res) => {
	res.status(204).send()
})

app.post('/connect-db', (req, res) => {
	res.cookie('connectionStr', req.body.str, 
		{httpOnly: true, secure: false, maxAge: 3600000} // is this sec or msec?
	)
	res.status(200).json({msg: "successful!"});
})

console.log(`Listening on port ${PortNo}`)
app.listen(4900)