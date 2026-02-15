import { useQuery } from "@tanstack/react-query";
import { type Address } from "viem";
import { invoiceMemo } from "@/lib/invoice";

export interface PaymentInfo {
  paid: boolean;
  txHash: string | null;
  from: string | null;
  amount: string | null;
  token: string | null;
  timestamp: number | null;
}

const DEFAULT_PAYMENT: PaymentInfo = {
  paid: false,
  txHash: null,
  from: null,
  amount: null,
  token: null,
  timestamp: null,
};

async function checkPayment(
  merchantAddress: string,
  tokenAddress: string,
  reference: string
): Promise<PaymentInfo> {
  const memo = invoiceMemo(reference);
  const res = await fetch("/api/verify-payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      merchantAddress,
      tokenAddress,
      memo,
    }),
  });

  if (!res.ok) {
    return DEFAULT_PAYMENT;
  }

  const data = await res.json();

  if (data.paid) {
    return {
      paid: true,
      txHash: data.txHash,
      from: data.from,
      amount: data.amount,
      token: data.token,
      timestamp: data.timestamp,
    };
  }

  return DEFAULT_PAYMENT;
}

export function usePaymentStatus(
  merchantAddress: Address | undefined,
  tokenAddress: Address | undefined,
  reference: string | undefined,
  pollInterval: number = 5000
) {
  const { data: payment = DEFAULT_PAYMENT, isLoading: loading } = useQuery({
    queryKey: ["paymentStatus", merchantAddress, tokenAddress, reference],
    queryFn: () => checkPayment(merchantAddress!, tokenAddress!, reference!),
    enabled: !!merchantAddress && !!tokenAddress && !!reference,
    refetchInterval: (query) =>
      query.state.data?.paid ? false : pollInterval,
  });

  return { payment, loading };
}
