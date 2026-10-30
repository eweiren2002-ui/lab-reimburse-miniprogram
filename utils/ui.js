function showError(err) {
  const message = err && err.message ? err.message : '操作失败'
  if (message.length > 14) {
    wx.showModal({
      title: '无法完成',
      content: message,
      showCancel: false
    })
    return
  }
  wx.showToast({ title: message, icon: 'none' })
}

function isCancel(err) {
  const message = (err && (err.errMsg || err.message)) || ''
  return message.indexOf('cancel') >= 0
}

module.exports = {
  showError,
  isCancel
}
