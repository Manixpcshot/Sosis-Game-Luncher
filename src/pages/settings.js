/** Settings page wrapper. */
import { settingsPage } from '../components/settings.js';

export function settingsPageRoute(root) {
  settingsPage(root);
  return { refresh: () => {} };
}
