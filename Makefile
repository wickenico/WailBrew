# Get version from package.json
VERSION := $(shell ./get-version.js)

GOPATH ?= $(shell go env GOPATH)
WAILS := $(shell command -v wails3 2> /dev/null || echo $(GOPATH)/bin/wails3)

UNAME_S := $(shell uname -s)
ifeq ($(UNAME_S),Darwin)
	SED_I := sed -i ''
else
	SED_I := sed -i
endif

.PHONY: i build build-universal dev bindings clean bump bump-minor update-deps update-cli install release-check release release-universal release-notes

i:
	cd frontend && pnpm install

# Default target. Builds build/bin/WailBrew.app; build/darwin/Taskfile.yml
# injects the version via -X main.Version.
build:
	@echo "Building WailBrew version: $(VERSION)"
	$(WAILS) task darwin:package

build-universal:
	@echo "Building WailBrew universal binary version: $(VERSION)"
	$(WAILS) task darwin:package:universal

dev:
	$(WAILS) dev

# Regenerate frontend/bindings after changing exported App methods.
bindings:
	$(WAILS) generate bindings -ts -clean=true

bump:
	@CURRENT=$$(grep '"version"' frontend/package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/'); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | cut -d. -f3); \
	NEW_PATCH=$$((PATCH + 1)); \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
	echo "Bumping version: $$CURRENT -> $$NEW_VERSION"; \
	$(SED_I) "s/\"version\": \"$$CURRENT\"/\"version\": \"$$NEW_VERSION\"/g" frontend/package.json; \
	$(SED_I) "s/version: \"$$CURRENT\"/version: \"$$NEW_VERSION\"/" build/config.yml; \
	$(SED_I) "s/<string>$$CURRENT<\/string>/<string>$$NEW_VERSION<\/string>/g" build/darwin/Info.plist build/darwin/Info.dev.plist; \
	echo "Updated frontend/package.json, build/config.yml and darwin plists to $$NEW_VERSION"

bump-minor:
	@CURRENT=$$(grep '"version"' frontend/package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/'); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	NEW_MINOR=$$((MINOR + 1)); \
	NEW_VERSION="$$MAJOR.$$NEW_MINOR.0"; \
	echo "Bumping minor version: $$CURRENT -> $$NEW_VERSION"; \
	$(SED_I) "s/\"version\": \"$$CURRENT\"/\"version\": \"$$NEW_VERSION\"/g" frontend/package.json; \
	$(SED_I) "s/version: \"$$CURRENT\"/version: \"$$NEW_VERSION\"/" build/config.yml; \
	$(SED_I) "s/<string>$$CURRENT<\/string>/<string>$$NEW_VERSION<\/string>/g" build/darwin/Info.plist build/darwin/Info.dev.plist; \
	echo "Updated frontend/package.json, build/config.yml and darwin plists to $$NEW_VERSION"

update-deps:
	@echo "Updating Go dependencies"
	# Scope discovery to Go sources to avoid pnpm symlinks in frontend/node_modules.
	go get -u . ./backend/... ./i18n/... && go mod tidy

update-cli:
	@echo "Updating Wails CLI"
	# Keep the CLI in lockstep with the wails/v3 version pinned in go.mod.
	go install github.com/wailsapp/wails/v3/cmd/wails3@$$(go list -m -f '{{.Version}}' github.com/wailsapp/wails/v3)

# Only remove build output; build/ also holds config.yml, Taskfiles and plists.
clean:
	rm -rf build/bin/

install: build
	@echo "Installing WailBrew to /Applications"
	cp -r build/bin/WailBrew.app /Applications/

# Checks branch, clean tree, pushed state, version, tag and signing identity
# without changing anything; the release targets run it before building.
release-check:
	./scripts/release.sh --preflight $(VERSION)

# Build, sign, notarize, tag v$(VERSION) and publish the GitHub release with
# the zip. Always universal (arm64 + x86_64) so Intel Macs keep working.
# NOTES_FILE=path uses hand-written notes; YES=1 skips the prompt.
release: release-check
	@echo "==> Releasing WailBrew universal binary version: $(VERSION)"
	$(MAKE) build-universal
	./scripts/release.sh $(VERSION) build/bin/WailBrew.app

release-universal: release

# Preview the generated release notes for the current version.
release-notes:
	@./scripts/release-notes.sh $(VERSION)

.DEFAULT_GOAL := build
