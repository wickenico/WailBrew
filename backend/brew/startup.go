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

	// Run all data fetches in parallel
	// The executor's cache will deduplicate any overlapping brew commands
	wg.Add(5)

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
		result.Leaves = s.listService.GetBrewLeaves()
	}()

	go func() {
		defer wg.Done()
		result.Taps = s.listService.GetBrewTaps()
	}()

	wg.Wait()
	return result
}

// GetStartupDataWithUpdate fetches all startup data after updating the database
// Use this when you want to ensure fresh data (e.g., manual refresh)
func (s *StartupService) GetStartupDataWithUpdate() (*StartupData, string, error) {
	// Update database first (has its own 5-minute cache)
	output, err := s.databaseService.UpdateBrewDatabaseWithOutput()
	if err != nil {
		// Continue anyway - we can still show current data
		output = ""
	}

	// Now fetch all data
	data := s.GetStartupData()
	return data, output, err
}
