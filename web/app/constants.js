/**
 * constants.js — Shared constants for ApplyReady web pages
 * 
 * Single source of truth for pricing displayed on landing, welcome,
 * and privacy pages. Change PRICE_AMOUNT here to update everywhere.
 * Displayed in USD. Available globally — LemonSqueezy auto-converts
 * to the buyer's local currency (EUR, GBP, INR, etc.) at checkout.
 */

export const PRICE_AMOUNT = 4.99;
export const PRICE = PRICE_AMOUNT % 1 === 0 ? `$${PRICE_AMOUNT}` : `$${PRICE_AMOUNT.toFixed(2)}`;
