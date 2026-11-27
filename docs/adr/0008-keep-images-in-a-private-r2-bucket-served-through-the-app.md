# 0008. Keep images in a private R2 bucket, served and resized through the app

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** Owner's decision on 2026-11-27 (switch from a public bucket: "definitely"; "I would
  easily stay on the free tier"); `context.md` §6

## Context
Recipe photos (and later other media) are personal. A public bucket with random file names would
leave them readable by anyone holding a URL, which conflicts with "Access is the only way in".

## Decision
Images are stored in a **private** R2 bucket bound only to the API worker (`FILES`). The browser
requests `/img/<key>?w=…`. The Astro worker (behind Access) forwards it over the binding, and the
API reads the object from R2, resizes it with the **Images binding**, and returns it with long-lived
cache headers. Object keys are random (`<module>/<uuid>.<ext>`) and never derived from personal
data. Images are never deleted (ADR 0009).

## Consequences
- Easy: one access rule for everything. Guests later get images through their own share mechanism.
- Hard: each image request passes through both workers. Resized variants need caching (Cache API)
  to stay cheap; expected to stay within the free tier for one user.
- Allowed widths are a fixed list, not arbitrary values, so the cache cannot be flooded with
  variants.

## Verification
No test result was provided. Nothing is scaffolded yet.

## Alternatives considered
- **A public bucket on a custom domain with Cloudflare Images URL transformations:** simplest and
  fastest, but anyone with the URL can see the images. It was approved first and then reversed.
- **Presigned R2 GET URLs:** private, but the URLs expire, which breaks caching and makes links
  awkward.
