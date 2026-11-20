'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Fee rules are edited on Finance › Platform Rates; old fee-rule links forward there. */
export function FeeRuleDetail() {
  const router = useRouter();
  useEffect(() => { router.replace('/rates'); }, [router]);
  return null;
}

/** /fees now lives at /revenue. */
export function FeesRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/revenue'); }, [router]);
  return null;
}
