import { useEffect } from "react";
import { C } from "@/lib/theme";
import type { CheckoutResult, Order } from "./Checkout";

export type { CheckoutResult, Order } from "./Checkout";

type RazorpayCtor = new (o: object) => { open: () => void; on: (e: string, f: (r: { error?: { description?: string } }) => void) => void };

/** Browser build: react-native-webview has no web support, so open Razorpay's Standard Checkout directly on the page. */
export function Checkout({ order, onPaid, onFailed, onClose }: {
  order: Order; onPaid: (r: CheckoutResult) => void; onFailed: (message: string) => void; onClose: () => void;
}) {
  useEffect(() => {
    const open = () => {
      const Razorpay = (window as unknown as { Razorpay: RazorpayCtor }).Razorpay;
      const rzp = new Razorpay({
        key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
        name: "English Coach", description: order.plan_name, prefill: order.prefill, theme: { color: C.green },
        handler: onPaid,
        modal: { ondismiss: onClose },
      });
      rzp.on("payment.failed", (r) => onFailed(r.error?.description || "The payment didn't go through. You haven't been charged."));
      rzp.open();
    };
    if ("Razorpay" in window) return open();
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = open;
    script.onerror = () => onFailed("Couldn't load the payment page. Check your internet connection.");
    document.body.appendChild(script);
  }, [order.order_id]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
