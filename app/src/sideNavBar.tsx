import { useEffect, useRef, useState, createContext, useContext } from "react"
import { useDispatch } from "react-redux"
import { type ServerDetails, type ConnectedDbDetails,  tabCreated, addNewConnectedDb } from "./store"
import { connectDb } from "./routes/dbConnect"

export const ServerDetailsContext = createContext<ServerDetails>({
  name: "",
  isConnUri: false,
  connectionUri: "",
  connectionParams: {},
  connectedDbs: [] as ConnectedDbDetails[],
})

const ParentDb = createContext({dbName: "", dbConnectionId: ""})
 

/** Component that displays the representation of a table
 * @param {string} schemaName - the name of the schema that the table belongs to
 * @param {string} tableName - Name of the table
 * @returns {JSX.Element}*/
function TableBtn({schemaName, tableName}: {schemaName: string, tableName: string}) {
  const { dbConnectionId, dbName } = useContext(ParentDb)
  const dispatch = useDispatch()
  const dataDetails = {tableName, schemaName, dbConnectionId, dbName}
  const [menuVisible, setMenuVisisble] = useState(false);

  function hideOptionsMenu() { // put it in one of those hooks
    setMenuVisisble(false)
  }

  useEffect(() => {
    if (menuVisible) {
      // useEffect may run before browser repaint according to the react docs. setTimeout works around 
      // this behaviour and makes sure the effect's logic runs after browser repaint
      setTimeout(() => {
        // hides the displayed menu when any where is clicked on the document
        document.addEventListener("click", hideOptionsMenu)
      }, 100)
    }

    return () => document.removeEventListener("click", hideOptionsMenu)
  }, [menuVisible])

  return (
    <li key={tableName} className="db-table-rep">
      <button className="db-table-btn" onClick={()=>{
        dispatch(
          tabCreated({tabType: "table-info", tabName: tableName, dataDetails})
        )}
      }>
        {tableName}
      </button>
      <button id="test" onClick={()=>setMenuVisisble(true)}>...</button>

      {menuVisible && (
        <div className="db-table-menu">
          <button onClick={()=>dispatch(
            tabCreated({tabType: "insert-form", tabName: tableName, dataDetails})
          )}>Insert</button>
          <button>Delete</button>
        </div>
      )}
    </li>
  )
}

/** Component that displays an array of components and each component in
 * the array represents a table in a schema
 * @param {string} schemaName - the name of the schema that the tables belong to
 * @returns {JSX.Element}*/
function SchemaTables({schemaName}: {schemaName: string}) {
  const [tables, setTables] = useState<string[]>([]) // Name of the tables to be displayed as `TableBtn` components
  const [tablesVisible, setTablesVisible] = useState(false)
  const fetchedTables = useRef(false)
  const { dbConnectionId, dbName } = useContext(ParentDb)
  const dispatch = useDispatch();

  const newTabletab = {
    tabName: "create-table",
    tabType: "create-table-form",
    dataDetails: {
      dbConnectionId,
      tableName: "",
      schemaName: schemaName,
      dbName
    }
  }

  useEffect(() => {
    if (!fetchedTables.current) {
      getDbTables()
    }
  }, [])

  function getDbTables() {
    fetch("http://localhost:4900/get-tables", {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({
        connectionId: dbConnectionId,
        query: `SELECT table_name FROM INFORMATION_SCHEMA.tables WHERE table_schema = '${schemaName}'`
      })
    })
    .then(response => response.json())
    .then(resBody => {
      if (resBody.errorMsg) {
        alert(resBody.errroMsg)
      }else {
        setTables(resBody.data)
        fetchedTables.current = true;
      }
    })
  }
  return (
    <>
      <button onClick={() => setTablesVisible(!tablesVisible)}>Tables</button>
      {tablesVisible && (fetchedTables.current ?
        <>
          <button onClick={() => dispatch(tabCreated(newTabletab))}>
            <img className="w-6 p-px hover:bg-blue-200 rounded-md cursor-pointer" src="/add.svg"/>
          </button>
          <ul className="pl-4 border-l border-gray-800">
            {tables.map(tableName => (
              <TableBtn schemaName={schemaName} tableName={tableName} key={tableName}/>
            ))}
          </ul>
        </> : "Loading...")
      }
    </>
  )
}

/** Component that displays an array of components and each component in
 * the array represents a view in a schema
 * @param {string} schemaName - the name of the schema that the views belong to
 * @returns {JSX.Element}*/
function SchemaViews({schemaName} : {schemaName: string}) {
  const [viewsVisible, setViewsVisible] = useState(false);
  const [views, setViews] = useState<string[]>([])
  const fetchedViews = useRef(false)
  const parentDb = useContext(ParentDb)

  useEffect(() => {
    if (!fetchedViews.current) {
      fetch("http://localhost:4900/get-views", {
        method: "POST",
        credentials: "include",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({
          connectionId: parentDb.dbConnectionId,
          query: `SELECT table_name FROM INFORMATION_SCHEMA.views WHERE table_schema = '${schemaName}'`
        })
      }).then(response => response.json())
      .then(resBody => {
        if (resBody.errorMsg) {
          alert(resBody.errroMsg)
        }else {
          setViews(resBody.data)
          fetchedViews.current = true
        }
      })
    }
  }, [])

  return (
    <>
      <button onClick={() => setViewsVisible(!viewsVisible)}>Views</button>
      <>
        {viewsVisible && fetchedViews.current && views.length > 0 && (
          <ul className="pl-4 border-l border-gray-800">
            {views.map((view) => <li key={view}><button>{view}</button></li>)}
          </ul>
        )}
        {viewsVisible && fetchedViews.current && views.length === 0 && <span>No existing views</span>}
        {viewsVisible && !fetchedViews.current && <span>Loading...</span>}
      </>
    </>
  )
}

/** Component that displays the representation of a schema
 * @param {string} name - the name of the schema 
 * @returns {JSX.Element}*/
function Schema({name}: {name: string}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button onClick={() => setVisible(!visible)}>{name}</button>
      {visible && (
        <ul className="pl-4 border-l border-gray-800">
          <li><SchemaTables schemaName={name}/></li>
          <li><SchemaViews schemaName={name}/></li>
          <li><button>Add type</button></li>
        </ul>)
      }
    </>
  )
}

/** Returns the `connectionId` attribute of the first database in the `connectedDbs`
 * parameter whose name equals the `dbName` parameter or null if none matches
 * @param {string} dbName - name of the database whose connectionId is needed
 * @param {{connectionId: string, name: string}[]} connectedDbs - Array of objects, each representing a single database
 * @returns {string|null} */
function getDbConnectionId(dbName: string, connectedDbs: ConnectedDbDetails[]) {
  for (let dbDetails of connectedDbs) {
    if (dbDetails.name === dbName) {
      return dbDetails.connectionId
    }
  }
  return null
}

/** Component that displays the representation of a database
 * @param {string} dbName - the name of the database 
 * @returns {JSX.Element}*/
function DataBase({dbName}: {dbName: string}) {
  const schemas = useRef<string[]>([]); // used to store all the schemas in the database
  const [schemasFetchStatus, setSchemasFetchStatus] = useState("")
  const connectedServerDetails = useContext(ServerDetailsContext)
  const connectionId = useRef(getDbConnectionId(dbName, connectedServerDetails.connectedDbs))
  const [dbObjectsVisible, setDbObjectsVisible] = useState(false)
  const dispatch =  useDispatch()

  useEffect(() => {
    if (connectionId.current) {
      setSchemasFetchStatus("pending")
      getDbSchemas()
    }
  }, [connectionId.current])


  function getDbSchemas() {
    fetch("http://localhost:4900/get-db-schemas", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({connectionId: connectionId.current})
    })
    .then(response  => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(responseBody.errorMsg)
      }else {
        schemas.current = responseBody.data
        setSchemasFetchStatus("complete")
      }
    })
  }

  async function openNewConsole() {
    if (!connectionId.current) {
      await connectToDb()
    }
    dispatch(tabCreated({
      tabName: "SQL-Console",
      tabType: "SQL-Console",
      dataDetails: {
        dbConnectionId: connectionId.current as string,
        tableName: "",
        schemaName: "",
        dbName,
      }
    }))
  }

  async function connectToDb() { // how do you add types to fetch api?
    const payload = {
      name: "",
      isConnUri: false,
      connectionUri: "",
      connectionParams: {...connectedServerDetails.connectionParams, database: dbName}
    }
    const response = await connectDb(payload, false)

    if (!response) {
      alert("Internet connection Error: Check your internet connection and if the database is reachable")
      return;
    }

    if (response && !response.ok) {
      alert(`Error ${response.status} Something went wrong while trying to connect to db ${dbName}`)
      return;
    }

    const dbDetails = await response.json()
    connectionId.current = dbDetails.data.connectionId
    dispatch(addNewConnectedDb({serverName: connectedServerDetails.name, dbDetails: dbDetails.data}))
  }

  async function toggleChildrenVisibilty() {
    if (!connectionId.current) {
      connectToDb()
    }
    setDbObjectsVisible(!dbObjectsVisible)
  }

  return (
    <li>
      <button className="pl-4 text-gray-700 py-1 border-y border-transparent hover:border-gray-300 hover:text-gray-950 block cursor-pointer w-full text-left" 
      onClick={toggleChildrenVisibilty}>{dbName}</button>
      {dbObjectsVisible && (<div className="ml-4 pl-4 border-l border-gray-800">
        <button onClick={openNewConsole} type="button">SQL console</button>
        <h1>Schemas</h1>
        {schemasFetchStatus === "complete" && (
          <ParentDb.Provider value={{dbName, dbConnectionId: connectionId.current!}}>
            <ul className="pl-4 border-l border-gray-800 ">
              {schemas.current.map(
                (schema) => (
                  <li key={schema}>
                    <Schema name={schema} />
                  </li>
                )
              )}
            </ul>
          </ParentDb.Provider>
        )}
        {schemasFetchStatus === "pending" && "Loading.."}
      </div>)}
    </li>
  )
}

/** Component that displays all the databases in a postgresql server
 * @param {string[]} clusterDbs - Array containing the names of all the databases in the server
 * @returns {JSX.Element} */
export function DataBases({clusterDbs}:{clusterDbs: string[]}) {
  const [dbListVisible, setDbListVisible] = useState(false)
  const listItems = [];
  for (let dbName of clusterDbs) {
    listItems.push(<DataBase dbName={dbName} key={dbName}/>)
  }
  return (
    <>
      <h2>
        <button className="grow flex items-center cursor-pointer" onClick={()=>setDbListVisible(!dbListVisible)}>
          <img className={`w-4 duration-300 transition-transform ${dbListVisible ? "rotate-y-180" : ""} `} src="/caret-top.svg"/>
          <span>DataBases</span>
        </button>
      </h2>
      <ul className={`border-l border-gray-800 ${dbListVisible ? "h-auto" : "h-0 overflow-hidden"}`}>
        {listItems}
      </ul>
    </>
  )
}

/** Parent Component that renders the roles in a PostgresSQl db server*/
export function Roles({dbClusterRoles, anydbConnectionId} : {dbClusterRoles: string[], anydbConnectionId: string}) {
  const [rolesVisible, setRolesVisible] = useState(false)
  const dispatch = useDispatch()

  function showRoleDetails(roleName: string) {
    const roleTabDetails = {
      tabName: `Role - ${roleName}`,
      tabType: "role-details",
      dataDetails: {
        dbConnectionId: anydbConnectionId,
        tableName: roleName,
        schemaName: "",
        dbName: ""
      }
    }
    dispatch(tabCreated(roleTabDetails)) // renders a new tab in the UI
  }

  function showNewRoleFormTab() {
    const newRoleFormTab = {
      tabName: "Create Role",
      tabType: "create-role-form",
      dataDetails: {
        dbConnectionId: anydbConnectionId,
        tableName: "",
        schemaName: "",
        dbName: ""
      }
    }
    dispatch(tabCreated(newRoleFormTab))
  }

  return (
    <>
      <h2 className="flex items-center cursor-pointer justify-between">
        <button className="grow flex items-center cursor-pointer" onClick={()=>setRolesVisible(!rolesVisible)}>
          <img className={`w-4 duration-300 transition-transform ${rolesVisible ? "rotate-y-180" : ""} `} src="/caret-top.svg"/>
          <span>Roles</span>
        </button>
        <button onClick={showNewRoleFormTab}><img className="w-6 p-px hover:bg-blue-200 rounded-md cursor-pointer" src="/add.svg"/></button>
      </h2>
      <ul className={`border-l border-gray-800 ${rolesVisible ? "h-auto" : "h-0 overflow-hidden"}`}>
        {dbClusterRoles.map(roleName => (
          <li key={roleName}>
            <button className="text-gray-700 py-1 pl-4 border-t border-b border-transparent hover:border-gray-300 hover:text-gray-950 block cursor-pointer w-full text-left" 
              onClick={() => showRoleDetails(roleName)}>
              {roleName}
            </button> {/*set width to full when using tailwind to handle proper clicks*/}
          </li>))}
      </ul>
    </>
  )
}


function getNewDashboardTabObj(db: ConnectedDbDetails) {
  return {
    tabName: "Db details",
    tabType: "db-details",
    dataDetails: {
      dbConnectionId: db.connectionId,
      tableName: "",
      schemaName: "",
      dbName: db.name
    }
  }
}

/** Makes a request to get all the databases and roles in a postgresql db
 * server that we have established an initial connection to
 * @param {string} connectionId - unique id that will be used to identify the server's connection
 * @returns {Promise<Response|null>}*/
function getServerObjects(connectionId: string) {
  return fetch("http://localhost:4900", {
    credentials: "include",
    headers: {"Content-Type": "application/json"},
    method: "POST", // shouldn't it be POST?
    body: JSON.stringify({connectionId}) 
  })
}


/** Parent Component that renders components that represent the databases and roles respectively in a server
 * 
 * @typedef {{user?: string, password?: string, host?: string, port?: number, ssl?: string, database?: string}} ConnectionParams
 * @typedef {{name: string, isConnUri: boolean, connectionUri: string, connectionParams: ConnectionParams}} ServerDetails
 * 
 * @param {ServerDetails} ServerDetails - connection details of the server
 * @return {JSX.Element}*/
export default function ServerRep({ serverDetails } : {serverDetails: ServerDetails}) {
  const dispatch = useDispatch()
  const [serverObjs, setServerObjs] = useState<{roles: string[], dbs: string[]}>({roles: [], dbs: []})

  // used to indicate if data hasn't been fetched, is being fetched, or has been fetched
  const [objectsFetchState, setObjectsfetchState] = useState("")
  const [serverObjsVisible, setServerObjsVisible] = useState(false)

  console.log(serverDetails.connectedDbs.length, objectsFetchState, serverObjs)
  useEffect(() => {
    /* Connecting to the postgresql database server through the connection form won't fetch the basic server data needed to 
    indicate the connection was successful so we manually do it after the server representation has rendered */
    if (serverDetails.connectedDbs.length === 1 && !objectsFetchState) {
      setObjectsfetchState("pending")
      setServerObjsVisible(true)
      fetchAndSetServerObjs(serverDetails.connectedDbs[0])
    }
  }, [])


  async function fetchAndSetServerObjs(targetDb: ConnectedDbDetails) {
    const serverObjsRequestRes = await getServerObjects(targetDb.connectionId)
    const responseBody = await serverObjsRequestRes.json()
    if (responseBody.errorMsg) {
      setObjectsfetchState("")
      alert(responseBody.errorMsg)
    }else {
      setServerObjs({roles: responseBody.data.roles, dbs: responseBody.data.databases})
      setObjectsfetchState("complete")
      dispatch(addNewConnectedDb({serverName: serverDetails.name, dbDetails: targetDb}))
      dispatch(tabCreated(getNewDashboardTabObj(targetDb)))
    }
  }

  async function connectToServer() {
    let {connectedDbs, ...payload} = serverDetails
    const response = await connectDb(payload, false)
    if (!response) {
      alert("Internet connection Error: Check your internet connection and if the database is reachable")
      return;
    }
    const resBody = await response.json()
    if (!response.ok) {
      alert(`Error ${response.status}: ${resBody.errorMsg}`)
      setObjectsfetchState("")
      return;
    }

    connectedDbs = [resBody.data]
    fetchAndSetServerObjs(connectedDbs[0])
  }

  function toggleServerObjsVisibility() {
    if (!objectsFetchState) {
      setObjectsfetchState("pending")
      connectToServer()
    }
    setServerObjsVisible(!serverObjsVisible)
  }
  
  return (
    <li id="cluster-lvl-objs" className="pl-4">
      <button onClick={toggleServerObjsVisibility} 
        className={`cursor-pointer rounded-md hover:bg-gray-300 w-full px-2 py-1 mb-2 flex justify-between ${objectsFetchState === "complete" ? " bg-gray-300" : ""}`}> 
        <span>{serverDetails.name}</span>
        {objectsFetchState === "complete" ? <img src="/chevron.svg" className="w-4"/> : null}
      </button>
      {serverObjsVisible && <>
        {objectsFetchState === "pending" && "Loading..."}
        {objectsFetchState === "complete" && (
          <ServerDetailsContext.Provider value={serverDetails}>
            <ul className="pl-4">
              <li className="pl-2"><Roles dbClusterRoles={serverObjs.roles} anydbConnectionId={serverDetails.connectedDbs[0].connectionId} /></li>
              <li className="pl-2"><DataBases clusterDbs={serverObjs.dbs} /></li>
            </ul>
          </ServerDetailsContext.Provider>
        )}
      </>}
    </li>
  )
}