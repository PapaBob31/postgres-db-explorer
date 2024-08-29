import { useEffect, useState } from "react"
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

export function connectSomething() {
	return redirect("/connect-db");
}

export default function TableData() {
  // useEffect(()=> {
  //   fetch('http://localhost:4900') 
  //   .then(response => {
  //     if (response.ok) {
  //       return response.json()
  //     }
  //   })
  //   .then (response => setData(response))
  //   .catch((error) => console.log(error))
  // }, [])
  
  const connectionURI = useLoaderData();
  console.log(connectionURI);
  const [data, setData] = useState<any>(null);

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