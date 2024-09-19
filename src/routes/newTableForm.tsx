import { useState, useRef, useContext } from "react"
import { useLocation } from "react-router-dom";
import { DataDisplay } from "./dbDataDisplay";

function generateQuery(formElement: HTMLFormElement) {
    const tableName = formElement.getElementById("table-name")
    let columnDetails = "";
    const columnContainers = formElement.querySelectorAll("div")

    columnContainers.forEach(columnComponent => {
      let name = (columnComponent.querySelector("input[name='column-name']") as HTMLInputElement).value;
      let dataType = (columnComponent.querySelector("select") as HTMLSelectElement).value;
      let constraints = (columnComponent.querySelector("input[name='constraints']") as HTMLInputElement).value;
      let defaultValue = (columnComponent.querySelector("input[name='default-value']") as HTMLInputElement).value;
      if (columnDetails) // column Details already has the string content for some columns already
        columnDetails += ','
      if (defaultValue)
        columnDetails += `${name} ${dataType} ${constraints} DEFAULT ${defaultValue} `
      else
        columnDetails += `${name} ${dataType} ${constraints}`;
    })

    return `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDetails});`
}


function ColumnDetailsForm({renderKey, removeColumn} : {renderKey: number, removeColumn: (key: number)=>void}) {
   /*columns
      [name type default value] [constraints+]+
      [generated column]
    table constraints

    default values can be expressions that returns a value rather than being just a value
    check constraints that evaluate to null are taken to be true*/
  return (
    <div>
    <label htmlFor="column-name"><b>Column name</b></label>
    <input type="text" name="column-name" id="column-name" required />
    <label htmlFor="data-type"><b>Data type</b></label>
    <select required id="data-type"> {/*only support three basic data types for now*/}
      <option>integer</option>
      <option>numeric</option>
      <option>text</option>
    </select>
    <label htmlFor="default-value">Default value:</label>
    <input type="text" name="default-value" id="default-value" />
    <label htmlFor="constraints"><b>Constraints</b></label>
    <input type="text" name="constraints" id="constraints" />

    <button type="button" onClick={() => removeColumn(renderKey)}>remove</button>
    </div>
  )
}


export function CreateTable() {
  let [columnKeys, setColumnKeys] = useState<number[]>([]); // free keys for rendering column components
  const freeColumnKeys = useRef([1]);
  const formRef = useRef<HTMLFormElement>(null);
  const setDisplayData = useContext(DataDisplay)

  function createTable(event) {
    event.preventDefault();
    const query = generateQuery(formRef.current as HTMLFormElement);
    let initialConnectedDb = useLocation().state;
    fetch("http://localhost:4900/create-table", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb: initialConnectedDb, query}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(`${responseBody.errorMsg} Please try again!`)
      }else {
        alert("Successful")
        setDisplayData({type: "table-info", data: responseBody.data})
      }
    })
  }

  function addNewColumn() {
    if (freeColumnKeys.current.length > 1) {
        setColumnKeys([...columnKeys, freeColumnKeys.current.pop() as number])
    }else {
      setColumnKeys([...columnKeys, freeColumnKeys.current.pop() as number])
      freeColumnKeys.current.push(columnKeys.length+1);
    }
  }
  function removeColumn(renderKey: number) {
      setColumnKeys(columnKeys.filter((key) => key !== renderKey))
      freeColumnKeys.current.push(renderKey);
  }
  return (
    <form ref={formRef} onSubmit={createTable}>
      <h2>Table Name:</h2>
      <input name="table-name" id="table-name" type="text" required />
      <h3>Columns</h3>
      {columnKeys.map(key => <ColumnDetailsForm key={key} renderKey={key} removeColumn={removeColumn}/>)}
      <button type="button" onClick={() => addNewColumn}>Add Column</button>
      <button type="submit">Create Table</button>
    </form>
  )
}