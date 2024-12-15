import { useRef, useState } from "react"
import { newServerConnected, tabCreated } from "../store"
import { useDispatch } from "react-redux"


interface URLParams {
	servername: string,
	user: string;
	password: string;
	hostname: string;
	dbname: string;
	port: number;
	saveConnDetails: boolean;
	ssl: boolean;
	connectionUri: string;
}

async function connectDb(urlParams: URLParams, saveConnDetails: boolean) {
	const payload:any = {servername: urlParams.servername, saveConnDetails}

	if (urlParams.connectionUri) {
		payload.isConnUri = true
		payload.connectionDetails = urlParams.connectionUri
	}else {
		payload.connectionDetails = urlParams;
	}

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({payload})
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
		else if (element.name !== "saveConnDetails")
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
	const [display, setDisplay] = useState<"Connection Details"|"Connection URI">("Connection Details")
	const [saveConnDetails, setSaveConnDetails]  = useState(true)

	async function connect(event: React.FormEvent) {
		event.preventDefault()
		let urlParams = serializeForm(formRef.current as HTMLFormElement)
		const response = await connectDb(urlParams, saveConnDetails);
		if (!response) return;


		if (response.ok) {
			const connString = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:${urlParams.port}`
			const newTabPayload = genDashBoardStatePayload(urlParams, connString, )
			dispatch(newServerConnected({name: "unimplemented yet", connString, connected: true, connectedDbs: [urlParams.dbname]}))
			dispatch(tabCreated(newTabPayload))
		}else {
			alert("Invalid connection string")
		}
	}

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
			{display === "Connection Details" ? 
				<form id="server-connect-form" method="post" ref={formRef} onSubmit={connect}>
					<h1>Connection parameters</h1>
					<label>Server Name</label>
					<input type="text" name="servername" maxLength={50} required/>
					<label>User</label>
					<input type="text" name="user"/>
					<label>Password</label>
					<input type="password" name="password"/>
					<label>Host name (<em>not ip addr</em>)</label>
					<input type="text" name="hostname"/>
					<label>Port number</label>
					<input type="number" name="port" min="1024" max="65535"/>
					<label>Db name</label>
					<input type="text" name="dbname"/>
					<label>SSl</label>
					<input type="checkbox" name="ssl"/>
					<label>
						<span>Save connection details </span>
						<button title="save connnection details for easier connection next time">info</button>
					</label>
					<input type="checkbox" checked={saveConnDetails} name="saveConnDetails" onClick={() => setSaveConnDetails(!saveConnDetails)} />
					<button type="submit">Connect</button>
				</form>
			:
				<form ref={formRef}>
					<h1>Connection URI</h1>
					<label>Server Name</label>
					<input type="text" name="servername" maxLength={50} required/>
					<label>URI</label>
					<input type="text" name="connectionUri" required/>
					<label>
						<span>Save connection details </span>
						<button title="save connnection details for easier connection next time">info</button>
					</label>
					<input type="checkbox" checked={saveConnDetails} name="saveConnDetails" onClick={() => setSaveConnDetails(!saveConnDetails)} />
					<button type="submit">Connect</button>
				</form>
			}
		</section>
	)
}