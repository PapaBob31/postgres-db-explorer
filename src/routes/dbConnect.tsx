import { useNavigate } from "react-router-dom";
import { useRef } from "react"

export async function connectDb(urlParams) {
	let connectionURI = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:5432/${urlParams.dbname}`

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({str: connectionURI})
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

function serializeForm(elem) {
	let urlParamsObj = Object();
	const inputElements = elem.querySelectorAll("input");
	for (let element of inputElements) {
		urlParamsObj[element.name] = element.value;
	}
	return urlParamsObj
}

export default function ConnectDbForm() {
	const formRef = useRef(null)
	const navigate = useNavigate()

	async function connect(event) {
		event.preventDefault()
		let urlParams = serializeForm(formRef.current)
		const response = await connectDb(urlParams);
		if (!response) return;

		const data = await response.json()
		if (response.ok) {
			navigate("/", {state: data.data});
		}else {
			alert(data.errorMsg)
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
			<button type="submit">Connect</button>
		</form>
	)
}