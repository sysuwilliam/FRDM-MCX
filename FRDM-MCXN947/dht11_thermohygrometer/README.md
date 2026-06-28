# FRDM-MCXN947 DHT11 Thermohygrometer

This Zephyr application reads a DHT11 temperature/humidity sensor on the
FRDM-MCXN947 board, prints measurements to the UART console every 2 seconds,
and forwards the same values to an ESP32-S3 BLE bridge through the Arduino
serial port.

## Hardware

Default wiring:

| DHT11 pin | FRDM-MCXN947 |
| --- | --- |
| VCC | 3.3V |
| GND | GND |
| DATA | Arduino D2 |
| NC | Not connected |

Add a 4.7 kOhm pull-up resistor between DATA and 3.3V. Some DHT11 modules
already include this resistor; bare 4-pin sensors usually need an external one.

ESP32-S3 bridge wiring:

| FRDM-MCXN947 | ESP32-S3 |
| --- | --- |
| Arduino D1/TX | UART RX, default GPIO18 in `dht11_ble` |
| GND | GND |

The DATA pin is configured in `app.overlay` through the board's Arduino header
mapping:

```dts
dio-gpios = <&arduino_header ARDUINO_HEADER_R3_D2 (GPIO_ACTIVE_LOW | GPIO_PULL_UP)>;
```

To use a different Arduino digital pin, change `ARDUINO_HEADER_R3_D2` in
`app.overlay`.

## Build

From a PowerShell with the Zephyr environment enabled:

```powershell
D:\Zephyr\zephyr_env.ps1
west build -p always -d D:\Zephyr\zephyrproject\build\dht11_thermohygrometer -b frdm_mcxn947/mcxn947/cpu0 D:\Zephyr\zephyrproject\apps\frdm_mcxn947_dht11_thermohygrometer
```

The `D:\Zephyr\zephyrproject\apps\frdm_mcxn947_dht11_thermohygrometer`
directory is a Windows junction to this project folder. It avoids a Zephyr
devicetree overlay parsing issue when the source path contains spaces.

## Flash

```powershell
west flash
```

Open the board's VCOM UART at `115200 8N1`. Expected output:

```text
FRDM-MCXN947 DHT11 thermohygrometer
DATA: Arduino D2, VCC: 3.3V, GND: GND, pull-up: 4.7 kOhm
ESP32-S3 UART: Arduino D1/TX -> ESP32 RX, GND -> GND, 115200 8N1
DHT11 device dht11 is ready
ESP32 UART device ... is ready
Temperature: 25.000000 deg C, Humidity: 55.000000 %RH
```

At the same time, the application sends one UART frame per measurement to the
ESP32-S3:

```text
TH,<sequence>,<temperature_centi_c>,<humidity_centi_rh>
```

For example, `TH,12,2500,5500` means sequence `12`, `25.00 deg C`, and
`55.00 %RH`.
