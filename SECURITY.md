# Security Policy

## Supported Versions

PaletteSmith is currently maintained on the latest version in `main`.

## Reporting a Vulnerability

If you discover a security issue, please do not open a public GitHub issue with exploit details.

Instead:

1. Contact the maintainer privately.
2. Include a clear description of the issue.
3. Include reproduction steps, impact, and any suggested mitigation if you have one.

Please include:

- affected version or commit
- environment details
- proof of concept or reproduction steps
- potential impact

We will aim to:

- acknowledge receipt within a reasonable timeframe
- investigate the report
- confirm severity and scope
- publish a fix when appropriate

## Response Timeline

We aim to:

- acknowledge new reports within 5 business days
- provide an initial triage update within 10 business days
- share status updates during active investigation when possible

Response times are best-effort and may vary depending on severity, report quality, and maintainer availability.

## Severity Guidance

Reports are generally prioritized using the following rough severity levels:

- Critical: issues that could enable major unauthorized access, malicious code execution, or severe data compromise
- High: issues that could expose sensitive data, unsafe document access, or meaningful privilege misuse
- Medium: issues with real security impact but narrower blast radius or stronger preconditions
- Low: defense-in-depth issues, minor permission concerns, or low-impact edge cases

Severity depends on exploitability, user impact, scope, and whether meaningful mitigations already exist.

## Disclosure Timeline

Please allow time for investigation and remediation before public disclosure.

Our general goal is to:

- validate the issue first
- prepare a fix or mitigation when possible
- coordinate a reasonable disclosure timeline with the reporter

If a vulnerability is confirmed, we may publish a fix, advisory, or changelog note once users have a reasonable path to update or mitigate.

## Scope Notes

This project is a Figma plugin and may involve:

- manifest permissions
- variable/style generation
- plugin UI rendering
- local export behavior

Reports related to unsafe permissions, unexpected document access, data leakage, or malicious export behavior are especially helpful.
