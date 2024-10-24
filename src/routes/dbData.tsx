import { useState, useEffect, createContext, useRef, useContext } from "react"
import { DataDisplayFn, getData } from "./dbDataDisplay"
export const TargetDb = createContext("")


function TablesWithSameColumnName({columnName, tablesData} : {tablesData: any, columnName: string}) {
  return <>null</>

}

function TableHeader({ headersList, tablesData } : {headersList : string[], tablesData: any}) {
  const [displayedMenuColumn, setDislayedMenuColumn] = useState("");
  useEffect(() => {
    function hideAnyVisibleMenu() {
      setDislayedMenuColumn("")
    }
    document.addEventListener("click", hideAnyVisibleMenu)
    return () => document.removeEventListener("click", hideAnyVisibleMenu);
  })

  function showColumnOptions(targetMenu: string) {
    
    if (targetMenu === displayedMenuColumn){
      setDislayedMenuColumn("");
      return;
    }
    setDislayedMenuColumn(targetMenu);
  }

  let htmlElements = []; // come back to define the proper type
  for (let i=0; i<headersList.length; i++) {
    htmlElements.push(
      <th key={i} onClick={(event) => {showColumnOptions(headersList[i]); event.stopPropagation();}}>
        {headersList[i]}
        {displayedMenuColumn === headersList[i] && (
          <ul className="column-submenu">
            <li>JOIN USING COLUMN</li>
            <li>JOIN ON COLUMN</li>
          </ul>
        )}
      </th>
    )
  }
  return <tr>{htmlElements}</tr>;
}

function TableBody({ headersList, data } : { headersList: string[], data: any[] }) {
  let rows:any = [];
  let rowData:any[] = [];
  data.forEach(entity => {
    for (let i=0; i<headersList.length; i++) {
      rowData.push(<td key={i}>{entity[headersList[i]]}</td>) // empty cells??
    }
    rows.push(<tr>{rowData}</tr>);
    rowData = [];
  })
  return <tbody>{rows}</tbody>
}

function Table({schemaName, tableName, setVisibleMenu, visibleMenu}:{schemaName: string, tableName: string, setVisibleMenu: (menu: string)=>void, visibleMenu: string}) {
  const targetDb = useContext(TargetDb);
  const setDisplayData = useContext(DataDisplayFn);

  return (
    <li key={tableName} className="db-table-rep">
      <button className="db-table-btn" onClick={()=>{
        setDisplayData({type: "table-info", data: {targetDb, tableName, schemaName}})}
      }>
        {tableName}
      </button>
      <button onClick={(event)=>{
        event.stopPropagation();
        setVisibleMenu(visibleMenu === tableName ? "" : tableName)
      }}>...</button>

      {visibleMenu === tableName && (
        <div className="db-table-menu">
          <button onClick={()=>setDisplayData({type: "insert-form", data: {targetDb, tableName, schemaName}})}>Insert</button>
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
      {schemaDetails.tables.map(tableName => <Table tableName={tableName} schemaName={schemaDetails.name} 
        key={tableName} setVisibleMenu={setDisplayedMenu} visibleMenu={displayedMenu}/>)}
    </ul>
  )
}

function Schema({schemaDetails}: {schemaDetails: {name: string, tables: string[]}}) {
  const [visible, setVisible] = useState(false);
  const setDisplayData = useContext(DataDisplayFn);


  return (
    <>
      <button onClick={() => setVisible(!visible)}>{schemaDetails.name}</button>
      {visible && (
        <>
          <SchemaTables schemaDetails={schemaDetails}/>
          <button id="add-table-btn" onClick={() => setDisplayData({type: "create-table-form", data: null})}>Add Table</button>
        </>)
      }
    </>
  )
}


function DataBase({dbName, initDb}: {dbName: string, initDb: string}) {
  const schemas = useRef<{name: string; tables: string[];}[]>([]);
  const [dbObjectsVisible, setDbObjectsVisible] = useState(false)

  useEffect(() => {
    if (initDb === dbName){
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
      <TargetDb.Provider value={dbName}>
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
      </TargetDb.Provider>
    </li>
  )
}


export function DataBases({clusterDbs, initDb}:{clusterDbs: string[], initDb: string}) {
  const listItems = [];
  for (let dbName of clusterDbs) {
    listItems.push(<DataBase dbName={dbName} key={dbName} initDb={initDb}/>)
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


interface GenericQueryData {
  rows: any[];
  fields: string[];
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

interface TableDetails {
  tableName: string;
  targetDb: string;
  schemaName: string
}

function displayRows(setDisplayData: (data: any) => void, queryDetails: TableDetails) {
  const {schemaName, tableName, targetDb} = queryDetails;
  const qualifiedTableName = `"${schemaName}"."${tableName}"`;
  // Get the details from the db everytime as values may have changed since the last time you checked
  getData(targetDb, `SELECT * FROM ${qualifiedTableName};`)
  .then(responseData => {
    if (responseData.errorMsg)
      alert("Error occurred while trying to query db!");
    setDisplayData(responseData.data)});
}

function displayColumns(setDisplayData: (data: any) => void, queryDetails: TableDetails) {
  const {schemaName, tableName, targetDb} = queryDetails;
  // Get the details from the db everytime as values may have changed since the last time you checked
  const query = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}' AND table_schema = '${schemaName}';`
  getData(targetDb, query)
  .then(responseData => {
    if (responseData.errorMsg)
      alert("Error occurred while trying to query db!");
    setDisplayData(responseData.data)});
}

export function TableDisplay({changeDisplay, tableDetails, displayType} : {changeDisplay: (displayDetails)=>void, tableDetails: TableDetails, displayType: string}) {
  const [displayData, setDisplayData] = useState<GenericQueryData|null>(null); // add display type on errors
  const allTableDetails = useRef(null)

  useEffect(() => {
    if (displayType === "table-columns"){
      displayColumns(setDisplayData, tableDetails);
      return;
    }
    displayRows(setDisplayData, tableDetails);
    const query = `SELECT column_name, data_type, table_name, table_schema FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${tableDetails.schemaName};'`
    getData(tableDetails.targetDb, query)
    .then(responseData => allTableDetails.current = responseData);
  }, [])

  return (
    <section>
      {displayData ? (
        <>
          <h1>Tables Data</h1>
          <table>
            <thead><TableHeader headersList={displayData.fields} tablesData={allTableDetails.current} /></thead>
            <TableBody headersList={displayData.fields} data={displayData.rows} />
          </table>
          <button onClick={() => changeDisplay({type: "insert-form", data: null})}>insert</button>
        </>
      ) : <h2>Loading...</h2>}
    </section>
  )
}