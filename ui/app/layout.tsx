import { Providers } from './providers';
import "../styles/globals.css";

export const metadata = {
  title: 'Prediction Market - Powered by Doot Oracle',
  description: 'Decentralized prediction markets on Zeko L2',
  icons: {
    icon: '/assets/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
