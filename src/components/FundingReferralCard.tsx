import React from 'react';
import type { FundingReferral } from '../lib/types';
import { Building2, ExternalLink } from 'lucide-react';

/** Simple card to display a business funding referral option */
export const FundingReferralCard: React.FC<{ referral: FundingReferral }> = ({ referral }) => (
  <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
    <div className="mb-3 flex items-center gap-2">
      <Building2 className="h-5 w-5 text-accent" />
      <h3 className="text-sm font-semibold tracking-tight text-fg">{referral.partnerName}</h3>
    </div>
    <p className="mb-4 text-sm leading-relaxed text-fg-muted">{referral.description}</p>
    <a
      href={referral.referralLink}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-accent transition-colors hover:text-accent/80"
    >
      Learn More <ExternalLink className="h-3.5 w-3.5" />
    </a>
  </div>
);
