import { CheckoutButton } from "../components/CheckoutButton";
import { NewsletterForm } from "../components/NewsletterForm";

export function Home() {
  return (
    <main>
      <h1>Scale your coaching business</h1>
      <CheckoutButton plan="pro" />
      <div className="calendly-inline-widget" data-url="https://calendly.com/acme-coaching/strategy-call" style={{ minWidth: 320, height: 700 }} />
      <footer><NewsletterForm /></footer>
    </main>
  );
}
