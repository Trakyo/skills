export function CheckoutButton({ plan }: { plan: "starter" | "pro" }) {
  const href = `https://checkout.acmepay.com/buy/${plan}`;
  return (
    <a className="btn btn-primary" href={href}>
      Buy {plan === "pro" ? "Pro" : "Starter"}
    </a>
  );
}
