import { configureStore, createSlice } from "@reduxjs/toolkit"

const initialState = {
	currentPage: "connect-db-form",
	connectedDb: "",
	tableDetails: {
		tableName: "", 
		schemaName: ""
	}
}

export const pagesSlice = createSlice({
	name: "pages",
	initialState,
	reducers: {
		serverConnected(state, action) {
			state.currentPage = action.payload.newPage
			state.connectedDb = action.payload.connectedDb
			state.tableDetails = action.payload.tableDetails
		},
		pageChanged(state, action) {
			state.currentPage = action.payload.newPage
			if (action.payload.tableDetails)
				state.tableDetails = action.payload.tableDetails
		},
		tableCreated(state, action) {
			state.currentPage = action.payload.newPage
			state.tableDetails.tableName = action.payload.newTableName
		},
		targetDbUpdated(state, action) {
			state.connectedDb = action.payload.newDb
		},
		targetTableChanged(state, action) {
			state.tableDetails.tableName = action.payload.tableToQuery
		}
	}
})

const store = configureStore({
	reducer: {
		pages: pagesSlice.reducer
	}
})
export default store;
export const { serverConnected, pageChanged, tableCreated, targetDbUpdated, targetTableChanged } = pagesSlice.actions

export const selectCurrentPage = (state: ReturnType<typeof store.getState>) => state.pages.currentPage
export const selectCurrentDb = (state: ReturnType<typeof store.getState>) => state.pages.connectedDb
export const selectTargetTableDetails = (state: ReturnType<typeof store.getState>) => state.pages.tableDetails