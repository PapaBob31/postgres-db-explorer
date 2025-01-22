import { useEffect, useRef, useState, createContext, useContext } from "react"
import { useDispatch, useSelector } from "react-redux"
import { type ServerDetails, tabCreated, selectCurrentTabServerConfig, getServerObjects } from "./store"

export const ServerDetailsContext = createContext<ServerDetails>({
  name: "",
  config: null,
  isConnUri: false,
  connectionUri: "",
  initDb: "",
  fetchedObjs: false,
  connectedDbs: [] as string[],
  roles: [],
  databases: []
})

const ParentDb = createContext("")

interface TableBtnProps {
  schemaName: string,
  tableName: string,
  setVisibleMenu: (menu: string)=>void,
  visibleMenu: string
}


function TableBtn({schemaName, tableName, setVisibleMenu, visibleMenu}:TableBtnProps) {
  const parentDb = useContext(ParentDb)
  const dispatch = useDispatch()
  const connectedServerDetails = useContext(ServerDetailsContext)
  const dataDetails = {tableName, schemaName, dbName: parentDb, serverConfig: connectedServerDetails.config}

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
  const config = useSelector(selectCurrentTabServerConfig)
  const fetchedTables = useRef(false)
  const connectedServerDetails = useContext(ServerDetailsContext)
  const dispatch =  useDispatch();

  const newTabletab = {
    tabName: "create-table",
    tabType: "create-table-form",
    dataDetails: {
      dbName: connectedServerDetails.initDb,
      tableName: "",
      schemaName: "",
      serverConfig: connectedServerDetails.config
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
      body: JSON.stringify({config})
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

function SchemaViews({schemaName} : {schemaName: string}) {
  const [viewsVisible, setViewsVisible] = useState(false);
  const [views, setViews] = useState<string[]>([])
  const fetchedViews = useRef(false)
  const config = useSelector(selectCurrentTabServerConfig)

  useEffect(() => {
    if (!fetchedViews.current) {
      fetch("http://localhost:4900/get-views", {
        method: "POST",
        credentials: "include",
        headers: {"content-type": "application/json"},
        body: JSON.stringify({config})
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
  const [dbObjectsVisible, setDbObjectsVisible] = useState(false)
  const connectedServerDetails = useContext(ServerDetailsContext)
  const config = useSelector(selectCurrentTabServerConfig)

  useEffect(() => {
    if (connectedServerDetails.connectedDbs.includes(dbName)){
      getDbSchemas()
    }
  }, [dbName])

  function getDbSchemas() {
    fetch("http://localhost:4900/get-db-schemas", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({config})
    })
    .then(response  => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(responseBody.errorMsg)
      }else {
        schemas.current = responseBody.data
        console.log(responseBody.data)
        setDbObjectsVisible(true)
      }
    })
  }

  /*function fetchDbDetails() {
    fetch("http://localhost:4900/get-db-details", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({config})
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(responseBody.errorMsg)
      }else {
        schemas.current = responseBody.data
        setDbObjectsVisible(true)
      }
    });
  }*/

  function toggleChildrenVisibilty() {
    if (dbObjectsVisible){
      setDbObjectsVisible(false);
      return;
    }else if (schemas.current.length === 0) {
      getDbSchemas()
    }else {
      setDbObjectsVisible(true)
    }
  }

  return (
    <li>
      <button onClick={toggleChildrenVisibilty}>{dbName}</button>
      {dbObjectsVisible && (
        <ParentDb.Provider value={dbName}>
          <h1>Schemas</h1>
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

export function Roles({dbClusterRoles} : {dbClusterRoles: string[]}) {
  const listItems = dbClusterRoles.map(roleName => <li key={roleName}><button>{roleName}</button></li>)
  return (
    <section id="cluster-roles">
      <h2>Roles</h2>
      <ul>
        {listItems}
      </ul>
    </section>
    
  )
}

function getNewDashboardTabObj(serverConfig: any, targetDb: string) {
  return {
    tabName: "dashboard",
    tabType: "dashboard",
    dataDetails: {
      dbName: targetDb,
      tableName: "",
      schemaName: "",
      serverConfig
    }
  }
}


export default function ServerRep({ serverDetails } : {serverDetails: ServerDetails}) {
  const dispatch = useDispatch()

  function connectToDb() {
    if (!serverDetails.fetchedObjs){
      dispatch(tabCreated(getNewDashboardTabObj(serverDetails.config, serverDetails.initDb)))
      dispatch(getServerObjects({serverName: serverDetails.name, config: {...serverDetails.config, database: serverDetails.initDb}}))
    }
  }

  function openNewConsole() {
    dispatch(tabCreated({
      tabName: "SQL-Console",
      tabType: "SQL-Console",
      dataDetails: {
        dbName: serverDetails.initDb,
        tableName: "",
        schemaName: "",
        serverConfig: serverDetails.config
      }
    }))
  }
  
  return (
    <li id="cluster-lvl-objs">
      <button onClick={connectToDb}>{serverDetails.name}</button>
      {serverDetails.fetchedObjs && (
        <ServerDetailsContext.Provider value={serverDetails}>
          <button onClick={openNewConsole} type="button">SQL console</button>
          <Roles dbClusterRoles={serverDetails.roles} />
          <DataBases clusterDbs={serverDetails.databases} />
        </ServerDetailsContext.Provider>
      )}
    </li>
  )
}