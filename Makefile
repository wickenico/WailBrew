# Get version from package.json
VERSION := $(shell ./get-version.js)

GOPATH ?= $(shell go env GOPATH)
WAILS := $(shell command -v wails 2> /dev/null || echo $(GOPATH)/bin/wails)

.PHONY: build dev clean

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