import '../ds/styles.css';
import { AdminShell } from '../App.jsx';
import { StoreProvider } from '../store/StoreProvider.jsx';
import { DesktopOnlyNotice } from '../components/DesktopOnlyNotice.jsx';
import screenStyles from '../components/DesktopOnlyNotice.module.css';

export const metadata = {
  title: {
    default: 'Trukkas Admin',
    template: '%s | Trukkas Admin',
  },
  description: 'Operations console for jobs, trips, bids, fleet, finance, and compliance.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@1&display=swap" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap" />
        {/* Apply the saved theme before first paint so dark mode doesn't flash white. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('trukkas-theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}" }} />
      </head>
      <body style={{ margin: 0 }}>
        <div className={screenStyles.experience}>
          <StoreProvider><AdminShell>{children}</AdminShell></StoreProvider>
        </div>
        <DesktopOnlyNotice />
      </body>
    </html>
  );
}
