const api = require('../../services/api')
const auth = require('../../services/auth')
const { showError } = require('../../utils/ui')

Page({
  data: {
    ready: false,
    user: null,
    counts: { draft: 0, pending: 0, approved: 0, rejected: 0, total: 0 },
    pendingAmountText: '0.00',
    recent: [],
    hospitalName: '丽水市第二人民医院',
    formTitle: '临时采购医用耗材购置申请表',
    departmentName: '中心实验室',
    driverText: '本机演示数据'
  },
  onShow() {
    this.reload()
  },
  onPullDownRefresh() {
    this.reload().then(() => {
      wx.stopPullDownRefresh()
    }, () => {
      wx.stopPullDownRefresh()
    })
  },
  reload() {
    return api.home().then((home) => {
      this.setData({
        ready: true,
        user: home.user,
        counts: home.counts,
        pendingAmountText: home.pendingAmountText,
        recent: home.recent,
        hospitalName: home.hospitalName,
        formTitle: home.formTitle,
        departmentName: home.departmentName,
        driverText: home.driver === 'cloud' ? '微信云开发' : '本机演示数据'
      })
    }).catch((err) => {
      this.setData({ ready: true })
      showError(err)
    })
  },
  onSwitchRole() {
    const next = this.data.user && this.data.user.role === 'mentor' ? 'applicant' : 'mentor'
    api.setRole(next).then(() => this.reload()).catch(showError)
  },
  onLogin() {
    auth.wechatLogin().then((result) => {
      wx.showModal({
        title: '微信登录未绑定身份',
        content: result.message,
        showCancel: false
      })
    }).catch((err) => {
      wx.showModal({
        title: '微信登录未完成',
        content: (err && err.message) || '请使用身份切换继续演示',
        showCancel: false
      })
    })
  },
  onReset() {
    wx.showModal({
      title: '恢复演示数据',
      content: '将清除本机新增的申请、审批意见和发票备注，恢复两张审批表的初始内容。当前身份不变。',
      success: (res) => {
        if (!res.confirm) return
        api.resetDemo().then(() => {
          wx.showToast({ title: '已恢复', icon: 'success' })
          this.reload()
        }).catch(showError)
      }
    })
  },
  onOpenCard(e) {
    const id = e.currentTarget.dataset.id
    if (!id || !this.data.user) return
    const url = this.data.user.role === 'mentor'
      ? '/pages/approve/detail?id=' + id
      : '/pages/apply/detail?id=' + id
    wx.navigateTo({ url: url })
  }
})
