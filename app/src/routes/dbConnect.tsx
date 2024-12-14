import { useRef } from "react"
import { newServerConnected, tabCreated } from "../store"
import { useDispatch } from "react-redux"


interface URLParams {
	serverName: string,
	user: string;
	password: string;
	hostname: string;
	dbname: string;
	port: number;
	saveConnDetails: boolean;
	ssl: boolean
}

async function connectDb(urlParams: URLParams) {
	let connectionString = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:${urlParams.port}/${urlParams.dbname}`

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({connectionString, serverName: urlParams.saveConnDetails ? urlParams.serverName : null, ssl: urlParams.ssl})
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

function serializeForm(elem: Element) {
	let urlParamsObj = Object();
	const inputElements = elem.querySelectorAll("input");
	for (let element of inputElements) {
		if (element.name === "ssl")
			urlParamsObj[element.name] = element.checked;
		else
			urlParamsObj[element.name] = element.value;
	}
	return urlParamsObj
}


function genDashBoardStatePayload(obj: URLParams, connectionString: string) {
	return  {
	    tabName: "dashboard",
	    tabType: "dashboard",
	    serverConnString: connectionString,
	    tabId: "",
	    dataDetails: {
	      dbName: obj.dbname,
	      tableName: "",
	      schemaName: "",
	    }
	}
}

export default function ConnectDbForm() {
	const formRef = useRef<HTMLFormElement|null>(null)
	const dispatch = useDispatch();

	async function connect(event: React.FormEvent) {
		event.preventDefault()
		let urlParams = serializeForm(formRef.current as HTMLFormElement)
		const response = await connectDb(urlParams);
		if (!response) return;

		if (response.ok) {
			const connString = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:${urlParams.port}`
			const newTabPayload = genDashBoardStatePayload(urlParams, connString)
			dispatch(newServerConnected({name: "unimplemented yet", connString, connected: true, connectedDbs: [urlParams.dbname]}))
			dispatch(tabCreated(newTabPayload))
		}else {
			alert("Invalid connection string")
		}
	}
	return (
		<form id="server-connect-form" method="post" ref={formRef} onSubmit={connect}>
			<label>Server Name</label>
			<input type="text" name="serverName" required/>
			<label>User</label>
			<input type="text" name="user" required/>
			<label>Password</label>
			<input type="password" name="password" required/>
			<label>Host name</label>
			<input type="text" name="hostname" required/>
			<label>Port number</label>
			<input type="number" name="port" min="1024" max="65535" required/>
			<label>Db name</label>
			<input type="text" name="dbname"/>
			<label>SSl</label>
			<input type="checkbox" name="ssl"/>
			<label>Save connection details</label>
			<input type="checkbox" name="saveConnDetails" />
			<button type="submit">Connect</button>
		</form>
	)
}