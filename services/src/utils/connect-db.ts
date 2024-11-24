import { Pool } from "pg"

export default function setupDbParams(connectionString: string) {
  return new Pool({connectionString, ssl: false})
}