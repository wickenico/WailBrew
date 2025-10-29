#!/bin/bash
# Askpass helper for GUI sudo password prompts
# This script displays a native macOS dialog to prompt for the sudo password
# This script must output the password to stdout and exit with 0 on success, or exit with 1 on failure
password=$(osascript <<'EOF'
try
    display dialog "WailBrew requires administrator privileges to upgrade certain packages. Please enter your password:" default answer "" with icon caution with title "Administrator Password Required" with hidden answer
    set result to text returned of result
    return result
on error
    -- User cancelled or error occurred
    return ""
end try
EOF
)
if [ -z "$password" ]; then
    exit 1
fi
echo -n "$password"

