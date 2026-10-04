import Link from 'next/link';
export default function NotFound() {
  return (
    <section style={{ padding: 40 }}>
      <h1>Page not found</h1>
      <p>
        <Link href="/">Return to the live map</Link>
      </p>
    </section>
  );
}
