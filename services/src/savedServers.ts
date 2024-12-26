const fs = require("node:fs") //  maybe change to sqlite later

interface ConnectionParams {
	name: string,
	user: string;
	password: string;
	host: string;
	database: string;
	port: number;
	saveConnDetails: boolean;
	ssl: boolean;
	isConnUri: boolean;
	connectionUri: string;
}

export function getSavedServersDetails() {
	let data: string = "";
	try {
		data = fs.readFileSync("savedServers.json", "utf8") // best file location? correct encoding?
	}catch(err) {
		fs.writeFileSync("savedServers.json", '', "utf8")
	}
	if (!data) 
		data = '[]'
	return data;
}


export function saveNewServerDetail(reqBody: ConnectionParams) {
	const currentlySavedData = JSON.parse(getSavedServersDetails())
	const usefulData = Object()
	for (let key in reqBody) {
		if (key !== "saveConnDetails") {
			usefulData[key] = reqBody[key]
		}
	}
	currentlySavedData.push(usefulData)
	fs.writeFileSync("savedServers.json", JSON.stringify(currentlySavedData))
}