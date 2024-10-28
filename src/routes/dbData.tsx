import { useState, useEffect, createContext, useRef, useContext } from "react"
import { DataDisplayFn, getData } from "./dbDataDisplay"
export const TargetDb = createContext("")

// TODO: table details should just be in a context
// Turn identifiers to quoted identifiers where appropriate

function TablesWithSameColumnName({columnName, tablesData, updateDisplay, tableDetails} 
  : {tablesData: GenericQueryData, columnName: string, updateDisplay: (data: Updater) => void, tableDetails: any}) {

  let targetTables: JSX.Element[] = [];
  function getAndUpdateData(targetTable: string) {
    const query = `SELECT * FROM "${tableDetails.tableName}" INNER JOIN ${targetTable} USING("${columnName}");`
    console.log(query);
    getData(tableDetails.targetDb, query)
    .then(response => {
      if (!response.errorMsg) {
        updateDisplay({displayName: `${tableDetails.tableName} INNER JOIN ${targetTable} USING ${columnName};`, data: response.data})
      }else alert("Something Went wrong while querying the db! @ TablesWithSameColumnName")
    })
  }
  for (let data of tablesData.rows) {
    if (data["column_name"] === columnName && data["table_name"] !== tableDetails.tableName && !targetTables.includes(data["table_name"])) { // is this check efficient?
      targetTables.push(
        <li onClick={() => {updateDisplay({displayName: "loading", data: null}); getAndUpdateData(data["table_name"])}}>
          {data["table_name"]}.{columnName}
        </li>
      )
    }
  }
  if (targetTables.length === 0)
    return null;
  return <ul>{targetTables}</ul>
}

interface Updater {
  displayName: string
  data: any
}
function TableHeader({ headersList, tablesData, updateDisplay, tableMetaData } : 
  {headersList : string[], tablesData: GenericQueryData, updateDisplay: (data: Updater) => void, tableMetaData: any}) {
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
      <th key={i} onClick={(event) => {showColumnOptions(headersList[i]); event.stopPropagation();}}>{/*Handle this event on columns that are part of a joined table*/}
        {headersList[i]}
        {displayedMenuColumn === headersList[i] && (
          <ul className="column-submenu">
            <li>
              INNER JOIN USING COLUMN &gt; 
              <TablesWithSameColumnName columnName={displayedMenuColumn} tablesData={tablesData} tableDetails={tableMetaData} updateDisplay={updateDisplay}/>
            </li>
            <li>JOIN ON COLUMN &gt; </li>
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

function displayColumns(setDisplayData: (data: any) => void, queryDetails: TableDetails) {
  const {schemaName, tableName, targetDb} = queryDetails;
  // Get the details from the db everytime as values may have changed since the last time you checked
  const query = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}' AND table_schema = '${schemaName}';`
  getData(targetDb, query)
  .then(responseData => {
    if (responseData.errorMsg)
      alert("Error occurred while trying to query db!");
    setDisplayData({displayName: "Table Columns", data: responseData.data})});
}

function sendDropTableReq(dbName: string, tableName: string, cascade: boolean): Promise<{errorMsg: string|null}> {
  return fetch("http://localhost:4900/drop-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({targetDb: dbName, tableName, cascade}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}

export function TableDisplay({changeDisplay, tableDetails, displayType} : {changeDisplay: (displayDetails)=>void, tableDetails: TableDetails, displayType: string}) {
  const [displayData, setDisplayData] = useState<{displayName: string, data: GenericQueryData}|null>(null); // add display type on errors
  const allTableDetails = useRef<GenericQueryData|null>(null)
  const updateMainDisplay = useContext(DataDisplayFn)

  useEffect(() => {
    if (displayType === "Table Columns"){
      displayColumns(setDisplayData, tableDetails);
      return;
    }
    const longQuery = `SELECT column_name, data_type, table_name, table_schema FROM INFORMATION_SCHEMA.COLUMNS WHERE table_schema = '${tableDetails.schemaName}';`
    // console.log(longQuery);
    const qualifiedTableName = `"${tableDetails.schemaName}"."${tableDetails.tableName}"`;
    console.log(qualifiedTableName);
    Promise.all([getData(tableDetails.targetDb, `SELECT * FROM ${qualifiedTableName};`), getData(tableDetails.targetDb, longQuery)])
    .then(values => {
      if (values[0].errorMsg){
        alert("Error occurred while trying to query db!");
        // todo: set state for some kind of error
        return
      }else setDisplayData({displayName: "Table Rows", data: values[0].data})
      if(!values[1].errorMsg) {
        allTableDetails.current = values[1].data
      }else alert("Error occurred while trying to query db! @ allTableDetails");
    });
  }, [displayType])

  async function dropTableAction({tableName, targetDb, schemaName}: TableDetails, cascade: boolean) {
    const results = await sendDropTableReq(targetDb, `"${schemaName}"."${tableName}"`, cascade);
    if (results.errorMsg){
      alert(results.errorMsg)
    }else{
      updateMainDisplay({type: "", data: null})
      alert(`Table '${tableName}' deleted successfully!`)
    }
  }


  return (
    <section>
      {displayData && displayData.displayName !== "loading" ? (
        <>
          <h1>{displayData.displayName}</h1>
          <table>
            <thead>
              <TableHeader 
                headersList={displayData.data.fields}
                tableMetaData={tableDetails}
                tablesData={allTableDetails.current as GenericQueryData}
                updateDisplay={setDisplayData} />
            </thead>
            <TableBody headersList={displayData.data.fields} data={displayData.data.rows} />
          </table>
          <button onClick={() => updateMainDisplay({type: "insert-form", data: tableDetails})}>insert</button>
          <button onClick={() => dropTableAction(tableDetails, true)}>Drop Table Cascade</button>
          <button onClick={() => dropTableAction(tableDetails, false)}>Drop Table Restrict</button>
        </>
      ) : <h2>Loading...</h2>}
    </section>
  )
}