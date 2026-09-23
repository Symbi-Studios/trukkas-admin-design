import '../ds/styles.css';
import { AdminShell } from '../App.jsx';
import { StoreProvider } from '../store/StoreProvider.jsx';

export const metadata = {
  title: {
    default: 'Trukkas Admin',
    template: '%s | Trukkas Admin',
  },
  description: 'Operations console for jobs, trips, bids, fleet, finance, and compliance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <StoreProvider><AdminShell>{children}</AdminShell></StoreProvider>
      </body>
    </html>
  );
}
