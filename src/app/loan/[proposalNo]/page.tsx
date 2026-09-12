import { notFound } from "next/navigation";
import { KeyFactsView } from "@/components/KeyFactsView";
import { getOffer } from "@/lib/lending/loanStore";
import { computeCoolingOffExit } from "@/lib/lending/keyFactStatement";
import { loadSnapshot } from "@/lib/db/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Key Facts Statement — DhanSathi",
  description: "The RBI-mandated Key Facts Statement for this loan proposal, with the full APR computation.",
};

export default async function LoanPage({
  params,
}: {
  params: Promise<{ proposalNo: string }>;
}) {
  await loadSnapshot();
  const { proposalNo } = await params;

  const offer = await getOffer(decodeURIComponent(proposalNo));
  if (!offer) notFound();

  const exit =
    offer.status === "accepted" && offer.acceptedAt
      ? computeCoolingOffExit(offer.kfs, new Date(offer.acceptedAt), new Date())
      : null;

  return <KeyFactsView initialOffer={offer} initialExit={exit} />;
}
