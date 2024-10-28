import { useState, useRef, useContext } from "react"
import { DataDisplayFn } from "./dbDataDisplay";


// escapes special sql chracters in identifiers
function escapeSQLCharacters(text: string): string {
  let escapedText = text.replace(/"/g, '""');
  if ((/[\[\]()*\s\.\$"+-/\\,:;]/).test(text)) { // text contains sql special characters
    escapedText = `"${escapedText}"`;
  }
  return escapedText;
}

function getDefaultValue(text: string, columnType: string) {
  if (["character", "character varying", "text"].includes(columnType)) {
    return "$$" + text + "$$"
  }
  return text
}

function DataTypeOptions(){
  let postgreSqlTypes = [
    "bigint", "bit", "bit varying", "boolean", "char", "character varying", "character",
    "varchar", "date", "double precision", "integer", "numeric", "decimal", "domain types",
    "real", "smallint", "timestamp", "smallserial", "serial", "bigserial", "line segments",
    "text", "bytea", "time", "interval", "timestamptz", "enum", "points", "lines", "boxes",
    "paths", "polygons", "circles", "inet", "cidr", "macaddr", "macaddr8", "tsquery", "oids", "money",
    "uuid", "xml", "json", "jsonb", "Array",  "tsvector", "composite types", "ranges", "pg_lsn", "pseudo types"
  ]
  let htmlOptionElems = postgreSqlTypes.map((option) => <option key={option}>{option}</option>)
  return (
    <>
      {htmlOptionElems}
    </>
  )
}

function getColumnDetails(container: HTMLDivElement) { // escape user input
  const formEntries:any = Object();
  const targetValues = ["column-name", "data-type", "constraints", "char-length"]
  // should be documented that you have auto escaped identifiers and strings

  for (let i=0; i<container.children.length; i++) {
    let formControl = container.children.item(i) as HTMLInputElement;
    if (formControl.name === "column-name") {
      formControl.value = escapeSQLCharacters(formControl.value)
    }
    if (formControl.name === "default-value" && formControl.value.trim()) {
      formEntries[formControl.name] = ` DEFAULT ${getDefaultValue(formControl.value, formControl.name)}`
    }else if (formControl.name && targetValues.includes(formControl.name)) {
      if (formControl.value) { // trim it first?
        formEntries[formControl.name] = ' ' + formControl.value;
      }else formEntries[formControl.name] = "";
    }
  }

  if (formEntries["data-type"] === " character" || formEntries["data-type"] === " character varying") {
    let charLength = formEntries["char-length"].trim()
    formEntries["data-type"] += (charLength ? `(${charLength})` : "")
  }

  if (formEntries['default-value'])
    return `${formEntries['column-name']}${formEntries['data-type']}${formEntries['default-value']}${formEntries['constraints']}`;

  return `${formEntries['column-name']}${formEntries['data-type']}${formEntries['constraints']}`;
}

function generateQuery(formElement: HTMLFormElement) {
    let tableName = "";
    let columnDetails = "";

    for (let childNode of formElement.children) {
      if (childNode.nodeName === "INPUT" && (childNode as HTMLInputElement).name === "table-name") {
        tableName = (childNode as HTMLInputElement).value;
      }
      if (childNode.nodeName === "DIV") {
        if (columnDetails)
          columnDetails += ', ';
        columnDetails += getColumnDetails(childNode as HTMLDivElement)
      }
    }

    return [tableName, `CREATE TABLE IF NOT EXISTS ${escapeSQLCharacters(tableName)} (${columnDetails});`]
}

function numericParams() {
  return (
    <></>
  )
}

function ColumnDetailsForm({renderKey, removeColumn} : {renderKey: number, removeColumn: (key: number)=>void}) {
   /*columns
      [name type default value] [constraints+]+
      [generated column]
    table constraints

    default values can be expressions that returns a value rather than being just a value
    check constraints that evaluate to null are taken to be true*/
  const [extraParamsType, setExtraParamsType] = useState("");

  const extraInputComponents = { 
    "character varying": <input max={10485760} type="number" name="char-length" placeholder="n"/>,
    "character": <input max={10485760} type="number" name="char-length" placeholder="n"/>,
    // warn users about negative scale not being portable and check if these are the proper max and min scales
    "numeric": <><input max={1000} min={-1000} type="number" name="precision"/><input max={1000} min={-1000} type="number" name="scale"/></>,
    // Get all the enum types first
  }

  function displayOptTypeParams(event) {
    let dataType: string = event.target.value
    if (extraInputComponents[dataType]) {
      setExtraParamsType(dataType);
    }
    setExtraParamsType("");
  }

  return (
    <div>
    <label htmlFor="column-name"><b>Column name</b></label>
    <input type="text" name="column-name" id="column-name" required />
    <label htmlFor="data-type"><b>Data type</b></label>
    <select required id="data-type" name="data-type" onChange={displayOptTypeParams}>
      <DataTypeOptions/>
    </select>
    {extraParamsType && extraInputComponents[extraParamsType]}
    <label htmlFor="default-value">Default value:</label>
    <input type="text" name="default-value" id="default-value" />
    <label htmlFor="constraints"><b>Constraints</b></label>
    <input type="text" name="constraints" id="constraints" />
    <button type="button" onClick={() => removeColumn(renderKey)}>remove</button>
    </div>
  )
}


export function CreateTable({targetDb}: {targetDb: string}) {
  let [columnKeys, setColumnKeys] = useState<number[]>([]); // free keys for rendering column components
  const freeColumnKeys = useRef([1]);
  const formRef = useRef<HTMLFormElement>(null);
  const setDisplayData = useContext(DataDisplayFn)

  function createTable(event) {
    event.preventDefault();
    const [newTableName, query] = generateQuery(formRef.current as HTMLFormElement);
    console.log(query);
    fetch("http://localhost:4900/mutate-dbData", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({targetDb, query, queryType: "create"}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(`${responseBody.errorMsg} Please try again!`)
      }else {
        alert("Successful")
        setDisplayData({type: "table-info", data: {tableName: newTableName, targetDb}}) // fix schema bug, Infact the table should be created with the qualified name
      }
    })
  }

  function addNewColumn() {
    let newColumnKeys:number[] = [...columnKeys, freeColumnKeys.current.pop() as number]

    if (freeColumnKeys.current.length === 0)
      freeColumnKeys.current.push(newColumnKeys.length+1);
    setColumnKeys(newColumnKeys);
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
      <button type="button" onClick={() => addNewColumn()}>Add Column</button>
      <button type="submit">Create Table</button>
    </form>
  )
}