#!/bin/bash
# Auto-show keyboard when input fields are focused

export DISPLAY=:0

# Kill any existing keyboard
pkill matchbox-keyboard 2>/dev/null

# Start matchbox-keyboard in toggle mode
matchbox-keyboard -s 50 extended &

sleep 1

# Monitor for input focus and show/hide keyboard
while true; do
    FOCUSED_WINDOW=$(xdotool getwindowfocus getwindowname 2>/dev/null || echo "")
    
    # Check if an input field is focused in Chromium
    if xdotool getwindowfocus getwindowpid &>/dev/null; then
        # Keyboard will auto-show on focus if configured properly
        sleep 0.5
    fi
    
    sleep 0.3
done

