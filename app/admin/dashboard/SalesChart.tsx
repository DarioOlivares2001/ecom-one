"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatPriceCompact } from "@/lib/utils/format";

export interface ChartDay {
  date: string;
  dateKey?: string;
  total: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-zinc-900">
        {formatPriceCompact(payload[0].value)}
      </p>
    </div>
  );
}

export function SalesChart({ data }: { data: ChartDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatPriceCompact(v)}
          tick={{ fontSize: 11, fill: "#a1a1aa" }}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "#e4e4e7", strokeWidth: 1 }} />
        <Line
          type="monotone"
          dataKey="total"
          stroke="#18181b"
          strokeWidth={2}
          dot={{ r: 3, fill: "#18181b", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#18181b", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
