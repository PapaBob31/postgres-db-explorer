import { configureStore, createSlice, createAsyncThunk } from "@reduxjs/toolkit"

export interface ServerDetails {
	name: string;
	connString: string;
	connected: boolean;
	connectedDbs: string[];
}


const serversDetails: {fetchedSavedServers: boolean; data: ServerDetails[]} = {
	fetchedSavedServers: false,
	data: []
}

export interface OpenedTabDetail {
	tabName: string;
	tabId: string;
	tabType: string;
	serverConnString: string;
	dataDetails: {
		dbName: string;
		tableName: string;
		schemaName: string;
	}
}

interface Tabs {
	currentTab: OpenedTabDetail,
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


const serverConnectForm = {
	tabName: "server-connect-interface",
	tabId: generateUniqueId(),
	tabType: "server-connect-interface",
	serverConnString: "",
	dataDetails: {
		dbName: "", 
		tableName: "",
		schemaName: "",
	}
}

const tabs: Tabs = { // must it always be in an object form?
	currentTab: serverConnectForm,
	openedTabs: [serverConnectForm]
}

interface Action {
	type: string;
	payload: {
		tabName: string;
		tabType: string;
		serverConnString: string;
		dataDetails: {
			dbName: string;
			tableName: string;
			schemaName: string;
		}
	}
}

const tabsSlice = createSlice({
	name: "openedTabs",
	initialState: tabs,
	reducers: {
		tabCreated(state, action: Action) {
			if (state.openedTabs.length === 1 && state.openedTabs[0].tabName === "server-connect-interface") {
				state.openedTabs.pop()
			}
			const newTabDetails = {...action.payload, tabId: generateUniqueId()}
			state.currentTab = newTabDetails
			state.openedTabs.push(newTabDetails)
		},
		tabClosed(state, action: {type: string, payload: {closedTabId: string}}) {
			const unclosedTabs = state.openedTabs.filter((tabDetail) => tabDetail.tabId !== action.payload.closedTabId)
			state.openedTabs = unclosedTabs
		},
		tabSwitched(state, action: {type: string, payload: string}) {
			const targetTab = state.openedTabs.find((tab) => tab.tabId === action.payload) as OpenedTabDetail;
    		state.currentTab = targetTab
		}
	}
})

interface ConnectionParams {
  user: string;
  password: string;
  hostname: string;
  dbname: string;
  port: number;
  ssl: boolean
}

interface BackendServerDetails {
  servername: string;
  recordType: "uri-parts"|"uri";
  connectionDetails: ConnectionParams | null;
  connectionUri: string
}


export const fetchSavedServers = createAsyncThunk("servers/loadSavedServers", async () => {
	const response = await fetch("http://localhost:4900/saved-servers");
	let data;
	if (response.ok)
		data = await response.json() as BackendServerDetails[]

	if (!data)
		return []

	return data.map((data) => {
        return {
          name:  data.servername,
          connString: data.connectionUri,
          connected: false,
          connectedDbs: [] as string[]
     	}
  	})
})

const serverSlice =  createSlice({
	name: "servers",
	initialState: serversDetails,
	reducers: {
		newServerConnected(state, action: {type: string, payload: ServerDetails}) {

			// sort it first putting connected on top
			const tempArray:ServerDetails[] = state.data.splice(0, state.data.length);
			tempArray.forEach(data => data.connected && state.data.push(data))
			state.data.push(action.payload);

			tempArray.forEach(data => !data.connected && state.data.push(data))
		},
		newDbConnected(state, action) {

		}
	},
	extraReducers(builder) {
		builder.addCase(fetchSavedServers.fulfilled, (state, action: {type: string, payload: ServerDetails[]}) => {
			state.fetchedSavedServers = true
			state.data.push(...action.payload)
		})

		.addCase(fetchSavedServers.rejected, (state, action) => {
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
export const { tabCreated, tabClosed, tabSwitched } = tabsSlice.actions
export const { newServerConnected } = serverSlice.actions;

export const selectTabs = (state: ReturnType<typeof store.getState>) => state.tabs
export const selectCurrentTab = (state: ReturnType<typeof store.getState>) => state.tabs.currentTab
export const selectServers = (state: ReturnType<typeof store.getState>) => state.servers.data
export const selectServersFetchStatus = (state: ReturnType<typeof store.getState>) => state.servers.fetchedSavedServers

