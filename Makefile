# Get version from package.json
VERSION := $(shell ./get-version.js)

GOPATH ?= $(shell go env GOPATH)
WAILS := $(shell command -v wails 2> /dev/null || echo $(GOPATH)/bin/wails)

.PHONY: build dev clean bump

i:
	cd frontend && pnpm install

# Default target
build:
	@echo "Building WailBrew version: $(VERSION)"
	$(WAILS) build -ldflags "-X main.Version=$(VERSION)"

build-universal:
	@echo "Building WailBrew universal binary version: $(VERSION)"
	$(WAILS) build -platform darwin/universal -ldflags "-X main.Version=$(VERSION)"

dev:
	$(WAILS) dev

bump:
	@CURRENT=$$(grep '"version"' frontend/package.json | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/'); \
	MAJOR=$$(echo $$CURRENT | cut -d. -f1); \
	MINOR=$$(echo $$CURRENT | cut -d. -f2); \
	PATCH=$$(echo $$CURRENT | cut -d. -f3); \
	NEW_PATCH=$$((PATCH + 1)); \
	NEW_VERSION="$$MAJOR.$$MINOR.$$NEW_PATCH"; \
	echo "Bumping version: $$CURRENT -> $$NEW_VERSION"; \
	sed -i '' "s/\"version\": \"$$CURRENT\"/\"version\": \"$$NEW_VERSION\"/g" frontend/package.json; \
	sed -i '' "s/\"version\": \"$$CURRENT\"/\"version\": \"$$NEW_VERSION\"/g" wails.json; \
	sed -i '' "s/\"productVersion\": \"$$CURRENT\"/\"productVersion\": \"$$NEW_VERSION\"/g" wails.json; \
	echo "Updated frontend/package.json and wails.json to $$NEW_VERSION"

clean:
	rm -rf build/

install: build
	@echo "Installing WailBrew to /Applications"
	cp -r build/bin/WailBrew.app /Applications/

release: build
	@echo "==> Releasing WailBrew version: $(VERSION)"
	./scripts/release.sh $(VERSION) build/bin/WailBrew.app

release-universal: build-universal
	@echo "==> Releasing WailBrew universal binary version: $(VERSION)"
	./scripts/release.sh $(VERSION) build/bin/WailBrew.app

.DEFAULT_GOAL := build 