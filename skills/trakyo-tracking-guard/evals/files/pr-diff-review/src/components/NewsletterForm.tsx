import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("https://hooks.acme-coaching.com/newsletter", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setDone(true);
  }
  if (done) return <p>Check your inbox.</p>;
  return (
    <form onSubmit={submit}>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
      <button type="submit">Subscribe</button>
    </form>
  );
}
