# Bambu Lab MQTT Bridge — Home Assistant Add-on

MQTT bridge for Bambu Lab printers that solves the single-client limitation. Republishes all printer MQTT traffic to your local Mosquitto broker and auto-discovers printer entities in Home Assistant via MQTT Discovery.

## What It Does

- Connects to each Bambu Lab printer as the sole MQTT client (MQTTS port 8883)
- Republishes all messages to your local Mosquitto broker
- Publishes HA MQTT Discovery payloads — printers auto-appear as devices with 36 entities each (sensors, camera, controls, AMS)
- Enables BambuStudio, Node-RED, custom scripts, and HA to all coexist simultaneously

## Prerequisites

- Home Assistant with the **Mosquitto broker** add-on installed and running
- **MQTT integration** configured in Home Assistant
- Bambu Lab printer(s) on the same local network with LAN Mode enabled

## Installation

1. In Home Assistant, go to **Settings > Add-ons > Add-on Store**
2. Click the **...** menu (top right) > **Repositories**
3. Add this repository URL: `https://github.com/DementedPixel/bambu-bridge-ha`
4. Find **Bambu Lab MQTT Bridge** in the store and click **Install**
5. Go to the **Configuration** tab and add your printer(s)
6. Start the add-on

## Documentation

See the [DOCS.md](bambu-bridge/DOCS.md) file or the **Documentation** tab in the add-on UI for full setup instructions, entity list, and troubleshooting.

## Entities Per Printer (36 total)

| Type | Count | Examples |
|------|-------|---------|
| Sensors | 14 | Nozzle/bed/chamber temp, print progress, layers, status, WiFi |
| Binary Sensors | 4 | Printing, print error, chamber light, AMS connected |
| Camera | 1 | Periodic JPEG snapshots |
| Buttons | 3 | Pause, resume, stop |
| Selects | 2 | Speed profile, chamber light |
| AMS Tray Sensors | 12 | Filament type, colour, remaining % (4 trays) |

## License

MIT
