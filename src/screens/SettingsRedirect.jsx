'use client';

import { useEffect } from 'react';
import { useNavigate } from '../router.js';
import { settingsTabPath } from './settingsShared.jsx';

/** Old per-tab settings URLs now open the matching tab on /settings. */
export function SettingsRedirect({ tab }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(settingsTabPath(tab), { replace: true }); }, [tab]);
  return null;
}
