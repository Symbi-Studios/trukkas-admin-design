'use client';
import { Button, Card, EmptyState } from '../ds.js';
import { useNavigate } from '../router.js';

/** Shown for any URL that doesn't match a console screen. */
export function NotFound() {
  const navigate = useNavigate();
  return (
    <Card>
      <EmptyState icon="compass" title="Page not found"
        description="This page doesn't exist or has moved. Check the address, or use the sidebar to find what you need."
        action={<Button variant="outline" icon="arrow-left" onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>} />
    </Card>
  );
}
