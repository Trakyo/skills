export default function HomePage() {
  return (
    <main>
      <h1>Scale your coaching business</h1>
      <form action="/api/signup" method="post">
        <input name="name" placeholder="Name" />
        <input name="email" type="email" placeholder="Email" />
        <button type="submit">Get the free training</button>
      </form>
      <div
        className="calendly-inline-widget"
        data-url="https://calendly.com/acme-coaching/strategy-call"
        style={{ minWidth: 320, height: 700 }}
      />
    </main>
  );
}
