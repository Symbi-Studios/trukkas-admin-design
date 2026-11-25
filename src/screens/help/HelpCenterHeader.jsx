'use client';

import { Link } from '../../router.js';
import styles from './Help.module.css';

/** Shared header for the two halves of the help center: articles (guides in the apps) and FAQs. */
export function HelpCenterHeader({ tab, stats, actions }) {
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <header className={styles.head}>
        <div>
          <h1 className="tk-display">Help center</h1>
          {stats ? <p className={styles.headStats}>{stats}</p> : <p className={styles.headStats}>What forwarders, truckers and drivers see under Help in their apps.</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      <nav className={styles.tabs} aria-label="Help center">
        <Link to="/knowledge-base" aria-current={tab === 'articles' ? 'page' : undefined}>Articles</Link>
        <Link to="/faq" aria-current={tab === 'faq' ? 'page' : undefined}>FAQs</Link>
      </nav>
    </div>
  );
}
