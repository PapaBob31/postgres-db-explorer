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


interface TableBtnProps {
  schemaName: string,
  tableName: string,
  setVisibleMenu: (menu: string)=>void,
  visibleMenu: string
}


function TableBtn({schemaName, tableName, setVisibleMenu, visibleMenu}: TableBtnProps) {
  const { dbConnectionId } = useContext(ParentDb)
  const dispatch = useDispatch()
  const dataDetails = {tableName, schemaName, dbConnectionId}

  return (
    <li key={tableName} className="db-table-rep">
      <button className="db-table-btn" onClick={()=>{
        dispatch(
          tabCreated({tabType: "table-info", tabName: tableName, dataDetails})
        )}
      }>
        {tableName}
      </button>
      <button onClick={(event)=>{
        event.stopPropagation();
        setVisibleMenu(visibleMenu === tableName ? "" : tableName)
      }}>...</button>

      {visibleMenu === tableName && (
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


function SchemaTables({schemaName}: {schemaName: string}) {
  const [displayedMenu, setDisplayedMenu] = useState("");
  const [tables, setTables] = useState<string[]>([])
  const [tablesVisible, setTablesVisible] = useState(false)
  const fetchedTables = useRef(false)
  const { dbConnectionId } = useContext(ParentDb)
  const dispatch = useDispatch();

  const newTabletab = {
    tabName: "create-table",
    tabType: "create-table-form",
    dataDetails: {
      dbConnectionId,
      tableName: "",
      schemaName: schemaName,
    }
  }

  useEffect(() => {
    if (!fetchedTables.current) {
      getDbTables()
    }
    function hideAnyVisibleMenu() {
      setDisplayedMenu("false")
    }

    document.addEventListener("click", hideAnyVisibleMenu)
    return () => document.removeEventListener("click", hideAnyVisibleMenu);
  }, [displayedMenu])

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
          <button id="add-table-btn" onClick={() => dispatch(tabCreated(newTabletab))}>Add Table</button>
          <ul>
            {tables.map(tableName => (
              <TableBtn schemaName={schemaName} tableName={tableName} key={tableName} setVisibleMenu={setDisplayedMenu} visibleMenu={displayedMenu}/>
            ))}
          </ul>
        </> : "Loading...")
      }
    </>
  )
}

function SchemaViews({schemaName} : {schemaName: string}) { // start here. Make schema views acceot both db name and connectionid as context
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
      <ul>{viewsVisible && (fetchedViews.current ? views.map((view) => <li key={view}><button>{view}</button></li>) : "Loading...")}</ul>
    </>
  )
}


function Schema({name}: {name: string}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button onClick={() => setVisible(!visible)}>{name}</button>
      {visible && (
        <>
          <SchemaTables schemaName={name}/>
          <SchemaViews schemaName={name}/>
          <button>Add type</button>
        </>)
      }
    </>
  )
} 


function DataBase({dbName}: {dbName: string}) {
  const schemas = useRef<string[]>([]);
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

  function getDbConnectionId(dbName: string, connectedDbs: ConnectedDbDetails[]) {
    for (let dbDetails of connectedDbs) {
      if (dbDetails.name === dbName) {
        return dbDetails.connectionId
      }
    }
    return null
  }

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
        console.log(responseBody.data)
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
      <button onClick={toggleChildrenVisibilty}>{dbName}</button>
      {dbObjectsVisible && (<>
        <button onClick={openNewConsole} type="button">SQL console</button>
        <h1>Schemas</h1>
        {schemasFetchStatus === "complete" && (
          <ParentDb.Provider value={{dbName, dbConnectionId: connectionId.current!}}>
            <ul>
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
      </>)}
    </li>
  )
}


export function DataBases({clusterDbs}:{clusterDbs: string[]}) {
  const listItems = [];
  for (let dbName of clusterDbs) {
    listItems.push(<DataBase dbName={dbName} key={dbName}/>)
  }
  return (
    <section id="cluster-dbs">
      <h2>Databases</h2>
      <ul>
        {listItems}
      </ul>
    </section>
  )
}


export function Roles({dbClusterRoles, anydbConnectionId} : {dbClusterRoles: string[], anydbConnectionId: string}) {
  const dispatch = useDispatch()

  function showRoleDetails(roleName: string) {
    const roleTabDetails = {
      tabName: `Role - ${roleName}`,
      tabType: "role-details",
      dataDetails: {
        dbConnectionId: anydbConnectionId,
        tableName: roleName,
        schemaName: "",
      }
    }
    dispatch(tabCreated(roleTabDetails))
  }

  function showNewRoleFormTab() {
    const newRoleFormTab = {
      tabName: "Create Role",
      tabType: "create-role-form",
      dataDetails: {
        dbConnectionId: anydbConnectionId,
        tableName: "",
        schemaName: "",
      }
    }
    dispatch(tabCreated(newRoleFormTab))
  }

  return (
    <section id="cluster-roles">
      <h2>Roles</h2>
      <button onClick={showNewRoleFormTab}>Create role</button>
      <ul>
        {dbClusterRoles.map(roleName => (
          <li key={roleName}>
            <button onClick={() => showRoleDetails(roleName)}>{roleName}</button> {/*set width to full when using tailwind to handle proper clicks*/}
          </li>))}
      </ul>
    </section>
    
  )
}

function getNewDashboardTabObj(dbConnectionId: string) {
  return {
    tabName: "Db details",
    tabType: "db-details",
    dataDetails: {
      dbConnectionId,
      tableName: "",
      schemaName: "",
    }
  }
}

function getServerObjects(connectionId: string) {
  return fetch("http://localhost:4900", {
    credentials: "include",
    headers: {"Content-Type": "application/json"},
    method: "POST", // shouldn't it be POST?
    body: JSON.stringify({connectionId}) 
  })
}
// todo: implement keeping track of open tabs related to a server/db so that disconnecting
// from the db or tab will not render such tabs usesless
export default function ServerRep({ serverDetails } : {serverDetails: ServerDetails}) {
  const dispatch = useDispatch()
  const [serverObjs, setServerObjs] = useState<{roles: string[], dbs: string[]}>({roles: [], dbs: []})
  const [objectsFetchState, setObjectsfetchState] = useState("")
  const [serverObjsVisible, setServerObjsVisible] = useState(false)

  useEffect(() => {
    if (serverDetails.connectedDbs.length === 1 && !objectsFetchState) { // from the login interface
      setObjectsfetchState("pending")
      getServerData()
    }
  }, [])

  async function getServerData() {
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
    
    const serverObjsReqRes = await getServerObjects(connectedDbs[0].connectionId)
    const responseBody = await serverObjsReqRes.json()
    if (responseBody.errorMsg) {
      setObjectsfetchState("")
      alert(responseBody.errorMsg)
    }else {
      setServerObjs({roles: responseBody.data.roles, dbs: responseBody.data.databases})
      setObjectsfetchState("complete")
      dispatch(addNewConnectedDb({serverName: serverDetails.name, dbDetails: connectedDbs[0]}))
      dispatch(tabCreated(getNewDashboardTabObj(connectedDbs[0].connectionId)))
    }
  }

  function toggleServerObjsVisibility() {
    if (!objectsFetchState) {
      setObjectsfetchState("pending")
      getServerData()
    }
    setServerObjsVisible(!serverObjsVisible)
  }
  
  return (
    <li id="cluster-lvl-objs">
      <button onClick={toggleServerObjsVisibility}>{serverDetails.name}</button>
      {serverObjsVisible && <>
        {objectsFetchState === "pending" && "Loading..."}
        {objectsFetchState === "complete" && (
          <ServerDetailsContext.Provider value={serverDetails}>
            <Roles dbClusterRoles={serverObjs.roles} anydbConnectionId={serverDetails.connectedDbs[0].connectionId} />
            <DataBases clusterDbs={serverObjs.dbs} />
          </ServerDetailsContext.Provider>
        )}
      </>}
    </li>
  )
}