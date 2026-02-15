interface StatusBadgeProps {
  status: "pending" | "paid" | "expired" | "confirming";
}

const STATUS_STYLES: Record<
  StatusBadgeProps["status"],
  { label: string; className: string }
> = {
  pending: {
    label: "AWAITING PAYMENT",
    className: "border-yellow-500/30 text-yellow-500/80",
  },
  confirming: {
    label: "CONFIRMING",
    className: "border-blue-500/30 text-blue-500/80",
  },
  paid: {
    label: "PAID",
    className: "border-green-500/30 text-green-500/80",
  },
  expired: {
    label: "EXPIRED",
    className: "border-red-500/30 text-red-500/80",
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-block border px-2 py-0.5 text-[9px] uppercase tracking-wider ${style.className}`}
    >
      {style.label}
    </span>
  );
}
