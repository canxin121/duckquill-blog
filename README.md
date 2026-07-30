# duckquill-blog

A personal static blog powered by Zola and Duckquill.

## Local development

```bash
zola serve
```

## Build static files

```bash
zola build
```

Build output directory:

- `public/`

## Notes

- The site is a static Zola build, deployed to EdgeOne Pages through GitHub Actions.
- `edge-functions/` is copied into `public/edge-functions/` during the production build so EdgeOne can deploy Pages Functions together with the generated site.

## Theme

Duckquill is added as a git submodule at `themes/duckquill`.

## Newly added languages

- Added language sections: `hi`, `bn`, `pt`, `ur`, `id`, `ja`.
- Ordering rule: language blocks are ordered by broad usage among the newly added languages.

## Production config

- Update `base_url` in `zola.toml` to your final domain before publishing.

## Multiple domains

- Duckquill resources and regular internal navigation are emitted as root-relative URLs, so one generated `public/` directory can be served by multiple domains.
- `base_url` remains the canonical URL for RSS/Atom feeds, Open Graph metadata, and sharing links; those protocols require an absolute public URL.
- For Markdown links that must keep the current browser domain, use a relative path such as `[Home](../../)` instead of Zola's `@/` link syntax, because `@/` deliberately expands to the canonical `base_url`.

## China Unicom SMS login page

`/blog/china-unicom-login/` contains an optional, one-shot China Unicom SMS login tool implemented with EdgeOne Pages Functions. Its source is in:

- `static/js/unicom-login.js` and `static/css/unicom-login.css` for the browser UI;
- `edge-functions/api/unicom/[[default]].js` for the same-origin API.

Before enabling it in production, create the following **production** environment variable in the EdgeOne Pages Makers console. Generate the value with a password manager and keep it out of GitHub, issue trackers, and chat history:

```text
UNICOM_LOGIN_ACCESS_KEY=<long-random-secret>
```

The function refuses authenticated SMS requests until this variable is configured. Also configure EdgeOne WAF rate limiting: at minimum, limit `/api/unicom/send` to 3 requests per source IP per minute and `/api/unicom/*` to 10 requests per source IP per minute. The small in-function hash-based throttle is only supplementary because different edge isolates do not share memory.

The endpoint is intentionally stateless: no database, KV, cookie, local storage, session storage, or server-side session is used. The credential JSON returned by the page is equivalent to a password; never publish it.

## GitHub comments (Giscus)

This site supports Giscus comments for GitHub users.

1. Enable **Discussions** in your GitHub repository settings.
2. Install the **giscus** GitHub App for the repository.
3. Open <https://giscus.app/zh-CN> and generate config values.
4. Fill `extra.giscus.category_id` in `zola.toml`.

After setup, article pages will render a comments section automatically.

### Localized client and theme

- `static/js/giscus-client.js` is a local copy adapted from upstream `giscus/client.ts`.
- `static/css/giscus-duckquill-light.css` and `static/css/giscus-duckquill-dark.css` provide Duckquill-style comment UI.
- `zola.toml` config under `[extra.giscus]` controls host, client script path, and theme values.
