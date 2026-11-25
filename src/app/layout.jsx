import '../ds/styles.css';
import { AdminShell } from '../App.jsx';
import { StoreProvider } from '../store/StoreProvider.jsx';
import { DesktopOnlyNotice } from '../components/DesktopOnlyNotice.jsx';
import screenStyles from '../components/DesktopOnlyNotice.module.css';
import { getAdmin } from '../lib/auth/session';

export const metadata = {
  title: {
    default: 'Trukkas Admin',
    template: '%s | Trukkas Admin',
  },
  description: 'Operations console for jobs, trips, bids, fleet, finance, and compliance.',
};

export default async function RootLayout({ children }) {
  // Runs on the Next.js server: reads the admin from the httpOnly cookie, so a reload keeps the admin signed in
  // without any token in the browser.
  const admin = await getAdmin();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before first paint so dark mode doesn't flash white. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('trukkas-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}" }} />
      </head>
      <body style={{ margin: 0 }}>
        <div className={screenStyles.experience}>
          <StoreProvider initialAdmin={admin}><AdminShell>{children}</AdminShell></StoreProvider>
        </div>
        <DesktopOnlyNotice />
      </body>
    </html>
  );
}