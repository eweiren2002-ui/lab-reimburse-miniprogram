/**
 * 正式登录预留。
 * 现在只调用 wx.login 取得临时 code，不把 code 发给任何服务器。
 * 接入后把 code 交给云函数 login，用 openid 匹配 users 集合里的角色。
 */
function wechatLogin() {
  return new Promise((resolve, reject) => {
    if (!wx.login) {
      reject(new Error('当前环境没有 wx.login'))
      return
    }
    wx.login({
      success(res) {
        if (!res.code) {
          reject(new Error('未取得登录 code'))
          return
        }
        resolve({
          bound: false,
          message: '已调用 wx.login，但还没有云函数把 code 换成 openid，也还没有按 users.openid 绑定申请人或导师。请继续使用首页的身份切换。'
        })
      },
      fail(err) {
        reject(new Error((err && err.errMsg) || 'wx.login 失败'))
      }
    })
  })
}

module.exports = {
  wechatLogin
}
