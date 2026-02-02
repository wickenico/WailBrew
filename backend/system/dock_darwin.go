package system

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa
#import <Cocoa/Cocoa.h>

void setDockBadge(const char* label) {
    dispatch_async(dispatch_get_main_queue(), ^{
        NSString *badgeLabel = [NSString stringWithUTF8String:label];
        [[[NSApplication sharedApplication] dockTile] setBadgeLabel:badgeLabel];
    });
}
*/
import "C"
import (
	"strconv"
	"unsafe"
)

// SetDockBadge sets the macOS dock badge with the given label
// Pass an empty string to clear the badge
func SetDockBadge(label string) {
	cLabel := C.CString(label)
	defer C.free(unsafe.Pointer(cLabel))
	C.setDockBadge(cLabel)
}

// SetDockBadgeCount sets the macOS dock badge with a numeric count
// Pass 0 to clear the badge
func SetDockBadgeCount(count int) {
	if count <= 0 {
		SetDockBadge("")
	} else {
		SetDockBadge(strconv.Itoa(count))
	}
}
