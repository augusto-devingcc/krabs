# krabs-cli

The command-line interface for [krabs.dev](https://krabs.dev) — a CRM for AI agents.

## Install

### npm
```bash
npm install -g krabs-cli
```

### Homebrew
```bash
brew install augusto-devingcc/krabs/krabs
```

### Standalone (no install)
```bash
pnpm dlx krabs-cli auth login
```

## Authenticate

```bash
krabs auth login
```

Opens a browser. Sign in with your krabs.dev account, approve the device. The CLI receives a token and saves it to `~/.config/krabs/config.json`.

## Common commands

```bash
krabs auth status                # who am I
krabs contact list               # list contacts
krabs contact create --email "lisa@acme.com" --name "Lisa Ortega"
krabs deal create --contact ctc_... --amount 12000 --stage qualified
krabs schema describe            # the full operation contract
```

For the full command tree, run `krabs --help`.

## License

MIT — see [LICENSE](../LICENSE) in the main repo.
