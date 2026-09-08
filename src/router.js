'use client';

import NextLink from 'next/link';
import { useParams as useNextParams, useRouter } from 'next/navigation';

export function Link({ to, href, children, ...props }) {
  return <NextLink href={href || to} {...props}>{children}</NextLink>;
}

export function useNavigate() {
  const router = useRouter();
  return (target, options = {}) => {
    if (typeof target === 'number') {
      if (target < 0) router.back();
      else router.forward();
      return;
    }
    if (options.replace) router.replace(target);
    else router.push(target);
  };
}

export function useParams() {
  return useNextParams();
}
