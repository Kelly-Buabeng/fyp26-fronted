import type { Metadata } from 'next';
import '@/styles/globals.css';
import 'leaflet/dist/leaflet.css';
import { Providers } from '@/components/layout/providers';
import { Header, Footer } from '@/components/layout/header';
import { isAdmin } from '@/lib/server/auth';
export const metadata: Metadata = {
  title: { default: 'Roadwatch — Pothole Intelligence for Ghana', template: '%s | Roadwatch' },
  description:
    'Roadwatch connects road images, pothole detection, and regional intelligence for Ghana.',
};
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialAdmin = await isAdmin();
  return (
    <html lang="en">
      <body>
        <Providers initialAdmin={initialAdmin}>
          <Header />
          <main id="main">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
