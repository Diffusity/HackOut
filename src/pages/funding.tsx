import React from 'react';
import { useMockData } from '../hooks/useMockData';
import type { FundingReferral } from '../lib/types';
import { FundingReferralCard } from '../components/FundingReferralCard';
import Head from 'next/head';

/** Funding page – displays business funding referral options */
export default function FundingPage() {
  const { data: referrals, loading } = useMockData<FundingReferral[]>('funding.json');

  return (
    <>
      <Head>
        <title>Funding Referrals • DhanSathi</title>
        <meta name="description" content="Business funding referrals for SMEs based on your profile." />
      </Head>
      <main className="mx-auto max-w-4xl p-4">
        <h1 className="text-2xl font-bold mb-6 text-white">Business Funding Referrals</h1>
        {loading && <p className="text-fg-muted">Loading options…</p>}
        {referrals &&
          referrals.map((ref, idx) => (
            <FundingReferralCard key={idx} referral={ref} />
          ))}
        {(!loading && (!referrals || referrals.length === 0)) && (
          <p className="text-fg-muted">No funding options available.</p>
        )}
      </main>
    </>
  );
}
