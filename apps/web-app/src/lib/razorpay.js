/**
 * Razorpay Checkout loader.
 *
 * The backend does the parts that must not be trusted to the browser:
 * POST /v1/payments/{id}/create-order creates the order server-side and
 * returns the public key id, and the signed webhook (POST
 * /v1/payments/webhook) is what actually marks a payment completed. This
 * file only opens the checkout sheet; it never decides a payment succeeded.
 */

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loader = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.async = true;
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => { loader = null; reject(new Error("Could not load Razorpay Checkout. Check your connection and try again.")); };
    document.head.appendChild(script);
  });
  return loader;
}

export async function openCheckout({ order, email, description, onDismiss }) {
  // Demo mode has no Razorpay account behind it, so the sheet is stubbed
  // and the payment is marked completed the way the signed webhook would.
  if (import.meta.env.VITE_DEMO === "1") {
    const { completeDemoPayment } = await import("../demo/mockApi.js");
    await new Promise((r) => setTimeout(r, 900));
    completeDemoPayment(order.razorpay_order_id);
    return { attempted: true };
  }
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      key: order.razorpay_key_id,
      order_id: order.razorpay_order_id,
      amount: order.amount_paise,
      currency: order.currency || "INR",
      name: "Borewell Platform",
      description,
      prefill: { email },
      theme: { color: "#141619" },
      // Resolving here only means the sheet reported a successful attempt.
      // The payment is not "completed" until the signed webhook lands, so
      // the caller re-reads the payment from the API rather than trusting
      // this callback.
      handler: () => resolve({ attempted: true }),
      modal: { ondismiss: () => { onDismiss?.(); resolve({ attempted: false }); } },
    });
    rzp.open();
  });
}
