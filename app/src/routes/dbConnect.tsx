import { useRef } from "react"
import { serverConnected } from "../store"
import { useDispatch } from "react-redux"


interface URLParams {
	user: string;
	password: string;
	hostname: string;
	dbname: string;
	port: number;
}

async function connectDb(urlParams: URLParams) {
	let connectionString = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:${urlParams.port}/${urlParams.dbname}`

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({connectionString})
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
		urlParamsObj[element.name] = element.value;
	}
	return urlParamsObj
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
			const tableDetails = {tableName: "", targetDb: urlParams.dbname, schemaName: ""}
			dispatch(serverConnected({newPage:  "dashboard", connectedDb: urlParams.dbname, tableDetails}))
		}else {
			alert("Invalid connection string")
		}
	}
	return (
		<form method="post" ref={formRef} onSubmit={connect}>
			<label>User</label>
			<input type="text" name="user" required/>
			<label>Password</label>
			<input type="password" name="password" required/>
			<label>Host name</label>
			<input type="text" name="hostname" required/>
			<label>Db name</label>
			<input type="text" name="dbname" required/>
			<label>Port number</label>
			<input type="number" name="port" min="1024" max="65535" required/>
			<button type="submit">Connect</button>
		</form>
	)
}