/** Favorites page (spec §12). */
import { libraryPage } from './library.js';

export function favoritesPage(root) {
  return libraryPage(root, { favoritesOnly: true });
}
