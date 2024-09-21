import { useState, useEffect, createContext, useRef, useContext } from "react"
import { DataDisplayFn } from "./dbDataDisplay"
export const TargetDb = createContext("")

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

function SchemaTables({tableList} : {tableList: string[]}) {
  const setDisplayData = useContext(DataDisplayFn);
  const targetDb = useContext(TargetDb);
  return (
    <ul>
      {tableList.map(tableName => (
        <li key={tableName}>
          <button className="table-btn" onClick={()=>{
            setDisplayData({type: "table-info", data: {targetDb, tableName}})}
          }>
            {tableName}
          </button>
        </li>)
      )}
    </ul>
  )
}

function Schema({name, tableList}: {name: string, tableList: string[]}) {
  const [visible, setVisible] = useState(false);
  const setDisplayData = useContext(DataDisplayFn);

  return (
    <>
      <button onClick={() => setVisible(!visible)}>{name}</button>
      {visible && (
        <>
          <SchemaTables tableList={tableList}/>
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
                  <Schema name={schema.name} tableList={schema.tables} />
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

export function TableDisplay({tableData} : {tableData: GenericQueryData}) {  
 return (tableData && (
  <section>
     <h1>Tables Data</h1>
     <table>
      <thead><TableHeader headersList={tableData.fields} /></thead>
      <TableBody headersList={tableData.fields} data={tableData.rows} />
    </table>
  </section>))
}