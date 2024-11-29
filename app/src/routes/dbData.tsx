import { useState, useEffect, createContext, useRef, useContext } from "react"
import { DataDisplayFn, getData } from "./dbDataDisplay"
export const TargetDb = createContext("")
const TopLevelTableDetails = createContext({tableName: "", targetDb: "",  schemaName: ""})

// TODO: table details should just be in a context
// Turn identifiers to quoted identifiers where appropriate
// Define the type of results to be returned in a fetch request

function TablesWithSameColumnName({columnName, tablesData, updateDisplay} 
  : {tablesData: GenericQueryData, columnName: string, updateDisplay: (data: Updater) => void}) {

  let tableDetails = useContext(TopLevelTableDetails)
  let targetTables: JSX.Element[] = [];
  function getAndUpdateData(targetTable: string) {
    const query = `SELECT * FROM "${tableDetails.tableName}" INNER JOIN ${targetTable} USING("${columnName}");`
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
        <li key={data["table_name"]} onClick={() => {updateDisplay({displayName: "loading", data: null}); getAndUpdateData(data["table_name"])}}>
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
function TableHeader({ headersList, tablesData, updateDisplay } : 
  {headersList : string[], tablesData: GenericQueryData, updateDisplay: (data: Updater) => void}) {

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
    if (headersList[i] === "ctid")
      continue;
    htmlElements.push(
      <th key={i} onClick={(event) => {showColumnOptions(headersList[i]); event.stopPropagation();}}>{/*Handle this event on columns that are part of a joined table*/}
        {headersList[i]}
        {displayedMenuColumn === headersList[i] && (
          <ul className="column-submenu">
            <li>
              INNER JOIN USING COLUMN &gt; 
              <TablesWithSameColumnName columnName={displayedMenuColumn} tablesData={tablesData} updateDisplay={updateDisplay}/>
            </li>
            <li>JOIN ON COLUMN &gt; </li>
          </ul>
        )}
      </th>
    )
  }
  return <tr>{htmlElements}</tr>;
}

interface QueryRow {
  [key: string]: string
}

function DataRow({rowData, headersList, updateData} : { rowData: QueryRow, headersList: string[], updateData: (exc: string)=>void}) {
  const rowId = useRef("");
  const {targetDb, schemaName, tableName} = useContext(TopLevelTableDetails)
  let row:any = [];

  for (let i=0; i<headersList.length; i++) {
    if (headersList[i] === "ctid"){
      rowId.current = rowData[headersList[i]]
      continue;
    }
    row.push(<Cell key={i} cellData={rowData[headersList[i]]}/>) // empty cells??
  }

  function deleteAction() {
    fetch("http://localhost:4900/delete-row", {
      credentials: "include",
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({targetDb, rowId: rowId.current, targetTable: `"${schemaName}"."${tableName}"`})
    })
    .then(response => response.json())
    .then(responseData => {
      if (responseData.errorMsg) {
        alert(`Error '${responseData.errorMsg}' occured while deleting row(s)`)
      }else {
        updateData(rowId.current);
      }
    })
  }

  return <tr>{row}<td><button onClick={deleteAction}>Delete</button></td></tr>

}

function Cell({cellData} : {cellData: string} ) {
  return <td>{cellData}</td>
}

function InputCell({currentData, columnDataTypeMap, columnName, syncUpdates} : 
  {currentData: string, columnDataTypeMap: {[key: string]: string}, columnName: string, syncUpdates: (param1: string, param2: string) => void}) {

  const [inputState, setInputState] = useState("")

  const numericTypes = ["bigint", "integer", "smallint", "numeric", "real", "double precision", "serial"]; // int2, int4, int8 ?
  const inputType = numericTypes.includes(columnDataTypeMap[columnName]) ? "number" : "text"

  function processUserInput(event) {
    if (inputType === "number" && !(/^\d+$/).test(event.target.value)) { // TODO: Add more robust input type validation
      setInputState("error")
    }else {
      let input = ""
      if (inputType !== "number") {
        input = `'${event.target.value}'`
      }else input = event.target.value;
      syncUpdates(columnName, input)
    }
  }
  return <td><input type={inputType} className={inputState} defaultValue={currentData} onBlur={processUserInput} onFocus={() => setInputState("")} /></td>
}

interface DataUpdate {
  ctid: string;
  updates: [string, string][]
}

function InputRow({rowData, headersList, updateData, columnData, rowDataIndex} : 
  { rowData: QueryRow, headersList: string[], updateData: (dat: DataUpdate, i: number)=>void, columnData: any, rowDataIndex: number}) {

  const rowId = useRef("");
  // const {targetDb, schemaName, tableName} = useContext(TopLevelTableDetails)
  let row:any = [];
  const rowEditDetails = useRef<DataUpdate>({ctid: "", updates: []});
  const columnDataMap: {[key: string]: string} = {};
  const numericTypes = ["bigint", "integer", "smallint", "numeric", "real", "double precision", "serial"]; // int2, int4, int8 ?


  for (let data of columnData.rows) {
    columnDataMap[data["column_name"]] = data["data_type"]
  }

  function syncUpdates(columnName: string, newValue: string) {
    let actualNewValue: any = ""
    if (numericTypes.includes(columnDataMap[columnName])) {
      actualNewValue = parseInt(newValue)
    }
    let dataChanged:boolean = rowData[columnName] !== actualNewValue;

    if (dataChanged) {
      let update;
      for (let data of rowEditDetails.current.updates) {
        if (data[0] === columnName) {
          update = data
        }
      }
      if (!update) {
        rowEditDetails.current.updates.push([])
        update = rowEditDetails.current.updates[rowEditDetails.current.updates.length-1]
      }
      update[0] = columnName
      update[1] = newValue
    }else {
      rowEditDetails.current.updates = rowEditDetails.current.updates.filter(update => update[0] !== columnName)
      console.log(rowEditDetails.current.updates)
    }
    updateData(rowEditDetails.current, rowDataIndex)
  }

  for (let i=0; i<headersList.length; i++) {
    if (headersList[i] === "ctid"){
      rowEditDetails.current.ctid = rowData[headersList[i]];
      rowId.current = rowData[headersList[i]]
      continue;
    }
    row.push(
      <InputCell key={i} currentData={rowData[headersList[i]]} columnName={headersList[i]} 
        columnDataTypeMap={columnDataMap} syncUpdates={syncUpdates}/>
    ) // empty cells??
  }

  return <tr>{row}</tr>
}

function initArray(length: number) {
  const data: DataUpdate[] = Array(length);

  for (let i=0; i<length; i++) {
    data[i] = {ctid: "", updates: []}
  }
  return data;
}


function columnUpdatesStr(updates: [string, string][]) {
  let querySubstr = ""
  updates.forEach(update => {
    if (querySubstr)
      querySubstr += ', ';
    querySubstr += `"${update[0]}" = ${update[1]}`
  })
  return querySubstr
}

function constructQuery(dataInput: DataUpdate[], tableName: string) {
  let query = ""
  dataInput.forEach(data => {
    if (data.ctid && data.updates.length > 0) {
      query += `UPDATE "${tableName}" SET ${columnUpdatesStr(data.updates)} WHERE ctid = '${data.ctid}';` 
    }
  })
  return query;
}

// getData is very similar to this except the endpoint, I should probably edit it to accept endpoints as parameters
function sendUpdateQuery(targetDb: string, query: string) {
  return fetch("http://localhost:4900/update-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({targetDb, query}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}

function TableBody({data, editMode, columnData, updateDisplay} : {data: GenericQueryData, columnData: GenericQueryData, editMode: boolean, updateDisplay: (d:any)=>void}) {
  const [rowsData, setRowsData] = useState(data.rows);
  const {tableName, targetDb, schemaName } = useContext(TopLevelTableDetails)
  let rows:JSX.Element[] = [];
  const editedRowsData = useRef<DataUpdate[]>(initArray(rowsData.length));

  function updateEditedRowsData(newData: {ctid: string, updates: [string, string][]}, index: number) {
    editedRowsData.current[index] = newData;
  }

  function updateRows(excludedValue: string) {
    setRowsData(rowsData.filter(data => data["ctid"] !== excludedValue))
  }

  function updateTable() {
    if (editedRowsData.current.some(data => data.updates.length > 0)) {
      // todo: Implement not sending on input validation error from InputCell
      const updateQuery = constructQuery(editedRowsData.current, tableName)
      sendUpdateQuery(targetDb, updateQuery+`SELECT ctid, * FROM "${schemaName}"."${tableName}";`)
      .then(response => {
        if (response.errorMsg) {
          alert(response.errorMsg)
        }else {
          updateDisplay(response.data)
          setRowsData(response.data.rows)
        }
      })
      // console.log(updateQuery)
    }
  }

  if (editMode) {
    rows = rowsData.map((entity, index) => (
      <InputRow key={index} rowData={entity} rowDataIndex={index}
        headersList={data.fields} updateData={updateEditedRowsData} 
        columnData={columnData}
      />))
  }else rows = rowsData.map((entity, index) => <DataRow key={index} rowData={entity} headersList={data.fields} updateData={updateRows}/>)


  return <tbody>{rows}{editMode && <tr><td><button onClick={updateTable}>Update</button></td></tr>}</tbody>
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


export function TableDisplay({tableDetails, displayType} : {tableDetails: TableDetails, displayType: string}) {
  const [displayData, setDisplayData] = useState<{displayName: string, data: GenericQueryData}|null>(null); // add display type on errors
  const [editMode, setEditMode] = useState("");
  const allTableDetails = useRef<GenericQueryData|null>(null)
  const updateMainDisplay = useContext(DataDisplayFn)

  useEffect(() => {

    const longQuery = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE 
                        table_schema = '${tableDetails.schemaName}' AND table_name = '${tableDetails.tableName}';`
    const qualifiedTableName = `"${tableDetails.schemaName}"."${tableDetails.tableName}"`;
    Promise.all([
      getData(tableDetails.targetDb, `SELECT ctid, * FROM ${qualifiedTableName};`), 
      getData(tableDetails.targetDb, longQuery)
    ])
    .then(values => {
      if (values[0].errorMsg){
        alert("Error occurred while trying to query db!") // todo: set state for some kind of error
        return
      }
      if (values[1].errorMsg) {
        alert("Error occurred while trying to query db! @ allTableDetails");
        return
      }else {
        allTableDetails.current = values[1].data
      }
      if (displayType === "Table Columns") {
        setDisplayData({displayName: "Table Columns", data: allTableDetails.current as GenericQueryData});
      }else { // Table Rows
        setDisplayData({displayName: "Table Rows", data: values[0].data})
      }
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

  function tableBodyUpdateFn(newData: GenericQueryData) {
    if (editMode === "rows") {
      setEditMode("")
    }
    setDisplayData({displayName: "Table Rows", data: newData})
  }
  function changeEditMode() {
    setEditMode(editMode === "rows" ? "" : "rows")
  }

  return (
    <section>
      {displayData && displayData.displayName !== "loading" ? (
        <TopLevelTableDetails.Provider value={tableDetails}>
          <h1>{displayData.displayName}</h1>
          <button className={editMode === "rows" ? "active" : ""} onClick={changeEditMode}>Rows edit mode</button>
          <button disabled>Find and Replace</button>
          <table>
            <thead>
              <TableHeader 
                headersList={displayData.data.fields}
                tablesData={allTableDetails.current as GenericQueryData}
                updateDisplay={setDisplayData} />
            </thead>
            <TableBody 
              data={displayData.data}
              updateDisplay={tableBodyUpdateFn}
              editMode={editMode === "rows"}
              columnData={allTableDetails.current as GenericQueryData}/>
          </table>
          <button onClick={() => updateMainDisplay({type: "insert-form", data: tableDetails})}>insert</button>
          <button onClick={() => dropTableAction(tableDetails, true)}>Drop Table Cascade</button>
          <button onClick={() => dropTableAction(tableDetails, false)}>Drop Table Restrict</button>
        </TopLevelTableDetails.Provider>
      ) : <h2>Loading...</h2>}
    </section>
  )
}