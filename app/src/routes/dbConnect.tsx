import { useRef, useState } from "react"
import { addNewServer, tabCreated,
		 type ConnectionParams, type ServerDetails, type ConnectedDbDetails} from "../store"
import { useDispatch } from "react-redux"
import { parse } from "pg-connection-string"
import { generateUniqueId } from "../main"
import { useForm, SubmitHandler } from "react-hook-form"


export interface ConnectionReqPayload {
	name: string;
	isConnUri: boolean;
	connectionUri: string;
	connectionParams: ConnectionParams;
}

/** Makes a request to the app's server which then makes another connection request to a postgresql server
 * @typedef {{user?: string, password?: string, host?: string, port?: number, ssl?: string, database?: string}} ConnectionParams
 * @typedef {{name: string, isConnUri: boolean, connectionUri: string, connectionParams: ConnectionParams;}} ConnectionReqPayload
 * 
 * @param {ConnectionReqPayload} reqBody - details needed to connect to the postgresql server
 * @param {boolean} saveDetails - indicates if the sent connction details should be stored for later resuse on the backend or not
 * @returns {Promise<Response | null>}*/
export async function connectDb(reqBody: ConnectionReqPayload, saveDetails: boolean) {

	const serverReq = new Request("http://localhost:4900/connect-db", {
		credentials: "include",
		headers: {"Content-Type": "application/json"},
		method: "POST",
		body: JSON.stringify({...reqBody, saveConnDetails: saveDetails})
	})

	let response;
	try {
		response = await fetch(serverReq)
	}catch(error) {
		return null
	}
	return response
}

interface URIFormData {
	name: string;
	connectionUri: string;
}

/** Component that renders a form with a field that requires a postgresql connection string as input
 * Submitting the form initiates a connection to a postgreql server using the necessary form fields values
 * @returns {JSX.Element}*/
function ConnectionURIForm() {
	const formRef = useRef<HTMLFormElement|null>(null)
	const dispatch = useDispatch();
	const saveConnDetails = useRef<HTMLInputElement|null>(null)
	const { handleSubmit, register } = useForm<URIFormData>()

	const connect: SubmitHandler<URIFormData> = async (formData) => {
		const connectionParams = parse(formData.connectionUri)
		const connectionReqPayload = {...formData, connectionParams, isConnUri: true}
		const response = await connectDb(connectionReqPayload, saveConnDetails.current!.checked);
		if (!response || !response.ok) {
			alert("Something went wrong! Check your connection parameters and try again")
			return;
		}

		const connectedDbDetails = (await response.json()).data as ConnectedDbDetails

		const newTabPayload =  {
		    tabName: "Db details",
		    tabType: "db-details",
		    tabId: generateUniqueId(),
		    dataDetails: {
		      dbConnectionId: connectedDbDetails.connectionId as string,
		      tableName: "",
		      schemaName: "",
		      dbName: connectionParams.database
		    }
		}
		dispatch(tabCreated(newTabPayload)) // a new tab showing the connection DB's details should be displayed on successful connection
		const connectedServer: ServerDetails = {...connectionReqPayload, connectedDbs: []}
		connectedServer.connectedDbs.push(connectedDbDetails)
		dispatch(addNewServer(connectedServer)) // server details should be stored in state on successful connection
	}
	
	return (
		<form ref={formRef} onSubmit={handleSubmit(connect)}>
			<h1>Connection URI</h1>
			<label>Server Name</label>
			<input type="text" {...register("name", {maxLength: 50, required: true})}/>
			<label>URI</label>
			<input type="text" {...register("connectionUri")}/>
			<label>
				<span>Save connection details </span>
				<button title="save connnection details for easier connection next time">info</button>
			</label>
			<input type="checkbox" name="saveConnDetails" ref={saveConnDetails}/>
			<button type="submit">Connect</button>
		</form>
	)
}

interface FormData {
	name: string,
	user: string;
	password: string;
	host: string;
	database: string;
	port: number;
	ssl: boolean|string;
}

/** Component that renders a form that some of it's fields represents postgresql connection parameters 
 * like User, Password, Port number e.t.c. Submitting the form initiates a connection to a 
 * postgresql server using the needed form fields values
 * @returns {JSX.Element}*/
function ConnectionFieldsForm() {
	const saveConnDetails = useRef<HTMLInputElement|null>(null)
	const dispatch = useDispatch();
	const { handleSubmit, register } = useForm<FormData>()

	const connect: SubmitHandler<FormData> = async (formData) => {
		const {name, ...connectionParams} = formData;
		// connectionParams.ssl = connectionParams.ssl ? "require" : "disable"
		// console.log(formData, connectionParams)
		const connectionReqPayload = {name, connectionParams, isConnUri: false, connectionUri: ""}
		const response = await connectDb(connectionReqPayload, saveConnDetails.current!.checked);
		if (!response || !response.ok) {
			alert("Something went wrong! Check your connection parameters and try again")
			return;
		}

		const connectedDbDetails = (await response.json()).data as ConnectedDbDetails

		const newTabPayload =  {
		    tabName: "Db Details",
		    tabType: "db-details",
		    tabId: generateUniqueId(),
		    dataDetails: {
		      dbConnectionId: connectedDbDetails.connectionId as string,
		      tableName: "",
		      schemaName: "",
		      dbName: connectionParams.database
		    }
		}
		dispatch(tabCreated(newTabPayload)) // a new tab showing the connection DB's details should be displayed on successful connection
		const connectedServer: ServerDetails = {...connectionReqPayload, connectedDbs: []}
		connectedServer.connectedDbs.push(connectedDbDetails)
		dispatch(addNewServer(connectedServer)) // server details should be stored in state on successful connection
	}

	return (
		<form id="server-connect-form" onSubmit={handleSubmit(connect)}>
			<h1>Connection parameters</h1>
			<label>Server Name</label>
			<input type="text" {...register("name", {maxLength: 50, required: true})}/>
			<label>User</label>
			<input type="text" {...register("user")}/>
			<label>Password</label>
			<input type="password" {...register("password")}/> 
			<label>Host name (<em>not ip addr</em>)</label>
			<input type="text" {...register("host")}/> 
			<label>Port number</label>
			<input type="number" {...register("port", {min: 1024, max: 65535})}/> 
			<label>Db name</label>
			<input type="text" {...register("database")}/> 
			<label>SSL</label>
			<input type="checkbox" {...register("ssl")}/>
			<label>
				<span>Save connection details </span>
				<button title="save connnection details for easier connection next time">info</button>
			</label>
			<input type="checkbox" name="saveConnDetails" ref={saveConnDetails}/>
			<button type="submit">Connect</button>
		</form>
	)
}


/** Parent component that renders a database connection details form
 * @returns {JSX.Element}*/
export default function ConnectDbForm() {

	// State variable controlling the type of connection form to be displayed
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