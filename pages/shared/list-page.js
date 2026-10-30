const api = require('../../services/api')
const { showError } = require('../../utils/ui')

function createListPage(options) {
  return {
    data: {
      blocked: false,
      role: '',
      status: options.defaultStatus || '',
      dealerId: '',
      keyword: '',
      viewMode: 'sheet',
      searchBox: true,
      vm: {
        ready: false,
        cards: [],
        dealerGroups: [],
        statusOptions: [],
        dealerOptions: []
      }
    },
    onLoad(query) {
      const status = query && query.status ? query.status : (options.defaultStatus || '')
      const dealerId = query && query.dealerId ? query.dealerId : ''
      const viewMode = query && query.view === 'dealer' ? 'dealer' : 'sheet'
      this.data.status = status
      this.data.dealerId = dealerId
      this.data.viewMode = viewMode
      this.setData({
        status: status,
        dealerId: dealerId,
        viewMode: viewMode
      })
      wx.setNavigationBarTitle({ title: options.title })
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
      const seq = (this._seq || 0) + 1
      this._seq = seq
      return api.ensureReady().then(() => api.getCurrentUser()).then((user) => {
        if (seq !== this._seq) return null
        if (options.mode === 'mentor' && user.role !== 'mentor') {
          this.setData({
            blocked: true,
            role: user.role,
            vm: { ready: true, blocked: true, cards: [], dealerGroups: [] }
          })
          return null
        }
        const applicantId = options.mode === 'applicant' && user.role === 'applicant' ? user.id : ''
        return api.queryApplications({
          status: this.data.status,
          dealerId: this.data.dealerId,
          keyword: this.data.keyword,
          applicantId: applicantId
        }).then((result) => ({ user: user, result: result }))
      }).then((payload) => {
        if (!payload || seq !== this._seq) return
        const previousGroups = (this.data.vm && this.data.vm.dealerGroups) || []
        const previous = {}
        previousGroups.forEach((group) => {
          previous[group.dealerId] = group.open
        })
        payload.result.dealerGroups.forEach((group) => {
          if (previousGroups.length && Object.prototype.hasOwnProperty.call(previous, group.dealerId)) {
            group.open = previous[group.dealerId]
          } else {
            group.open = true
          }
        })
        const intro = payload.user.role === 'mentor' && options.mode === 'applicant'
          ? '当前是导师身份，这里显示全部申请供查阅。通过或驳回请进入待审批。'
          : options.intro
        this.setData({
          blocked: false,
          role: payload.user.role,
          vm: {
            ready: true,
            blocked: false,
            mode: options.mode,
            intro: intro,
            role: payload.user.role,
            viewMode: this.data.viewMode,
            status: this.data.status,
            dealerId: this.data.dealerId,
            statusOptions: payload.result.statusOptions,
            dealerOptions: payload.result.dealerOptions,
            cards: payload.result.cards,
            dealerGroups: payload.result.dealerGroups,
            emptyText: options.emptyText
          }
        })
      }).catch((err) => {
        showError(err)
        this.setData({
          vm: {
            ready: true,
            cards: [],
            dealerGroups: [],
            statusOptions: [],
            dealerOptions: [],
            emptyText: '加载失败'
          }
        })
      })
    },
    onKeyword(e) {
      const keyword = e.detail.value
      this.data.keyword = keyword
      this.setData({ keyword: keyword })
      this.reload()
    },
    onClearKeyword() {
      this.data.keyword = ''
      this.setData({ keyword: '', searchBox: false }, () => {
        this.setData({ searchBox: true })
        this.reload()
      })
    },
    onStatus(e) {
      const status = e.currentTarget.dataset.value || ''
      this.data.status = status
      this.setData({ status: status })
      this.reload()
    },
    onDealer(e) {
      const dealerId = e.currentTarget.dataset.id || ''
      this.data.dealerId = dealerId
      this.setData({ dealerId: dealerId })
      this.reload()
    },
    onSwitchView(e) {
      const viewMode = e.currentTarget.dataset.mode || 'sheet'
      this.data.viewMode = viewMode
      this.setData({ viewMode: viewMode, 'vm.viewMode': viewMode })
    },
    onToggleDealer(e) {
      const id = e.currentTarget.dataset.id
      const groups = ((this.data.vm && this.data.vm.dealerGroups) || []).map((group) => {
        if (group.dealerId !== id) return group
        return Object.assign({}, group, { open: !group.open })
      })
      this.setData({ 'vm.dealerGroups': groups })
    },
    onOpenCard(e) {
      const id = e.currentTarget.dataset.id
      if (!id) return
      wx.navigateTo({ url: options.detailUrl + '?id=' + id })
    },
    onCreate() {
      wx.navigateTo({ url: '/pages/apply/edit' })
    },
    onBecomeMentor() {
      api.setRole('mentor').then(() => this.reload()).catch(showError)
    }
  }
}

module.exports = {
  createListPage
}
