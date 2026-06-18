# krabs-cli

The command-line interface for [krabs](https://github.com/augusto-devingcc/krabs) — a self-host personal finance tracker for AI agents.

## Install

### npm
```bash
npm install -g krabs-cli
```

### Homebrew
```bash
brew install augusto-devingcc/krabs/krabs
```

## Setup

After installing, point the CLI at your krabs instance:

```bash
export KRABS_API_KEY=your_api_key
export KRABS_API_URL=http://localhost:3000   # or wherever your instance runs
```

Or put them in `~/.config/krabs/config.json`.

## Common commands

```bash
krabs schema describe            # full operation contract
krabs finance summary            # revenue / expenses / net / MRR / ARR
krabs finance mrr                # MRR breakdown
krabs key list                   # list API keys
krabs action list                # audit log
```

For the full command tree, run `krabs --help`.

## License

MIT — see [LICENSE](../LICENSE) in the main repo.
