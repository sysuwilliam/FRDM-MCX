const DEVICE_NAME = 'MCXN947_DHT11'
const COMPANY_ID = 0x02e5
const PROTOCOL_VERSION = 1

let scanning = false
let scanTimeout = null

function formatTime(date) {
  const pad = (value) => `${value}`.padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function arrayBufferToBytes(buffer) {
  if (!buffer) return []
  return Array.from(new Uint8Array(buffer))
}

function decodeAscii(bytes) {
  return bytes.map((value) => String.fromCharCode(value)).join('')
}

function parseAdvertisement(buffer) {
  const bytes = arrayBufferToBytes(buffer)
  const result = {
    localName: '',
    manufacturerData: null
  }
  let offset = 0

  while (offset < bytes.length) {
    const length = bytes[offset]
    if (length === 0) break

    const typeOffset = offset + 1
    const valueOffset = offset + 2
    const valueLength = length - 1
    if (typeOffset >= bytes.length || valueOffset + valueLength > bytes.length) break

    const type = bytes[typeOffset]
    const value = bytes.slice(valueOffset, valueOffset + valueLength)

    if (type === 0x08 || type === 0x09) {
      result.localName = decodeAscii(value)
    } else if (type === 0xff) {
      result.manufacturerData = value
    }

    offset += length + 1
  }

  return result
}

function readInt16LE(bytes, offset) {
  const value = bytes[offset] | (bytes[offset + 1] << 8)
  return value & 0x8000 ? value - 0x10000 : value
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function checksum(bytes) {
  return bytes.reduce((sum, value) => (sum + value) & 0xff, 0)
}

function parseThermohygrometerPayload(bytes) {
  if (!bytes || bytes.length < 12) return null

  const companyId = bytes[0] | (bytes[1] << 8)
  const validChecksum = checksum(bytes.slice(0, 11)) === bytes[11]

  if (
    companyId !== COMPANY_ID ||
    bytes[2] !== 0x54 ||
    bytes[3] !== 0x48 ||
    bytes[4] !== PROTOCOL_VERSION ||
    !validChecksum
  ) {
    return null
  }

  return {
    sequence: bytes[5],
    temperature: readInt16LE(bytes, 6) / 100,
    humidity: readUint16LE(bytes, 8) / 100,
    valid: (bytes[10] & 0x01) === 0x01
  }
}

function clearScanTimeout() {
  if (scanTimeout) {
    clearTimeout(scanTimeout)
    scanTimeout = null
  }
}

Page({
  data: {
    scanning: false,
    receiving: false,
    temperature: '--',
    humidity: '--',
    statusText: '点击开始扫描 ESP32-S3 广播',
    statusTone: 'idle',
    primaryButtonText: '开始扫描',
    deviceName: DEVICE_NAME,
    deviceId: '--',
    rssi: '--',
    sequence: '--',
    lastUpdated: '--:--:--',
    hintText: '请保持 ESP32-S3 上电，并确认 FRDM-MCXN947 已通过 UART 发送 TH 数据帧。'
  },

  onLoad() {
    this.bindBluetoothListeners()
  },

  onUnload() {
    this.cleanup()
  },

  bindBluetoothListeners() {
    this.handleDeviceFound = (res) => {
      const devices = res.devices || []

      devices.forEach((device) => {
        const adv = parseAdvertisement(device.advertisData)
        const name = device.localName || device.name || adv.localName || ''
        const measurement =
          parseThermohygrometerPayload(adv.manufacturerData) ||
          parseThermohygrometerPayload(arrayBufferToBytes(device.manufacturerData)) ||
          parseThermohygrometerPayload(arrayBufferToBytes(device.advertisData))

        if (!measurement && name !== DEVICE_NAME) return
        if (!measurement) return

        const lastUpdated = formatTime(new Date())
        this.setData({
          receiving: true,
          temperature: measurement.valid ? measurement.temperature.toFixed(2) : '--',
          humidity: measurement.valid ? measurement.humidity.toFixed(2) : '--',
          statusText: measurement.valid ? '已收到 ESP32-S3 温湿度广播' : '已发现设备，等待有效测量值',
          statusTone: measurement.valid ? 'success' : 'busy',
          deviceName: name || DEVICE_NAME,
          deviceId: device.deviceId || '--',
          rssi: typeof device.RSSI === 'number' ? `${device.RSSI} dBm` : '--',
          sequence: measurement.sequence,
          lastUpdated,
          hintText: '广播包校验通过，页面会随 ESP32-S3 新广播持续刷新。'
        })
      })
    }

    this.handleAdapterStateChange = (res) => {
      if (!res.available) {
        this.stopScan('蓝牙适配器不可用，请开启系统蓝牙', 'danger')
      }
    }

    wx.onBluetoothDeviceFound(this.handleDeviceFound)
    wx.onBluetoothAdapterStateChange(this.handleAdapterStateChange)
  },

  startScan() {
    if (scanning) return

    this.setData({
      scanning: true,
      receiving: false,
      statusText: '正在打开蓝牙适配器...',
      statusTone: 'busy',
      primaryButtonText: '停止扫描',
      hintText: `正在搜索设备名 ${DEVICE_NAME} 或匹配的厂商广播数据。`
    })

    wx.openBluetoothAdapter({
      success: () => {
        this.startDiscovery()
      },
      fail: () => {
        this.setData({
          scanning: false,
          statusText: '蓝牙不可用，请检查权限或系统蓝牙开关',
          statusTone: 'danger',
          primaryButtonText: '重新扫描'
        })
      }
    })
  },

  startDiscovery() {
    scanning = true
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      interval: 0,
      success: () => {
        this.setData({
          scanning: true,
          statusText: '正在扫描 ESP32-S3 广播...',
          statusTone: 'busy'
        })

        clearScanTimeout()
        scanTimeout = setTimeout(() => {
          if (!this.data.receiving) {
            this.setData({
              statusText: '暂未收到目标广播，仍在继续扫描',
              statusTone: 'busy',
              hintText: '请检查 ESP32-S3 是否已烧录 dht11_ble，且手机蓝牙权限已允许。'
            })
          }
        }, 12000)
      },
      fail: () => {
        scanning = false
        this.setData({
          scanning: false,
          statusText: '扫描启动失败，请稍后重试',
          statusTone: 'danger',
          primaryButtonText: '重新扫描'
        })
      }
    })
  },

  stopScan(message = '已停止扫描', tone = 'idle') {
    scanning = false
    clearScanTimeout()
    wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
    this.setData({
      scanning: false,
      statusText: message,
      statusTone: tone,
      primaryButtonText: '开始扫描'
    })
  },

  handlePrimaryAction() {
    if (scanning) {
      this.stopScan()
      return
    }
    this.startScan()
  },

  cleanup() {
    this.stopScan()
    if (this.handleDeviceFound && wx.offBluetoothDeviceFound) {
      wx.offBluetoothDeviceFound(this.handleDeviceFound)
    }
    if (this.handleAdapterStateChange && wx.offBluetoothAdapterStateChange) {
      wx.offBluetoothAdapterStateChange(this.handleAdapterStateChange)
    }
    wx.closeBluetoothAdapter({ success: () => {}, fail: () => {} })
  }
})
