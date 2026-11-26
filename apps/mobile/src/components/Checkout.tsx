import { Linking, Modal, View } from "react-native";
import { WebView } from "react-native-webview";
import { C } from "@/lib/theme";

export type Order = {
  order_id: string;
  key_id: string;
  amount: number;
  currency: string;
  plan_name: string;
  prefill: { name: string; email: string; contact: string };
};
export type CheckoutResult = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type Message = { paid?: CheckoutResult; failed?: string; dismissed?: boolean };

/** Razorpay's official Standard Checkout, in a web view (no native SDK, so it works in Expo Go too).
 *  The signed receipt goes back to the API (/v1/payments/verify) exactly as on the web. */
export function Checkout({ order, onPaid, onFailed, onClose }: {
  order: Order; onPaid: (r: CheckoutResult) => void; onFailed: (message: string) => void; onClose: () => void;
}) {
  const options = {
    key: order.key_id, amount: order.amount, currency: order.currency, order_id: order.order_id,
    name: "English Coach", description: order.plan_name, prefill: order.prefill, theme: { color: C.green },
  };
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:${C.bg}"><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
const post = (m) => window.ReactNativeWebView.postMessage(JSON.stringify(m));
const o = ${JSON.stringify(options)};
o.handler = (r) => post({ paid: r });
o.modal = { ondismiss: () => post({ dismissed: true }) };
const rzp = new Razorpay(o);
rzp.on("payment.failed", (r) => post({ failed: (r.error && r.error.description) || "" }));
rzp.open();
</script></body></html>`;

  function onMessage(data: string) {
    const m: Message = JSON.parse(data);
    if (m.paid) onPaid(m.paid);
    else if (m.failed !== undefined) onFailed(m.failed || "The payment didn't go through. You haven't been charged.");
    else if (m.dismissed) onClose();
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <WebView
          originWhitelist={["*"]}
          source={{ html, baseUrl: "https://checkout.razorpay.com" }}
          onMessage={(e) => onMessage(e.nativeEvent.data)}
          // UPI apps (upi://, intent://) must open outside the web view.
          onShouldStartLoadWithRequest={(r) => {
            if (/^https?:|^about:|^data:/.test(r.url)) return true;
            Linking.openURL(r.url).catch(() => onFailed("No UPI app found on this phone. Try a card or another method."));
            return false;
          }}
          javaScriptEnabled
          setSupportMultipleWindows={false}
        />
      </View>
    </Modal>
  );
}
