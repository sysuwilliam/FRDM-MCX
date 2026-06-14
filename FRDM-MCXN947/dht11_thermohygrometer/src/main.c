/*
 * FRDM-MCXN947 DHT11 thermohygrometer.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

#include <zephyr/device.h>
#include <zephyr/drivers/sensor.h>
#include <zephyr/kernel.h>
#include <zephyr/sys/printk.h>

#define DHT_NODE DT_ALIAS(dht0)

#if !DT_NODE_EXISTS(DHT_NODE)
#error "No dht0 alias found. Check app.overlay."
#endif

static const struct device *const dht = DEVICE_DT_GET(DHT_NODE);

static void print_sensor_value(const char *label, const char *unit,
			       const struct sensor_value *value)
{
	printk("%s: %d.%06d %s", label, value->val1, value->val2, unit);
}

int main(void)
{
	struct sensor_value temperature;
	struct sensor_value humidity;
	int ret;

	printk("FRDM-MCXN947 DHT11 thermohygrometer\r\n");
	printk("DATA: Arduino D2, VCC: 3.3V, GND: GND, pull-up: 4.7 kOhm\r\n");

	if (!device_is_ready(dht)) {
		printk("DHT11 device %s is not ready\r\n", dht->name);
		return 0;
	}

	printk("DHT11 device %s is ready\r\n", dht->name);

	while (1) {
		ret = sensor_sample_fetch(dht);
		if (ret < 0) {
			printk("Failed to fetch DHT11 sample: %d\r\n", ret);
			k_sleep(K_SECONDS(2));
			continue;
		}

		ret = sensor_channel_get(dht, SENSOR_CHAN_AMBIENT_TEMP, &temperature);
		if (ret < 0) {
			printk("Failed to read temperature: %d\r\n", ret);
			k_sleep(K_SECONDS(2));
			continue;
		}

		ret = sensor_channel_get(dht, SENSOR_CHAN_HUMIDITY, &humidity);
		if (ret < 0) {
			printk("Failed to read humidity: %d\r\n", ret);
			k_sleep(K_SECONDS(2));
			continue;
		}

		print_sensor_value("Temperature", "deg C", &temperature);
		printk(", ");
		print_sensor_value("Humidity", "%RH", &humidity);
		printk("\r\n");

		k_sleep(K_SECONDS(2));
	}

	return 0;
}
