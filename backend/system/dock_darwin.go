package system

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

void setDockBadge(const char* label) {
    // Convert to NSString BEFORE dispatch to avoid race condition
    NSString *badgeLabel = label != NULL ? [NSString stringWithUTF8String:label] : @"";
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @autoreleasepool {
            NSApplication *app = [NSApplication sharedApplication];
            if (app == nil) {
                NSLog(@"WailBrew: NSApplication not available for dock badge");
                return;
            }
            
            NSDockTile *dockTile = [app dockTile];
            if (dockTile == nil) {
                NSLog(@"WailBrew: DockTile not available");
                return;
            }
            
            [dockTile setBadgeLabel:badgeLabel];
            [dockTile display]; // Force refresh
            
            NSLog(@"WailBrew: Dock badge set to '%@'", badgeLabel);
        }
    });
}

// Synchronous version for testing
void setDockBadgeSync(const char* label) {
    @autoreleasepool {
        NSApplication *app = [NSApplication sharedApplication];
        if (app == nil) {
            NSLog(@"WailBrew: NSApplication not available for dock badge (sync)");
            return;
        }
        
        NSDockTile *dockTile = [app dockTile];
        if (dockTile == nil) {
            NSLog(@"WailBrew: DockTile not available (sync)");
            return;
        }
        
        NSString *badgeLabel = label != NULL ? [NSString stringWithUTF8String:label] : @"";
        [dockTile setBadgeLabel:badgeLabel];
        [dockTile display]; // Force refresh
        
        NSLog(@"WailBrew: Dock badge set to '%@' (sync)", badgeLabel);
    }
}
*/
import "C"
import (
	"fmt"
	"strconv"
	"unsafe"
)

// SetDockBadge sets the macOS dock badge with the given label
// Pass an empty string to clear the badge
func SetDockBadge(label string) {
	cLabel := C.CString(label)
	defer C.free(unsafe.Pointer(cLabel))
	C.setDockBadge(cLabel)
	fmt.Printf("WailBrew: SetDockBadge called with label: '%s'\n", label)
}

// SetDockBadgeSync sets the macOS dock badge synchronously (for testing)
// Pass an empty string to clear the badge
func SetDockBadgeSync(label string) {
	cLabel := C.CString(label)
	defer C.free(unsafe.Pointer(cLabel))
	C.setDockBadgeSync(cLabel)
	fmt.Printf("WailBrew: SetDockBadgeSync called with label: '%s'\n", label)
}

// SetDockBadgeCount sets the macOS dock badge with a numeric count
// Pass 0 to clear the badge
func SetDockBadgeCount(count int) {
	fmt.Printf("WailBrew: SetDockBadgeCount called with count: %d\n", count)
	if count <= 0 {
		SetDockBadge("")
	} else {
		SetDockBadge(strconv.Itoa(count))
	}
}

// SetDockBadgeCountSync sets the macOS dock badge with a numeric count synchronously
// Pass 0 to clear the badge
func SetDockBadgeCountSync(count int) {
	fmt.Printf("WailBrew: SetDockBadgeCountSync called with count: %d\n", count)
	if count <= 0 {
		SetDockBadgeSync("")
	} else {
		SetDockBadgeSync(strconv.Itoa(count))
	}
}
