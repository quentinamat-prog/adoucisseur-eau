/**
 * Slugification des noms de catégorie pour les URLs.
 *
 * Source unique de vérité : importée par [category].astro (qui génère les pages),
 * BlogLayout, BlogSidebar et blog/index.astro (qui génèrent les liens). Toute
 * divergence entre ces fichiers produirait des liens vers des pages inexistantes.
 *
 * Seuls [a-z0-9] et le tiret sont conservés : une esperluette ou une apostrophe
 * dans un chemin d'URL casse les liens cités entre guillemets, se retrouve
 * percent-encodée dans les rapports GSC, et crée des variantes crawlables
 * (`eau-&-sante` et `eau-%26-sante` répondant toutes deux en 200).
 *
 *   'Eau & Santé'   -> 'eau-sante'
 *   "Guide d'achat" -> 'guide-d-achat'
 */
export function catToSlug(cat: string): string {
  return cat
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // diacritiques
    .replace(/[^a-z0-9]+/g, '-')     // tout le reste devient séparateur
    .replace(/^-+|-+$/g, '');        // pas de tiret en tête ni en fin
}
