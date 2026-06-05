package brew

import (
	"sync"
)

// StartupData contains all data needed for app initialization
type StartupData struct {
	Packages  [][]string `json:"packages"`
	Casks     [][]string `json:"casks"`
	Updatable [][]string `json:"updatable"`
	Leaves    []string   `json:"leaves"`
	Taps      [][]string `json:"taps"`
}

// StartupService provides optimized startup data loading
type StartupService struct {
	listService     *ListService
	outdatedService *OutdatedService
	databaseService *DatabaseService
}

// NewStartupService creates a new startup service
func NewStartupService(
	listService *ListService,
	outdatedService *OutdatedService,
	databaseService *DatabaseService,
) *StartupService {
	return &StartupService{
		listService:     listService,
		outdatedService: outdatedService,
		databaseService: databaseService,
	}
}

// GetStartupData fetches all startup data in parallel with deduplication
// This replaces multiple individual calls from the frontend
func (s *StartupService) GetStartupData() *StartupData {
	var wg sync.WaitGroup
	result := &StartupData{}

	// Run data fetches in parallel; leaves runs afterward to avoid Homebrew lock contention
	wg.Add(4)

	go func() {
		defer wg.Done()
		result.Packages = s.listService.GetBrewPackages()
	}()

	go func() {
		defer wg.Done()
		result.Casks = s.listService.GetBrewCasks()
	}()

	go func() {
		defer wg.Done()
		// GetBrewUpdatablePackages already handles its own validation
		result.Updatable = s.outdatedService.GetBrewUpdatablePackages()
	}()

	go func() {
		defer wg.Done()
		result.Taps = s.listService.GetBrewTaps()
	}()

	wg.Wait()
	result.Leaves = s.listService.GetBrewLeaves()
	return result
}

// GetStartupDataWithUpdate fetches all startup data after updating the database
// Use this when you want to ensure fresh data (e.g., manual refresh or startup)
// Optimized to run database update in parallel with fetching other data to minimize startup time
// Returns only StartupData (like GetStartupData) to match Wails binding expectations
func (s *StartupService) GetStartupDataWithUpdate() *StartupData {
	var wg sync.WaitGroup
	result := &StartupData{}

	// Start database update in background (has its own 5-minute cache, so often returns immediately)
	wg.Add(1)
	go func() {
		defer wg.Done()
		// Update database - errors are ignored as we can still show current data
		_, _ = s.databaseService.UpdateBrewDatabaseWithOutput()
	}()

	// Fetch other data in parallel (these don't require fresh database)
	wg.Add(3)

	go func() {
		defer wg.Done()
		result.Packages = s.listService.GetBrewPackages()
	}()

	go func() {
		defer wg.Done()
		result.Casks = s.listService.GetBrewCasks()
	}()

	go func() {
		defer wg.Done()
		result.Taps = s.listService.GetBrewTaps()
	}()

	// Wait for database update and other data to complete
	wg.Wait()

	// Fetch outdated packages and leaves after parallel brew commands finish
	// to avoid Homebrew lock contention causing false timeouts
	result.Updatable = s.outdatedService.GetBrewUpdatablePackages()
	result.Leaves = s.listService.GetBrewLeaves()

	return result
}
