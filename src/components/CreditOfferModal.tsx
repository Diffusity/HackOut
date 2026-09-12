import React, { useState } from 'react';
import { useGuardrail } from '../../hooks/useGuardrail';
import type { CreditOffer, Customer } from '../../lib/types';

/**
 * Modal that appears when the customer's stress score exceeds the threshold.
 * It displays the first eligible credit offer from the mock data.
 */
export const CreditOfferModal: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { eligibleOffer, loading } = useGuardrail(customer);
  const [isOpen, setIsOpen] = useState(false);

  // Open the modal when an eligible offer becomes available
  React.useEffect(() => {
    if (eligibleOffer && !loading) {
      setIsOpen(true);
    }
  }, [eligibleOffer, loading]);

  if (!isOpen || !eligibleOffer) return null;

  const { offerAmount, interestRate, tenureMonths, terms } = eligibleOffer as CreditOffer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="bg-glass backdrop-blur-md p-6 rounded-xl shadow-lg max-w-md w-full text-white">
        <h2 className="text-2xl font-semibold mb-3">Emergency Credit Offer</h2>
        <p className="mb-4">We noticed you might need quick cash. Here’s a tailored offer for you:</p>
        <ul className="mb-4 list-disc list-inside space-y-1">
          <li>Amount: ₹{offerAmount.toLocaleString()}</li>
          <li>Interest Rate: {interestRate}% per annum</li>
          <li>Tenure: {tenureMonths} months</li>
        </ul>
        <p className="mb-4 text-sm italic">{terms}</p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 rounded bg-gray-600 hover:bg-gray-700 transition-colors"
            onClick={() => setIsOpen(false)}
          >
            Close
          </button>
          <button className="px-4 py-2 rounded bg-primary-500 hover:bg-primary-600 transition-colors">
            Accept Offer
          </button>
        </div>
      </div>
    </div>
  );
};
