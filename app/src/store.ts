import { configureStore, createSlice } from "@reduxjs/toolkit"

export interface ServerDetails {
	name: string;
	connString: string;
	connected: boolean;
	connectedDbs: string[]
}

const serversDetails:ServerDetails[] = []

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


const initPageDetails = {
	tabName: "server-connect-interface",
	tabId: generateUniqueId(),
	tabType: "server-connect-interface",
	serverConnStrinng: "",
	dataDetails: {
		dbName: "", 
		tableName: "",
		schemaName: "",
	}
}

const tabs: Tabs = { // must it always be in an object form?
	currentTab: initPageDetails,
	openedTabs: [initPageDetails]
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
			state.openedTabs.push({...action.payload, tabId: generateUniqueId()})
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

const serverSlice =  createSlice({
	name: "servers",
	initialState: serversDetails,
	reducers: {
		newServerConnected(state, action: {type: string, payload: ServerDetails}) {
			// sort it first putting connected on top
			state.push(action.payload)
		},
		newDbConnected(state, action) {

		}
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
export const selectServers = (state: ReturnType<typeof store.getState>) => state.servers

