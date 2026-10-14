
export const isLegacyKey = value => /^[A-Za-z0-9_-]{43}$/.test(value);
export const NEW_PHRASE_GUIDANCE = "Use exactly three words separated by dashes, then a number and ! after the last word. Use letters for the words.";
export function canonicalNewPhrase(value) {
  if(typeof value!=="string" || value.length>160) return null;
  const phrase=value.trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g,"-");
  return /^[a-z]+-[a-z]+-[a-z]+[0-9]+!$/.test(phrase) ? phrase : null;
}
export function canonicalPhrase(value) {
  const current=canonicalNewPhrase(value);
  if(current) return current;
  if(typeof value!=="string" || value.length>160) return null;
  const words=value.trim().toLowerCase().replace(/[\u2010-\u2015\u2212]/g,"-").split(/[\s-]+/);
  return words.length>=6 && words.length<=12 && new Set(words).size===words.length && words.every(w=>/^[a-z]{2,24}$/.test(w))
    ? words.join("-") : null;
}
export function normalizeCredential(value) {
  if(typeof value!=="string") return null;
  const trimmed=value.trim();
  // Preserve every published opaque key, including its case.
  return isLegacyKey(trimmed) ? trimmed : canonicalPhrase(trimmed);
}
export function credentialCandidates(value) {
  if(typeof value!=="string" || value.length>160) return [];
  const trimmed=value.trim(),phrase=canonicalPhrase(trimmed);
  return [...new Set([...(isLegacyKey(trimmed)?[trimmed]:[]),...(phrase?[phrase]:[])])];
}
export async function phraseHash(value) {
  const phrase=canonicalPhrase(value);
  if(!phrase) throw Error("Enter a recognized access phrase.");
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(phrase));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
