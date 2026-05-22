# ATRI Search modules

Two HubSpot CMS modules implementing the approved search mockups, wired to the ATRI Search API
(`atri_api_platform`). See `atri_api_platform/SEARCH_API_INTEGRATION.md` for the API contract.

## Modules

### `search-overlay.module`
The slide-in search panel (right-side, dimmed backdrop, "What can we help you find?", recent searches in
localStorage). Renders its own search-icon trigger by default. On submit it navigates to the results page at
`{results_path}?q=<query>`.

- **Place it in:** the site header area (page/blog templates).
- **Key fields:** Panel heading, input placeholder, **Search results page path** (default `/search`),
  recent-searches labels, and a toggle to hide the built-in trigger.
- **Use your existing header icon instead of the built-in trigger:** turn off "Show search trigger icon" and
  wire your header's search link to:
  ```html
  <a href="#" onclick="window.dispatchEvent(new CustomEvent('atri:open-search')); return false;">…</a>
  ```
  (or call `window.ATRISearchOverlay.open()`).

### `search-results.module`
Reads `q` and optional `source` from the page URL, calls `GET {api_base_url}/api/search/`, and renders the
result grid, the "Showing 1–N of M for …" count line, **source** filter pills (All / Articles=`hubspot` /
Store=`woocommerce`), and page/per_page pagination. Products show price + a Sale badge from `metadata`;
articles show an excerpt. Includes loading, empty, and error states.

- **Place it on:** a dedicated **Search results page** whose URL matches the overlay's `results_path`
  (e.g. create a page at `/search` using a template that contains this module).
- **Key fields:** **Search API base URL** (e.g. `https://<heroku-app>.herokuapp.com`, no trailing slash),
  results per page (default 12 → `per_page`), currency symbol, show-filters toggle, and a sample-data
  fallback toggle.

## Prerequisite: CORS (backend)
The browser calls the API cross-origin from the HubSpot domain. The backend currently has **no CORS**, so add
`django-cors-headers` and allow-list the HubSpot site origin(s) — see the "CORS, auth & CSRF" section of
`SEARCH_API_INTEGRATION.md`. Until then, leave the results module's **sample-data fallback** on so the page
still renders in preview.

## Upload / preview with the HubSpot CLI
```bash
# one-time auth (if not already configured)
hs init

# upload the whole project to the Design Manager
hs upload . "<your-portal-folder>"

# or push just one module
hs upload search-overlay.module "<your-portal-folder>/search-overlay.module"
hs upload search-results.module "<your-portal-folder>/search-results.module"

# live-sync while editing locally
hs watch . "<your-portal-folder>"
```
Then add the modules to your templates / pages in the HubSpot page editor.

## Notes / deviations
- The mockup's Watch/Listen/Read/Store pills were replaced with **source**-based pills (All / Articles /
  Store) because the API filters only by `source`. Richer categories would need `metadata.categories`
  (Woo) or `metadata.tag_ids` (HubSpot).
- Fonts load from Google Fonts (Cormorant Garamond + Inter); swap for theme fonts if preferred.
- `_locales/` i18n files were not hand-authored (HubSpot can generate them); default English strings live in
  `fields.json` and the templates.
