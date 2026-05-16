# Releasing the krabs CLI

## npm

```bash
cd cli
pnpm build
npm publish --access public
```

## Homebrew

After publishing to npm:
1. Get the tarball sha256: `curl -sL https://registry.npmjs.org/krabs-cli/-/krabs-cli-X.Y.Z.tgz | shasum -a 256`
2. Update `Formula/krabs.rb` with the new version and sha256
3. Copy `Formula/krabs.rb` to the `augusto-devingcc/homebrew-krabs` repo on a `vX.Y.Z` branch
4. Open a PR to that repo
5. Once merged, users can `brew install augusto-devingcc/krabs/krabs`
