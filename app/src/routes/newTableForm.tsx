import { useState } from "react"
import { useDispatch, useSelector } from "react-redux"
import { tabChangedInPlace, selectCurrentTab } from "../store"
import { useForm, useFieldArray, SubmitHandler, type UseFormRegister } from "react-hook-form"

interface ColumnSpec {
  name: string;
  dataType: string;
  typeAttributes: string; // for storing extra attributes of types i.e whould store the n in char(n)
  collation?: string;
  storage?: string;
  compression?: string; // only if storage was specified
  constraints: string;
}

interface FormValues {
  name: string;
  temporary?: boolean;
  onCommit?: string;
  unlogged?: boolean;
  columns?: ColumnSpec[];
  likeTable?: string;
  likeOption?: string[];
  tableConstraints?: string;
  tableSpace?: string;
}

// escapes special sql chracters in identifiers
function escapeSQLCharacters(text: string): string {
  let escapedText = text.replace(/"/g, '""');
  if ((/[\[\]()*\s\.\$"+-/\\,:;]/).test(text)) { // text contains sql special characters
    escapedText = `"${escapedText}"`;
  }
  return escapedText;
}


function getColumnSpecSql(columnsData: ColumnSpec[], tableConstraints: string) {
  // fv : formatValue
  function fv(value: any) {
    if (value)
      return value + ' '
    else 
      return ''
  }
  if (columnsData.length == 0) 
    return "";
  let sql = "("
  for (let data of columnsData) {
    if (sql !== '(') // at least one column specification has been added
      sql += ','

    sql += `\n  ${fv(escapeSQLCharacters(data.name))}${fv(data.dataType)}`
    if (data.typeAttributes) {
      sql += `(${data.typeAttributes}) `
    }
    sql += `${fv(data.storage)}${fv(data.compression)}${fv(data.collation)}${data.constraints}`
  }
  if (tableConstraints) {
    sql += ',\n  '+tableConstraints // should there always be columns before table constraint; enforce it in the UI if so
  }
  sql += '\n)'
  return sql;
}

function generateQuery(tableData: FormValues) {
  console.log(tableData)
  let query = "CREATE"
  if (tableData.temporary) {
    query += " TEMPORARY"
  }else if (tableData.unlogged) {
    query += " UNLOGGED"
  }
  query += " TABLE IF NOT EXISTS "
  query += escapeSQLCharacters(tableData.name)
  query += getColumnSpecSql(tableData.columns as ColumnSpec[], tableData.tableConstraints as string) + ';'

  return [tableData.name, query]
}


function DataTypeOptions(){
  let postgreSqlTypes = [
    "bigint", "bit", "bit varying", "bigserial", "boolean", "bpchar", "char", "varchar","date", 
    "double precision", "integer", "numeric", "decimal", "domain types", "enum", "line segments",
    "real", "smallint", "smallserial", "serial", "timestamp", "text", "bytea", "time", "interval", 
    "timestamptz", "points", "lines", "boxes", "paths", "polygons", "circles", "inet", "cidr", 
    "macaddr", "macaddr8", "tsquery", "oids", "money", "uuid", "xml", "json", "jsonb", "Array", 
    "tsvector", "composite types", "ranges", "pg_lsn", "pseudo types"
  ]
  let htmlOptionElems = postgreSqlTypes.map((option) => <option key={option}>{option}</option>)
  return (
    <>
      {htmlOptionElems}
    </>
  )
}

function TypeAttributes({type, updateTypeAttributes} : {type: string, updateTypeAttributes: (str: string) => void}){
  const [attributes, setAttributes] = useState<string[]>(["", ""])

  function setAttributesValue(value: string, type: "strLen"|"precision"|"scale") {
    const newArr = [...attributes]
    switch(type) {
      case "strLen":{
        newArr[0] = value
        setAttributes(newArr)
        break;
      }
      case "precision": {
        newArr[0] = value
        setAttributes(newArr)
        break;
      }
      case "scale": {
        newArr[1] = value
        setAttributes(newArr)
        break;
      }
    }
  }

  const attributesMap: {[key: string]: JSX.Element} = {
    "varchar": <input 
                  max={10485760} type="number" onChange={(event)=>setAttributesValue(event.target.value, "strLen")}
                  name="char-length" value={attributes[0]} placeholder="n"
                />,
    "char": <input 
                max={10485760} type="number" onChange={(event)=>setAttributesValue(event.target.value, "strLen")}
                name="char-length" value={attributes[0]} placeholder="n"
              />,
    // warn users about negative scale not being portable and check if these are the proper max and min scales
    "numeric": <>
          <input max={1000} min={-1000} type="number" name="precision" onChange={(event)=>setAttributesValue(event.target.value, "precision")}/>
          <input max={1000} min={-1000} type="number" name="scale" onChange={(event)=>setAttributesValue(event.target.value, "scale")}/>
        </>
    // Get all the enum types first
  }

  const formatedAttributes = attributes.filter(attribute => Boolean(attribute)).join()

  return (<>
      {attributesMap[type] && (
      <div className="inline" onBlur={() => updateTypeAttributes(formatedAttributes)}>{attributesMap[type]}</div>)}
    </>)
}

function ColumnDetailsForm({index, removeColumn, register, setValue} : {index: number, removeColumn: (index: number)=>void, register: UseFormRegister<FormValues>, setValue: any}) {
  const [dataType, setDataType] = useState("")
  // const [typeAttributes, setTypeAttributes] = useState("")
  const specialDataTypes = ["varchar", "char", "numeric"]

  function setTypeAttributes(newValue: string) {
    setValue(`columns.${index}.typeAttributes`, newValue)
  }

  return (
    <div className="column-details">
      <label htmlFor="column-name" className="block"><b>Column name</b></label>
      <input type="text" {...register(`columns.${index}.name`, {required: true})} />
      <label htmlFor="data-type" className="block"><b>Data type</b></label>
      <select {...register(`columns.${index}.dataType`, {required: true})} value={dataType} onChange={(event) => setDataType(event.target.value)}>
        <DataTypeOptions/>
      </select>
      <input type="hidden" {...register(`columns.${index}.typeAttributes`)} />
      {specialDataTypes.includes(dataType) && <TypeAttributes key={dataType} type={dataType} updateTypeAttributes={setTypeAttributes} />}
      <label className="block">Collation</label>
      <input type="text" {...register(`columns.${index}.collation`)}/>
      <label className="block">Storage</label>
      <select {...register(`columns.${index}.storage`)}>
         <option>PLAIN</option>
         <option>EXTERNAL</option>
         <option>EXTENDED</option>
         <option>MAIN</option>
         <option>DEFAULT</option>
      </select>
      <label className="block">Constraints</label>
      <input type="text" {...register(`columns.${index}.constraints`)} />
      <button type="button" onClick={() => removeColumn(index)}>remove</button>
    </div>
  )
}

// perhaps you can just highlight when the user has used
// a key word wrongly

function GeneralTableAttributes({display, register} : {display: "show"|"hide", register: UseFormRegister<FormValues>}) {
  const [tempOptionsVisible, setTempOptionsVisible] = useState(false)
  const [copiedTable, setCopiedTable] = useState("")
  const [includeOptionsVisible, setIncludeOptionsVisible] = useState(false)

  function setLikeOption(event: React.ChangeEvent<HTMLInputElement>) {
    setCopiedTable(event.target.value)
    if (!event.target.value && includeOptionsVisible) {
      setIncludeOptionsVisible(false)
    }else if (event.target.value && !includeOptionsVisible) {
      setIncludeOptionsVisible(true)
    }
  }
  return (
    <div className={"form-section " + display}>
      <h2>Table Name:</h2>
      <input type="text" {...register("name", {required: true})} />
      <label>Unlogged</label>
      <input type="checkbox" {...register("unlogged")}/>
      <label className="block">
        Temporary
        <input type="checkbox" {...register("temporary")} onChange={(event)=>setTempOptionsVisible(event.target.checked)}/>
      </label>
      {tempOptionsVisible && (
        <div>
          <label>ON COMMIT</label>
          <select>
            <option>PRESERVE ROWS</option>
            <option>DELETE ROWS</option>
            <option>DROP</option>
          </select>
        </div>
      )}
      <label className="block">LIKE TABLE</label>
      <input type="text" {...register("likeTable")} value={copiedTable} onChange={setLikeOption}/>
      {includeOptionsVisible && <>
        <label>including</label>
        <select>
          <option>INCLUDING ALL</option>
          <option>INCLUDING COMPRESSION</option>
          <option>INCLUDING CONSTRAINTS</option>
          <option>INCLUDING COMMENTS</option>
          <option>INCLUDING GENERATED</option>
          <option>INCLUDING IDENTITY</option>
          <option>INCLUDING INDEXES</option>
          <option>INCLUDING STORAGE</option>
          <option>INCLUDING STATISTICS</option>
        </select>
      </>}
    </div>
  )
}

function getTableInfoTabConfig(tableName:string, targetDb: string, serverConfig: any) {
  return {
    tabName: "table -- " + tableName,
    tabType: "table-info",
    dataDetails: {
      dbName: targetDb,
      tableName: "",
      schemaName: "",
      serverConfig
    }
  }
}

export function CreateTable() {
  const [display, setDisplay] = useState<"general"|"columns"|"sql">("general")
  const { control, handleSubmit, register, setValue } = useForm<FormValues>()
  const { fields, append, remove } = useFieldArray({control, name: "columns"})
  const tabDetails = useSelector(selectCurrentTab)
  const config = {...tabDetails.dataDetails.serverConfig, database: tabDetails.dataDetails.dbName}
  const dispatch = useDispatch()

  const onSubmit: SubmitHandler<FormValues> = (data) => {
    const [newTableName, query] = generateQuery(data);
    console.log(query);
    fetch("http://localhost:4900/mutate-dbData", {
      credentials: "include",
      headers: {"Content-Type": "application/json"},
      method: "POST",
      body: JSON.stringify({config, query, queryType: "create"}) 
    })
    .then(response => response.json())
    .then(responseBody => {
      if (responseBody.errorMsg) {
        alert(`${responseBody.errorMsg} Please try again!`)
      }else {
        alert(`${newTableName} created successfully!`)
        dispatch(tabChangedInPlace(getTableInfoTabConfig(newTableName, tabDetails.dataDetails.dbName, tabDetails.dataDetails.serverConfig))) 
      }
    })
  }


  return (
    <form onSubmit={handleSubmit(onSubmit)} id="create-form">
      <div id="table-attr-selection">
        <button type="button" onClick={() => setDisplay("general")}>General</button>
        <button type="button" onClick={() => setDisplay("columns")}>Column Atributes</button>
        <button type="button" onClick={() => setDisplay("sql")}>SQL</button>
        <button type="submit">Create Table</button>
      </div>

      <section id="form-sections-container">
        <GeneralTableAttributes display={display === "general" ? "show" : "hide"} register={register}/>
        <div className={"form-section " + (display === "columns" ? "show" : "hide")}>
          <h3>Columns</h3>
          {fields.map((field, index) => <ColumnDetailsForm key={field.id} index={index} removeColumn={remove} register={register} setValue={setValue} />)}
          <button onClick={() => append({
            name: "", dataType: "", collation: "", storage:"", compression: "", constraints: "", typeAttributes: ""}
          )}>
            Add
          </button>
          <label className="block">Table Constraints</label>
          <textarea {...register("tableConstraints")}></textarea> 
        </div>
      </section>
    </form>
  )
}