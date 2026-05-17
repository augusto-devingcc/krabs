# Releasing `krabs-cli`

The npm package lives in this `cli/` workspace; the Homebrew formula lives at
`../Formula/krabs.rb`. Cut a release in two steps: npm first, then Homebrew.

## 1. npm

Run from `cli/` (this directory):

```bash
# One-time: log in to npm with the account that will own krabs-cli.
npm login          # interactive — needs OTP if you have 2FA on

# Verify what will ship (no upload):
pnpm build
npm pack --dry-run

# Publish (public scope-less name → tarball is permanent ~72h after upload):
npm publish --access public
```

The `prepublishOnly` hook re-runs `pnpm build` so you can't accidentally publish
a stale `dist/`. The `files` array in `package.json` pins what ships: `dist/`,
`README.md`, `LICENSE` only — no source, no sourcemaps, no lockfile.

After publish, smoke-test from a clean shell:

```bash
npx krabs-cli@latest --version
# or
npm install -g krabs-cli && krabs --version
```

## 2. Homebrew

```bash
# Compute the sha256 of the just-uploaded tarball:
curl -sL https://registry.npmjs.org/krabs-cli/-/krabs-cli-0.5.0.tgz \
  | shasum -a 256

# Edit ../Formula/krabs.rb:
#   - confirm `url` matches the version you published
#   - replace `PLACEHOLDER_REPLACE_AFTER_NPM_PUBLISH` with the sha256 above

# Copy the formula into the tap repo (separate GitHub repo):
#   augusto-devingcc/homebrew-krabs   →   Formula/krabs.rb
# Open a PR on a vX.Y.Z branch, merge.

# Users install with:
brew install augusto-devingcc/krabs/krabs
```

## Versioning

The CLI tracks the main repo's `package.json` version. Bump both together
before publishing. The CLI's own `package.json` is in this directory.
