# Automated Release Setup

This document describes the automated release workflow for WailBrew using semantic-release and GitHub Actions.

## Overview

The automated release workflow handles the complete release process:

1. **Version Management**: Uses semantic-release to automatically determine the next version based on commit messages
2. **Build & Sign**: Builds the macOS app as a universal binary and signs it with Apple Developer ID
3. **Notarization**: Submits the app to Apple for notarization
4. **Release Creation**: Creates a GitHub release with the signed and notarized ZIP file
5. **Homebrew Update**: Automatically updates the homebrew-wailbrew tap with the new version and SHA256

## Commit Message Convention

The workflow uses [Conventional Commits](https://www.conventionalcommits.org/) to determine version bumps:

- `feat: new feature` → Minor version bump (0.7.0 → 0.8.0)
- `fix: bug fix` → Patch version bump (0.7.0 → 0.7.1)
- `perf: performance improvement` → Patch version bump
- `refactor: code refactoring` → Patch version bump
- `BREAKING CHANGE:` or `!` after type → Major version bump (0.7.0 → 1.0.0)
- `docs:`, `style:`, `test:`, `chore:`, `ci:` → No release

### Examples

```bash
# Patch release (0.7.13 → 0.7.14)
git commit -m "fix: resolve crash when deleting package"

# Minor release (0.7.13 → 0.8.0)
git commit -m "feat: add dark mode support"

# Major release (0.7.13 → 1.0.0)
git commit -m "feat!: redesign UI with new navigation structure"
# or
git commit -m "feat: redesign UI

BREAKING CHANGE: navigation structure changed"

# No release
git commit -m "docs: update README"
git commit -m "chore: update dependencies"
```

## Required GitHub Secrets

You need to configure the following secrets in your GitHub repository settings (Settings → Secrets and variables → Actions → New repository secret):

### 1. Apple Code Signing

#### `APPLE_CERTIFICATES_P12`
Your Apple Developer ID Application certificate exported as a base64-encoded P12 file.

**How to create:**
```bash
# Export certificate from Keychain Access as .p12 file
# Then convert to base64:
base64 -i YourCertificate.p12 | pbcopy
```

#### `APPLE_CERTIFICATES_P12_PASSWORD`
The password you set when exporting the P12 certificate.

#### `APPLE_IDENTITY`
Your Apple Developer ID identity string, e.g.:
```
Developer ID Application: Your Name (TEAM_ID)
```

**How to find:**
```bash
security find-identity -p codesigning -v
```

### 2. Apple Notarization

#### `APPLE_ID`
Your Apple ID email address (e.g., `your.email@example.com`)

#### `APPLE_TEAM_ID`
Your Apple Developer Team ID (10-character alphanumeric string)

**How to find:** Check [Apple Developer Account](https://developer.apple.com/account) → Membership

#### `APPLE_APP_PASSWORD`
An app-specific password for notarization.

**How to create:**
1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. In the Security section, click "Generate Password" under "App-Specific Passwords"
4. Label it "WailBrew Notarization"
5. Copy the generated password

### 3. Homebrew Tap Update

#### `HOMEBREW_TAP_TOKEN`
A GitHub Personal Access Token with permissions to push to your homebrew-wailbrew repository.

**How to create:**
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a descriptive name: "WailBrew Release Automation"
4. Select scopes:
   - `repo` (Full control of private repositories)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again!)

## Workflow Triggers

The release workflow runs automatically on every push to the `main` branch. It will:

1. Analyze commits since the last release
2. Determine if a new release is needed based on commit messages
3. If a release is needed, execute the full release process
4. If no release is needed, skip the build and release steps

## Manual Testing

### Test semantic-release locally

```bash
# Dry run to see what version would be released
npm install
npx semantic-release --dry-run
```

### Test the release script locally

```bash
# Build the app first
make build-universal

# Run the release script (replace VERSION)
IDENTITY="Your Developer ID" \
NOTARY_PROFILE="wailbrew-notary" \
./scripts/release.sh 0.7.14
```

## Workflow Steps Explained

1. **Checkout**: Clones the repository with full history for semantic-release
2. **Setup**: Installs Node.js, pnpm, Go, and Wails
3. **Version Check**: Runs semantic-release in dry-run mode to determine if a release is needed
4. **Build**: Builds the universal macOS binary with the new version
5. **Sign & Notarize**: Uses the release script to sign, notarize, and create the ZIP
6. **Release**: Creates a GitHub release and uploads the ZIP file
7. **Update Homebrew**: Checks out the homebrew-wailbrew repo, updates the cask file, and pushes

## Troubleshooting

### Release workflow fails at code signing
- Check that `APPLE_CERTIFICATES_P12` and `APPLE_CERTIFICATES_P12_PASSWORD` are correct
- Verify the certificate hasn't expired

### Release workflow fails at notarization
- Verify `APPLE_ID`, `APPLE_TEAM_ID`, and `APPLE_APP_PASSWORD` are correct
- Check that the app-specific password hasn't been revoked
- Review notarization logs in the GitHub Actions output

### Homebrew tap update fails
- Verify `HOMEBREW_TAP_TOKEN` has correct permissions
- Ensure the token hasn't expired
- Check that the homebrew-wailbrew repository is accessible

### No release is created
- Check that your commit messages follow the conventional commit format
- Run `npx semantic-release --dry-run` locally to see what semantic-release detects
- Ensure you're pushing to the `main` branch

## Files Created

The automated release setup creates the following files:

- `.releaserc.json` - Semantic-release configuration
- `package.json` - Root package.json with semantic-release dependencies
- `.github/workflows/release.yml` - GitHub Actions workflow
- `CHANGELOG.md` - Auto-generated changelog (created after first release)

## First Release After Setup

After setting up all secrets, push a commit with a conventional commit message to trigger your first automated release:

```bash
git add .
git commit -m "ci: setup automated release workflow"
git push origin main
```

Then make a change to trigger an actual release:

```bash
# Make some changes...
git commit -m "feat: setup automated release workflow"
git push origin main
```

Watch the GitHub Actions tab to see the workflow in action!

## Benefits

✅ **Consistent versioning** based on semantic versioning and commit messages  
✅ **Automated changelog** generation from commit history  
✅ **No manual version bumps** - everything is automatic  
✅ **Automatic Homebrew updates** - users get updates immediately  
✅ **Code signing & notarization** handled automatically  
✅ **GitHub releases** with attached assets  
✅ **Parallel updates** - GitHub release and Homebrew cask updated in one workflow  

## Notes

- The workflow includes `[skip ci]` in the version bump commit to avoid triggering another workflow run
- The workflow only runs on pushes to `main`, not on pull requests
- Semantic-release tracks releases using git tags, so don't manually delete version tags
- The CHANGELOG.md file is automatically generated and committed

