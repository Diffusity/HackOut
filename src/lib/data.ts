import { Customer, Transaction, Product } from "./types";
import { getConsentOverride, setConsentOverride, ConsentState } from "./consentStore";

/**
 * Data is imported, NOT read with fs (ADR-022).
 *
 * `fs.readFileSync(path.join(process.cwd(), ...))` works locally but fails on
 * Vercel: Next's file tracer cannot see a path built at runtime, so the JSON is
 * never bundled into the lambda and production throws ENOENT. A static import
 * is traced by the compiler and always ships.
 */
import customersSeed from "@/data/customers.json";
import transactionsSeed from "@/data/transactions.json";
import productsSeed from "@/data/products.json";

const customers = customersSeed as Customer[];
const transactions = transactionsSeed as Transaction[];
const products = productsSeed as Product[];

const txnsByCustomer = new Map<string, Transaction[]>();
for (const t of transactions) {
  const list = txnsByCustomer.get(t.customerId);
  if (list) list.push(t);
  else txnsByCustomer.set(t.customerId, [t]);
}

export function getCustomers(): Customer[] {
  return customers.map((c) => withConsentOverride(c));
}

export function getTransactions(): Transaction[] {
  return transactions;
}

export function getProducts(): Product[] {
  return products;
}

export function getProductById(id: string): Product | undefined {
  return products.find((p) => p.id === id);
}

function withConsentOverride(customer: Customer): Customer {
  const override = getConsentOverride(customer.customerId);
  return override ? { ...customer, consent: override } : customer;
}

export function getCustomerById(id: string): Customer | undefined {
  const customer = customers.find((c) => c.customerId === id);
  return customer ? withConsentOverride(customer) : undefined;
}

export function getTransactionsForCustomer(id: string): Transaction[] {
  return txnsByCustomer.get(id) ?? [];
}

export function updateCustomerConsent(id: string, consent: ConsentState): Customer | undefined {
  const customer = customers.find((c) => c.customerId === id);
  if (!customer) return undefined;
  setConsentOverride(id, consent);
  return { ...customer, consent };
}
