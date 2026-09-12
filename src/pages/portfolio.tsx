import React from 'react';
import Head from 'next/head';
import { PortfolioSimulator } from '../components/PortfolioSimulator';
import { useMockData } from '../hooks/useMockData';
import type { Customer } from '../lib/types';

/** Portfolio page – displays simulated portfolio for a demo customer */
export default function PortfolioPage() {
  // For demo we just pick the first SIP nudge entry to get a customer id
  const { data: sipNudges, loading } = useMockData<any>('data/mock/sipNudge.json');
  const customer: Customer | null = sipNudges && sipNudges.length > 0 ? sipNudges[0] : null;

  return (
    <>
      <Head>
        <title>Portfolio Simulator • DhanSathi</title>
        <meta name="description" content="Simulated portfolio based on static market strategy." />
      </Head>
      <main className="mx-auto max-w-4xl p-4">
        <h1 className="text-2xl font-bold mb-6 text-white">Portfolio Simulator</h1>
        <PortfolioSimulator customer={customer} />
      </main>
    </>
  );
}
