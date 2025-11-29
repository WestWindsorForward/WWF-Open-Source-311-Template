import { useEffect } from "react";

import { useBrandingStore } from "../store/branding";
import type { Branding } from "../types";

interface Props {
  branding?: Branding;
  children: React.ReactNode;
}

const DEFAULT_FAVICON = "/vite.svg";

export function BrandingProvider({ branding, children }: Props) {
  const { setBranding } = useBrandingStore();

  useEffect(() => {
    if (!branding) return;
    setBranding(branding);
    if (branding.primary_color) {
      const rgb = safeHexToRgb(branding.primary_color);
      if (rgb) {
        document.documentElement.style.setProperty("--color-primary", rgb);
      }
    }
    if (branding.secondary_color) {
      const rgb = safeHexToRgb(branding.secondary_color);
      if (rgb) {
        document.documentElement.style.setProperty("--color-secondary", rgb);
      }
    }
  }, [branding, setBranding]);

  useEffect(() => {
    const title = branding?.site_title ?? branding?.town_name ?? "Township Request Portal";
    document.title = title;
    updateFavicon(branding?.favicon_url);
  }, [branding]);

  return <>{children}</>;
}

function safeHexToRgb(hex: string): string | null {
  const value = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return null;
  }
  const bigint = Number.parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r} ${g} ${b}`;
}

function updateFavicon(url?: string | null) {
  const link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) {
    return;
  }
  link.href = url || DEFAULT_FAVICON;
}
