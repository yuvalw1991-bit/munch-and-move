# Tailwind static build (replaces cdn.tailwindcss.com runtime compiler)

The live app used the Tailwind Play CDN (runtime JIT) which fails on older
Android WebView/browsers, leaving the app unstyled. We now ship a precompiled
static `tailwind.css` at project root instead.

## Rebuild after adding/removing Tailwind classes in index.html
From this folder:

    npx -y tailwindcss@3.4.17 -c ./tailwind.config.cjs -i ./input.css -o "../../tailwind.css" --minify

`tailwind.config.cjs` scans ../../index.html for class names and replicates the
old inline config (colors: ink/panel/panel2/line, font: Polin).

Note: only literal class strings are detected. Do not build class names by
string concatenation (e.g. `bg-${color}`) — add such classes to `safelist`
in the config instead.
