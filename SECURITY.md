# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub: [report a vulnerability](https://github.com/xLion-ch/TimeLion/security/advisories/new) (Security tab → "Report a vulnerability"). Don't open a public issue. English or German is fine.

Helpful in a report: what is affected, how to reproduce it, and what an attacker gains. We will reply as soon as we can, keep you updated while we work on a fix, and credit you in the advisory if you like. There is no bug bounty.

The same contact is published at [timelion.ch/.well-known/security.txt](https://timelion.ch/.well-known/security.txt).

## Scope

The code in this repository and the instance at [timelion.ch](https://timelion.ch). Especially interesting:

- anything that lets the server, another site or a third party read poll content, keys or tokens
- changing or deleting polls and responses without the matching admin or edit token
- ways around the Content Security Policy, or script injection through poll content

Known limitations of the design are not vulnerabilities (see [CLAUDE.md → Encryption design](CLAUDE.md#encryption-design)): a compromised server could ship malicious JavaScript, a lost link means a lost poll, and the server sees metadata such as IDs, timestamps, sizes and, in the host's access logs, IP addresses.

For a self-hosted instance, contact its operator; report the problem here too if it is in TimeLion's code.

## Supported versions

Only the latest version on `main`, which runs on timelion.ch, receives fixes.
