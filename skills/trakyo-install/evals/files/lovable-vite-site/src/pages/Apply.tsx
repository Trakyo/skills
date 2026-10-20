import { useState } from "react";

export function Apply() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("https://hooks.acme-coaching.com/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name }),
    });
    window.location.href = "/home";
  }
  return (
    <form onSubmit={submit}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
      <button type="submit">Apply</button>
    </form>
  );
}
