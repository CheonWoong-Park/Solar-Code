# $ship skill

Pre-ship checklist for releasing code. Run through each item:

1. **Tests** — are all tests passing? (`npm test` / `cargo test`)
2. **Lint** — no lint errors? (`npm run lint`)
3. **Type Check** — no TypeScript errors?
4. **Review** — run `oms review` on the diff
5. **Changelog** — is CHANGELOG.md updated?
6. **Version** — is version bumped appropriately?
7. **Documentation** — are docs updated?
8. **Breaking Changes** — are any breaking changes noted?
9. **Security** — no secrets committed? No new vulnerabilities?

Report: SHIP / HOLD with reasons.
