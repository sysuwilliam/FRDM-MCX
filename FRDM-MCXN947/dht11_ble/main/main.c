/*
 * ESP32-S3 bridge for FRDM-MCXN947 DHT11 measurements.
 *
 * UART input frame from FRDM:
 *   TH,<sequence>,<temperature_centi_c>,<humidity_centi_rh>\r\n
 *
 * BLE manufacturer data:
 *   company id: 0x02E5
 *   bytes 2..3: "TH"
 *   byte 4: protocol version
 *   byte 5: sequence LSB
 *   bytes 6..7: temperature in 0.01 deg C, signed little-endian
 *   bytes 8..9: humidity in 0.01 %RH, unsigned little-endian
 *   byte 10: flags, bit0 = valid measurement
 *   byte 11: additive checksum over bytes 0..10
 */

#include <stdbool.h>
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"

#include "driver/uart.h"
#include "esp_bt.h"
#include "esp_bt_device.h"
#include "esp_bt_main.h"
#include "esp_gap_ble_api.h"
#include "esp_log.h"
#include "nvs_flash.h"

#define DEVICE_NAME "MCXN947_DHT11"
#define UART_PORT UART_NUM_1
#define UART_BAUD_RATE 115200
#define UART_BUF_SIZE 256
#define ADV_COMPANY_ID 0x02E5
#define ADV_PROTOCOL_VERSION 1
#define ADV_CONFIG_FLAG (1 << 0)
#define SCAN_RSP_CONFIG_FLAG (1 << 1)

#ifndef CONFIG_DHT11_UART_RX_GPIO
#define CONFIG_DHT11_UART_RX_GPIO 18
#endif

#ifndef CONFIG_DHT11_UART_TX_GPIO
#define CONFIG_DHT11_UART_TX_GPIO 17
#endif

static const char *TAG = "DHT11_BLE";

static SemaphoreHandle_t measurement_lock;
static uint8_t manufacturer_data[12] = {
    ADV_COMPANY_ID & 0xff,
    ADV_COMPANY_ID >> 8,
    'T',
    'H',
    ADV_PROTOCOL_VERSION,
};

static int16_t temperature_centi;
static uint16_t humidity_centi;
static uint8_t sequence_lsb;
static bool measurement_valid;
static bool adv_started;
static bool adv_configuring;
static bool adv_update_queued;
static bool adv_config_failed;
static uint8_t adv_config_pending;

static esp_ble_adv_data_t adv_data = {
    .set_scan_rsp = false,
    .include_name = false,
    .include_txpower = false,
    .appearance = 0x00,
    .manufacturer_len = sizeof(manufacturer_data),
    .p_manufacturer_data = manufacturer_data,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,
    .p_service_uuid = NULL,
    .flag = ESP_BLE_ADV_FLAG_GEN_DISC | ESP_BLE_ADV_FLAG_BREDR_NOT_SPT,
};

static esp_ble_adv_data_t scan_rsp_data = {
    .set_scan_rsp = true,
    .include_name = true,
    .include_txpower = false,
    .appearance = 0x00,
    .manufacturer_len = 0,
    .p_manufacturer_data = NULL,
    .service_data_len = 0,
    .p_service_data = NULL,
    .service_uuid_len = 0,
    .p_service_uuid = NULL,
    .flag = 0,
};

static esp_ble_adv_params_t adv_params = {
    .adv_int_min = 0x00a0,
    .adv_int_max = 0x0140,
    .adv_type = ADV_TYPE_SCAN_IND,
    .own_addr_type = BLE_ADDR_TYPE_PUBLIC,
    .channel_map = ADV_CHNL_ALL,
    .adv_filter_policy = ADV_FILTER_ALLOW_SCAN_ANY_CON_ANY,
};

static uint8_t checksum(const uint8_t *data, size_t len)
{
    uint8_t sum = 0;

    for (size_t i = 0; i < len; i++) {
        sum = (uint8_t)(sum + data[i]);
    }

    return sum;
}

static void rebuild_manufacturer_data(void)
{
    manufacturer_data[5] = sequence_lsb;
    manufacturer_data[6] = temperature_centi & 0xff;
    manufacturer_data[7] = (temperature_centi >> 8) & 0xff;
    manufacturer_data[8] = humidity_centi & 0xff;
    manufacturer_data[9] = (humidity_centi >> 8) & 0xff;
    manufacturer_data[10] = measurement_valid ? 0x01 : 0x00;
    manufacturer_data[11] = checksum(manufacturer_data, sizeof(manufacturer_data) - 1);
}

static void configure_advertising(void)
{
    esp_err_t err;

    if (adv_configuring) {
        adv_update_queued = true;
        return;
    }

    adv_configuring = true;
    adv_update_queued = false;
    adv_config_failed = false;
    adv_config_pending = 0;

    err = esp_ble_gap_config_adv_data(&adv_data);
    if (err == ESP_OK) {
        adv_config_pending |= ADV_CONFIG_FLAG;
    } else {
        adv_config_failed = true;
        ESP_LOGE(TAG, "config adv data failed: %s", esp_err_to_name(err));
    }

    err = esp_ble_gap_config_adv_data(&scan_rsp_data);
    if (err == ESP_OK) {
        adv_config_pending |= SCAN_RSP_CONFIG_FLAG;
    } else {
        adv_config_failed = true;
        ESP_LOGE(TAG, "config scan response failed: %s", esp_err_to_name(err));
    }

    if (adv_config_pending == 0) {
        adv_configuring = false;
    }
}

static void request_advertising_update(void)
{
    if (xSemaphoreTake(measurement_lock, pdMS_TO_TICKS(100)) == pdTRUE) {
        rebuild_manufacturer_data();
        xSemaphoreGive(measurement_lock);
    }

    if (adv_started) {
        adv_update_queued = true;
        esp_err_t err = esp_ble_gap_stop_advertising();
        if (err == ESP_ERR_INVALID_STATE) {
            adv_started = false;
            configure_advertising();
        } else if (err != ESP_OK) {
            ESP_LOGW(TAG, "stop advertising failed before update: %s", esp_err_to_name(err));
        }
        return;
    }

    configure_advertising();
}

static bool parse_measurement_line(char *line, int32_t *sequence,
                                   int32_t *temperature, int32_t *humidity)
{
    char prefix[3] = {0};
    long parsed_sequence;
    long parsed_temperature;
    long parsed_humidity;

    if (sscanf(line, "%2[^,],%ld,%ld,%ld",
               prefix, &parsed_sequence, &parsed_temperature, &parsed_humidity) != 4 ||
        strcmp(prefix, "TH") != 0 ||
        parsed_temperature < INT16_MIN ||
        parsed_temperature > INT16_MAX ||
        parsed_humidity < 0 ||
        parsed_humidity > UINT16_MAX) {
        return false;
    }

    *sequence = (int32_t)parsed_sequence;
    *temperature = (int32_t)parsed_temperature;
    *humidity = (int32_t)parsed_humidity;
    return true;
}

static void handle_measurement_line(char *line)
{
    int32_t sequence;
    int32_t temperature;
    int32_t humidity;

    if (!parse_measurement_line(line, &sequence, &temperature, &humidity)) {
        ESP_LOGW(TAG, "ignored UART line: %s", line);
        return;
    }

    if (xSemaphoreTake(measurement_lock, pdMS_TO_TICKS(100)) == pdTRUE) {
        sequence_lsb = (uint8_t)sequence;
        temperature_centi = (int16_t)temperature;
        humidity_centi = (uint16_t)humidity;
        measurement_valid = true;
        xSemaphoreGive(measurement_lock);
    }

    ESP_LOGI(TAG, "measurement seq=%" PRId32 " temp=%.2f C humidity=%.2f %%RH",
             sequence, temperature / 100.0, humidity / 100.0);
    request_advertising_update();
}

static void uart_rx_task(void *arg)
{
    uint8_t byte;
    char line[64];
    size_t line_len = 0;

    ESP_LOGI(TAG, "UART%d RX GPIO%d, baud %d",
             UART_PORT, CONFIG_DHT11_UART_RX_GPIO, UART_BAUD_RATE);

    while (true) {
        int len = uart_read_bytes(UART_PORT, &byte, 1, pdMS_TO_TICKS(1000));
        if (len <= 0) {
            continue;
        }

        if (byte == '\n') {
            line[line_len] = '\0';
            if (line_len > 0) {
                handle_measurement_line(line);
            }
            line_len = 0;
            continue;
        }

        if (byte == '\r') {
            continue;
        }

        if (line_len < sizeof(line) - 1) {
            line[line_len++] = (char)byte;
        } else {
            line_len = 0;
            ESP_LOGW(TAG, "UART line too long, dropping");
        }
    }
}

static void gap_event_handler(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *param)
{
    switch (event) {
    case ESP_GAP_BLE_ADV_DATA_SET_COMPLETE_EVT:
        adv_config_pending &= (uint8_t)~ADV_CONFIG_FLAG;
        if (param->adv_data_cmpl.status != ESP_BT_STATUS_SUCCESS) {
            adv_config_failed = true;
            ESP_LOGE(TAG, "advertising data set failed, status=%d", param->adv_data_cmpl.status);
        }
        if (adv_config_pending != 0) {
            break;
        }
        adv_configuring = false;
        if (adv_config_failed) {
            break;
        }
        if (adv_update_queued) {
            configure_advertising();
            break;
        }
        esp_ble_gap_start_advertising(&adv_params);
        break;

    case ESP_GAP_BLE_SCAN_RSP_DATA_SET_COMPLETE_EVT:
        adv_config_pending &= (uint8_t)~SCAN_RSP_CONFIG_FLAG;
        if (param->scan_rsp_data_cmpl.status != ESP_BT_STATUS_SUCCESS) {
            adv_config_failed = true;
            ESP_LOGE(TAG, "scan response set failed, status=%d", param->scan_rsp_data_cmpl.status);
        }
        if (adv_config_pending != 0) {
            break;
        }
        adv_configuring = false;
        if (adv_config_failed) {
            break;
        }
        if (adv_update_queued) {
            configure_advertising();
            break;
        }
        esp_ble_gap_start_advertising(&adv_params);
        break;

    case ESP_GAP_BLE_ADV_START_COMPLETE_EVT:
        if (param->adv_start_cmpl.status == ESP_BT_STATUS_SUCCESS) {
            adv_started = true;
            ESP_LOGI(TAG, "BLE advertising as %s", DEVICE_NAME);
        } else {
            adv_started = false;
            ESP_LOGE(TAG, "advertising start failed, status=%d", param->adv_start_cmpl.status);
        }
        break;

    case ESP_GAP_BLE_ADV_STOP_COMPLETE_EVT:
        adv_started = false;
        if (param->adv_stop_cmpl.status != ESP_BT_STATUS_SUCCESS) {
            ESP_LOGW(TAG, "advertising stop status=%d", param->adv_stop_cmpl.status);
        }
        if (adv_update_queued) {
            configure_advertising();
        }
        break;

    default:
        break;
    }
}

static void init_uart(void)
{
    const uart_config_t uart_config = {
        .baud_rate = UART_BAUD_RATE,
        .data_bits = UART_DATA_8_BITS,
        .parity = UART_PARITY_DISABLE,
        .stop_bits = UART_STOP_BITS_1,
        .flow_ctrl = UART_HW_FLOWCTRL_DISABLE,
        .source_clk = UART_SCLK_DEFAULT,
    };

    ESP_ERROR_CHECK(uart_driver_install(UART_PORT, UART_BUF_SIZE, 0, 0, NULL, 0));
    ESP_ERROR_CHECK(uart_param_config(UART_PORT, &uart_config));
    ESP_ERROR_CHECK(uart_set_pin(UART_PORT,
                                 CONFIG_DHT11_UART_TX_GPIO,
                                 CONFIG_DHT11_UART_RX_GPIO,
                                 UART_PIN_NO_CHANGE,
                                 UART_PIN_NO_CHANGE));
}

static void init_ble(void)
{
    esp_err_t ret;

    ESP_ERROR_CHECK(esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT));

    esp_bt_controller_config_t bt_cfg = BT_CONTROLLER_INIT_CONFIG_DEFAULT();
    ret = esp_bt_controller_init(&bt_cfg);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "initialize controller failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = esp_bt_controller_enable(ESP_BT_MODE_BLE);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "enable controller failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = esp_bluedroid_init();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "init bluedroid failed: %s", esp_err_to_name(ret));
        return;
    }

    ret = esp_bluedroid_enable();
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "enable bluedroid failed: %s", esp_err_to_name(ret));
        return;
    }

    ESP_ERROR_CHECK(esp_ble_gap_register_callback(gap_event_handler));
    ESP_ERROR_CHECK(esp_ble_gap_set_device_name(DEVICE_NAME));
    request_advertising_update();
}

void app_main(void)
{
    esp_err_t ret = nvs_flash_init();

    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
        ESP_ERROR_CHECK(nvs_flash_erase());
        ret = nvs_flash_init();
    }
    ESP_ERROR_CHECK(ret);

    measurement_lock = xSemaphoreCreateMutex();
    if (measurement_lock == NULL) {
        ESP_LOGE(TAG, "failed to create measurement mutex");
        return;
    }

    init_uart();
    init_ble();

    xTaskCreate(uart_rx_task, "uart_rx", 4096, NULL, 10, NULL);
}
