const DEVICE_NAME = 'MCXW71_TH'
const HTS_SERVICE = '00001809-0000-1000-8000-00805f9b34fb'
const HTS_TEMP_CHAR = '00002a1c-0000-1000-8000-00805f9b34fb'
const ESS_SERVICE = '0000181a-0000-1000-8000-00805f9b34fb'
const ESS_HUM_CHAR = '00002a6f-0000-1000-8000-00805f9b34fb'

let deviceId = null
let isConnecting = false
let isScanning = false
let scanTimer = null

function readInt16(buffer) {
  return new DataView(buffer).getInt16(0, true)
}

function readUint16(buffer) {
  return new DataView(buffer).getUint16(0, true)
}

function formatTime(date) {
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function clearScanTimer() {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
  }
}

Page({
  data: {
    connected: false,
    loading: false,
    discovering: false,
    temperature: '--',
    humidity: '--',
    statusText: '点击开始连接，自动搜索传感器',
    statusTone: 'idle',
    primaryButtonText: '开始连接',
    connectionLabel: '待连接',
    lastUpdated: '--:--:--',
    environmentHint: '连接后将实时显示温度与湿度',
    temperatureTrend: '等待数据',
    humidityTrend: '等待数据'
  },

  onLoad() {
    this.bindBleListeners()
  },

  onUnload() {
    this.cleanup()
  },

  bindBleListeners() {
    this.handleConnectionStateChange = (res) => {
      if (res.deviceId !== deviceId) return
      if (!res.connected) {
        deviceId = null
        isConnecting = false
        isScanning = false
        clearScanTimer()
        this.setData({
          connected: false,
          loading: false,
          discovering: false,
          temperature: '--',
          humidity: '--',
          statusText: '连接已断开',
          statusTone: 'idle',
          primaryButtonText: '重新连接',
          connectionLabel: '已断开',
          environmentHint: '设备断开后停止接收实时数据',
          temperatureTrend: '等待数据',
          humidityTrend: '等待数据'
        })
      }
    }

    this.handleCharacteristicValueChange = (res) => {
      const characteristicId = res.characteristicId.toUpperCase()
      const lastUpdated = formatTime(new Date())

      if (characteristicId === HTS_TEMP_CHAR.toUpperCase()) {
        const temperature = (readInt16(res.value) / 100).toFixed(2)
        this.setData({
          temperature,
          lastUpdated,
          environmentHint: '数据刷新正常，当前正在接收温度变化',
          temperatureTrend: `${temperature} °C`
        })
      } else if (characteristicId === ESS_HUM_CHAR.toUpperCase()) {
        const humidity = (readUint16(res.value) / 100).toFixed(2)
        this.setData({
          humidity,
          lastUpdated,
          environmentHint: '数据刷新正常，当前正在接收湿度变化',
          humidityTrend: `${humidity} %RH`
        })
      }
    }

    wx.onBLEConnectionStateChange(this.handleConnectionStateChange)
    wx.onBLECharacteristicValueChange(this.handleCharacteristicValueChange)
  },

  connect() {
    if (isConnecting || isScanning || deviceId) return

    isConnecting = true
    this.setData({
      loading: true,
      discovering: false,
      statusText: '正在打开蓝牙并搜索设备...',
      statusTone: 'busy',
      primaryButtonText: '连接中...',
      connectionLabel: '扫描中',
      environmentHint: '请保持传感器通电并靠近手机'
    })

    wx.openBluetoothAdapter({
      success: () => {
        this.startDiscovery()
      },
      fail: (err) => {
        if (err.errCode === 10001) {
          this.startDiscovery()
          return
        }

        isConnecting = false
        this.setData({
          loading: false,
          statusText: '蓝牙不可用，请检查系统蓝牙权限',
          statusTone: 'danger',
          primaryButtonText: '重新连接',
          connectionLabel: '未开启'
        })
      }
    })
  },

  startDiscovery() {
    isScanning = true
    this.setData({
      discovering: true,
      statusText: '正在扫描 MCXW71_TH...',
      statusTone: 'busy'
    })

    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: () => {
        this.pollDevices()
      },
      fail: () => {
        isConnecting = false
        isScanning = false
        clearScanTimer()
        this.setData({
          loading: false,
          discovering: false,
          statusText: '扫描失败，请稍后重试',
          statusTone: 'danger',
          primaryButtonText: '重新连接',
          connectionLabel: '扫描失败'
        })
      }
    })
  },

  pollDevices() {
    let count = 0
    clearScanTimer()

    scanTimer = setInterval(() => {
      count += 1

      if (count >= 15) {
        clearScanTimer()
        isConnecting = false
        isScanning = false
        wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
        this.setData({
          loading: false,
          discovering: false,
          statusText: '15 秒内未找到设备',
          statusTone: 'danger',
          primaryButtonText: '重新连接',
          connectionLabel: '未发现',
          environmentHint: '请确认设备名称为 MCXW71_TH 且广播已开启'
        })
        return
      }

      wx.getBluetoothDevices({
        success: (res) => {
          const targetDevice = res.devices.find((item) => item.name === DEVICE_NAME)
          if (!targetDevice) return

          clearScanTimer()
          isScanning = false
          wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
          this.doConnectDevice(targetDevice.deviceId)
        }
      })
    }, 1000)
  },

  doConnectDevice(id) {
    this.setData({
      loading: true,
      discovering: false,
      statusText: '设备已找到，正在建立连接...',
      statusTone: 'busy',
      connectionLabel: '连接中'
    })

    wx.createBLEConnection({
      deviceId: id,
      success: () => {
        deviceId = id
        isConnecting = false
        this.setData({
          connected: true,
          loading: false,
          discovering: false,
          statusText: '连接成功，正在订阅实时数据',
          statusTone: 'success',
          primaryButtonText: '断开连接',
          connectionLabel: '已连接',
          environmentHint: '正在同步温湿度传感器数据'
        })
        this.getServices(id)
      },
      fail: () => {
        deviceId = null
        isConnecting = false
        this.setData({
          connected: false,
          loading: false,
          discovering: false,
          statusText: '连接失败，请重试',
          statusTone: 'danger',
          primaryButtonText: '重新连接',
          connectionLabel: '连接失败'
        })
      }
    })
  },

  getServices(id) {
    wx.getBLEDeviceServices({
      deviceId: id,
      success: (res) => {
        res.services.forEach((service) => {
          const uuid = service.uuid.toUpperCase()
          if (uuid === HTS_SERVICE.toUpperCase()) {
            this.subscribeCharacteristic(id, service.uuid, HTS_TEMP_CHAR)
          } else if (uuid === ESS_SERVICE.toUpperCase()) {
            this.subscribeCharacteristic(id, service.uuid, ESS_HUM_CHAR)
          }
        })

        this.setData({
          statusText: '已连接，等待传感器推送数据',
          statusTone: 'success'
        })
      },
      fail: () => {
        this.setData({
          statusText: '已连接，但服务发现失败',
          statusTone: 'danger',
          environmentHint: '请检查设备 GATT 服务是否正常开放'
        })
      }
    })
  },

  subscribeCharacteristic(currentDeviceId, serviceId, targetCharId) {
    wx.getBLEDeviceCharacteristics({
      deviceId: currentDeviceId,
      serviceId,
      success: (res) => {
        res.characteristics.forEach((item) => {
          if (item.uuid.toUpperCase() !== targetCharId.toUpperCase()) return
          if (!item.properties.notify && !item.properties.indicate) return

          wx.notifyBLECharacteristicValueChange({
            deviceId: currentDeviceId,
            serviceId,
            characteristicId: item.uuid,
            state: true,
            success: () => {
              wx.readBLECharacteristicValue({
                deviceId: currentDeviceId,
                serviceId,
                characteristicId: item.uuid
              })
            }
          })
        })
      }
    })
  },

  disconnect() {
    if (!deviceId) return

    const currentDeviceId = deviceId
    deviceId = null
    isConnecting = false
    isScanning = false
    clearScanTimer()

    wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
    wx.closeBLEConnection({ deviceId: currentDeviceId, success: () => {}, fail: () => {} })

    this.setData({
      connected: false,
      loading: false,
      discovering: false,
      temperature: '--',
      humidity: '--',
      statusText: '已断开连接',
      statusTone: 'idle',
      primaryButtonText: '重新连接',
      connectionLabel: '待连接',
      lastUpdated: '--:--:--',
      environmentHint: '断开后可再次扫描并连接传感器',
      temperatureTrend: '等待数据',
      humidityTrend: '等待数据'
    })
  },

  handlePrimaryAction() {
    if (this.data.connected) {
      this.disconnect()
      return
    }
    this.connect()
  },

  cleanup() {
    clearScanTimer()
    isConnecting = false
    isScanning = false

    if (this.handleConnectionStateChange && wx.offBLEConnectionStateChange) {
      wx.offBLEConnectionStateChange(this.handleConnectionStateChange)
    }
    if (this.handleCharacteristicValueChange && wx.offBLECharacteristicValueChange) {
      wx.offBLECharacteristicValueChange(this.handleCharacteristicValueChange)
    }

    wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
    if (deviceId) {
      const currentDeviceId = deviceId
      deviceId = null
      wx.closeBLEConnection({ deviceId: currentDeviceId, success: () => {}, fail: () => {} })
    }
  }
})
