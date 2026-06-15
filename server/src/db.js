import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSONFilePreset } from "lowdb/node";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const databasePath = path.join(__dirname, "../data/db.json");
await fs.mkdir(path.dirname(databasePath), { recursive: true });

const defaultData = {
  users: [],
  categoryGroups: [],
  categories: [],
  products: [],
  variants: [],
  vouchers: [],
  leads: [],
  orders: [],
  order_items: []
};

export const db = await JSONFilePreset(databasePath, defaultData);
