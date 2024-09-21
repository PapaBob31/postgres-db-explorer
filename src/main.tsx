import { useState, useRef } from "react"
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import ConnectDbForm from "./routes/dbConnect"
import DbDataDisplay from "./routes/dbDataDisplay"

function Main(){
  const [formVisible, setFormVisible] = useState(false);
  const initDbName = useRef("");

  function setDbDetails(dbName: string) {
      initDbName.current = dbName;
      setFormVisible(false);
  }

  if (formVisible){
    return <ConnectDbForm setDbDetails={setDbDetails} />
  }
  return <DbDataDisplay showDbConnectForm={()=>setFormVisible(true)} dbName={initDbName.current} />
}

// Handle strict mode effect of causing double requests to database
createRoot(document.getElementById('root')!).render(
   // making alot of requests and strict mode is doubling the load
   <Main />
)
