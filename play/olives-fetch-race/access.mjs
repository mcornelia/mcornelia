
export const isLegacyKey = value => /^[A-Za-z0-9_-]{43}$/.test(value);
export function canonicalPhrase(value) {
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
  if(!phrase) throw Error("Use six to twelve different words, separated by dashes.");
  const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(phrase));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
}
