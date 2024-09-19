import { useState, useEffect, createContext, useContext } from "react"
import { useLocation, useNavigate } from "react-router-dom";
import { DataBases, Roles, TableDisplay } from "./dbData"
import { CreateTable } from "./newTableForm";
import { TargetDb } from "./dbData"
export const DataDisplay = createContext(null);

function ClusterLevelObjects() {
  const navigate = useNavigate();
  let initialConnectedDb = useLocation().state;
  if (!initialConnectedDb) {
    navigate("/connect-db")
  }
  const [data, setData] = useState<{roles: string[], dataBases: string[]}>(null);
  useEffect(() => {
    fetch("http://localhost:4900", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb: initialConnectedDb}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        navigate("/connect-db")
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
          <DataBases clusterDbs={data.dataBases} />
        </>
      )}
    </section>
  )
}

function getData(targetDb: string, query: string) {
  return fetch("http://localhost:4900/query-table", {
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    method: "POST",
    body: JSON.stringify({targetDb, query}) // TODO: limit the amount of data sent back
  })
}

/*
  Displays columns and rows 
  under the column section, you can do things like alter column, add column but with a gui
  under the row secton, you can query rows but with gui

  Is the way below the best way to actually do conditional rendering?
*/
function TableInfo({tableName}:{tableName: string}) {
  const [display, setDisplay] = useState({type: "root", data: null})
  const targetDb = useContext(TargetDb);

  function displayRows() { 
    getData(targetDb, `SELECT * FROM ${tableName};`)
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg){
        alert(responseBody.errorMsg)
      }else {
        setDisplay({type: "table-rows", data: responseBody.data})
      }
    }) 
  }

  function displayColumns() {
    console.log(tableName);
    getData(targetDb, `SELECT column_name, data_type FROM INFORMATION_SCHEMA.COLUMNS WHERE table_name = '${tableName}';`)
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg){
        alert(responseBody.errorMsg)
      }else {
        console.log(responseBody.data);
        setDisplay({type: "table-columns", data: responseBody.data})
      }
    })
  }
  return (
    <section>
    {display.type !== "root" && (
      <nav>
        <button onClick={()=>setDisplay({type: "root", data: null})}>root</button> 
        <button>{display.type}</button>
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

export default function Main() {
  // const [tableData, setTableData] = useState(null);
  const [displayInfo, setDisplayInfo] = useState({type: "", data: null})
  return (
    <DataDisplay.Provider value={setDisplayInfo}>
      <ClusterLevelObjects />
      {displayInfo.type === "create-table-form" && <CreateTable/>}
      {displayInfo.type === "table-info" && <TableInfo tableName={displayInfo.data}/>}
      {/*displayInfo.type === "table-data" && <TableDisplay tableData={displayInfo.data} /> */}
    </DataDisplay.Provider>
  )
}


/*
  Implement checking if a table exists before query incase a 
  previously existing table has been deleted outside the guis
  maybe put some state update logic inside a reducer
  try setting an identifier name to exceed the NAMEDATALEN limit in the gui
  quoted identifier
  single quotes delimit string constants
*/