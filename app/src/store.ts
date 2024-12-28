import { configureStore, createSlice, createAsyncThunk } from "@reduxjs/toolkit"
import { getServerConfig, type ConnectionParams } from "./routes/dbConnect"

export interface ServerDetails {
	name: string,
  	isConnUri: boolean,
	connectionUri: string,
	config: any,
	initDb: string;
	fetchedObjs: boolean;
  	connectedDbs: string[];
  	roles: string[];
  	databases: string[]
}


const serversDetails: {fetchedSavedServers: boolean; data: ServerDetails[]} = {
	fetchedSavedServers: false,
	data: []
}

export interface OpenedTabDetail {
	tabName: string;
	tabId: string;
	tabType: string;
	dataDetails: {
		dbName: string;
		tableName: string;
		schemaName: string;
		serverConfig: any
	}
}

interface Tabs {
	currentTab: OpenedTabDetail|null,
	openedTabs: OpenedTabDetail[]
}

function generateUniqueId() {
  let key = "";
  const alphaNumeric = "0abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  for (let i=0; i<10; i++) {
    const randIndex = Math.floor(Math.random()  * alphaNumeric.length);
    key += alphaNumeric[randIndex];
  }
  return key
}


const tabs: Tabs = {
	currentTab: null,
	openedTabs: []
}

interface Action {
	type: string;
	payload: {
		tabName: string;
		tabType: string;
		dataDetails: {
			dbName: string;
			tableName: string;
			schemaName: string;
			serverConfig: any
		}
	}
}

const tabsSlice = createSlice({
	name: "openedTabs",
	initialState: tabs,
	reducers: {
		tabCreated(state, action: Action) {
			const newTabDetails = {...action.payload, tabId: generateUniqueId()}
			state.currentTab = newTabDetails
			state.openedTabs.push(newTabDetails)
		},
		tabClosed(state, action: {type: string, payload: {closedTabId: string}}) {
			const unclosedTabs:OpenedTabDetail[] = []
			for (let i=0; i<state.openedTabs.length; i++) {
				if (state.openedTabs[i].tabId !== action.payload.closedTabId) {
					unclosedTabs.push(state.openedTabs[i])
				}else if (state.openedTabs.length > 1){
					state.currentTab = (i === 0 ? state.openedTabs[i+1] : state.openedTabs[i-1])
				}
			}
			state.openedTabs = unclosedTabs;
		},
		tabSwitched(state, action: {type: string, payload: string}) {
			const targetTab = state.openedTabs.find((tab) => tab.tabId === action.payload) as OpenedTabDetail;
    		state.currentTab = targetTab
		}
	}
})


export const fetchSavedServers = createAsyncThunk("servers/loadSavedServers", async () => {
	const response = await fetch("http://localhost:4900/saved-servers");
	let serverData;
	if (response.ok)
		serverData = await response.json() as ConnectionParams[]

	if (!serverData)
		return []

	return serverData.map((data) => {
        return {
          	name: data.name,
          	isConnUri: data.isConnUri,
  			connectionUri: data.connectionUri,
  			config: getServerConfig(data),
  			fetchedObjs: false,
  			initDb: data.database,
          	connectedDbs: [] as string[]
     	} as ServerDetails;
  	})
})

export const getServerObjects = createAsyncThunk("servers/getServerObjects", async (details: {serverName: string, config: any}) => {
	const response = await fetch("http://localhost:4900", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({config: details.config}) 
    })

    if (!response.ok)
    	throw new Error("Error! @ servers/getServerObjects") // Is this okay to be asyncThunk rejected?

    const responseBody = await response.json()
	return {serverName: details.serverName, serverObjects: responseBody.data as {roles: string[], databases: string[]}};
})

interface ServerObjectsPayload {
	serverName: string,
	serverObjects: {
		roles: string[],
		databases: string[]
	}
}

const serverSlice =  createSlice({
	name: "servers",
	initialState: serversDetails,
	reducers: {
		addNewServer(state, action: {type: string, payload: ServerDetails}) {

			// sort it first putting connected on top
			const tempArray:ServerDetails[] = state.data.splice(0, state.data.length);
			tempArray.forEach(data => data.fetchedObjs && state.data.push(data))
			state.data.push(action.payload);

			tempArray.forEach(data => !data.fetchedObjs && state.data.push(data))
		},
		newDbConnected(state, action) {

		}
	},
	extraReducers(builder) {
		builder.addCase(fetchSavedServers.fulfilled, (state, action: {type: string, payload: ServerDetails[]}) => {
			state.fetchedSavedServers = true
			state.data = action.payload // pushing instead of assigning directly causes a bug.
		})

		.addCase(fetchSavedServers.rejected, (state) => {
			state.data = [];
		})
		.addCase(getServerObjects.fulfilled, (state, action: {type: string, payload: ServerObjectsPayload} ) => {
			for (let server of state.data) {
				if (server.name === action.payload.serverName) {
					server.fetchedObjs = true
					server.roles = action.payload.serverObjects.roles
					server.databases = action.payload.serverObjects.databases
				}
			}
		})
		.addCase(getServerObjects.rejected, (state, action ) => {
			
		})
	}
})

const store = configureStore({
	reducer: {
		tabs: tabsSlice.reducer,
		servers: serverSlice.reducer
	}
})

export default store;
export const { tabCreated, tabClosed, tabSwitched } = tabsSlice.actions
export const { addNewServer } = serverSlice.actions;

export const selectTabs = (state: ReturnType<typeof store.getState>) => state.tabs
export const selectCurrentTab = (state: ReturnType<typeof store.getState>) => state.tabs.currentTab as OpenedTabDetail;
export const selectServers = (state: ReturnType<typeof store.getState>) => state.servers.data
export const selectServersFetchStatus = (state: ReturnType<typeof store.getState>) => state.servers.fetchedSavedServers
export const selectCurrentTabServerConfig = (state: ReturnType<typeof store.getState>) => {
	const tabDetails = state.tabs.currentTab as OpenedTabDetail;
  	return {...tabDetails.dataDetails.serverConfig, database: tabDetails.dataDetails.dbName}
}