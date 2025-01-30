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

		const connectedDbDetails = await response.json() as ConnectedDbDetails

		const newTabPayload =  {
		    tabName: "dashboard",
		    tabType: "dashboard",
		    tabId: generateUniqueId(),
		    dataDetails: {
		      dbConnectionId: connectedDbDetails.connectionId as string,
		      tableName: "",
		      schemaName: "",
		    }
		}
		dispatch(tabCreated(newTabPayload))
		const connectedServer: ServerDetails = {...connectionReqPayload, connectedDbs: []}
		connectedServer.connectedDbs.push(connectedDbDetails)
		dispatch(addNewServer(connectedServer))
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

function ConnectionFieldsForm() {
	const saveConnDetails = useRef<HTMLInputElement|null>(null)
	const dispatch = useDispatch();
	const { handleSubmit, register } = useForm<FormData>()

	const connect: SubmitHandler<FormData> = async (formData) => {
		console.log(formData)
		const {name, ...connectionParams} = formData;
		// connectionParams.ssl = connectionParams.ssl ? "require" : "disable"
		// console.log(formData, connectionParams)
		const connectionReqPayload = {name, connectionParams, isConnUri: false, connectionUri: ""}
		const response = await connectDb(connectionReqPayload, saveConnDetails.current!.checked);
		if (!response || !response.ok) {
			alert("Something went wrong! Check your connection parameters and try again")
			return;
		}

		const connectedDbDetails = await response.json() as ConnectedDbDetails

		const newTabPayload =  {
		    tabName: "dashboard",
		    tabType: "dashboard",
		    tabId: generateUniqueId(),
		    dataDetails: {
		      dbConnectionId: connectedDbDetails.connectionId as string,
		      tableName: "",
		      schemaName: "",
		    }
		}
		dispatch(tabCreated(newTabPayload))
		const connectedServer: ServerDetails = {...connectionReqPayload, connectedDbs: []}
		connectedServer.connectedDbs.push(connectedDbDetails)
		dispatch(addNewServer(connectedServer))
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