/**
 * Test stand-in for the `cloudflare:workers` module, which exists only inside workerd. Tests set
 * `env.API` to a stub service binding before rendering a page.
 */
export const env: { API?: Fetcher } = {};
