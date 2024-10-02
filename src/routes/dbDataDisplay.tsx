import { useState, useEffect, createContext } from "react"
import { DataBases, Roles, TableDisplay } from "./dbData"
import { CreateTable } from "./newTableForm";
// import { TargetDb } from "./dbData"
export const DataDisplayFn = createContext(()=>{});


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

function getAndSetData(targetDb: string, query: string, setDisplay: (a: any)=>void, displayType: string) {
  return fetch("http://localhost:4900/query-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({targetDb, query}) // TODO: limit the amount of data sent back
  })
  .then(response => response.json())
  .then(responseBody => {
    if (responseBody.errorMsg){
      alert(responseBody.errorMsg)
    }else {
      setDisplay({type: displayType, data: responseBody.data})
    }
  })
}

function InsertForm() {
  return (
    <form>
      
    </form>
  )
}

/*
  Displays columns and rows 
  under the column section, you can do things like alter column, add column but with a gui
  under the row secton, you can query rows but with gui

  Is the way below the best way to actually do conditional rendering?
*/
function TableInfo({tableDetails}:{tableDetails: {tableName: string, targetDb: string}}) {
  const [display, setDisplay] = useState({type: "root", data: null})
  const {targetDb, tableName} = tableDetails;
  function displayRows() { 
    getAndSetData(targetDb, `SELECT * FROM "${tableName}";`, setDisplay, "table-rows") // will these quotes affect case sensitivity?
  }

  function displayColumns() {
    const query = `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}';`
    getAndSetData(targetDb, query, setDisplay, "table-columns")
  }
  return (
    <section>
    <h1>{tableName}</h1>
    {display.type !== "root" && (
      <nav>
        <button onClick={()=>setDisplay({type: "root", data: null})}>root</button> 
        <button disabled>{display.type}</button>
      </nav>
    )}
     {display.type === "root" && (
       <ul>
        <button onClick={()=>displayColumns()}>Columns</button> 
        <button onClick={()=>displayRows()}>Rows</button>
      </ul>)}
     {display.type === "table-rows" && <TableDisplay tableData={display.data as any}/>}
     {display.type === "table-columns" && <TableDisplay tableData={display.data as any}/>}
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
      {displayInfo.type === "table-info" && <TableInfo tableDetails={displayInfo.data} />}
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
  when writing the insert interface, try and check data types like character varying for correctness before sending it off to the server
*/