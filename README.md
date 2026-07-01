# FRDM-MCX

FRDM-MCX development notes and embedded experiments.

This repository collects my work around NXP FRDM-MCX boards, mainly the
FRDM-MCXN947 temperature / humidity Bluetooth chain and additional
FRDM-MCXW71RM learning materials.

## Repository Layout

```text
FRDM-MCX/
├─ FRDM-MCXN947/
│  ├─ 温湿度蓝牙链路开发报告.md
│  ├─ dht11_thermohygrometer/       # Zephyr app on FRDM-MCXN947
│  ├─ dht11_ble/                    # ESP-IDF BLE bridge on ESP32-S3
│  ├─ 温湿度计小程序源码/            # WeChat mini program scanner UI
│  ├─ Zephyr-RTOS/                  # Windows Zephyr setup/build notes
│  ├─ 数据手册/                     # Board documents
│  └─ report_assets/                # Images used by the report
├─ FRDM-MCXW71RM/
│  ├─ Zephyr实战*/                  # Zephyr tutorial material
│  ├─ 微信小程序源代码/
│  └─ 数据手册/
└─ README.md
```

## Main Project: Temperature / Humidity BLE Chain

The primary completed workflow is a low-power BLE advertising data chain:

```text
DHT11 -> FRDM-MCXN947 -> UART -> ESP32-S3 -> BLE Advertising -> WeChat mini program
```

### Components

| Component | Role |
| --- | --- |
| FRDM-MCXN947 | Runs a Zephyr application, reads DHT11, and sends UART ASCII frames |
| ESP32-S3 | Runs an ESP-IDF bridge, parses UART data, and publishes BLE manufacturer data |
| WeChat mini program | Scans BLE advertisements and displays temperature / humidity |

The top-level report for this workflow is:

```text
FRDM-MCXN947/温湿度蓝牙链路开发报告.md
```

## Protocol Summary

### UART Frame

FRDM-MCXN947 sends one line per measurement:

```text
TH,<sequence>,<temperature_centi_c>,<humidity_centi_rh>\r\n
```

Example:

```text
TH,12,2634,5810
```

This means sequence `12`, temperature `26.34 deg C`, and relative humidity
`58.10 %RH`.

### BLE Manufacturer Data

The ESP32-S3 advertises a compact 12-byte manufacturer payload:

| Byte | Meaning |
| ---: | --- |
| 0..1 | Company ID, little-endian, default `0x02E5` |
| 2..3 | ASCII marker `TH` |
| 4 | Protocol version, currently `1` |
| 5 | Sequence low byte |
| 6..7 | Temperature in 0.01 deg C, signed little-endian |
| 8..9 | Humidity in 0.01 %RH, unsigned little-endian |
| 10 | Flags, bit 0 means valid measurement |
| 11 | Additive checksum over bytes 0..10 |

The BLE device name is:

```text
MCXN947_DHT11
```

## Build Notes

### FRDM-MCXN947 Zephyr App

Project:

```text
FRDM-MCXN947/dht11_thermohygrometer/
```

Typical board target:

```powershell
frdm_mcxn947/mcxn947/cpu0
```

The project README inside `dht11_thermohygrometer/` contains the detailed build,
flash, wiring, and UART frame notes.

### ESP32-S3 BLE Bridge

Project:

```text
FRDM-MCXN947/dht11_ble/
```

Typical flow:

```shell
idf.py set-target esp32s3
idf.py build
idf.py -p <PORT> flash monitor
```

The bridge defaults to UART1 RX on GPIO18. If your wiring is different, update
the pin in `idf.py menuconfig`.

### WeChat Mini Program

Project:

```text
FRDM-MCXN947/温湿度计小程序源码/
```

The mini program scans BLE advertisements, filters `MCXN947_DHT11`, validates
the manufacturer payload checksum, and renders the decoded measurement.

## Hardware Wiring

### DHT11 To FRDM-MCXN947

| DHT11 | FRDM-MCXN947 |
| --- | --- |
| VCC | 3.3V |
| GND | GND |
| DATA | Arduino D2 |

### FRDM-MCXN947 To ESP32-S3

| FRDM-MCXN947 | ESP32-S3 |
| --- | --- |
| Arduino D1 / TX | GPIO18 / UART RX |
| GND | GND |

The two boards must share GND. Otherwise UART decoding will be unstable.

## Documentation

- `FRDM-MCXN947/温湿度蓝牙链路开发报告.md`: complete chain report
- `FRDM-MCXN947/Zephyr-RTOS/`: Windows Zephyr installation and build/flash notes
- `FRDM-MCXW71RM/Zephyr实战*/`: additional Zephyr learning notes and materials
- `FRDM-MCXN947/数据手册/` and `FRDM-MCXW71RM/数据手册/`: board documents

## Notes

- Some Windows paths in the notes reflect the machine used during development.
  Adjust Zephyr, ESP-IDF, and LinkServer paths for your own setup.
- The website version of the main report is published in William Lab under the
  `FRDM-MCXN947` article series.
