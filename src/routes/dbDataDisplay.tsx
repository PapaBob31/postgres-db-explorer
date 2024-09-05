import { useState } from "react"
import { useLocation, redirect } from "react-router-dom";

function TableHeader({ headersList } : {headersList : string[]}) {
  let htmlElements = []; // come back to define the proper type
  for (let i=0; i<headersList.length; i++) {
    htmlElements.push(<th key={i}>{headersList[i]}</th>)
  }
  return <tr>{htmlElements}</tr>;
}

function TableBody({ headersList, data } : { headersList: string[], data: any[] }) {
  let rows = []; // come back to define the proper type
  let rowData:any = []; // come back to define the proper type
  data.forEach(entity => {
    for (let i=0; i<headersList.length; i++) {
      rowData.push(<td key={i}>{entity[headersList[i]]}</td>)
    }
    rows.push(<tr>{rowData}</tr>);
    rowData = [];
  })
  return <tbody>{rows}</tbody>
}

export async function getDbData():any {
  let responseDetails = {data: null, hasError: false}
  let response;

  try{
    response = await fetch('http://localhost:4900/', {
      credentials: "include",
      headers: {
        "Content-Type": "text/plain"
      }
    })
  }catch(error) { // Network error
    return null
  }

  if (response.ok){
    responseDetails.data = await response.json()
  }else{
    redirect("/connect-db");
  }
  
  return responseDetails.data;
}

export default function TableData() {
  let dbData = useLocation().state
  if (!dbData) {
    dbData = getDbData();
  }
  if (!dbData) {
    return <h1>Error! Couldn't connect to database. Check your internet connection and try again</h1>
  }
  const [data, setData] = useState<any>(dbData.data);

  let columns:string[] = [];
  if (data) {
    for (let attr in data.rows[0]) {
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