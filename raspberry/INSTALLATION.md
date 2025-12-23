# 🚀 Guide d'Installation Complet - ColiGoo Raspberry Pi Kiosk

Ce guide vous accompagne pas à pas pour installer et configurer le système de kiosque ColiGoo sur un Raspberry Pi.

## 📋 Prérequis

### Matériel
- Raspberry Pi 4 (2GB RAM minimum, 4GB recommandé)
- Carte SD 16GB minimum (32GB recommandé)
- Écran tactile 7" ou écran HDMI
- Arduino Mega connecté via USB
- Alimentation 5V 3A pour Raspberry Pi
- Connexion Internet (Ethernet ou WiFi)

### Logiciels
- Raspberry Pi Imager
- Connexion SSH (PuTTY sur Windows, Terminal sur Mac/Linux)

---

## 📥 Étape 1: Installation de Raspberry Pi OS

### 1.1 Flasher la carte SD

1. Téléchargez **Raspberry Pi Imager**: https://www.raspberrypi.com/software/
2. Insérez la carte SD dans votre ordinateur
3. Ouvrez Raspberry Pi Imager
4. **Operating System** → Raspberry Pi OS (64-bit) - **Bookworm** recommandé
5. **Storage** → Sélectionnez votre carte SD
6. Cliquez sur l'icône ⚙️ **Settings**:
   - ✅ Enable SSH
   - ✅ Set username and password: `pi` / `votre-mot-de-passe`
   - ✅ Configure WiFi (optionnel): SSID et mot de passe
   - ✅ Set hostname: `smartlocker`
   - ✅ Set locale: Europe/Paris, Keyboard: fr
7. Cliquez **WRITE** et attendez la fin

### 1.2 Premier démarrage

1. Insérez la carte SD dans le Raspberry Pi
2. Connectez l'écran, clavier, souris (temporaire)
3. Branchez l'alimentation
4. Attendez le démarrage (1-2 minutes)

### 1.3 Connexion SSH

```bash
# Depuis votre ordinateur
ssh pi@smartlocker.local
# Ou si .local ne fonctionne pas, trouvez l'IP:
# ssh pi@192.168.x.x
```

---

## 🔧 Étape 2: Configuration Système

### 2.1 Mise à jour du système

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

### 2.2 Installation des paquets de base

```bash
sudo apt install -y \
  python3 \
  python3-venv \
  python3-pip \
  git \
  xserver-xorg \
  x11-xserver-utils \
  xinit \
  chromium \
  unclutter \
  xinput
```

### 2.3 Configuration du port série (Arduino)

```bash
# Ajouter l'utilisateur pi au groupe dialout
sudo usermod -a -G dialout pi

# Vérifier que l'Arduino est détecté
ls -l /dev/ttyACM*
# Devrait afficher: /dev/ttyACM0

# Redémarrer pour appliquer
sudo reboot
```

---

## 📦 Étape 3: Installation de l'Application

### 3.1 Cloner le dépôt

```bash
# Créer le répertoire
mkdir -p ~/smart-locker
cd ~/smart-locker

# Cloner le projet
git clone https://github.com/Yoruzaki/ColiBox.git .

# Vérifier
ls -la
# Devrait afficher: raspberry/ server/ README.md INSTALL.md
```

### 3.2 Configuration Python (environnement virtuel)

```bash
cd ~/smart-locker/ColiBox/raspberry

# Créer l'environnement virtuel
python3 -m venv .venv

# Activer l'environnement
source .venv/bin/activate

# Installer les dépendances
pip install -r requirements.txt

# Vérifier l'installation
pip list
# Devrait afficher: Flask, requests, pyserial

# Désactiver pour l'instant
deactivate
```

---

## ⚙️ Étape 4: Configuration des Services

### 4.1 Configuration du service Flask (Backend)

```bash
cd ~/smart-locker/ColiBox/raspberry

# Éditer le fichier de service
nano systemd/smart-locker.service
```

**Vérifiez et modifiez ces lignes:**
```ini
Environment="SERVER_BASE_URL=http://IP_DU_SERVEUR:5000"
Environment="LOCKER_ID=1"
Environment="SERIAL_PORT=/dev/ttyACM0"
Environment="SERIAL_BAUD=115200"
```

**Remplacez `IP_DU_SERVEUR` par l'adresse IP réelle de votre serveur!**

```bash
# Copier le service
sudo cp systemd/smart-locker.service /etc/systemd/system/

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable smart-locker
sudo systemctl start smart-locker

# Vérifier le statut
sudo systemctl status smart-locker
# Devrait afficher: active (running)
```

### 4.2 Configuration du kiosque Chromium

```bash
cd ~/smart-locker/ColiBox/raspberry

# Rendre le script exécutable
chmod +x kiosk-xinit.sh

# Copier le service kiosque
sudo cp systemd/kiosk-browser.service /etc/systemd/system/

# Activer et démarrer
sudo systemctl daemon-reload
sudo systemctl enable kiosk-browser
sudo systemctl start kiosk-browser

# Vérifier le statut
sudo systemctl status kiosk-browser
# Devrait afficher: active (running)
```

---

## 🖐️ Étape 5: Configuration de l'Écran Tactile

### 5.1 Pour écran tactile officiel Raspberry Pi 7"

```bash
# Vérifier que l'écran est connecté via DSI (câble plat)

# Éditer la config
sudo nano /boot/firmware/config.txt
```

**Ajoutez à la fin du fichier:**
```
# Écran tactile 7"
dtoverlay=vc4-kms-dsi-7inch
```

```bash
# Sauvegarder (Ctrl+O, Enter, Ctrl+X)
sudo reboot
```

### 5.2 Vérifier la détection tactile

```bash
# Après redémarrage
DISPLAY=:0 xinput list
# Devrait afficher un périphérique touchscreen

# Tester les événements tactiles
sudo evtest
# Sélectionnez le device touchscreen et touchez l'écran
```

### 5.3 Calibration (si nécessaire)

```bash
DISPLAY=:0 xinput_calibrator
# Suivez les instructions à l'écran
# Copiez la sortie dans:
sudo nano /usr/share/X11/xorg.conf.d/99-calibration.conf
```

---

## 🌐 Étape 6: Configuration Réseau

### 6.1 IP Statique (Recommandé pour production)

```bash
sudo nano /etc/dhcpcd.conf
```

**Ajoutez à la fin:**
```
interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8

# Ou pour WiFi:
interface wlan0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

```bash
sudo reboot
```

---

## 🧪 Étape 7: Tests et Vérification

### 7.1 Tester l'application Flask

```bash
# Vérifier que le service tourne
sudo systemctl status smart-locker

# Vérifier les logs
sudo journalctl -u smart-locker -n 50

# Tester l'API localement
curl http://localhost:8000/api/ping
# Devrait retourner: {"status":"ok"}
```

### 7.2 Tester la connexion au serveur

```bash
# Remplacez IP_DU_SERVEUR par votre IP
curl http://IP_DU_SERVEUR:5000/

# Devrait afficher la page HTML du serveur
```

### 7.3 Tester l'Arduino

```bash
# Vérifier la connexion
ls -l /dev/ttyACM*

# Lire les logs du service
sudo journalctl -u smart-locker -f
# Vous devriez voir des messages PING vers l'Arduino
```

### 7.4 Tester le kiosque

```bash
# Vérifier que Chromium est lancé
ps aux | grep chromium

# Vérifier les logs
sudo journalctl -u kiosk-browser -n 50

# L'écran devrait afficher l'interface ColiGoo
```

---

## 🔄 Étape 8: Mises à Jour

### 8.1 Mettre à jour l'application

```bash
cd ~/smart-locker/ColiBox

# Récupérer les dernières modifications
git pull origin main

# Redémarrer les services
sudo systemctl restart smart-locker kiosk-browser

# Vérifier
sudo systemctl status smart-locker kiosk-browser
```

### 8.2 Mettre à jour le système

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

---

## 🛠️ Dépannage

### Le service smart-locker ne démarre pas

```bash
# Vérifier les logs détaillés
sudo journalctl -u smart-locker -n 100 --no-pager

# Vérifier l'environnement virtuel
ls -la ~/smart-locker/ColiBox/raspberry/.venv/

# Réinstaller les dépendances
cd ~/smart-locker/ColiBox/raspberry
source .venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart smart-locker
```

### L'écran tactile ne fonctionne pas

```bash
# Vérifier la détection
DISPLAY=:0 xinput list

# Vérifier les overlays
cat /boot/firmware/config.txt | grep overlay

# Réinstaller les pilotes
sudo apt install --reinstall xserver-xorg-input-libinput
sudo reboot
```

### Chromium ne s'affiche pas

```bash
# Vérifier X server
ps aux | grep Xorg

# Vérifier les logs kiosk
sudo journalctl -u kiosk-browser -n 100

# Nettoyer et redémarrer
sudo systemctl stop kiosk-browser
sudo pkill -f Xorg
sudo rm -f /tmp/.X0-lock /tmp/.X11-unix/X0
sudo systemctl start kiosk-browser
```

### Pas de connexion au serveur

```bash
# Vérifier la connectivité réseau
ping 8.8.8.8

# Vérifier la connexion au serveur
ping IP_DU_SERVEUR

# Tester le port
curl -v http://IP_DU_SERVEUR:5000/

# Vérifier le firewall du serveur
# Sur le serveur:
sudo ufw status
sudo ufw allow 5000/tcp
```

### L'Arduino ne répond pas

```bash
# Vérifier la connexion USB
lsusb
# Devrait afficher: Arduino Mega

# Vérifier le port
ls -l /dev/ttyACM*

# Tester manuellement
sudo apt install screen
screen /dev/ttyACM0 115200
# Tapez: PING
# Devrait répondre: PONG
# Quitter: Ctrl+A puis K
```

---

## 📊 Commandes Utiles

### Gestion des services

```bash
# Démarrer
sudo systemctl start smart-locker
sudo systemctl start kiosk-browser

# Arrêter
sudo systemctl stop smart-locker
sudo systemctl stop kiosk-browser

# Redémarrer
sudo systemctl restart smart-locker kiosk-browser

# Statut
sudo systemctl status smart-locker kiosk-browser

# Logs en temps réel
sudo journalctl -u smart-locker -f
sudo journalctl -u kiosk-browser -f

# Désactiver (ne démarre plus au boot)
sudo systemctl disable smart-locker
sudo systemctl disable kiosk-browser

# Réactiver
sudo systemctl enable smart-locker
sudo systemctl enable kiosk-browser
```

### Informations système

```bash
# Version Raspberry Pi OS
cat /etc/os-release

# Utilisation CPU/RAM
htop

# Espace disque
df -h

# Température
vcgencmd measure_temp

# Adresse IP
hostname -I

# Périphériques USB
lsusb

# Périphériques série
ls -l /dev/tty*
```

---

## 🔒 Sécurité

### Changer le mot de passe par défaut

```bash
passwd
# Entrez un nouveau mot de passe fort
```

### Désactiver SSH (production)

```bash
# Après installation complète
sudo systemctl disable ssh
sudo systemctl stop ssh
```

### Firewall (optionnel)

```bash
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from 192.168.1.0/24  # Votre réseau local
sudo ufw enable
```

---

## 📝 Configuration Finale

### Paramètres à vérifier avant déploiement

- ✅ `SERVER_BASE_URL` dans `/etc/systemd/system/smart-locker.service`
- ✅ `LOCKER_ID` unique pour chaque machine
- ✅ `SERIAL_PORT` correspond à l'Arduino (/dev/ttyACM0)
- ✅ IP statique configurée
- ✅ Écran tactile calibré
- ✅ Tests de dépôt/retrait réussis
- ✅ Mot de passe pi changé
- ✅ Auto-démarrage activé

---

## 🎉 Installation Terminée!

Votre kiosque ColiGoo est maintenant opérationnel!

### Contacts

- GitHub: https://github.com/Yoruzaki/ColiBox
- Documentation: Voir README.md dans le projet

### Vérification finale

```bash
# Tout devrait être vert:
sudo systemctl status smart-locker kiosk-browser

# L'écran devrait afficher l'interface ColiGoo
# Testez un dépôt et un retrait complets
```

**Bon déploiement! 🚀**

