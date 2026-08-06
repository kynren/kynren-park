'use client';

import { useEffect } from 'react';
import { useBranding } from '../lib/branding';

/** Applies the branded favicon + document title across the whole admin. */
export function FaviconManager() {
  const brand = useBranding();
  useEffect(() => {
    if (brand.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = brand.faviconUrl;
    }
    if (brand.appName) document.title = `${brand.appName} — Staff Dashboard`;
  }, [brand.faviconUrl, brand.appName]);
  return null;
}
