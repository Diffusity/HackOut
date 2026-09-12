import { Customer } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { User, MapPin, Briefcase } from "lucide-react";

export function ProfileCard({ customer }: { customer: Customer | null }) {
  if (!customer) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5 text-indigo-400" />
          {customer.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-3 mt-4 text-sm text-gray-300">
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-gray-500" />
            <span className="capitalize">{customer.segment.replace("_", " ")}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-500" />
            <span>Tier {customer.cityTier} City</span>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs bg-white/5 border border-white/10 rounded px-2 py-1">
              Language: {customer.preferredLanguage.toUpperCase()}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
