import { useEffect, useRef, useState } from "react"
import { useSelector, useDispatch } from "react-redux"
import { selectCurrentDb, pageChanged } from "../store"

interface TableBtnProps {
  schemaName: string,
  tableName: string,
  setVisibleMenu: (menu: string)=>void,
  visibleMenu: string
}

function TableBtn({schemaName, tableName, setVisibleMenu, visibleMenu}:TableBtnProps) {
  const dispatch = useDispatch()

  return (
    <li key={tableName} className="db-table-rep">
      <button className="db-table-btn" onClick={()=>{
        dispatch(pageChanged({newPage: "table-info", tableDetails: {tableName, schemaName}}))}
      }>
        {tableName}
      </button>
      <button onClick={(event)=>{
        event.stopPropagation();
        setVisibleMenu(visibleMenu === tableName ? "" : tableName)
      }}>...</button>

      {visibleMenu === tableName && (
        <div className="db-table-menu">
          <button onClick={()=>dispatch(pageChanged({newPage: "insert-form", tableDetails: {tableName, schemaName}}))}>Insert</button>
          <button>Delete</button>
        </div>
      )}
    </li>
  )
}


function SchemaTables({schemaDetails} : {schemaDetails: {name: string, tables: string[]}}) {
  const [displayedMenu, setDisplayedMenu] = useState("");

  useEffect(() => {
    function hideAnyVisibleMenu() {
      setDisplayedMenu("false")
    }
    document.addEventListener("click", hideAnyVisibleMenu)
    return () => document.removeEventListener("click", hideAnyVisibleMenu);
  })
  
  return (
    <ul>
      {schemaDetails.tables.map(tableName => (
        <TableBtn schemaName={schemaDetails.name} tableName={tableName} key={tableName} setVisibleMenu={setDisplayedMenu} visibleMenu={displayedMenu}/>
      ))}
    </ul>
  )
}

function Schema({schemaDetails}: {schemaDetails: {name: string, tables: string[]}}) {
  const [visible, setVisible] = useState(false);
  const dispatch =  useDispatch();

  return (
    <>
      <button onClick={() => setVisible(!visible)}>{schemaDetails.name}</button>
      {visible && (
        <>
          <SchemaTables schemaDetails={schemaDetails}/>
          <button id="add-table-btn" onClick={() => dispatch(pageChanged({newPage: "create-table-form"}))}>Add Table</button>
          <button onClick={() => dispatch(pageChanged({newPage: "new-type-form"}))}>Add type</button>
        </>)
      }
    </>
  )
}

function DataBase({dbName}: {dbName: string}) {
  const schemas = useRef<{name: string; tables: string[];}[]>([]);
  const [dbObjectsVisible, setDbObjectsVisible] = useState(false)
  const connectedDb = useSelector(selectCurrentDb)

  useEffect(() => {
    if (connectedDb === dbName){
      fetchDbDetails()
    }
  }, [dbName])

  function fetchDbDetails() {
    fetch("http://localhost:4900/get-db-details", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb: dbName})
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
  }

  function toggleChildrenVisibilty() {
    if (dbObjectsVisible){
      setDbObjectsVisible(false);
      return;
    }else if (schemas.current.length === 0) {
      fetchDbDetails()
    }else {
      setDbObjectsVisible(true)
    }
  }

  return (
    <li>
      <button onClick={toggleChildrenVisibilty}>{dbName}</button>
      {dbObjectsVisible && (
        <ul>
          {schemas.current.map(
            (schema) => (
              <li key={schema.name}>
                <Schema schemaDetails={schema} />
              </li>
          ))}
        </ul>
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

export default function ServerObjects() {
  const [data, setData] = useState<{roles: string[], dataBases: string[]}>({roles: [], dataBases: []});
  const dispatch = useDispatch()

  useEffect(() => {
    fetch("http://localhost:4900", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: "" 
    })
    .then(response => {
      switch (response.status) {
        case 200:
          return response.json()
        default:
          dispatch(pageChanged({newPage: "connect-db-form"}));
      }
      response.json()
    })
    .then(responseBody => {
      setData(responseBody.data)
    })
    .catch(() => alert("Internet connection Error: Check your internet connection and if the database is reachable"))
  }, [])
  
  return (
    <section id="cluster-lvl-objs">
      {data && (
        <>
          <Roles dbClusterRoles={data.roles} />
          <DataBases clusterDbs={data.dataBases} />
        </>
      )}
    </section>
  )
}