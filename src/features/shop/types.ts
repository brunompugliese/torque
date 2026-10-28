// What the browser may know about the signed-in user's shop. Never the logo's
// storage path: the logo is read through SHOP_LOGO_PATH.
export type Shop = {
  name: string;
  address: string | null;
  phone: string | null;
  hasLogo: boolean;
};

// The app serves the shop's logo itself (src/app/logo/route.ts), so no storage
// URL ever reaches the browser.
export const SHOP_LOGO_PATH = "/logo";
