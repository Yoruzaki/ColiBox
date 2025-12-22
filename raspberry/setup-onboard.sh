#!/usr/bin/env bash
# Script to install and configure Onboard on-screen keyboard

set -euo pipefail

echo "Installing Onboard on-screen keyboard..."
sudo apt update
sudo apt install -y onboard

echo "Creating Onboard configuration directory..."
mkdir -p ~/.config/onboard

echo "Configuring Onboard for auto-show on input focus..."
cat > ~/.config/onboard/onboard.conf << 'EOF'
[main]
layout=Compact
theme=Nightshade

[window]
docking-enabled=true
docking-edge=bottom
window-decoration=false

[auto-show]
enabled=true
hide-on-key-press=false

[keyboard]
touch-input=true
sticky-keys=false

[theme-settings]
key-size=1.2
key-stroke-width=1.0
roundrect-radius=2.0
EOF

echo "Making kiosk script executable..."
chmod +x ~/smart-locker/ColiBox/raspberry/kiosk-xinit.sh

echo ""
echo "✅ Onboard configured successfully!"
echo ""
echo "The keyboard will now:"
echo "  - Appear automatically when you click on text inputs"
echo "  - Hide when not needed"
echo "  - Stay docked at the bottom of the screen"
echo ""
echo "Restart the kiosk service to apply changes:"
echo "  sudo systemctl restart kiosk-browser"
echo ""

