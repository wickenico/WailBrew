# Get version from package.json
VERSION := $(shell ./get-version.js)

.PHONY: build dev clean

i:
	cd frontend && pnpm install

# Default target
build:
	@echo "Building WailBrew version: $(VERSION)"
	wails build -ldflags "-X main.Version=$(VERSION)"

build-universal:
	@echo "Building WailBrew universal binary version: $(VERSION)"
	wails build -platform darwin/universal -ldflags "-X main.Version=$(VERSION)"

dev:
	wails dev

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