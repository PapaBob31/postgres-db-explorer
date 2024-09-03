import { Form, redirect } from "react-router-dom";

export async function connectAction({ request, params }) {
	const formData = await request.formData();
	const urlParams = Object.fromEntries(formData); // connection parameters
	let connectionURI = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:5432/${urlParams.dbname}`

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({str: connectionURI})
	})

	try {
		const response = await fetch(serverReq)	
		if (response.ok) {
			return redirect("/");
		}else {
			alert("Couldn't connect to database, please check your connection parameters")
			return null
		}
	}catch(error) {
		alert("Internet connection Error: Check your internet connection and if the database is reachable")
	}
}

export default function ConnectDbForm() {
	return (
		<Form method="post">
			<label>User</label>
			<input type="text" name="user" required/>
			<label>Password</label>
			<input type="password" name="password" required/>
			<label>Host name</label>
			<input type="text" name="hostname" required/>
			<label>Db name</label>
			<input type="text" name="dbname" required/>
			<button>Connect</button>
		</Form>
	)
}