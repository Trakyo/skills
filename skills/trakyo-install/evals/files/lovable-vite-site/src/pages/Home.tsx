export function Home() {
  return (
    <main>
      <h1>Scale your coaching business</h1>
      <a href="/apply">Apply for a free call</a>
      <div
        className="calendly-inline-widget"
        data-url="https://calendly.com/acme-coaching/strategy-call"
        style={{ minWidth: 320, height: 700 }}
      />
    </main>
  );
}
