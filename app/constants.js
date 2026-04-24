/**
 * constants.js — Shared constants for ApplyReady web pages
 * 
 * Single source of truth for pricing displayed on landing, welcome,
 * and privacy pages. Change PRICE_AMOUNT here to update everywhere.
 * 
 * Business Model: Monthly subscription (30-day license)
 * Displayed in USD. Available globally — LemonSqueezy auto-converts
 * to the buyer's local currency (EUR, GBP, INR, etc.) at checkout.
 */

export const SUBSCRIPTION_DURATION = '30 days';
