export default function Home() {
  return (
    <main style={{ padding: '2rem', maxWidth: '48rem', margin: '0 auto' }}>
      <h1>Hop Ahumado</h1>
      <p>Monorepo: Next.js (web) + NestJS (api)</p>
      <p>
        API health: <a href="/api/health">/api/health</a> (proxy al backend)
      </p>
    </main>
  );
}
