const fs = require("node:fs") //  maybe change to sqlite later
// does node-postgres accept the same connection uri as lib-pq?

interface SavedServerDetails {
	servername: string,
	recordType: "uri-parts"|"uri",
	connectionDetails: {
		user: string;
		password: string;
		hostname: string;
		dbname: string;
		port: number;
		ssl: boolean
	} | null;
	connectionUri: string;
}

function generateUri(obj: any) { // todo: urlencode the params
	let uri = "postgresql://"

	if (obj.dbName)
		uri += `/${obj.dbName}`
	if (obj.ssl === true)
		uri += `?ssl=allow`
	else 
		uri += `?ssl=disable`

	if (obj.user)
		uri += `&user=${obj.user}`
	if (obj.password)
		uri += `&password=${obj.password}`

	if (obj.hostname)
		uri += `&host=${obj.hostname}`
	if (obj.port)
		uri += `&posrt=${obj.port}`

	return uri

}

export function getSavedServersDetails() {
	let data: string = "";
	try {
		data = fs.readFileSync("savedServers.json", "utf8") // best file location? correct encoding?
	}catch(err) {
		fs.writeFileSync("savedServers.json", '', "utf8")
	}
	if (!data) 
		return []
	return JSON.parse(data);
}

function extractConnectSettings(obj: any):SavedServerDetails{
	if (obj.isConnUri) {
		return {servername: obj.servername, recordType: "uri",  connectionDetails: null, connectionUri: obj.connectionDetails}
	}

	const serverDetails:SavedServerDetails = {
		servername: obj.servername, recordType: "uri-parts", connectionDetails: null, connectionUri: generateUri(obj.connectionDetails)
	}
	const validFields = ["user", "password", "hostname", "dbname", "port", "ssl"]

	for (let [key, value] of obj.entries()) {
		if (validFields.includes(key))
			serverDetails.connectionDetails[key] = value;
	}

	return serverDetails
}

export function saveNewServerDetail(reqBody: any) {
	let data:SavedServerDetails[] = getSavedServersDetails();
	const newDetail = extractConnectSettings(reqBody)
	data.push(newDetail)

	fs.writeFIleSync("savedServers.json", JSON.stringify(data))
}