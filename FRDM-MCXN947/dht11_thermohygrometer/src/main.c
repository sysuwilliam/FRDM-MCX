/*
 * FRDM-MCXN947 DHT11 thermohygrometer.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/device.h>
#include <zephyr/drivers/sensor.h>
#include <zephyr/drivers/uart.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>

#define DHT_NODE DT_ALIAS(dht0)
#define ESP32_UART_NODE DT_NODELABEL(arduino_serial)
#define SAMPLE_PERIOD K_SECONDS(2)

#if !DT_NODE_EXISTS(DHT_NODE)
#error "No dht0 alias found. Check app.overlay."
#endif

#if !DT_NODE_HAS_STATUS(ESP32_UART_NODE, okay)
#error "arduino_serial is not enabled for ESP32-S3 UART output."
#endif

static const struct device *const dht = DEVICE_DT_GET(DHT_NODE);
static const struct device *const esp32_uart = DEVICE_DT_GET(ESP32_UART_NODE);

static int32_t measurement_value_to_centi(const struct sensor_value *value)
{
	return (value->val1 * 100) + (value->val2 / 10000);
}

static void uart_write_string(const struct device *uart, const char *text)
{
	for (size_t i = 0; text[i] != '\0'; i++) {
		uart_poll_out(uart, text[i]);
	}
}

static void send_measurement_frame(uint32_t sequence,
				   const struct sensor_value *temperature,
				   const struct sensor_value *humidity)
{
	char frame[48];
	int len;

	len = snprintk(frame, sizeof(frame), "TH,%lu,%ld,%ld\r\n",
		       (unsigned long)sequence,
		       (long)measurement_value_to_centi(temperature),
		       (long)measurement_value_to_centi(humidity));
	if (len > 0 && len < sizeof(frame)) {
		uart_write_string(esp32_uart, frame);
	}
}

static void print_sensor_value(const char *label, const char *unit,
			       const struct sensor_value *value)
{
	printk("%s: %d.%06d %s", label, value->val1, value->val2, unit);
}

int main(void)
{
	struct sensor_value temperature;
	struct sensor_value humidity;
	uint32_t sequence = 0;
	int ret;

	printk("FRDM-MCXN947 DHT11 thermohygrometer\r\n");
	printk("DATA: Arduino D2, VCC: 3.3V, GND: GND, pull-up: 4.7 kOhm\r\n");
	printk("ESP32-S3 UART: Arduino D1/TX -> ESP32 RX, GND -> GND, 115200 8N1\r\n");

	if (!device_is_ready(dht)) {
		printk("DHT11 device %s is not ready\r\n", dht->name);
		return 0;
	}

	if (!device_is_ready(esp32_uart)) {
		printk("ESP32 UART device %s is not ready\r\n", esp32_uart->name);
		return 0;
	}

	printk("DHT11 device %s is ready\r\n", dht->name);
	printk("ESP32 UART device %s is ready\r\n", esp32_uart->name);

	while (1) {
		ret = sensor_sample_fetch(dht);
		if (ret < 0) {
			printk("Failed to fetch DHT11 sample: %d\r\n", ret);
			k_sleep(SAMPLE_PERIOD);
			continue;
		}

		ret = sensor_channel_get(dht, SENSOR_CHAN_AMBIENT_TEMP, &temperature);
		if (ret < 0) {
			printk("Failed to read temperature: %d\r\n", ret);
			k_sleep(SAMPLE_PERIOD);
			continue;
		}

		ret = sensor_channel_get(dht, SENSOR_CHAN_HUMIDITY, &humidity);
		if (ret < 0) {
			printk("Failed to read humidity: %d\r\n", ret);
			k_sleep(SAMPLE_PERIOD);
			continue;
		}

		print_sensor_value("Temperature", "deg C", &temperature);
		printk(", ");
		print_sensor_value("Humidity", "%RH", &humidity);
		printk("\r\n");

		send_measurement_frame(sequence++, &temperature, &humidity);

		k_sleep(SAMPLE_PERIOD);
	}

	return 0;
}
