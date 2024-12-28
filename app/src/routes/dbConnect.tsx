import { useRef, useState } from "react"
import { addNewServer, tabCreated, getServerObjects } from "../store"
import { useDispatch } from "react-redux"
import { parse } from "pg-connection-string"
import { generateUniqueId } from "../main"


export interface ConnectionParams {
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

async function connectDb(params: ConnectionParams) {

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({...params})
	})

	let response;
	try {
		response = await fetch(serverReq)
	}catch(error) {
		alert("Internet connection Error: Check your internet connection and if the database is reachable")
		return null
	}
	return response
}

function serializeForm(elem: Element) : ConnectionParams {
	let urlParamsObj = Object();
	const inputElements = elem.querySelectorAll("input");

	for (let element of inputElements) {
		if (element.name === "ssl" || element.name === "saveConnDetails")
			urlParamsObj[element.name] = element.checked;
		else
			urlParamsObj[element.name] = element.value.trim();
	}
	return urlParamsObj
}


function genDashBoardStatePayload(obj: ConnectionParams, serverConfig: any) {
	return  {
	    tabName: "dashboard",
	    tabType: "dashboard",
	    tabId: generateUniqueId(),
	    dataDetails: {
	      dbName: obj.database,
	      tableName: "",
	      schemaName: "",
	      serverConfig
	    }
	}
}


export function getServerConfig(connectionParams: any) {
	const config = Object()
	const restricted = ["name", "isConnUri", "connectionUri", "saveConnDetails", "database"]

	for (let key in connectionParams) {
		if (!restricted.includes(key)) {
			config[key] = connectionParams[key]
		}
	}

	return config;
}

function ConnectionURIForm() {
	const formRef = useRef<HTMLFormElement|null>(null)
	const dispatch = useDispatch();

	async function connect(event: React.FormEvent) {
		event.preventDefault()
		let params = serializeForm(formRef.current as HTMLFormElement)
		params.isConnUri = true;
		
		try {
			params = {...parse(params.connectionUri), ...params}
		}catch(err) {
			alert("Invaid connection URI")
			return;
		}

		const response = await connectDb(params);
		if (!response) return;

		
		if (response.ok) {
			const serverConfig = getServerConfig(params)
			const newTabPayload = genDashBoardStatePayload(params, serverConfig)
			dispatch(tabCreated(newTabPayload))
			dispatch(addNewServer({
				name: params.name,
				isConnUri: true,
				connectionUri: params.connectionUri,
				config: serverConfig,
				fetchedObjs: false,
				initDb: params.database,
				connectedDbs: [],
				roles: [],
  				databases: []
			}))
			dispatch(getServerObjects({serverName: params.name, config: {...serverConfig, database: params.database}}))
		}else {
			alert("Invalid connection string")
		}
	}
	return (
		<form ref={formRef} onSubmit={connect}>
			<h1>Connection URI</h1>
			<label>Server Name</label>
			<input type="text" name="name" maxLength={50} required/>
			<label>URI</label>
			<input type="text" name="connectionUri" required/>
			<label>
				<span>Save connection details </span>
				<button title="save connnection details for easier connection next time">info</button>
			</label>
			<input type="checkbox" name="saveConnDetails" />
			<button type="submit">Connect</button>
		</form>
	)
}

function ConnectionFieldsForm() {
	const formRef = useRef<HTMLFormElement|null>(null)
	const dispatch = useDispatch();

	async function connect(event: React.FormEvent) {
		event.preventDefault()
		let params = serializeForm(formRef.current as HTMLFormElement)
		const response = await connectDb(params);
		if (!response) return;

		if (response.ok) {
			const serverConfig = getServerConfig(params)
			const newTabPayload = genDashBoardStatePayload(params, serverConfig)
			dispatch(tabCreated(newTabPayload))
			dispatch(addNewServer({
				name: params.name,
				isConnUri: true,
				connectionUri: params.connectionUri,
				config: serverConfig,
				fetchedObjs: false,
				initDb: params.database,
				connectedDbs: [],
				roles: [],
  				databases: []
			}))
			dispatch(getServerObjects({serverName: params.name, config: {...serverConfig, database: params.database}}))
		}else {
			alert("Invalid connection string")
		}
	}
	return (
		<form id="server-connect-form" ref={formRef} onSubmit={connect}>
			<h1>Connection parameters</h1>
			<label>Server Name</label>
			<input type="text" name="name" maxLength={50} required/>
			<label>User</label>
			<input type="text" name="user"/>
			<label>Password</label>
			<input type="password" name="password"/>
			<label>Host name (<em>not ip addr</em>)</label>
			<input type="text" name="host"/>
			<label>Port number</label>
			<input type="number" name="port" min="1024" max="65535"/>
			<label>Db name</label>
			<input type="text" name="database"/>
			<label>SSL</label>
			<input type="checkbox" name="ssl"/>
			<label>
				<span>Save connection details </span>
				<button title="save connnection details for easier connection next time">info</button>
			</label>
			<input type="checkbox" name="saveConnDetails" />
			<button type="submit">Connect</button>
		</form>
	)
}

export default function ConnectDbForm() {
	const [display, setDisplay] = useState<"Connection Details"|"Connection URI">("Connection Details")

	return (
		<section>
			<button 
				onClick={() => setDisplay("Connection Details")} 
				className={display === "Connection Details" ? "active" : "" }>
				Connection Details
			</button>
			<button 
				onClick={() => setDisplay("Connection URI")}
				className={display === "Connection URI" ? "active" : "" }>
				Connection URI
			</button>
			{display === "Connection Details" ? <ConnectionFieldsForm/> : <ConnectionURIForm/> }
		</section>
	)
}