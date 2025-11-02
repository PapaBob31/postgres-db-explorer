import { StrictMode, useEffect } from "react"
import { createRoot } from 'react-dom/client'
import { Provider, useSelector, useDispatch } from "react-redux"
import store, { selectServers, selectServersFetchStatus, fetchSavedServers } from "./store"
import ServerRep from "./sideNavBar"

import ConnectDbForm from "./routes/dbConnect"
import DbDataDisplay from "./routes/dbDataDisplay"

export function generateUniqueId() {
  let key = "";
  const alphaNumeric = "0abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for (let i=0; i<15; i++) {
    const randIndex = Math.floor(Math.random()  * alphaNumeric.length);
    key += alphaNumeric[randIndex];
  }
  return key
}

/** Parent Component that renders components representing saved server-connection details*/
function Servers() {
  const servers = useSelector(selectServers);
  console.log(servers)
  return (
    <section className="min-w-xs p-2 bg-gray-100 h-full overflow-auto">
      <h1 className="font-semibold flex align-baseline border-b border-gray-300 py-1 mb-2">
        <img src="/server.svg" className="block mr-2 w-6" />
        <span>Saved Servers</span>
      </h1>
      <ul>
        {servers.map(server => <ServerRep key={server.name} serverDetails={server}/>)}
      </ul>
    </section>
  )
}

// main component of the app 
function Main(){
  const dispatch = useDispatch()
  const loaded = useSelector(selectServersFetchStatus)
  const servers = useSelector(selectServers)

  useEffect(() => {
    if (!loaded) {
      dispatch(fetchSavedServers())
    }
  }, [loaded])

  return (
    <section className="flex h-screen">
      {loaded ? <>
        <Servers/>
        {servers.some(server => server.connectedDbs.length > 0) ? <DbDataDisplay /> : <ConnectDbForm />}
      </> : 
      <div className="loader"><div className="spinner"></div></div>}
    </section>
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
