"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface MonthlyPoint {
  month: string;
  credits: number;
  debits: number;
}

/**
 * Money in and money out. The palette is neutral, so the two series are told
 * apart by fill rather than hue: income is the solid area, spending the
 * hatched one. That survives greyscale printing and colour-blind viewers.
 */
export function IncomeSpendChart({ data }: { data: MonthlyPoint[] }) {
  if (!data || data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Money in and out</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="fillIncome" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--fg)" stopOpacity={0.22} />
                  <stop offset="100%" stopColor="var(--fg)" stopOpacity={0.02} />
                </linearGradient>
                <pattern
                  id="fillSpend"
                  patternUnits="userSpaceOnUse"
                  width="6"
                  height="6"
                  patternTransform="rotate(45)"
                >
                  <line x1="0" y1="0" x2="0" y2="6" stroke="var(--fg-subtle)" strokeWidth="1.5" />
                </pattern>
              </defs>

              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--fg-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--fg-subtle)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value: number) => `₹${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                  color: "var(--fg)",
                }}
                labelStyle={{ color: "var(--fg-muted)" }}
                formatter={(value: any, name: any) => [
                  `₹${Number(value).toLocaleString("en-IN")}`,
                  name,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "11px", color: "var(--fg-muted)" }}
                iconType="plainline"
              />
              <Area
                type="monotone"
                dataKey="credits"
                name="Income"
                stroke="var(--fg)"
                strokeWidth={2}
                fill="url(#fillIncome)"
              />
              <Area
                type="monotone"
                dataKey="debits"
                name="Spending"
                stroke="var(--fg-subtle)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                fill="url(#fillSpend)"
                fillOpacity={0.35}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
