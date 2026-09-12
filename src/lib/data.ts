import fs from "fs";
import path from "path";
import { Customer, Transaction, Product } from "./types";

// In-memory cache for the duration of the request/process
let customersCache: Customer[] | null = null;
let transactionsCache: Transaction[] | null = null;
let productsCache: Product[] | null = null;

const DATA_DIR = path.join(process.cwd(), "src", "data");

export function getCustomers(): Customer[] {
  if (!customersCache) {
    const data = fs.readFileSync(path.join(DATA_DIR, "customers.json"), "utf8");
    customersCache = JSON.parse(data) as Customer[];
  }
  return customersCache;
}

export function getTransactions(): Transaction[] {
  if (!transactionsCache) {
    const data = fs.readFileSync(path.join(DATA_DIR, "transactions.json"), "utf8");
    transactionsCache = JSON.parse(data) as Transaction[];
  }
  return transactionsCache;
}

export function getProducts(): Product[] {
  if (!productsCache) {
    const data = fs.readFileSync(path.join(DATA_DIR, "products.json"), "utf8");
    productsCache = JSON.parse(data) as Product[];
  }
  return productsCache;
}

export function getCustomerById(id: string): Customer | undefined {
  return getCustomers().find((c) => c.customerId === id);
}

export function getTransactionsForCustomer(id: string): Transaction[] {
  return getTransactions().filter((t) => t.customerId === id);
}

export function updateCustomerConsent(
  id: string,
  consent: { transactions: boolean; location: boolean; spendCategories: boolean }
): Customer | undefined {
  const customer = getCustomerById(id);
  if (customer) {
    customer.consent = consent;
  }
  return customer;
}
