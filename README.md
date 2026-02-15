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

- This repository only handles content and static build.
- Hosting and service management are intentionally not included.

## Theme

Duckquill is added as a git submodule at `themes/duckquill`.

## Production config

- Update `base_url` in `zola.toml` to your final domain before publishing.

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
