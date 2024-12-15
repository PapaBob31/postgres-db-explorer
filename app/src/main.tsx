import { StrictMode } from "react"
import { createRoot } from 'react-dom/client'
import { Provider, useSelector, useDispatch } from "react-redux"
import store, { selectServers, selectServersFetchStatus, fetchSavedServers } from "./store"
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
  const dispatch = useDispatch()
  const loaded = useSelector(selectServersFetchStatus)
  const servers = useSelector(selectServers)

  if (!loaded)  {
    dispatch(fetchSavedServers())
  }

  return (
    <>
      {loaded ? <>
        <Servers/>
        {servers.some(server => server.connected) ? <DbDataDisplay /> : <ConnectDbForm />}
      </> : <div id-="loader"><div id="spinner"></div></div>}
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
