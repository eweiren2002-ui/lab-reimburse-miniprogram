const api = require('../../services/api')
const domain = require('../../domain/applications')
const format = require('../../domain/format')
const { showError } = require('../../utils/ui')

function blankLine(usage) {
  return {
    id: 'line-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
    sheetNo: 0,
    productName: '',
    spec: '',
    usage: usage || '科研需要',
    quantity: '1',
    unitPrice: '',
    totalPrice: 0,
    totalPriceText: '0.00',
    manufacturer: '',
    dealerId: '',
    dealerName: '',
    dealerShortName: '',
    phone: ''
  }
}

function fromAppItem(item) {
  return {
    id: item.id,
    sheetNo: item.sheetNo,
    productName: item.productName,
    spec: item.spec,
    usage: item.usage,
    quantity: String(item.quantity),
    unitPrice: String(item.unitPrice),
    totalPrice: item.totalPrice,
    totalPriceText: format.formatMoney(item.totalPrice),
    manufacturer: item.manufacturer,
    dealerId: item.dealerId,
    dealerName: item.dealerName,
    dealerShortName: item.dealerShortName,
    phone: item.phone || ''
  }
}

Page({
  data: {
    ready: false,
    busy: false,
    dateText: '',
    amountText: '0.00',
    previewGroups: [],
    form: {
      items: []
    },
    dealerSheet: {
      open: false,
      lineIndex: -1,
      results: []
    },
    catalogSheet: {
      open: false,
      lineIndex: -1,
      dealerId: '',
      results: []
    }
  },
  onLoad(query) {
    this.editId = query && query.id ? query.id : ''
    wx.setNavigationBarTitle({ title: this.editId ? '编辑申请' : '新建申请' })
    api.prepareEditor(this.editId).then((payload) => {
      this.dealers = payload.dealers
      this.catalog = payload.catalog
      const form = payload.app ? this.formFromApp(payload.app) : this.freshForm(payload.user)
      this.setData({
        ready: true,
        form: form,
        dateText: format.formatDateCN(form.applyDate)
      })
      this.refreshSummary()
    }).catch((err) => {
      showError(err)
      setTimeout(() => {
        wx.navigateBack({ delta: 1 })
      }, 500)
    })
  },
  freshForm(user) {
    const usage = '科研需要'
    return {
      id: '',
      serialNo: '',
      department: user.department || '中心实验室',
      applicantName: user.name,
      applyDate: format.todayISO(),
      usage: usage,
      reason: '',
      fundNote: '',
      printedEstimate: '',
      sourceLabel: '小程序新建',
      createdAt: '',
      submittedAt: '',
      invoice: { note: '', files: [] },
      items: [blankLine(usage)]
    }
  },
  formFromApp(app) {
    return {
      id: app.id,
      serialNo: app.serialNo,
      department: app.department,
      applicantName: app.applicantName,
      applyDate: app.applyDate,
      usage: app.usage || '科研需要',
      reason: app.reason || '',
      fundNote: app.fundNote || '',
      printedEstimate: app.printedEstimate || '',
      sourceLabel: app.sourceLabel,
      createdAt: app.createdAt,
      submittedAt: app.submittedAt || '',
      invoice: app.invoice || { note: '', files: [] },
      items: (app.items && app.items.length ? app.items : [blankLine(app.usage)]).map(fromAppItem)
    }
  },
  refreshSummary() {
    const items = (this.data.form.items || []).map((item) => Object.assign({}, item, {
      totalPrice: domain.lineTotal(item.quantity, item.unitPrice)
    }))
    const groups = domain.groupItems(items).filter((group) => {
      return group.lines.some((line) => line.productName || line.dealerName || Number(line.unitPrice) > 0)
    })
    const amount = groups.reduce((sum, group) => sum + group.subtotal, 0)
    this.setData({
      previewGroups: groups,
      amountText: format.formatMoney(amount)
    })
  },
  onHeaderInput(e) {
    const field = e.currentTarget.dataset.field
    this.data.form[field] = e.detail.value
  },
  onDateChange(e) {
    const applyDate = e.detail.value
    this.data.form.applyDate = applyDate
    this.setData({
      'form.applyDate': applyDate,
      dateText: format.formatDateCN(applyDate)
    })
  },
  onLineInput(e) {
    const index = Number(e.currentTarget.dataset.index)
    const field = e.currentTarget.dataset.field
    const items = this.data.form.items
    if (!items[index]) return
    items[index][field] = e.detail.value
    if (field === 'quantity' || field === 'unitPrice') {
      const total = domain.lineTotal(items[index].quantity, items[index].unitPrice)
      items[index].totalPrice = total
      const patch = {}
      patch['form.items[' + index + '].totalPriceText'] = format.formatMoney(total)
      this.setData(patch)
      this.refreshSummary()
    }
  },
  onAddLine() {
    if ((this.data.form.items || []).length >= 80) {
      showError(new Error('一条申请最多 80 行明细'))
      return
    }
    const items = this.data.form.items.concat([blankLine(this.data.form.usage)])
    this.setData({ 'form.items': items })
    this.refreshSummary()
  },
  onRemoveLine(e) {
    const index = Number(e.currentTarget.dataset.index)
    let items = this.data.form.items.slice()
    if (items.length === 1) items = [blankLine(this.data.form.usage)]
    else items.splice(index, 1)
    this.setData({ 'form.items': items })
    this.refreshSummary()
  },
  onCopyLine(e) {
    const index = Number(e.currentTarget.dataset.index)
    if ((this.data.form.items || []).length >= 80) {
      showError(new Error('一条申请最多 80 行明细'))
      return
    }
    const items = this.data.form.items.slice()
    const copy = Object.assign({}, items[index], { id: 'line-' + Date.now() })
    items.splice(index + 1, 0, copy)
    this.setData({ 'form.items': items })
    this.refreshSummary()
  },
  onMoveLine(e) {
    const index = Number(e.currentTarget.dataset.index)
    const dir = Number(e.currentTarget.dataset.dir)
    const target = index + dir
    const items = this.data.form.items.slice()
    if (target < 0 || target >= items.length) return
    const current = items[index]
    items[index] = items[target]
    items[target] = current
    this.setData({ 'form.items': items })
  },
  onOpenDealer(e) {
    const index = Number(e.currentTarget.dataset.index)
    this.manualDealer = ''
    this.setData({
      catalogSheet: Object.assign({}, this.data.catalogSheet, { open: false }),
      dealerSheet: {
        open: true,
        lineIndex: index,
        results: domain.filterDealers(this.dealers, '')
      }
    })
  },
  onDealerKeyword(e) {
    this.setData({
      'dealerSheet.results': domain.filterDealers(this.dealers, e.detail.value)
    })
  },
  onChooseDealer(e) {
    const id = e.currentTarget.dataset.id
    const dealer = (this.dealers || []).find((item) => item.id === id)
    if (!dealer) return
    this.applyDealer(this.data.dealerSheet.lineIndex, {
      dealerId: dealer.id,
      dealerName: dealer.name,
      dealerShortName: dealer.shortName
    })
  },
  onManualDealer(e) {
    this.manualDealer = e.detail.value
  },
  onConfirmManualDealer() {
    const name = (this.manualDealer || '').trim()
    if (!name) {
      showError(new Error('请输入供货单位全称'))
      return
    }
    this.applyDealer(this.data.dealerSheet.lineIndex, domain.matchDealerInput(this.dealers, name))
  },
  applyDealer(index, dealer) {
    const items = this.data.form.items.slice()
    if (!items[index]) return
    items[index] = Object.assign({}, items[index], dealer)
    this.setData({
      'form.items': items,
      'dealerSheet.open': false
    })
    this.refreshSummary()
  },
  closeDealer() {
    this.setData({ 'dealerSheet.open': false })
  },
  onAddFromCatalog() {
    this.openCatalog(-1)
  },
  onFillLineFromCatalog(e) {
    this.openCatalog(Number(e.currentTarget.dataset.index))
  },
  openCatalog(lineIndex) {
    this.catalogKeyword = ''
    this.catalogDealerId = ''
    this.setData({
      dealerSheet: Object.assign({}, this.data.dealerSheet, { open: false }),
      catalogSheet: {
        open: true,
        lineIndex: lineIndex,
        dealerId: '',
        results: domain.filterCatalog(this.catalog, this.dealers, '', '').slice(0, 80)
      }
    })
  },
  onCatalogKeyword(e) {
    this.catalogKeyword = e.detail.value
    this.setData({
      'catalogSheet.results': domain.filterCatalog(
        this.catalog,
        this.dealers,
        this.catalogKeyword,
        this.catalogDealerId || ''
      ).slice(0, 80)
    })
  },
  onCatalogDealer(e) {
    const dealerId = e.currentTarget.dataset.id || ''
    this.catalogDealerId = dealerId
    this.setData({
      'catalogSheet.dealerId': dealerId,
      'catalogSheet.results': domain.filterCatalog(
        this.catalog,
        this.dealers,
        this.catalogKeyword || '',
        dealerId
      ).slice(0, 80)
    })
  },
  onPickCatalog(e) {
    const id = e.currentTarget.dataset.id
    const picked = (this.catalog || []).find((row) => row.id === id)
    if (!picked) return
    const lineIndex = this.data.catalogSheet.lineIndex
    const apply = () => {
      const partial = {
        productName: picked.productName,
        spec: picked.spec,
        usage: picked.usage || this.data.form.usage || '科研需要',
        quantity: String(picked.quantity || 1),
        unitPrice: String(picked.unitPrice),
        manufacturer: picked.manufacturer,
        dealerId: picked.dealerId,
        dealerName: picked.dealerName,
        dealerShortName: picked.dealerShortName,
        phone: picked.phone || ''
      }
      let items = this.data.form.items.slice()
      let index = lineIndex
      if (index < 0) {
        if (items.length >= 80) {
          showError(new Error('一条申请最多 80 行明细'))
          return
        }
        items = items.concat([blankLine(this.data.form.usage)])
        index = items.length - 1
      }
      const current = Object.assign({}, items[index], partial)
      current.totalPrice = domain.lineTotal(current.quantity, current.unitPrice)
      current.totalPriceText = format.formatMoney(current.totalPrice)
      items[index] = current
      this.setData({
        'form.items': items,
        'catalogSheet.open': false
      })
      this.refreshSummary()
    }
    const existing = lineIndex >= 0 ? this.data.form.items[lineIndex] : null
    if (existing && existing.productName) {
      wx.showModal({
        title: '覆盖这一行？',
        content: '目录内容会替换当前行的品名、规格、价格和经销商。',
        success: (res) => {
          if (res.confirm) apply()
        }
      })
      return
    }
    apply()
  },
  closeCatalog() {
    this.setData({ 'catalogSheet.open': false })
  },
  noop() {},
  collectForm() {
    const form = this.data.form
    return {
      id: form.id,
      serialNo: form.serialNo,
      department: form.department,
      applicantName: form.applicantName,
      applyDate: form.applyDate,
      usage: form.usage,
      reason: form.reason,
      fundNote: form.fundNote,
      printedEstimate: form.printedEstimate,
      sourceLabel: form.sourceLabel,
      createdAt: form.createdAt,
      submittedAt: form.submittedAt,
      invoice: form.invoice,
      items: (form.items || []).map((item) => ({
        id: item.id,
        productName: item.productName,
        spec: item.spec,
        usage: item.usage || form.usage,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        manufacturer: item.manufacturer,
        dealerId: item.dealerId,
        dealerName: item.dealerName,
        dealerShortName: item.dealerShortName,
        phone: item.phone
      }))
    }
  },
  onSaveDraft() {
    if (this.data.busy) return
    this.setData({ busy: true })
    api.saveDraft(this.collectForm()).then((app) => {
      wx.showToast({ title: '已存草稿', icon: 'success' })
      wx.redirectTo({ url: '/pages/apply/detail?id=' + app.id })
    }).catch((err) => {
      this.setData({ busy: false })
      showError(err)
    })
  },
  onSubmit() {
    if (this.data.busy) return
    this.setData({ busy: true })
    api.submitForm(this.collectForm()).then((app) => {
      wx.showToast({ title: '已提交', icon: 'success' })
      wx.redirectTo({ url: '/pages/apply/detail?id=' + app.id })
    }).catch((err) => {
      this.setData({ busy: false })
      showError(err)
    })
  }
})
