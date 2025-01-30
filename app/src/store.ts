import { configureStore, createSlice, createAsyncThunk } from "@reduxjs/toolkit"

export interface ConnectedDbDetails {
	connectionId: string;
	name: string;
}

export interface ConnectionParams {
	user?: string;
	password?: string;
	host?: string;
	port?: number;
	ssl?: string;
	database?: string;
}

interface SavedServerDetails {
	name: string;
	isConnUri: boolean;
	connectionUri: string;
	connectionParams: ConnectionParams;
}

export interface ServerDetails extends SavedServerDetails{
	name: string;
	isConnUri: boolean;
	connectionUri: string;
	connectionParams: ConnectionParams;
	connectedDbs: ConnectedDbDetails[];
}


const serversDetails: {fetchedSavedServers: boolean, data: ServerDetails[]} = {
	fetchedSavedServers: false,
	data: []
}

interface TabDetailWithoutId {
	tabName: string;
	tabType: string;
	dataDetails: {
		dbConnectionId: string;
		tableName: string;
		schemaName: string;
	}
}

export interface OpenedTabDetail extends TabDetailWithoutId {
	tabId: string;
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
	payload: TabDetailWithoutId
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
		},
		tabChangedInPlace(state, action: Action) {
			let replacedTabIndex = state.openedTabs.findIndex((tab) => tab.tabId === state.currentTab!.tabId);
			state.openedTabs[replacedTabIndex] = {...action.payload, tabId: state.currentTab!.tabId} // currentTab is also the tab to be replaced
			state.currentTab = state.openedTabs[replacedTabIndex]
		}
	}
})


export const fetchSavedServers = createAsyncThunk("servers/loadSavedServers", async () => {
	const response = await fetch("http://localhost:4900/saved-servers");
	let serverData;
	if (response.ok)
		serverData = await response.json() as SavedServerDetails[]

	if (!serverData)
		return []

	return serverData.map((data) => {
    return {...data, connectedDbs: []} as ServerDetails
	})
})

/*export const getServerObjects = createAsyncThunk("servers/getServerObjects", async (arg: {serverDetails: ServerDetails, connectedDbDetails: ConnectedDbDetails}) => {
	const response = await fetch("http://localhost:4900", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({connectionId: arg.connectedDbDetails.connectionId}) 
    })

    if (!response.ok)
    	throw new Error("Error! @ servers/getServerObjects") // Is this okay to be asyncThunk rejected?

    const responseBody = await response.json()
	return {serverName: details.serverName, serverObjects: responseBody.data as {roles: string[], databases: string[]}};
})*/

function moveConnectedServersUp(data: ServerDetails[]) { // could this algorithnm be better?
	const connected : ServerDetails[]= []
	const unconnected: ServerDetails[] = []
	for (let serverDetails of data) {
		if (serverDetails.connectedDbs.length > 0) {
			connected.push(serverDetails)
		}else {
			unconnected.push(serverDetails)
		}
	}

	return  [...connected, ...unconnected]
}

const serverSlice =  createSlice({
	name: "servers",
	initialState: serversDetails,
	reducers: {
		addNewServer(state, action: {type: string, payload: ServerDetails}) {
			state.data.push(action.payload)
			state.data = moveConnectedServersUp(state.data)
		},
		addNewConnectedDb(state, action: {type: string, payload: {serverName: string, dbDetails: ConnectedDbDetails}}) {
			const targetServer = state.data.find((data) => data.name === action.payload.serverName)
			if (targetServer) {
				targetServer.connectedDbs.push(action.payload.dbDetails)
			}// else nothing. 'else' case should be impossible
			state.data = moveConnectedServersUp(state.data)
		},
	},
	extraReducers(builder) {
		builder
		.addCase(fetchSavedServers.fulfilled, (state, action: {type: string, payload: ServerDetails[]}) => {
			state.fetchedSavedServers = true;
			state.data = action.payload // pushing instead of assigning directly causes a bug.
		})
		.addCase(fetchSavedServers.rejected, (state) => {
			state.data = [];
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
export const { tabCreated, tabClosed, tabSwitched, tabChangedInPlace } = tabsSlice.actions
export const { addNewServer, addNewConnectedDb } = serverSlice.actions;

export const selectTabs = (state: ReturnType<typeof store.getState>) => state.tabs
export const selectCurrentTab = (state: ReturnType<typeof store.getState>) => state.tabs.currentTab as OpenedTabDetail;
export const selectServers = (state: ReturnType<typeof store.getState>) => state.servers.data
export const selectServersFetchStatus = (state: ReturnType<typeof store.getState>) => state.servers.fetchedSavedServers
/*export const selectCurrentTabServerConfig = (state: ReturnType<typeof store.getState>) => {
	const tabDetails = state.tabs.currentTab as OpenedTabDetail;
  return {...tabDetails.dataDetails.serverConfig, database: tabDetails.dataDetails.dbName}
}*/