export const calculateSceneRevision = async scene => {
  const bytes = new TextEncoder().encode(JSON.stringify(scene));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
};
