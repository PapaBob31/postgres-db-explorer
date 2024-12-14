import { StrictMode } from "react"
import { createRoot } from 'react-dom/client'
import { Provider, useSelector } from "react-redux"
import store, { selectCurrentTab, selectServers } from "./store"
import ServerRep from "./sideNavBar"

import ConnectDbForm from "./routes/dbConnect"
import DbDataDisplay from "./routes/dbDataDisplay"



function Servers() {
  const servers = useSelector(selectServers);
  return (
    <ul>
      {servers.map(server => <li><ServerRep serverDetails={server}/></li>)}
    </ul>
  )
}


function Main(){
  const currentTab = useSelector(selectCurrentTab)

  return (
    <>
      <Servers/>
      {currentTab.tabName === "server-connect-interface" ? <ConnectDbForm /> : <DbDataDisplay />}
    </>
  )
}

// Handle strict mode effect of causing double requests to database
createRoot(document.getElementById('root')!).render(
   <StrictMode>
     <Provider store={store}>
      <Main />
     </Provider>
   </StrictMode>
)
