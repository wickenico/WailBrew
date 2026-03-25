package system

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa

#import <Cocoa/Cocoa.h>

void setAppAppearance(const char* appearanceName) {
    NSString *name = [NSString stringWithUTF8String:appearanceName];
    dispatch_async(dispatch_get_main_queue(), ^{
        @autoreleasepool {
            NSAppearance *appearance = [NSAppearance appearanceNamed:name];
            [NSApp setAppearance:appearance];
        }
    });
}
*/
import "C"
import "unsafe"

// SetAppearanceDark sets the native macOS window chrome to dark mode
func SetAppearanceDark() {
	name := C.CString("NSAppearanceNameDarkAqua")
	defer C.free(unsafe.Pointer(name))
	C.setAppAppearance(name)
}

// SetAppearanceLight sets the native macOS window chrome to light mode
func SetAppearanceLight() {
	name := C.CString("NSAppearanceNameAqua")
	defer C.free(unsafe.Pointer(name))
	C.setAppAppearance(name)
}
