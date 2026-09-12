import { Customer, Transaction, Product } from "./types";
import { getConsentOverride, setConsentOverride, ConsentState } from "./consentStore";
import { currentSnapshot } from "./db/repository";
import productsSeed from "@/data/products.json";

/**
 * Synchronous read layer over the loaded snapshot (ADR-032).
 *
 * Callers get customers and transactions without awaiting anything, which is
 * what keeps the entire decision pipeline pure and lets the counterfactual
 * engine sweep it hundreds of times per request. The snapshot is populated by
 * `loadSnapshot()` at the request boundary — from Postgres when DATABASE_URL is
 * set, otherwise from the bundled JSON seed.
 *
 * The product catalogue stays a static import: it is configuration, not
 * customer data, and shipping it in the bundle removes a query from the path.
 */

const products = productsSeed as Product[];

export function getCustomers(): Customer[] {
  return currentSnapshot().customers.map((c) => withConsentOverride(c));
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
  const customer = currentSnapshot().customers.find((c) => c.customerId === id);
  return customer ? withConsentOverride(customer) : undefined;
}

export function getTransactionsForCustomer(id: string): Transaction[] {
  // A copy: callers sort in place, and the snapshot is shared across requests.
  return [...(currentSnapshot().transactionsByCustomer.get(id) ?? [])];
}

export function getTransactions(): Transaction[] {
  return currentSnapshot().customers.flatMap((c) => getTransactionsForCustomer(c.customerId));
}

/**
 * Applies a consent change to the in-process view. Durable persistence happens
 * separately in the consent route (database when configured, cookie otherwise)
 * so that this stays synchronous for the tools that read it.
 */
export function updateCustomerConsent(id: string, consent: ConsentState): Customer | undefined {
  const customer = currentSnapshot().customers.find((c) => c.customerId === id);
  if (!customer) return undefined;
  setConsentOverride(id, consent);
  return { ...customer, consent };
}
