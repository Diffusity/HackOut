import React from 'react';
import type { FundingReferral } from '../lib/types';
import { useMockData } from '../hooks/useMockData';

/** Simple card to display a business funding referral option */
export const FundingReferralCard: React.FC<{ referral: FundingReferral }> = ({ referral }) => (
  <div className="bg-glass backdrop-blur-md p-4 rounded-xl shadow-lg text-white mb-4">
    <h3 className="text-lg font-semibold mb-1">{referral.partnerName}</h3>
    <p className="mb-2">{referral.description}</p>
    <a
      href={referral.referralLink}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary-400 underline"
    >
      Learn More
    </a>
  </div>
);
