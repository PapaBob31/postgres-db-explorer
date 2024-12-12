import { StrictMode } from "react"
import { createRoot } from 'react-dom/client'
import { Provider, useSelector } from "react-redux"
import store, { selectCurrentPage } from "./store"

import ConnectDbForm from "./routes/dbConnect"
import DbDataDisplay from "./routes/dbDataDisplay"

function Main(){
  const currentPage = useSelector(selectCurrentPage)

  return (
    <>
      {currentPage === "connect-db-form" ? <ConnectDbForm /> : <DbDataDisplay />}
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
