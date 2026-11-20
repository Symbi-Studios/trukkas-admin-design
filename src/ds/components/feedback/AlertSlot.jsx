'use client';
import React from 'react';

/**
 * Page-level error and warning banners render into a full-width bar under the
 * top bar. AppShell provides the slot; Modal, SideDrawer and other overlays
 * mark their content as inline so banners there stay in place.
 */
export const AlertSlotContext = React.createContext(null);
export const InlineAlertContext = React.createContext(false);

/** Wrap overlay content so error/warning banners inside it stay inline. */
export function InlineAlerts({ children }) {
  return <InlineAlertContext.Provider value>{children}</InlineAlertContext.Provider>;
}
