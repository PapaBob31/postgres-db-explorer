const fs = require("node:fs") //  maybe change to sqlite later
import {type ServerDetails} from "./index"


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


export function saveNewServerDetail(reqBody: ServerDetails) {
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