import { useState, useEffect, createContext, useRef } from "react"
import { DataBases, Roles, TableDisplay } from "./dbData"
import { CreateTable } from "./newTableForm";
// import { TargetDb } from "./dbData"
export const DataDisplayFn = createContext((dataDetail: {type: string, data: any})=>{});


function ClusterLevelObjects({ displayDbForm, targetDb }: {displayDbForm: () => void, targetDb: string}) {
  
  const [data, setData] = useState<{roles: string[], dataBases: string[]}>({roles: [], dataBases: []});
  useEffect(() => {
    if (!targetDb) {
      displayDbForm()
      return
    }
    fetch("http://localhost:4900", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        displayDbForm()
      }else {
        setData(responseBody.data)
      }
    })
    .catch(() => alert("Internet connection Error: Check your internet connection and if the database is reachable"))
  }, [])
  
  return (
    <section id="cluster-lvl-objs">
      {data && (
        <>
          <Roles dbClusterRoles={data.roles} />
          <DataBases clusterDbs={data.dataBases} initDb={targetDb} />
        </>
      )}
    </section>
  )
}

export function getData(targetDb: string, query: string) {
  return fetch("http://localhost:4900/query-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({targetDb, query}) // TODO: limit the amount of data sent back
  }).then(response => response.json())
}

function setDisplayData(data: any, setDisplay: (a: any)=>void, displayType: string) {
  if (data.errorMsg){
      alert(data.errorMsg)
  }else {
    setDisplay({type: displayType, data: data.data})
  }
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

function InsertForm({tableDetails, changeDisplay}:{tableDetails: {tableName: string, targetDb: string, schemaName: string}, changeDisplay: (display: string) => void}) {
  const [columnData, setColumnData] = useState<any>(null);
  const {targetDb, tableName, schemaName} = tableDetails;
  const query = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}' AND table_schema = '${schemaName}';`
  const [insertRowKeys, setInsertRowKeys] = useState<number[]>([1]);
  const freeKeys = useRef<number[]>([]);

  useEffect(() => {
    getData(targetDb, query)
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
      body: JSON.stringify({targetDb, query, queryType: "insert"}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(`${responseBody.errorMsg} Please try again!`)
      }else {
        alert(`${responseBody.rowCount} new rows uploaded successfully!`)
        changeDisplay("table-rows")
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

/*
  Displays columns and rows 
  under the column section, you can do things like alter column, add column but with a gui
  under the row secton, you can query rows but with gui

  Is the way below the best way to actually do conditional rendering?
*/
function TableInfo({tableDetails, displayType}:{tableDetails: {tableName: string, targetDb: string, schemaName: string}, displayType: string}) {
  const [display, setDisplay] = useState(displayType)
  
  return (
    <section>
      <h1>{tableDetails.tableName}</h1>
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
      </nav>)}
     {(display === "Table Rows" || display === "Table Columns") && <TableDisplay tableDetails={tableDetails} displayType={display}/>}
     {display === "insert-form" && <InsertForm tableDetails={tableDetails} changeDisplay={setDisplay}/>}
    </section>
  )
}

export default function Main({ showDbConnectForm, dbName }: {showDbConnectForm: () => void, dbName: string}) {
  // const [tableData, setTableData] = useState(null);
  const [displayInfo, setDisplayInfo] = useState<{type: string, data: any}>({type: "", data: null})
  return (
    <DataDisplayFn.Provider value={setDisplayInfo}>
      <ClusterLevelObjects displayDbForm={showDbConnectForm} targetDb={dbName} />
      {displayInfo.type === "create-table-form" && <CreateTable targetDb={dbName}/>}
      {displayInfo.type === "table-info" && <TableInfo tableDetails={displayInfo.data} displayType={"root"}/>}
      {displayInfo.type === "insert-form" && <TableInfo tableDetails={displayInfo.data} displayType={"insert-form"}/>}
      {/*displayInfo.type === "table-data" && <TableDisplay tableData={displayInfo.data} /> */}
    </DataDisplayFn.Provider>
  )
}


/*
  Change data fetching mechanism to tan stack query or react query
  Implement checking if a table exists before query incase a 
  previously existing table has been deleted outside the guis
  maybe put some state update logic inside a reducer
  try setting an identifier name to exceed the NAMEDATALEN limit in the gui
  quoted identifier
  single quotes delimit string constants
  Implement measures and checks for data that has already been edited in the db but the old value is still being displayed here
  when writing the insert interface, try and check data types like character varying for correctness before sending it off to the server
*/