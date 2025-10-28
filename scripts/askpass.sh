#!/bin/bash
# Askpass helper for GUI sudo password prompts
# This script displays a native macOS dialog to prompt for the sudo password

osascript <<EOF
display dialog "WailBrew requires administrator privileges to upgrade certain packages. Please enter your password:" default answer "" with icon caution with title "Administrator Password Required" with hidden answer
text returned of result
EOF

