// The fallback mirrors the verified public contact configured on the main site.
// Production may replace it without a code change.
export const siteContact = Object.freeze({
  whatsappNumber: String(process.env.PUBLIC_ADVISOR_WHATSAPP_NUMBER || '971585857429').replace(/\D/g, '')
});
