# FRDM-MCXN947 DHT11 BLE Bridge

This ESP-IDF project turns an ESP32-S3 into a BLE advertising bridge for the
FRDM-MCXN947 DHT11 thermohygrometer sample.

The FRDM board reads the DHT11 sensor with Zephyr, sends a compact UART frame
to the ESP32-S3, and the ESP32-S3 publishes the latest measurement in BLE
manufacturer data. The WeChat mini program can read the values by scanning BLE
advertisements, without creating a GATT connection.

## Hardware

- FRDM-MCXN947 running `dht11_thermohygrometer`
- ESP32-S3 running this `dht11_ble` project
- DHT11 data pin on FRDM Arduino D2
- FRDM Arduino D1/TX connected to ESP32-S3 UART RX
- Common GND between FRDM and ESP32-S3

Default ESP32-S3 UART pins:

| Signal | Default GPIO | Menuconfig symbol |
| --- | ---: | --- |
| ESP32-S3 RX | GPIO18 | `CONFIG_DHT11_UART_RX_GPIO` |
| ESP32-S3 TX | GPIO17 | `CONFIG_DHT11_UART_TX_GPIO` |

Only RX and GND are required by the bridge. TX is configured for completeness.

## UART Frame

The ESP32-S3 expects one ASCII line per measurement:

```text
TH,<sequence>,<temperature_centi_c>,<humidity_centi_rh>\r\n
```

Example:

```text
TH,12,2634,5810
```

This means sequence `12`, temperature `26.34 deg C`, and humidity `58.10 %RH`.

## BLE Payload

The bridge advertises the latest measurement as manufacturer data:

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

The device name `MCXN947_DHT11` is placed in the BLE scan response so the legacy
advertising packet remains within the 31-byte size limit.

## Build And Flash

Set the target and build:

```shell
idf.py set-target esp32s3
idf.py build
```

On Windows, if ESP-IDF fails under a path that contains spaces or non-ASCII
characters, copy this `dht11_ble` folder to an ASCII-only path such as
`C:\codex_build\dht11_ble` and run the same commands there. The firmware source
is path-independent; this only avoids toolchain path parsing issues.

Flash and monitor:

```shell
idf.py -p <PORT> flash monitor
```

If your wiring uses different ESP32-S3 pins, run:

```shell
idf.py menuconfig
```

Then change `DHT11 BLE bridge -> ESP32-S3 UART RX GPIO`.

## Expected Log

After boot, the ESP32-S3 starts BLE advertising and waits for UART data. When a
valid line is received, the log should look like:

```text
I DHT11_BLE: BLE advertising as MCXN947_DHT11
I DHT11_BLE: UART1 RX GPIO18, baud 115200
I DHT11_BLE: measurement seq=12 temp=26.34 C humidity=58.10 %RH
```

Open the WeChat mini program in `../温湿度计小程序源码`, tap scan, and keep scanning
to receive the updated advertisements.
