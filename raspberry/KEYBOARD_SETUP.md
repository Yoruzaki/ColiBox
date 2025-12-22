# Configuration du Clavier Virtuel

## Installation du clavier à l'écran

### Option 1: Matchbox-Keyboard (Simple et léger)

```bash
sudo apt update
sudo apt install -y matchbox-keyboard
```

### Option 2: Onboard (Plus avancé avec auto-show)

```bash
sudo apt update
sudo apt install -y onboard
```

## Configuration pour Chromium

Le fichier `kiosk-xinit.sh` lance déjà le clavier automatiquement.

### Pour Matchbox-Keyboard

Si vous voulez que le clavier apparaisse automatiquement :

```bash
# Installer xdotool
sudo apt install -y xdotool

# Rendre le script exécutable
chmod +x /home/pi/smart-locker/ColiBox/raspberry/start-keyboard.sh
```

### Pour Onboard (Recommandé)

Onboard peut auto-afficher le clavier quand un champ est sélectionné.

1. **Modifier kiosk-xinit.sh** pour utiliser onboard:

```bash
# Remplacer la ligne matchbox-keyboard par:
onboard &
```

2. **Configuration d'Onboard**:

```bash
# Créer le fichier de config
mkdir -p ~/.config/onboard
cat > ~/.config/onboard/onboard.conf << 'EOF'
[main]
layout=Compact
theme=Nightshade
key-label-font=Ubuntu 9
key-label-overrides={}

[window]
docking-enabled=true
docking-edge=bottom

[auto-show]
enabled=true
hide-on-key-press=true

[keyboard]
touch-input=true
EOF
```

3. **Redémarrer le kiosk**:

```bash
sudo systemctl restart kiosk-browser
```

## Test

1. Ouvrir l'interface ColiGoo
2. Cliquer sur un champ de saisie
3. Le clavier devrait apparaître automatiquement

## Désactiver le clavier physique (optionnel)

Si vous voulez forcer l'utilisation du clavier virtuel uniquement :

```bash
sudo nano /etc/X11/xorg.conf.d/10-keyboard.conf
```

Ajouter:
```
Section "InputClass"
    Identifier "Disable built-in keyboard"
    MatchIsKeyboard "on"
    Option "Ignore" "on"
EndSection
```

**Note**: Ne faites cela que si vous avez un clavier virtuel fonctionnel!

