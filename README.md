# Afribit Pay

A non-custodial Bitcoin wallet for everyday spending, built for Kibera, Nairobi.

Buy Bitcoin with M-Pesa. Spend it anywhere M-Pesa is accepted — scan a till, a paybill, or send to a phone number. Hold your own keys the entire time.

## Why this exists

People in Kibera already use Bitcoin day to day, but doing it well currently means juggling at least two separate apps: one to buy, another to spend. Afribit Pay unifies that into one wallet, without asking anyone to give up control of their money to do it.

Built by [Afribit Africa](https://afribit.africa), a Kibera-based Bitcoin circular economy organization onboarding merchants and running education programs on the ground since 2019.

## What it does

- **Non-custodial wallet** — forked from [Blink](https://github.com/blinkbitcoin/blink)'s open-source, MIT-licensed core, built on the Spark protocol. Users hold their own recovery phrase; nobody at Afribit can access their funds.
- **Buy Bitcoin with M-Pesa** — instant on-ramp via the Bitika API, sats delivered straight to the user's own wallet.
- **Spend Bitcoin via M-Pesa** — scan a QR code that recognizes either a Lightning invoice/address or a Kenyan M-Pesa QR code (till or paybill), or send directly to a phone number. The recipient gets shillings; they never have to touch Bitcoin.

## Status

Pre-launch, active development. Not yet live with real funds. See [ROADMAP.md](./docs/ROADMAP.md) for where things stand and [PRD.md](./docs/PRD.md) for the full product spec.

## Repo structure

```
afribit-pay/
├── apps/
│   └── mobile/          # the wallet app itself (Blink 3.0 fork)
├── brand/
│   ├── logo/             # vector logo source and exports
│   └── brand-book/        # brand brief, color and type specs
├── landing/               # marketing / product-showcase site
├── docs/
│   ├── PRD.md
│   ├── ROADMAP.md
│   ├── SETUP.md
│   └── decisions/          # short write-ups on decisions like off-ramp provider choice
├── CONTRIBUTING.md
└── README.md
```

## Contributing

We're building this in the open and welcome outside help — see [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

MIT, inherited from Blink's core. See `LICENSE`.

## Security

If you find a security issue, please do not open a public GitHub issue. See the Security section in [CONTRIBUTING.md](./CONTRIBUTING.md) for responsible disclosure.