export const XCODE_LICENSE_COMMAND = "sudo xcodebuild -license accept";

// Match Homebrew's diagnostic, not general Xcode failures or license metadata.
export function isXcodeLicenseError(message: unknown): boolean {
    return typeof message === "string" && /you have not agreed to the xcode license/i.test(message);
}
