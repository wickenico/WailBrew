# Security Policy

## Supported versions

Security fixes are released for the latest version of WailBrew only. Please update before reporting an issue:

```bash
brew upgrade --cask wailbrew
```

## Reporting a vulnerability

Please **do not open a public issue** for security problems.

Report vulnerabilities privately through GitHub instead:
[**Report a vulnerability**](https://github.com/wickenico/WailBrew/security/advisories/new)

Include as much of the following as you can:

- The WailBrew version and your macOS version
- What an attacker could do and under which conditions
- Steps to reproduce, or a proof of concept

WailBrew is maintained in spare time, but security reports are handled first. Once a fix is released, the advisory is published and you're credited, unless you prefer to stay anonymous.

## Scope

WailBrew runs the `brew` command-line tool on your behalf. Vulnerabilities in Homebrew itself or in packages installed through it should be reported to the [Homebrew project](https://github.com/Homebrew/brew/security/policy) or the package maintainers.
