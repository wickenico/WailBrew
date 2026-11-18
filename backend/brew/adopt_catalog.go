package brew

import (
	"context"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// The cask catalog comes from Homebrew's public JSON API. `brew info
// --eval-all` would be the brew-native source, but Homebrew 7 disabled it, and
// the internal API cache under ~/Library/Caches/Homebrew/api is an unstable
// format. The download is ~2 MB gzipped and revalidated with an ETag.
const (
	defaultHomebrewAPIDomain = "https://formulae.brew.sh/api"
	catalogFetchTimeout      = 60 * time.Second
	catalogCacheFileName     = "cask-catalog.json"
	catalogETagFileName      = "cask-catalog.etag"
)

// caskCatalog fetches and caches the cask catalog.
type caskCatalog struct {
	getEnv   func() []string
	cacheDir func() (string, error)
	client   func(env []string) *http.Client

	mu     sync.Mutex
	casks  []catalogCask
	etag   string
	stale  bool
	loaded bool
}

func newCaskCatalog(getEnv func() []string) *caskCatalog {
	return &caskCatalog{
		getEnv:   getEnv,
		cacheDir: defaultCatalogCacheDir,
		client:   proxyAwareClient,
	}
}

func defaultCatalogCacheDir() (string, error) {
	base, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "WailBrew"), nil
}

// envValue returns the last value of key in env, falling back to the process
// environment.
func envValue(env []string, key string) string {
	value := ""
	for _, kv := range env {
		if v, ok := strings.CutPrefix(kv, key+"="); ok {
			value = v
		}
	}
	if value == "" {
		value = os.Getenv(key)
	}
	return value
}

// proxyAwareClient honours the proxy configured in WailBrew (passed to brew as
// https_proxy) and otherwise the process environment.
func proxyAwareClient(env []string) *http.Client {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if proxy := envValue(env, "https_proxy"); proxy != "" {
		if proxyURL, err := url.Parse(proxy); err == nil {
			transport.Proxy = http.ProxyURL(proxyURL)
		}
	}
	return &http.Client{Transport: transport, Timeout: catalogFetchTimeout}
}

func (c *caskCatalog) catalogURL(env []string) string {
	domain := strings.TrimRight(envValue(env, "HOMEBREW_API_DOMAIN"), "/")
	if domain == "" {
		domain = defaultHomebrewAPIDomain
	}
	return domain + "/cask.json"
}

// Load returns the catalog, revalidating it against the server. When the
// network is unavailable a previously cached copy is used and stale is true.
func (c *caskCatalog) Load(ctx context.Context) (casks []catalogCask, stale bool, err error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.loaded {
		c.loadFromDisk()
	}

	env := c.getEnv()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.catalogURL(env), nil)
	if err != nil {
		return nil, false, err
	}
	req.Header.Set("User-Agent", "WailBrew")
	if c.etag != "" && c.casks != nil {
		req.Header.Set("If-None-Match", c.etag)
	}

	resp, fetchErr := c.client(env).Do(req)
	if fetchErr == nil {
		defer func() { _ = resp.Body.Close() }()
		switch {
		case resp.StatusCode == http.StatusNotModified && c.casks != nil:
			c.stale = false
			return c.casks, false, nil
		case resp.StatusCode == http.StatusOK:
			body, readErr := io.ReadAll(resp.Body)
			if readErr != nil {
				fetchErr = readErr
				break
			}
			var parsed []catalogCask
			if jsonErr := json.Unmarshal(body, &parsed); jsonErr != nil {
				fetchErr = fmt.Errorf("parsing cask catalog: %w", jsonErr)
				break
			}
			c.casks, c.etag, c.stale, c.loaded = parsed, resp.Header.Get("ETag"), false, true
			c.saveToDisk(body)
			return c.casks, false, nil
		default:
			fetchErr = fmt.Errorf("cask catalog request failed: HTTP %d", resp.StatusCode)
		}
	}

	if c.casks != nil {
		c.stale = true
		return c.casks, true, nil
	}
	return nil, false, fetchErr
}

func (c *caskCatalog) loadFromDisk() {
	c.loaded = true
	dir, err := c.cacheDir()
	if err != nil {
		return
	}
	body, err := os.ReadFile(filepath.Join(dir, catalogCacheFileName))
	if err != nil {
		return
	}
	var parsed []catalogCask
	if err := json.Unmarshal(body, &parsed); err != nil {
		return
	}
	c.casks = parsed
	if etag, err := os.ReadFile(filepath.Join(dir, catalogETagFileName)); err == nil {
		c.etag = strings.TrimSpace(string(etag))
	}
}

// saveToDisk is best effort: failing to cache only costs a re-download.
func (c *caskCatalog) saveToDisk(body []byte) {
	dir, err := c.cacheDir()
	if err != nil || os.MkdirAll(dir, 0o755) != nil {
		return
	}
	tmp := filepath.Join(dir, catalogCacheFileName+".tmp")
	if os.WriteFile(tmp, body, 0o644) != nil {
		return
	}
	if os.Rename(tmp, filepath.Join(dir, catalogCacheFileName)) != nil {
		_ = os.Remove(tmp)
		return
	}
	_ = os.WriteFile(filepath.Join(dir, catalogETagFileName), []byte(c.etag), 0o644)
}

// readInfoPlist converts a (possibly binary) Info.plist to XML with plutil and
// returns its top-level string values.
func readInfoPlist(path string) (map[string]string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, "/usr/bin/plutil", "-convert", "xml1", "-o", "-", path).Output()
	if err != nil {
		return nil, err
	}
	return parsePlistStrings(out)
}

// parsePlistStrings extracts the string values of the top-level <dict> of an
// XML property list. Nested dictionaries and arrays are skipped.
func parsePlistStrings(data []byte) (map[string]string, error) {
	decoder := xml.NewDecoder(strings.NewReader(string(data)))
	decoder.Strict = false
	values := map[string]string{}
	depth := 0 // depth inside the top-level dict; 0 = not yet inside it
	key := ""
	expectKey := true
	for {
		token, err := decoder.Token()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, err
		}
		switch t := token.(type) {
		case xml.StartElement:
			if depth == 0 {
				if t.Name.Local == "dict" {
					depth = 1
				}
				continue
			}
			if depth > 1 {
				if t.Name.Local == "dict" || t.Name.Local == "array" {
					depth++
				}
				continue
			}
			switch t.Name.Local {
			case "key":
				var k string
				if err := decoder.DecodeElement(&k, &t); err != nil {
					return nil, err
				}
				key, expectKey = k, false
			case "string":
				var v string
				if err := decoder.DecodeElement(&v, &t); err != nil {
					return nil, err
				}
				if !expectKey {
					values[key] = v
				}
				expectKey = true
			case "dict", "array":
				depth++
				expectKey = true
			default:
				if err := decoder.Skip(); err != nil {
					return nil, err
				}
				expectKey = true
			}
		case xml.EndElement:
			if depth > 1 && (t.Name.Local == "dict" || t.Name.Local == "array") {
				depth--
			} else if depth == 1 && t.Name.Local == "dict" {
				return values, nil
			}
		}
	}
	return values, nil
}
