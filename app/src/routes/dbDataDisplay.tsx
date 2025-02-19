import { useState, useEffect, useRef } from "react"
import { TableRowsDisplay, NewTypeForm, DbDetails, RoleDetails, CreateRoleForm } from "./dbData"
import { CreateTable } from "./newTableForm";
import { useSelector, useDispatch } from "react-redux"
// import { ServerDetailsContext, generateUniqueId } from "../main"
import { type OpenedTabDetail, selectCurrentTab, tabClosed, selectTabs, tabSwitched } from "../store"
import { useForm, SubmitHandler } from "react-hook-form"
import { nanoid } from "nanoid"

export function getData(query: string, dbConnectionId: string) {
  return fetch("http://localhost:4900/query-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({connectionId: dbConnectionId, query}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}


function QueryResultTable({data} : {data: {fields: string[], rows: any[]}}) {
  const tableHeaderJSX = data.fields.map(field => <th>{field}</th>)
  const tableBodyJSX = [];

  for (let row of data.rows) {
    let rowJsx = []
    for (let field of data.fields) {
      rowJsx.push(<td>{row[field]}</td>)
    }
    tableBodyJSX.push(<tr>{rowJsx}</tr>)
  }
  return (
    <table>
      <thead><tr>{tableHeaderJSX}</tr></thead>
      <tbody>{tableBodyJSX}</tbody>
    </table>
  )
}


function SQLConsole() {
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const { dbConnectionId } = useSelector(selectCurrentTab).dataDetails;
  const [lastQueryData, setLastQueryData] = useState(null)

  async function runQuery() {
    const queryResult = await getData(textAreaRef.current!.value, dbConnectionId)
    setLastQueryData(queryResult.data) 
  }
  return (<>
    <button onClick={runQuery}>Run</button>
    <section id="sql-console">
      <textarea ref={textAreaRef} id="sql-console-input"></textarea>
      <section id="sql-console-output">
        {lastQueryData && <QueryResultTable data={lastQueryData}/>}
      </section>
    </section>
  </>)
}

function getInputDetails(container: HTMLDivElement) {
  let inputMappings: any = {};
  for (let childNode of container.children) {
    if ((childNode as HTMLElement).nodeName !== "INPUT")
      continue;
    let inputElement = childNode as HTMLInputElement;
    if (inputElement.type === "text"){
      inputMappings[inputElement.name] = `'${inputElement.value}'`
    }else inputMappings[inputElement.name] = inputElement.value;
  }
  return inputMappings;
}

function generateQueryFrom(tableName:string, formElement: HTMLFormElement, columnNames: string[]) { // Add strong measures against sql injections
  let newRowsData: {columnName: string}[] = []
  let rowValuesText = ""

  for (let childNode of formElement.children) {
    if (childNode.nodeName === "DIV") {
      newRowsData.push(getInputDetails(childNode as HTMLDivElement));
    }
  }

  for (let entry of newRowsData) {
    if (rowValuesText){
      rowValuesText += ", ("
    }else rowValuesText += '('

    for (let i=0; i<columnNames.length; i++) {
      if (i === columnNames.length-1)
        rowValuesText += entry[columnNames[i]]
      else
        rowValuesText += (entry[columnNames[i]] + ', ')
    }
    rowValuesText += ')'
  }

  let targetColumnsText = "";
  columnNames.forEach((name, i) => {
    if (i === 0)
      targetColumnsText += `"${name}"`;
    else
      targetColumnsText += `, "${name}"`;
  })
  return `INSERT INTO "${tableName}" (${targetColumnsText}) VALUES ${rowValuesText};`
}

function NewRowInput({columns, id, removeRowInput}: {columns: {column_name: string, data_type: string}[], id: number, removeRowInput: (num: number)=>void}) {
  return <div>{
    columns.map((columnDetails) => {
    const {column_name, data_type} = columnDetails;
    let inputType = "text"
    let numericTypes = ["bigint", "integer", "smallint", "numeric", "real", "double precision", "serial"]; // int2, int4, int8 ?

    if (numericTypes.includes(data_type))
      inputType = "number";

    return (
      <>
        <label htmlFor={column_name} key={column_name}>{column_name}</label>
        <input name={column_name} type={inputType} placeholder={data_type}/> {/*Change the input type for data types like boolean*/}
      </>
    )})
  }
    <button onClick={() => removeRowInput(id)}>X</button>
  </div>
}

function InsertForm() {
  const [columnData, setColumnData] = useState<any>(null);
  const {tableName, schemaName} = useSelector(selectCurrentTab).dataDetails;
  const query = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}' AND table_schema = '${schemaName}';`
  const [insertRowKeys, setInsertRowKeys] = useState<number[]>([1]);
  const freeKeys = useRef<number[]>([]);
  // const dispatch = useDispatch()
  const { dbConnectionId } = useSelector(selectCurrentTab).dataDetails

  useEffect(() => {
    getData(query, dbConnectionId)
    .then(responseData => setColumnData(responseData.data))
  }, [])

  function removeRowInput(rowKey: number) {
    setInsertRowKeys(insertRowKeys.filter((key)=>key!==rowKey));
    freeKeys.current.push(rowKey);
  }

  function addNewRowInput() {
    let newKey = -1;
    if (freeKeys.current.length > 0) {
      newKey = freeKeys.current.pop() as number;
    }else {
      newKey = Math.max(...insertRowKeys)+1;
    }
    setInsertRowKeys([...insertRowKeys, newKey]);
  }

  function insertDataIntoTable(event) {
    event.preventDefault();
    const form = event.target;
    const query = generateQueryFrom(tableName, form, columnData.rows.map(column => column.column_name));
    fetch("http://localhost:4900/mutate-dbData", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({connectionId: dbConnectionId, query, queryType: "insert"}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(`${responseBody.errorMsg} Please try again!`)
      }else {
        alert(`${responseBody.msg} new rows uploaded successfully!`)
        // dispatch(pageChanged({newPage: "table-rows-data"}))
      }
    })
  }

  return (
    <>
      <em>Maybe empty columns will be replaced with defaults</em>
      {columnData ? (
        <form onSubmit={insertDataIntoTable}>
          {insertRowKeys.map((key) => <NewRowInput columns={columnData.rows} key={key} id={key} removeRowInput={removeRowInput}/>)}
          <button onClick={addNewRowInput} type="button">Add</button>
          <button type="submit">Insert</button>
        </form>
      ) : <h2>Loading...</h2>}
    </>
  )   
}


interface IndexDetails {
  id: string;
  indexname: string;
  indexdef: string;
  tablespace: string;
}

function TableIndex({ details, removeFromDisplay, updateIndexes } : 
  {details: IndexDetails, removeFromDisplay: (name: string) => void, updateIndexes: (id: string, key: "indexname"|"tablespace", value: string) => void}) {
  const {dbConnectionId, schemaName} = useSelector(selectCurrentTab).dataDetails
  const [indexDefVisible, setIndexDefVisible] = useState(false);
  const [dropParam, setDropParam] = useState<"CONCURRENTLY"|"CASCADE"|"">("")
  const [indexDropOptionsVisible, setIndexDropOptionsVisible] = useState(false)
  const [valuesToEdit, setValuesToEdit] = useState<("indexName"|"indexTableSpace")[]>([])
  const nameInputRef = useRef<HTMLInputElement>(null);
  const tableSpaceInputRef = useRef<HTMLInputElement>(null);
  // continue from here, alter table commands implementation
  function changeDropParam(newValue: "CONCURRENTLY"|"CASCADE") {
    if (newValue === dropParam) {
      setDropParam("")
    }else setDropParam(newValue)
  }

  function sendIndexDropRequest() {
    const query = `DROP INDEX ${dropParam === "CONCURRENTLY" ? dropParam : ""} "${schemaName}"."${details.indexname}" ${dropParam === "CASCADE" ? dropParam : ""}`
    fetch("http://localhost:4900/drop-index", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({connectionId: dbConnectionId, query})
    })
    .then(response => {
      if (response.ok) {
        return response.json()
      }else {
        return null
      }
    }).then(responseBody => {
      if (responseBody.errorMg) {
        alert(responseBody.errorMsg)
      }else {
        removeFromDisplay(details.indexname)
      }
    })
  }

  function editValue(value: "indexName"|"indexTableSpace") {
    if (!valuesToEdit.includes(value)) {
      setValuesToEdit([...valuesToEdit, value])
    }
  }

  function cancelEditState(valueToCancel: "indexName"|"indexTableSpace") {
    setValuesToEdit(valuesToEdit.filter(value => value !== valueToCancel))
  }


  function changeIndexName() {
    fetch("http://localhost:4900/rename-index", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({connectionId: dbConnectionId, oldName: details.indexname, newName: nameInputRef.current!.value})
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(responseBody.errorMsg)
      }else {
        updateIndexes(details.id, "indexname", nameInputRef.current!.value) 
      }
      setValuesToEdit(valuesToEdit.filter(value => value !== "indexName"))
    })
    .catch(err => {
      alert("Internal Server Error!")
      console.log(err.message)
    })
  }

  function changeIndexTableSpace() {
    fetch("http://localhost:4900/set-index-tablespace", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({connectionId: dbConnectionId, indexName: details.indexname, tableSpace: tableSpaceInputRef.current!.value})
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(responseBody.errorMsg)
      }else {
        updateIndexes(details.id, "tablespace", tableSpaceInputRef.current!.value) 
      }
      setValuesToEdit(valuesToEdit.filter(value => value !== "indexTableSpace"))
    })
    .catch(err => {
      alert("Internal Server Error!")
      console.log(err.message)
    })
  }

  console.log(details.tablespace)

  return (
    <section>
      <div>
        <h1>Index Name</h1>
        {valuesToEdit.includes("indexName") ? <input defaultValue={details.indexname} ref={nameInputRef}/> : <span className="inline">{details.indexname}</span>}
        {valuesToEdit.includes("indexName") ? 
          <><button onClick={changeIndexName}>update</button><button onClick={() => cancelEditState("indexName")}>x</button></> : 
          <button onClick={() => editValue("indexName")}>edit</button>}
      </div>
      <div>
        <p className="inline">
          <strong>tablespace:</strong>
          {valuesToEdit.includes("indexTableSpace") ? 
            <input defaultValue={details.tablespace ? details.tablespace : 'null'} ref={tableSpaceInputRef}/> : 
            (details.tablespace ? details.tablespace : 'null')
          }
          {valuesToEdit.includes("indexTableSpace") ? 
            <><button onClick={changeIndexTableSpace}>update</button><button onClick={() => cancelEditState("indexTableSpace")}>x</button></> : 
            <button onClick={() => editValue("indexTableSpace")}>edit</button>
          }
        </p>
      </div>

      <button onClick={() => setIndexDefVisible(!indexDefVisible)}>indexDef</button>
      {indexDefVisible && <textarea style={{width: "400px"}}>{details.indexdef}</textarea>}

      <button onClick={() => setIndexDropOptionsVisible(!indexDropOptionsVisible)}>Drop</button>
      {indexDropOptionsVisible && <div style={{width: "400px", backgroundColor: "lightgray"}}>
        <label style={{display: "block"}} htmlFor="concurrently">
          CONCURRENTLY
          <input type="checkbox" name="concurrently" checked={dropParam === "CONCURRENTLY"} onChange={() => changeDropParam("CONCURRENTLY")}/>
        </label>
        <label style={{display: "block"}} htmlFor="cascade">
          CASCADE
          <input type="checkbox" name="cascade" checked={dropParam === "CASCADE"} onChange={() => changeDropParam("CASCADE")}/>
        </label>
        <button onClick={sendIndexDropRequest}>DROP INDEX</button>
      </div>}
    </section>
  )

}

interface IndexFormValues {
  indexName: string;
  unique: boolean;
  concurrently: boolean;
  only: boolean;
  method: string;
  columnNameOrExpression: string;
  nullsNotDistinct: boolean;
}

function generateQuery(formData: IndexFormValues, tableName: string, schemaName: string) {
  const uniqueParam = formData.unique  ? "UNIQUE" : ""
  const concurrentlyParam = formData.concurrently ? "CONCURRENTLY" : ""
  const onlyParam = formData.only ? " ONLY " : " "
  const nndParam = formData.nullsNotDistinct ? "NULLS NOT DISTINCT" : ""
  return `CREATE ${uniqueParam} INDEX ${concurrentlyParam} ${formData.indexName} ON 
      ${onlyParam} "${schemaName}"."${tableName}" USING ${formData.method} (${formData.columnNameOrExpression}) ${nndParam}`

}

function TableIndexes({visible}: {visible: boolean}) {
  const {dbConnectionId, schemaName, tableName} = useSelector(selectCurrentTab).dataDetails
  const [indexes, setIndexes] = useState<IndexDetails[]>([])
  const [newIndexFormVisisble, setNewIndexFormVisible] = useState(false)
  const { handleSubmit, register } = useForm<IndexFormValues>()
  const [reload, setReload] = useState(true)

  function removeIndex(indexName: string) {
    const newIndexDetails = indexes.filter(index => index.indexname !== indexName)
    setIndexes(newIndexDetails);
  }

  function updateIndexes(id: string, key: "indexname"|"tablespace", value: string) {
    const updatedIndexes = [...indexes];
    const indexToUpdate = updatedIndexes.find(detail => detail.id === id);
    if (!indexToUpdate) {
      console.log("Index to update doesn't exist")
      return;
    }
    indexToUpdate[key] = value;
    setIndexes(updatedIndexes)
  }

  useEffect(() => {
    if (reload == false)
      return
    fetch("http://localhost:4900/table-indexes", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({connectionId: dbConnectionId, tableName, schemaName})
    })
    .then(response => {
      if (response.ok)
        return response.json()
      else return null
    })
    .then(responseBody => {
      if (responseBody && !responseBody.errorMsg) {
        const newIndexDetails = responseBody.data.rows.map(row => {return {...row, id: nanoid()}})
        setIndexes(newIndexDetails)
      }else if (responseBody) {
        alert(responseBody.errorMsg)
      }else {
        alert("Something went wrong while trying to get table's index details")
      }
      setReload(false)
    })
  }, [reload])

  const onSubmit: SubmitHandler<IndexFormValues> = (data) => {
    const query = generateQuery(data, tableName, schemaName);
    fetch("http://localhost:4900/create-index", {
      method: "POST",
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({connectionId: dbConnectionId, query})
    })
    .then(response => {
      if (response.ok) {
        return response.json()
      }else return null
    })
    .then(responseBody => {
      if (!responseBody.errorMsg) {
        setReload(true)
        setNewIndexFormVisible(false)
      }else {
        alert(responseBody.errorMsg)
      }
    })
    .catch(err => console.log(err))
  }
  return (
    <section style={{display: visible ? "block" : "none"}}>
      <h1>Table Indexes</h1>
      {indexes.map(details => <TableIndex key={details.id} details={details} removeFromDisplay={removeIndex} updateIndexes={updateIndexes}/>)}
      <button onClick={() => setNewIndexFormVisible(true)}>New Index</button>
      {newIndexFormVisisble && <form onSubmit={handleSubmit(onSubmit)}>
        <button onClick={() => setNewIndexFormVisible(false)}>x</button>
        <label className="block">index name</label>
        <input type="text" {...register("indexName", {required: true})}/>
        <label className="block">Unique</label>
        <input type="checkbox" {...register("unique")}/>
        <label className="block">Concurrently</label>
        <input type="checkbox" {...register("concurrently")}/>
        <label className="block">Only</label>
        <input type="checkbox" {...register("only")}/>
        <label className="block">Method</label>
        <select {...register("method")}>
          <option>btree</option>
          <option>hash</option>
          <option>gist</option>
          <option>spgist</option>
          <option>gin</option>
          <option>brin</option>
        </select>
        <label className="block">column name/expression</label> {/*todo: seperate column name and expression such that both can't be filled at the same time*/}
        <input type="text" title="You must add parenthesis if you mean an expression" {...register("columnNameOrExpression", {required: true})}/>
        <label className="block">Nulls not distinct</label>
        <input type="checkbox" {...register("nullsNotDistinct")}/>
        <button type="submit">Create Index</button>
      </form>}
    </section>
  )
}

/*
  Displays columns and rows 
  under the column section, you can do things like alter column, add column but with a gui
  under the row secton, you can query rows but with gui

  Is the way below the best way to actually do conditional rendering?
*/
function TableInfo({ currentDisplay } : {currentDisplay: string}) {
  const [display, setDisplay] = useState(currentDisplay)
  const tableDetails = useSelector(selectCurrentTab).dataDetails
  // view and create indexes on the table
  
  return (
    <section>
      <h1>{tableDetails.tableName}</h1>
      <p><b>Table Owner?</b></p>
      <p><b>Number of row in the table</b></p>
      <p><b>RLS policies</b></p>

      {display !== "root" && (
        <nav>
          <button onClick={()=>setDisplay("root")}>root</button> 
          <button disabled>{display}</button>
        </nav>
      )}
     {display === "root" && (
       <nav>
        <button onClick={()=>setDisplay("Table Columns")}>Columns</button> 
        <button onClick={()=>setDisplay("Table Rows")}>Rows</button>
        <button onClick={()=>setDisplay("indexes")}>Indexes</button>
      </nav>)}
     {(display === "Table Rows" || display === "Table Columns") && <TableRowsDisplay displayType={display}/>}
     <TableIndexes visible={display === "indexes"}/>
     {display === "insert-form" && <InsertForm />}
    </section>
  )
}

// todo: find a way to limit the possible key types
const stateDisplayMap: {[key: string]: JSX.Element} = {
  "db-details": <DbDetails/>,
  "new-type-form": <NewTypeForm/>,
  "create-table-form": <CreateTable />,
  "table-info": <TableInfo currentDisplay="root" />,
  "table-rows-data": <TableInfo currentDisplay="Table Rows"/>,
  "table-columns-data": <TableInfo currentDisplay="Table Columns"/>,
  "insert-form": <InsertForm />,
  "SQL-Console": <SQLConsole/>,
  "role-details": <RoleDetails/>,
  "create-role-form": <CreateRoleForm/>
}

function TabBtn( { tabDetail } : {tabDetail: OpenedTabDetail}) {
  const dispatch = useDispatch()
  const currentTab = useSelector(selectCurrentTab);

  function closeTab() {
    dispatch(tabClosed({closedTabId: tabDetail.tabId}))  
  }

  function switchTabs() {
    if (currentTab.tabId !== tabDetail.tabId) {
      dispatch(tabSwitched(tabDetail.tabId))
    }
  }
  
  return (
    <div onClick={switchTabs}>
      <span>{tabDetail.tabName}</span>
      <button onClick={closeTab}><b>x</b></button>
    </div> 
  )
}


function Tabs({ tabDetails } : {tabDetails: OpenedTabDetail[]}) {
  return (
    <ul>
      {tabDetails.map(detail => <TabBtn tabDetail={detail} key={detail.tabId}/>)}
    </ul>
  )
}

function DataDisplay() {
  const openedTabs = useSelector(selectTabs).openedTabs
  const currentTab = useSelector(selectCurrentTab);

  return (
    <section>
      {currentTab && (<>
        <Tabs tabDetails={openedTabs} />
        {stateDisplayMap[currentTab.tabType]}
      </>)}
    </section>
  )
}

export default function DbDataDisplay() {
  return <DataDisplay/>
}


/*
  create role, set role privieges, group role, drop role, REASSIGN_OWNED, DROP_OWNED
  (For maximum security, issue the REVOKE in the same transaction that creates the object; then there is no window in which another user can use the object.)
  Database roles are global across a database cluster installation (and not per individual database).
  switching connected roles

  YOU SHOULD ALWAYS SEE THINGS LIKE THE ROLE YOU ARE CONNECTED AS AND THE DB YOU AR CONNECTED TO

  roles can be created with privileges
  roles can be user roles or group roles
  inherit, noinherit
  The role attributes LOGIN, SUPERUSER, CREATEDB, and CREATEROLE can be thought of as special privileges, 
  but they are never inherited as ordinary privileges on database objects are.
  change session default variables
  role interfaces
   create role with the appropriate privileges
   add and remove members 
   GRANT, ALTER , REVOKE, DROP

  FUNCTIONALITY to manage databases
  PostgreSQL server provides a large number of run-time configuration variables. You can set database-specific default values for many of these settings.
  drop database
  ALWAYS REMEMBER THAT THE GOAL IS TO MAKE IT WAY EASIER THAN TYPING THE COMMANDS MANUALLY
  try and reduce the number of clicks needed to at most 3 before getting to use any ui features
  Change data fetching mechanism to tan stack query or react query
  Implement checking if a table exists before query incase a 
  previously existing table has been deleted outside the guis
  maybe put some state update logic inside a reducer
  try setting an identifier name to exceed the NAMEDATALEN limit in the gui
  quoted identifier
  Implement measures and checks for data that has already been edited in the db but the old value is still being displayed here
  when writing the insert interface, try and check data types like character varying for correctness before sending it off to the server

   Foreign data wrappers (see postgres_fdw) allow for objects within one database to act as proxies for objects in other database or clusters.
   The older dblink module (see dblink) provides a similar capability.
   inform users probably in the docs that they don't need to add double quites when pputting in their own text or something
*/