import { Form, redirect } from "react-router-dom";

export async function connectAction({ request, params }) {
	const formData = await request.formData();
	const urlParams = Object.fromEntries(formData); // connection parameters
	let connectionURI = `postgresql//${urlParams.user}:${urlParams.password}@/${urlParams.hostname}/${urlParams.dbname}`
	return redirect("/");
}

export default function ConnectDbForm() {
	return (
		<Form method="post">
			<label>User</label>
			<input type="text"/>
			<label>Password</label>
			<input type="text"/>
			<label>Host name</label>
			<input type="text"/>
			<label>Db name</label>
			<input type="text"/>
			<button>Connect</button>
		</Form>
	)
}