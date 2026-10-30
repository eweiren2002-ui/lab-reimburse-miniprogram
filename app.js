const config = require('./config')
const api = require('./services/api')

App({
  globalData: {
    hospitalName: config.hospitalName,
    defaultDepartment: config.defaultDepartment,
    formTitle: config.formTitle,
    driver: config.driver
  },
  onLaunch() {
    if (config.driver === 'cloud') {
      if (!wx.cloud) {
        console.error('基础库不支持云开发')
      } else if (!config.cloudEnv) {
        console.error('config.js 的 cloudEnv 还是空的')
      } else {
        wx.cloud.init({
          env: config.cloudEnv,
          traceUser: true
        })
      }
    }
    api.ensureReady().catch((err) => {
      console.error(err)
    })
  }
})
