import { useState, useEffect, useRef, useContext } from "react"
import { getData } from "./dbDataDisplay"
import { selectCurrentTab } from "../store"
import { useDispatch, useSelector } from "react-redux"

// Turn identifiers to quoted identifiers where appropriate
// Define the type of results to be returned in a fetch request

function TablesWithSameColumnName({columnName, tablesData, updateDisplay} 
  : {tablesData: GenericQueryData, columnName: string, updateDisplay: (data: Updater) => void}) {
  const serverConnString = useSelector(selectCurrentTab).serverConnString

  const tableDetails = useSelector(selectCurrentTab).dataDetails
  let targetTables: JSX.Element[] = [];
  function getAndUpdateData(targetTable: string) {
    const query = `SELECT * FROM "${tableDetails.tableName}" INNER JOIN ${targetTable} USING("${columnName}");`
    getData(query, serverConnString)
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
  const serverConnString = useSelector(selectCurrentTab).serverConnString

  const {schemaName, tableName} = useSelector(selectCurrentTab).dataDetails
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
      body: JSON.stringify({connectionString: serverConnString, rowId: rowId.current, targetTable: `"${schemaName}"."${tableName}"`})
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
  // const {schemaName, tableName} = useSelector(selectTargetTableDetails)
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
function sendUpdateQuery(query: string, serverConnString: string) {
  return fetch("http://localhost:4900/update-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({connectionString: serverConnString, query}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}

function TableBody({data, editMode, columnData, updateDisplay} : {data: GenericQueryData, columnData: GenericQueryData, editMode: boolean, updateDisplay: (d:any)=>void}) {
  const [rowsData, setRowsData] = useState(data.rows);
  const {tableName, schemaName } = useSelector(selectCurrentTab).dataDetails
  let rows:JSX.Element[] = [];
  const editedRowsData = useRef<DataUpdate[]>(initArray(rowsData.length));
  const serverConnString = useSelector(selectCurrentTab).serverConnString

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
      sendUpdateQuery(updateQuery+`SELECT ctid, * FROM "${schemaName}"."${tableName}";`, serverConnString)
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


function CompositeTypeValues() {
  return  (
    <>
      <label>attribute name</label>
      <input type="text"/>
      <label>Data Type</label>
      <input type="text"/>
      <label>collation</label>
      <input type="text"/>
    </>
  )
}

function EnumTypeValues() {
  const [labels, setNewLabels] = useState<string[]>([])
  const inputElementRef = useRef<HTMLInputElement>(null)

  function addNewLabel() {
    const newLabel = inputElementRef.current!.value.trim()
    if (!newLabel) 
      return;

    for (let label of labels) {
      if (newLabel === label)
        return;
    }

    setNewLabels([...labels, newLabel])
  }

  function removeLabel(labelToRemove: string) {
    setNewLabels(labels.filter(label => label !== labelToRemove))
  }
  return (
    <>
      {labels.map(label => (<div key={label}>
          <span>{label}</span>
          <button type="button" onClick={() => removeLabel(label)}>Remove</button>
      </div>))}
      <label>label</label>
      <input type="text" ref={inputElementRef} />
      <button type="button" onClick={addNewLabel}>add</button>
    </>
  )
}

function RangeTypeValues() {
  return (<>
    <label>SUBTYPE</label>
    <input type="text"/>
    <label>SUBTYPE_OPCLASS</label>
    <input type="text"/>
    <label>COLLATION</label>
    <input type="text"/>
    <label>CANONICAL</label>
    <input type="text"/>
    <label>SUBTYPE_DIFF</label>
    <input type="text"/>
    <label>MULTIRANGE_TYPE_NAME</label>
    <input type="text"/>
  </>)
}

export function NewTypeForm() {
  const [typeFormat, setTypeFormat] = useState("composite")

  const nameRef = useRef<HTMLInputElement>(null);
  function sendQuery() {
    const typeName =  nameRef.current!.value.trim();
    if (!typeName)
      return;
  }
  return (
    <form>
      <label>Type of 'type':</label>
      <select value="composite" onChange={(event) => setTypeFormat(event.target.value)}>
        <option>composite</option>
        <option>enum</option>
        <option>range</option>
        <option>base</option>
        <option>shell</option>
      </select>
      <div>
        <label>name:</label>
        <input type="text" ref={nameRef}/>
      </div>
      <div>
        {typeFormat === "composite" && <CompositeTypeValues/>}
        {typeFormat === "enum" && <EnumTypeValues/>}
        {typeFormat === "base" && <i>Not implemented yet</i>}
        {typeFormat === "range" && <RangeTypeValues/>}
       </div>
       <button type="button" onClick={sendQuery}>Create</button>
    </form>
  )
}



interface GenericQueryData {
  rows: any[];
  fields: string[];
}


function Header({username, connectedDb} : {username: string, connectedDb: string}) {
  return (
    <header>
     <b>Logged in user: </b>{username}
     <b> Connected database: </b>{connectedDb}
    </header>
  )
}

interface ConnectionDetail {
  user: string;
  application_name: string;
  state: string;
  client_hostname: string;
  client_port: number
}

interface DbDetails {
  template: boolean;
  encoding: string;
  allowedConnectionsNum: number;
  currentConnections: ConnectionDetail[]
}

/*
Roles
  Rolen - grant and revoke privileges
installed languages
Databses - space usage

  DataBasn
    schenma_n
      tables
      views
      foreign data wappers
      foreign tables
      materialised views
      functions
      sequences

*/


export function DashBoard() {
  return  (
    <section>
      <p><strong>Connected User:</strong>{}</p>
      {/*<p><strong>Connected Database:</strong>{}</p>*/}
     <h2>Current connections</h2>
      <table>
        <thead>
          <tr>
            <th>user</th>
            <th>application name</th>
            <th>client_hostname</th>
            <th>client_port</th>
            <th>state</th>
          </tr>
        </thead>
        <tbody></tbody>{/*Implement button that closes each displayed connection*/}
      </table>
      <section>
        <h2>Run time configs</h2>
        <p>Config1: <span>value</span> <button>set value</button></p>
      </section>
      <section>
        <h2>Backups</h2>
      </section>
    </section>
  )
}

function DbDetails() {
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    if (loading) {
      // fetch("http:localhost:4900/")
    }

  })
  return (
    <section>
      {loading ? <strong><i>Loading...</i></strong> : <>
        <h1>Db details</h1><span>Connected {/* show only if connected*/}</span>
        <p><strong>template?</strong></p>
        <p><strong>encoding: </strong>{}</p>
        <p><strong>No of allowed connections: </strong>{}</p>
        
        <h2>Db Objects</h2>
        <i>To implement...</i>
      </>}
    </section>
  )
}

function RoleDetails({roleName} : {roleName: string}) {
  // const [roleDetails, setRoleDetails] = useState<any>({})
  return (
    <section>
      <h1>{roleName}</h1>
       <div>SuperUser?</div>
       <div>Logged in?</div>
       <section>
         <h2>Privileges</h2>
         <div>Privilege 1 <button>revoke</button></div>
         <button>Grant privilege</button>
       </section>
       <section>
         <h2>Objects Owned</h2>
         <i>To implement maybe...</i>
       </section>
      <button disabled>DROP ROLE</button>
      <button>DROP OWNED</button>
    </section>)
}



interface TableDetails {
  tableName: string;
  schemaName: string
}

function sendDropTableReq(dbName: string, tableName: string, cascade: boolean, serverConnString: string): Promise<{errorMsg: string|null}> {
  return fetch("http://localhost:4900/drop-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({connectionString: tableName, cascade}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}

interface NewQueryObjType{
  newName: string;
  newDataType: string;
  newDefault: string;
  dropDefault: boolean
}

function genAlterColumnQuery(columnName: string, columnDropped: boolean, newQueryObj: NewQueryObjType) {
  if (columnDropped)
    return `DROP COLUMN ${columnName}`

  if (newQueryObj.newName)
    return `RENAME COLUMN ${columnName} TO ${newQueryObj.newName}`

  if (newQueryObj.newDefault)
    return `ALTER COLUMN ${columnName} SET DEFAULT ${newQueryObj.newDefault}`

  if (newQueryObj.dropDefault)
    return `ALTER COLUMN ${columnName} DROP DEFAULT ${newQueryObj.dropDefault}`
  return ""
}

interface AlterColumnParams {
  column: {column_name: string, data_type: string};
  getChanges: boolean;
  addColumnChanges: (str: string)=>void;
}

function AlterColumnInterface({column, getChanges, addColumnChanges} : AlterColumnParams) {
  const [columnDropped, setColumnDropped] = useState(false);
  const [inputsInterface, setInputsInterface] = useState("rename-column")
  const newValuesQuery = useRef({newName: "", newDataType: "", newDefault: "", dropDefault: false})


  useEffect(()=>{
    if (getChanges) {
      const query = genAlterColumnQuery(column.column_name, columnDropped, newValuesQuery.current)
      if (query)
        addColumnChanges(query);
    }
  }, [getChanges])

  function storeValues(event: React.ChangeEvent<HTMLInputElement>) {
    if (event.target.name === "new-name") {
      newValuesQuery.current.newName += event.target.value.trim();
    }

    if (event.target.name === "new-data-type") {
      newValuesQuery.current.newDataType += event.target.value.trim();
    }

    if (event.target.name === "new-default") {
      newValuesQuery.current.newDefault += event.target.value.trim();
    }

     if (event.target.name === "drop-default") {
      newValuesQuery.current.dropDefault = event.target.checked;
    } 
  }

  return (
    <section>
      <strong>{column.column_name}</strong>
      <select>
        <option onClick={()=>setInputsInterface("rename-column")}>Rename column</option>
        <option disabled>Rename constraints</option>
        <option onClick={()=>setInputsInterface("others")}>Others</option>
      </select>
      {inputsInterface === "rename-column" && (
        <div>
          <label>New Name: </label>
          <input name="new-name" type="text" defaultValue={column.column_name} disabled={columnDropped} onChange={storeValues}/>
        </div>
      )}
      {inputsInterface === "others" && <div>
        <label>New Data Type: </label>
        <input name="new-data-type" type="text" defaultValue={column.data_type} disabled={columnDropped} onChange={storeValues}/>
        <label>Set default: </label>
        <input name="new-default" type="text" onChange={storeValues} />
        <label>Drop default: </label>
        <input name="drop-default" type="checkbox" disabled={columnDropped} onChange={storeValues}/>
        <button onClick={()=>setColumnDropped(!columnDropped)}>Drop column</button>
      </div>}
     </section>
  )
}

function generateUniqueKey() {
  let key = "";
  const alphaNumeric = "0abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for (let i=0; i<5; i++) {
    const randIndex = Math.floor(Math.random()  * alphaNumeric.length);
    key += alphaNumeric[randIndex];
  }
  return key
}


interface TableChanges{
  newSchema: string;
  newName: string;
  newColumnsQuery: string[]
}

function generateAlterTableQuery(tableName: string, values: TableChanges, editedColumnsQuery: string) {
  let query = "";
  if (values.newSchema) {
    query += `ALTER TABLE '${tableName}' SET SCHEMA '${values.newSchema}';`
  }

  if (values.newName) {
    query += `ALTER TABLE '${tableName}' RENAME TO '${values.newName}';`
  }

  if (values.newColumnsQuery){
    query += `ALTER TABLE '${tableName}' ;`
    query += values.newColumnsQuery.join(',');
  }

  if (editedColumnsQuery){
    query += `ALTER TABLE '${tableName}' `
    query += editedColumnsQuery;
  }

  return query
}

function AlterTableForm({tableDetails, columnsDetails} : {tableDetails: TableDetails, columnsDetails: {column_name: string, data_type: string}[]}) {
  const [updateData, setUpdateData] = useState(false);
  const [newColumns, setNewColumns] = useState<{key: string, queryStr: string}[]>([]);
  const values = useRef({newSchema: "", newName: "", newColumnsQuery: [] as string[]})
  const existingColumnsAlterQuery = useRef("");

  existingColumnsAlterQuery.current = ""
  useEffect(() => {
    if (updateData) {
      values.current.newColumnsQuery = newColumns.map(queryObj => queryObj.queryStr);
      const query = generateAlterTableQuery(tableDetails.tableName, values.current, existingColumnsAlterQuery.current);
      console.log(query);
      /*fetch("http://localhost:4900/alter-table")
      .then(response => {
        if (response.ok) {
          // remove from alter table state
        }
      })*/
    }
  })

  function addColumnAlterQuery(newStr: string) {
    if (!existingColumnsAlterQuery.current)
      existingColumnsAlterQuery.current += newStr
    else
      existingColumnsAlterQuery.current += ',' + newStr;
  }

  function editTableProps(event: React.ChangeEvent<HTMLInputElement>) {
    const editedTableValues = values.current;

    switch(event.target.name) {
      case "new-table-name":
        editedTableValues.newName = event.target.value.trim();
        break;
      case "new-table-schema":
        editedTableValues.newSchema = event.target.value.trim();
        break;
    }
  }

  function updateValue(key: string, newQueryStr: string) {
    let updates = [...newColumns]
    for (let i=0; i< updates.length; i++) {
      if (updates[i].key === key){
        updates[i].queryStr = newQueryStr;
        setNewColumns(updates);
        break;
      }
    }
  }

  return (
    <section>
      {updateData && <p><strong><em>Loading...</em></strong></p>}
      <span>Rename Table: </span>
      <input name="new-table-name" type="text" defaultValue={tableDetails.tableName} onChange={editTableProps}/>
      <div></div>
      <span>Change Schema</span>
      <input name="new-table-schema" type="text" onChange={editTableProps}/>
      <h1>Columns</h1>
      {columnsDetails.map(column => (
        <AlterColumnInterface column={column} addColumnChanges={addColumnAlterQuery} getChanges={updateData} key={column.column_name}/>
      ))}
      <button onClick={()=>setNewColumns([...newColumns, {key: generateUniqueKey(), queryStr: ""}])}>Add column</button>
      {newColumns.map(columnData => <div key={columnData.key}>
        <label>newColumnQuery: </label>
        <input type="text" key={columnData.key} value={columnData.queryStr} onChange={(event)=>updateValue(columnData.key, event.target.value)}/>
        <button>remove</button>
      </div>)}
      <button onClick={()=>setUpdateData(!updateData)}>Update</button>
    </section>
  )
}

export function TableRowsDisplay({ displayType } : {displayType: string}) {
  const [displayData, setDisplayData] = useState<{displayName: string, data: GenericQueryData}|null>(null); // add display type on errors
  const [rowEditMode, setRowEditMode] = useState(false);
  const allTableDetails = useRef<GenericQueryData|null>(null)
  const serverConnString = useSelector(selectCurrentTab).serverConnString
  const tableDetails = useSelector(selectCurrentTab).dataDetails
  const dispatch = useDispatch()

  useEffect(() => {
    const longQuery = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE 
                        table_schema = '${tableDetails.schemaName}' AND table_name = '${tableDetails.tableName}';`
    const qualifiedTableName = `"${tableDetails.schemaName}"."${tableDetails.tableName}"`;
    Promise.all([
      getData(`SELECT ctid, * FROM ${qualifiedTableName};`, serverConnString), 
      getData(longQuery, serverConnString)
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

  async function dropTableAction({tableName, schemaName}: TableDetails, cascade: boolean) {
    const dbName = useContext(ParentDb)
    const results = await sendDropTableReq(dbName, `"${schemaName}"."${tableName}"`, cascade, serverConnString);
    if (results.errorMsg){
      alert(results.errorMsg)
    }else{
      // dispatch(tabSwitched({newPage: "dashboard"}))
      alert(`Table '${tableName}' deleted successfully!`)
    }
  }

  function tableBodyUpdateFn(newData: GenericQueryData) {
    setRowEditMode(false)
    setDisplayData({displayName: "Table Rows", data: newData})
  }

  function changeRowEditMode() {
    setRowEditMode(!rowEditMode)
  }

  function DisplayAlterTableForm() {
    setDisplayData({displayName: "Alter Table", data: displayData!.data})
  }

  return (
    <section>
      {displayData && displayData.displayName !== "loading" ? (
        <>{displayData.displayName === "Alter Table" && (
            <AlterTableForm tableDetails={tableDetails} columnsDetails={allTableDetails.current!.rows}/>
          )}

        {displayData && displayData.displayName !== "Alter Table" && (
          <>
            <h1>{displayData.displayName}</h1>
            <button className={rowEditMode ? "active" : ""} onClick={changeRowEditMode}>Rows edit mode</button>
            <button onClick={DisplayAlterTableForm} disabled={allTableDetails.current ? false : true}>alter table</button>
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
                editMode={rowEditMode}
                columnData={allTableDetails.current as GenericQueryData}/>
            </table>
            <button onClick={() => dispatch(pageChanged({newPage: "insert-form"}))}>insert</button>
            <button onClick={() => dropTableAction(tableDetails, true)}>Drop Table Cascade</button>
            <button onClick={() => dropTableAction(tableDetails, false)}>Drop Table Restrict</button>
          </>
        )}</>
      ) : <h2>Loading...</h2>}
    </section>
  )
}