import { createBrowserRouter, RouterProvider } from "react-router-dom";

// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import ConnectDbForm from "./routes/dbConnect"
import Main from "./routes/dbDataDisplay"


function Column(){
  let postgreSqlTypes = [
    "bigint", "bit", "bit varying", "boolean", "char", "character varying", "character",
    "varchar", "date", "double precision", "integer", "interval", "numeric", "decimal",
    "real", "smallint", "time", "timestamp", "xml", "smallserial", "serial", "bigserial",
    "text", "bytea", "timestamp", "date", "time", "interval", "timestamptz", "boolean", "enum",
    "points", "lines", "line segments", "boxes", "paths", "polygons", "circles", "inet", "cidr",
    "macaddr", "macaddr8", "tsquery", "tsvector", "uuid", "xml", "json", "jsonb", "Array", 
    "composite types", "ranges", "domain types", "oids", "pg_lsn", "pseudo types"
  ]
  let htmlOptionElems = postgreSqlTypes.map((option) => <option>{option}</option>)
  return (
    <div>
      <select>
       {htmlOptionElems}
      </select>
      <input type="text"/>
    </div>
  )
}


const router = createBrowserRouter([
  {
    path: "/",
    element: <Main />,
  },
  {
    path: "/connect-db",
    element: <ConnectDbForm />,
  }
])

// Handle strict mode effect of causing double requests to database
createRoot(document.getElementById('root')!).render(
   // making alot of requests and strict mode is doubling the load
   <RouterProvider router={router} />
)
