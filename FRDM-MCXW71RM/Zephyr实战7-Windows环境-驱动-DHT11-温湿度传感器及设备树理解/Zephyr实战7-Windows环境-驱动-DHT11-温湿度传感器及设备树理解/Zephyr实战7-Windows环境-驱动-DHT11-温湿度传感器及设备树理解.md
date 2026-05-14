# Zephyr实战7-Windows环境-驱动-DHT11-温湿度传感器及设备树理解

## 0、视频教程
视频教程地址：[https://www.bilibili.com/video/BV18vidBYEmR/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319](https://www.bilibili.com/video/BV18vidBYEmR/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319)

```
https://www.bilibili.com/video/BV18vidBYEmR/?vd_source=9ebd187ccc98c26d8c32c09c0ffa5319
```


## 1、程序描述
基于 Zephyr 实时操作系统的传感器采样应用程序，用于通过 DHT 系列温湿度传感器（如 DHT11、DHT22）周期性地读取环境温度和相对湿度数据。该示例采用轮询（polling）方式获取传感器数据。


#### 主要功能
- 初始化 DHT 传感器设备（通过 Zephyr 的设备树和传感器 API）。
- 在主循环中以固定间隔（默认为 2 秒）轮询传感器。
- 读取并解析传感器返回的温度（单位：°C）和湿度（单位：%）。
- 通过串口（UART）将测量结果打印到控制台，格式如下：
  ```
  temp: 23.000000; humidity: 45.000000
  ```

#### 技术要点
- **依赖 Zephyr 传感器子系统**：使用标准的 `sensor_sample_fetch()` 和 `sensor_channel_get()` API。
- **硬件抽象**：通过设备树（Device Tree）配置 DHT 传感器所连接的 GPIO 引脚，无需硬编码引脚号。
- **可移植性强**：只要目标板支持 DHT 驱动并正确配置设备树，即可在不同 Zephyr 兼容开发板上运行。
- **低功耗考虑有限**：由于是轮询模式，未深度优化功耗，适用于教学或简单监控场景。

#### 典型应用场景
- 嵌入式环境监测节点
- 教学演示 Zephyr 传感器 API 的使用
- 快速原型开发中的温湿度采集模块

---

该示例体现了 Zephyr OS 对传感器设备的统一抽象能力，使开发者能以一致的方式访问不同类型的传感器，同时保持代码简洁清晰。


## 2、【FPB-RA6E2】开发板接线DHT11示意图

| DHT11 | FPB-RA6E2 |
| -- | --- |
| NC |  悬空（不接线）  |
| VCC |  VCC  |
| GND | GND   |
| DATA | P500（Arduino D4 引脚）   |





## 3 设备树官方文档
Zephyr官方文档：[https://docs.zephyrproject.org/latest/guides/dts/index.html](https://docs.zephyrproject.org/latest/guides/dts/index.html)

官方示例代码文档：[https://github.com/zephyrproject-rtos/zephyr/tree/cdb7debfb726569440fc22ce6673de2b86c728f7/samples/sensor/dht_polling](https://github.com/zephyrproject-rtos/zephyr/tree/cdb7debfb726569440fc22ce6673de2b86c728f7/samples/sensor/dht_polling)


