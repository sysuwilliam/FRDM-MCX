// pages/index/index.js
// BLE 温湿度计 — 微信小程序

const DEVICE_NAME = 'MCXW71_TH'
const HTS_SERVICE = '00001809-0000-1000-8000-00805f9b34fb'
const HTS_TEMP_CHAR = '00002a1c-0000-1000-8000-00805f9b34fb'
const ESS_SERVICE = '0000181a-0000-1000-8000-00805f9b34fb'
const ESS_HUM_CHAR = '00002a6f-0000-1000-8000-00805f9b34fb'

// 所有模块级状态都在这里
let deviceId = null
let isConnecting = false
let isScanning = false

function readInt16(buffer) {
  return new DataView(buffer).getInt16(0, true)
}

function readUint16(buffer) {
  return new DataView(buffer).getUint16(0, true)
}

function resetState(page) {
  deviceId = null
  isConnecting = false
  isScanning = false
  page.setData({
    connected: false,
    loading: false,
    discovering: false,
    temperature: '--',
    humidity: '--',
    statusText: '点击开始连接',
  })
}

function setStatus(page, text) {
  page.setData({ statusText: text })
}

Page({
  data: {
    connected: false,
    temperature: '--',
    humidity: '--',
    statusText: '点击开始连接',
    loading: false,
    discovering: false,
  },

  onLoad() {},
  onShow() {},
  onHide() {},

  onUnload() {
    // 只关连接，不关适配器，避免下次无法重连
    if (deviceId) {
      wx.closeBLEConnection({ deviceId, success: () => {}, fail: () => {} })
    }
    wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
  },

  connect() {
    if (isConnecting || isScanning) return
    this._doConnect()
  },

  _doConnect() {
    isConnecting = true
    this.setData({ loading: true, statusText: '正在扫描...' })

    // 先打开蓝牙适配器
    wx.openBluetoothAdapter({
      success: () => {
        this._scanAndConnect()
      },
      fail: (err) => {
        // errCode 10001 = 适配器已打开，正常
        if (err.errCode !== 10001) {
          isConnecting = false
          this.setData({ loading: false, statusText: '蓝牙不可用' })
        }
      }
    })
  },

  _scanAndConnect() {
    isScanning = true
    this.setData({ discovering: true })

    // 注册连接状态监听（只注册一次）
    wx.onBLEConnectionStateChange((res) => {
      if (res.deviceId !== deviceId) return
      if (!res.connected) {
        deviceId = null
        isConnecting = false
        isScanning = false
        this.setData({
          connected: false,
          loading: false,
          discovering: false,
          statusText: '连接已断开',
        })
      }
    })

    // 监听数据变化
    wx.onBLECharacteristicValueChange((res) => {
      if (res.characteristicId.toUpperCase() === HTS_TEMP_CHAR.toUpperCase()) {
        this.setData({ temperature: (readInt16(res.value) / 100).toFixed(2) })
      } else if (res.characteristicId.toUpperCase() === ESS_HUM_CHAR.toUpperCase()) {
        this.setData({ humidity: (readUint16(res.value) / 100).toFixed(2) })
      }
    })

    // 开始扫描
    wx.startBluetoothDevicesDiscovery({
      allowDuplicatesKey: true,
      success: () => {
        this._pollDevices()
      },
      fail: () => {
        isConnecting = false
        isScanning = false
        this.setData({ loading: false, discovering: false, statusText: '扫描失败' })
      }
    })
  },

  _pollDevices() {
    let count = 0
    const timer = setInterval(() => {
      count++
      if (count >= 15) {
        clearInterval(timer)
        isConnecting = false
        isScanning = false
        wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
        this.setData({ discovering: false, loading: false, statusText: '未找到设备' })
        return
      }

      wx.getBluetoothDevices({
        success: (res) => {
          for (const d of res.devices) {
            if (d.name === DEVICE_NAME) {
              clearInterval(timer)
              isScanning = false
              wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
              this._doConnectDevice(d.deviceId)
              return
            }
          }
        }
      })
    }, 1000)
  },

  _doConnectDevice(id) {
    this.setData({ loading: true, statusText: '正在连接...' })

    wx.createBLEConnection({
      deviceId: id,
      success: () => {
        deviceId = id
        isConnecting = false
        this.setData({ connected: true, loading: false, discovering: false, statusText: '已连接' })
        this._getServices(id)
      },
      fail: () => {
        deviceId = null
        isConnecting = false
        this.setData({ loading: false, discovering: false, statusText: '连接失败' })
      }
    })
  },

  _getServices(id) {
    const t = setTimeout(() => {
      this.setData({ statusText: '已连接' })
    }, 3000)

    wx.getBLEDeviceServices({
      deviceId: id,
      success: (res) => {
        clearTimeout(t)
        for (const s of res.services) {
          const uuid = s.uuid.toUpperCase()
          if (uuid === HTS_SERVICE.toUpperCase()) {
            this._subscribeChar(id, s.uuid, HTS_TEMP_CHAR)
          } else if (uuid === ESS_SERVICE.toUpperCase()) {
            this._subscribeChar(id, s.uuid, ESS_HUM_CHAR)
          }
        }
        this.setData({ statusText: '已连接' })
      },
      fail: () => {
        clearTimeout(t)
        this.setData({ statusText: '已连接' })
      }
    })
  },

  _subscribeChar(deviceId, serviceId, charId) {
    wx.getBLEDeviceCharacteristics({
      deviceId, serviceId,
      success: (res) => {
        for (const c of res.characteristics) {
          if (c.uuid.toUpperCase() === charId.toUpperCase()) {
            if (c.properties.notify || c.properties.indicate) {
              wx.notifyBLECharacteristicValueChange({
                deviceId, serviceId,
                characteristicId: c.uuid, state: true,
                success: () => {
                  wx.readBLECharacteristicValue({ deviceId, serviceId, characteristicId: c.uuid })
                }
              })
            }
          }
        }
      }
    })
  },

  disconnect() {
    if (!deviceId) return

    const id = deviceId
    deviceId = null
    isConnecting = false
    isScanning = false

    wx.stopBluetoothDevicesDiscovery({ success: () => {}, fail: () => {} })
    wx.closeBLEConnection({ deviceId: id, success: () => {}, fail: () => {} })

    this.setData({
      connected: false,
      loading: false,
      discovering: false,
      temperature: '--',
      humidity: '--',
      statusText: '点击开始连接',
    })
  },
})
