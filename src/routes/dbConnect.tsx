import { Form, redirect } from "react-router-dom";

export async function connectAction({ request, params }) {
	const formData = await request.formData();
	const urlParams = Object.fromEntries(formData); // connection parameters
	let connectionURI = `postgresql://${urlParams.user}:${urlParams.password}@${urlParams.hostname}:5432/${urlParams.dbname}`
	let connectionDetails = {msg: "", hasError: false};

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({str: connectionURI})
	})

	const response = fetch(serverReq)

	response.then(res => {
		if (res.ok) {
			return res.json()
		}else throw new Error("Something went wrong when connecting to the database!");
	})
	.then(res => {connectionDetails.msg = res})
	.catch(error => {alert(error.message); connectionDetails.hasError = true});

	if (connectionDetails.hasError)
		return null;
	return redirect("/");
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