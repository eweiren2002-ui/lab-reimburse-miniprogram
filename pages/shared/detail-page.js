const api = require('../../services/api')
const { nowText, formatSize } = require('../../domain/format')
const { showError, isCancel } = require('../../utils/ui')

function createDetailPage(options) {
  return {
    data: {
      ready: false,
      blocked: false,
      missing: false,
      app: null,
      showSavedInvoice: true,
      canInvoice: false,
      canEdit: false,
      canWithdraw: false,
      canDecide: false,
      canGoApprove: false,
      comment: '',
      invoiceNote: '',
      invoiceFiles: [],
      busy: false,
      role: ''
    },
    onLoad(query) {
      this.id = query && query.id ? query.id : ''
      if (!this.id) this.setData({ ready: true, missing: true })
    },
    onShow() {
      if (!this.id) return
      if (this.skipReload) {
        this.skipReload = false
        return
      }
      this.reload()
    },
    onPullDownRefresh() {
      this.invoiceDirty = false
      this.reload().then(() => {
        wx.stopPullDownRefresh()
      }, () => {
        wx.stopPullDownRefresh()
      })
    },
    reload() {
      if (!this.id) return Promise.resolve()
      return api.getPresentedApplication(this.id).then((result) => {
        const app = result.app
        const user = result.user
        const isOwner = user.role === 'applicant' && app.applicantId === user.id
        const canInvoice = isOwner && (app.status === 'pending' || app.status === 'approved')
        const blocked = options.mode === 'mentor' && user.role !== 'mentor'
        const data = {
          ready: true,
          blocked: blocked,
          missing: false,
          role: user.role,
          app: blocked ? null : app,
          showSavedInvoice: !(canInvoice && options.mode === 'applicant'),
          canInvoice: canInvoice && options.mode === 'applicant',
          canEdit: isOwner && (app.status === 'draft' || app.status === 'rejected') && options.mode === 'applicant',
          canWithdraw: isOwner && app.status === 'pending' && options.mode === 'applicant',
          canDecide: user.role === 'mentor' && app.status === 'pending' && options.mode === 'mentor',
          canGoApprove: user.role === 'mentor' && app.status === 'pending' && options.mode === 'applicant',
          busy: false
        }
        if (!this.invoiceDirty) {
          data.invoiceNote = app.invoiceNote
          data.invoiceFiles = (app.invoiceFiles || []).map((file, index) => Object.assign({}, file, {
            key: (file.name || 'file') + '-' + index
          }))
        }
        this.setData(data)
      }).catch((err) => {
        this.setData({ ready: true, missing: true, app: null, busy: false })
        showError(err)
      })
    },
    onBecomeMentor() {
      api.setRole('mentor').then(() => this.reload()).catch(showError)
    },
    onComment(e) {
      this.data.comment = e.detail.value
    },
    onInvoiceNote(e) {
      this.invoiceDirty = true
      this.data.invoiceNote = e.detail.value
    },
    onAddInvoiceFile() {
      this.skipReload = true
      wx.chooseMessageFile({
        count: 5,
        type: 'all',
        success: (res) => {
          const added = (res.tempFiles || []).map((file, index) => ({
            key: (file.name || 'file') + '-' + Date.now() + '-' + index,
            name: file.name,
            size: file.size,
            sizeText: formatSize(file.size),
            addedAt: nowText()
          }))
          this.invoiceDirty = true
          this.setData({
            invoiceFiles: (this.data.invoiceFiles || []).concat(added)
          })
        },
        fail: (err) => {
          if (!isCancel(err)) showError(err)
        }
      })
    },
    onRemoveInvoiceFile(e) {
      const index = Number(e.currentTarget.dataset.index)
      const files = (this.data.invoiceFiles || []).slice()
      files.splice(index, 1)
      this.invoiceDirty = true
      this.setData({ invoiceFiles: files })
    },
    onSaveInvoice() {
      if (this.data.busy) return
      this.setData({ busy: true })
      api.saveInvoice(this.id, {
        note: this.data.invoiceNote,
        files: this.data.invoiceFiles
      }).then(() => {
        this.invoiceDirty = false
        wx.showToast({ title: '已保存', icon: 'success' })
        return this.reload()
      }).catch((err) => {
        this.setData({ busy: false })
        showError(err)
      })
    },
    onEdit() {
      wx.navigateTo({ url: '/pages/apply/edit?id=' + this.id })
    },
    onWithdraw() {
      wx.showModal({
        title: '撤回为草稿',
        content: '撤回后导师暂时看不到这条待审批，改完可以再提交。',
        success: (res) => {
          if (!res.confirm) return
          api.withdraw(this.id).then(() => {
            wx.showToast({ title: '已撤回', icon: 'success' })
            this.reload()
          }).catch(showError)
        }
      })
    },
    onGoApprove() {
      wx.navigateTo({ url: '/pages/approve/detail?id=' + this.id })
    },
    decide(result) {
      if (this.data.busy) return
      const comment = this.data.comment || ''
      wx.showModal({
        title: result === 'approved' ? '确认通过' : '确认驳回',
        content: result === 'approved' ? '通过后申请人按明细采购，并可以补录发票。' : '驳回后申请人可以修改再提交。',
        success: (res) => {
          if (!res.confirm) return
          this.setData({ busy: true })
          api.decide(this.id, { result: result, comment: comment }).then(() => {
            wx.showToast({ title: result === 'approved' ? '已通过' : '已驳回', icon: 'success' })
            this.reload()
          }).catch((err) => {
            this.setData({ busy: false })
            showError(err)
          })
        }
      })
    },
    onApprove() {
      this.decide('approved')
    },
    onReject() {
      this.decide('rejected')
    }
  }
}

module.exports = {
  createDetailPage
}
