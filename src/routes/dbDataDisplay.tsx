import { useState, useEffect } from "react"
import { useLocation } from "react-router-dom";

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



function TableDisplay() {
  

  let columns:string[] = [];
  let data = dbConnInfo.data;
  if (data) {
    for (let attr in data.rows[0]) { // first row is picked only since all the other objs will have same attributes
      columns.push(attr);
    }
  }
  
 return data ?
    (<><h1>Tables in the Public schema</h1>
     <table>
      <thead><TableHeader headersList={columns} /></thead>
      <TableBody headersList={columns} data={data.rows} />
    </table></>) : <h2>Omo! no data oo</h2>
}


function Roles({dbClusterRoles} : {dbClusterRoles: any}) {
  const listItems = [];
  for (let data of dbClusterRoles.rows) {
    listItems.push(<li><button>{data[dbClusterRoles.fields[0].name]}</button></li>)
  }
  return (
    <section id="cluster-roles">
      <h2>Roles</h2>
      <ul>
        {listItems}
      </ul>
    </section>
    
  )
}


function DataBases({clusterDbs}:{clusterDbs: any}) {
  const listItems = []
  for (let data of clusterDbs.rows) {
    listItems.push(<li><button>{data[clusterDbs.fields[0].name]}</button></li>)
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


function ClusterLevelObjects({dataBases, roles} : {dataBases: any, roles: any}) {
  return (
    <section id="cluster-lvl-objs">
      <Roles dbClusterRoles={roles} />
      <DataBases clusterDbs={dataBases} />
    </section>
  )
}

export default function Main() {
  let dbData = useLocation().state || {errorMsg: "", loading: true, data: null} // look into it. It seems to persist data across sessions
  const [dbConnInfo, setData] = useState<any>(dbData);

  useEffect(() => {
    if (!dbConnInfo.loading) return;
    fetch('http://localhost:4900/', {
      credentials: "include",
      headers: {
        "Content-Type": "text/plain"
      }
    })
    .then((response) => response.json())
    .then((resBody) => setData(resBody))
    .catch((error) => {
      console.log(error)
      setData({errorMsg: "Internet connection Error: Check your internet connection and if the database is reachable", data: null, loading: false})
    })
  }, [])


  if (dbConnInfo.loading) {
    return <h1>Loading...</h1>
  }else if (dbConnInfo.errorMsg) {
    return <h1>{dbConnInfo.errorMsg}</h1>
  }

  return (
    <>
      <ClusterLevelObjects dataBases={dbConnInfo[0]} roles={dbConnInfo[1]}/>
      <section></section>
      {/*<TableDisplay/>*/}
    </>
  )
}