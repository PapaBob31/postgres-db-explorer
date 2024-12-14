import { StrictMode } from "react"
import { createRoot } from 'react-dom/client'
import { Provider, useSelector } from "react-redux"
import store, { selectServers } from "./store"
import ServerRep from "./sideNavBar"

import ConnectDbForm from "./routes/dbConnect"
import DbDataDisplay from "./routes/dbDataDisplay"



function Servers() {
  const servers = useSelector(selectServers);
  return (
    <section>
      <h1>Saved Servers</h1>
      <ul>
        {servers.map(server => <ServerRep serverDetails={server}/>)}
      </ul>
    </section>
  )
}


function Main(){
  const servers = useSelector(selectServers);

  return (
    <>
      <Servers/>
      {servers.some(server => server.connected) ? <DbDataDisplay /> : <ConnectDbForm />}
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
