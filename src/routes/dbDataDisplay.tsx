import { useState } from "react"
import { useLoaderData, redirect } from "react-router-dom";

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

export function getDbData():any {
  let responseDetails = {data: null, hasError: false}
  fetch('http://localhost:4900/', {
    credentials: "include",
  }) 
  .then(response => {
    if (response.ok) {
      return response.json()
    }
  })
  .then (response => {responseDetails.data = response})
  .catch((error) =>  responseDetails.hasError = true)
  if (responseDetails.hasError)
    return redirect("/connect-db");
  return responseDetails.data;
}

export default function TableData() {
  const dbData = useLoaderData();
  const [data, setData] = useState<any>(dbData);

  let columns:string[] = [];

  for (let attr in data.rows[0]) {
    columns.push(attr);
  }
  return (
    <table>
      <thead><TableHeader headersList={columns} /></thead>
      <TableBody headersList={columns} data={data.rows} />
    </table>
  )
}