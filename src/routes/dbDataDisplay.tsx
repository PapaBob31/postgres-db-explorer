import { useState, useEffect, createContext, useRef, useContext } from "react"
import { useLocation, useNavigate } from "react-router-dom";

const DataDisplay = createContext(null);
const TargetDb = createContext("")

function TableHeader({ headersList } : {headersList : string[]}) {
  let htmlElements = []; // come back to define the proper type
  for (let i=0; i<headersList.length; i++) {
    htmlElements.push(<th key={i}>{headersList[i]}</th>)
  }
  return <tr>{htmlElements}</tr>;
}

function TableBody({ headersList, data } : { headersList: string[], data: any[] }) {
  let rows:any = [];
  let rowData:any[] = [];
  data.forEach(entity => {
    for (let i=0; i<headersList.length; i++) {
      rowData.push(<td key={i}>{entity[headersList[i]]}</td>)
    }
    rows.push(<tr>{rowData}</tr>);
    rowData = [];
  })
  return <tbody>{rows}</tbody>
}


function Roles({dbClusterRoles} : {dbClusterRoles: string[]}) {
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

function SchemaTables({tableList} : {tableList: string[]}) {
  const setDisplayData = useContext(DataDisplay);
  const targetDb = useContext(TargetDb);

  function getDataAndSetDisplay(tableName: string){ // useMemo for this or something like that so that when next It's clicked
    fetch("http://localhost:4900/query", {
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      method: "POST",
      body: JSON.stringify({targetDb, query: `SELECT * FROM ${tableName}`})
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg){
        alert(responseBody.errorMsg)
      }else {
        setDisplayData(responseBody.data)
      }
    })
    
  }
  return (
    <ul>
      {tableList.map(tableName => (
        <li key={tableName}>
          <button className="table-btn" onClick={()=>{getDataAndSetDisplay(tableName)}}>{tableName}</button>
        </li>)
      )}
    </ul>
  )
}

function Schema({name, tableList}: {name: string, tableList: string[]}) {
  const [visible, setVisible] = useState(false);

  return (
    <>
      <button onClick={() => setVisible(!visible)}>{name}</button>
      {visible && <SchemaTables tableList={tableList}/>}
    </>
  )
}


function DataBase({dbName, initDb}: {dbName: string, initDb: string}) {
  const schemas = useRef<{name: string; tables: string[];}[]>([]);
  const [dbObjectsVisible, setDbObjectsVisible] = useState(false)

  useEffect(() => {
    if (initDb === dbName){
      fetchDbDetails()
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
  }, [dbName])

  function fetchDbDetails() {
    return fetch("http://localhost:4900/get-db-details", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb: dbName})
    })
  }

  function toggleChildrenVisibilty() {
    if (dbObjectsVisible){
      setDbObjectsVisible(false);
      return;
    }else if (schemas.current.length === 0) {
      fetchDbDetails()
      .then(response => response.json())
      .then(responseBody => {
        if (responseBody.errorMsg) {
          alert(responseBody.errorMsg)
        }else {
          schemas.current = responseBody.data
          setDbObjectsVisible(true)
        }
      })
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
                  <Schema name={schema.name} tableList={schema.tables} />
                </li>
            ))}
          </ul>
        )}
      </TargetDb.Provider>
    </li>
  )
}


function DataBases({clusterDbs}:{clusterDbs: string[]}) {
  let initialConnectedDb = useLocation().state; // look into it. It seems to persist data across sessions
  const listItems = [];
  for (let dbName of clusterDbs) {
    listItems.push(<DataBase dbName={dbName} key={dbName} initDb={initialConnectedDb}/>)
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



function ClusterLevelObjects() {
  const navigate = useNavigate();
  let initialConnectedDb = useLocation().state;
  if (!initialConnectedDb) {
    navigate("/connect-db")
  }
  console.log(initialConnectedDb, 0);
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


interface GenericQueryData {
  rows: any[];
  fields: string[];
}

function TableDisplay({tableData} : {tableData: GenericQueryData}) {
  console.log(tableData, 56);
  
 return (tableData && (
  <section>
     <h1>Tables Data</h1>
     <table>
      <thead><TableHeader headersList={tableData.fields} /></thead>
      <TableBody headersList={tableData.fields} data={tableData.rows} />
    </table>
  </section>))
}

export default function Main() {
  const [tableData, setTableData] = useState(null);
  return (
    <DataDisplay.Provider value={setTableData}>
      <ClusterLevelObjects />
      <TableDisplay tableData={tableData} />
    </DataDisplay.Provider>
  )
}