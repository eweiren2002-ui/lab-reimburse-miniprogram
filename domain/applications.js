const {
  trim,
  roundMoney,
  formatMoney,
  formatQuantity,
  formatDateCN,
  formatSize,
  brief
} = require('./format')

const STATUS_META = {
  draft: { text: '草稿', cls: 'st-draft' },
  pending: { text: '待审批', cls: 'st-pending' },
  approved: { text: '已通过', cls: 'st-approved' },
  rejected: { text: '已驳回', cls: 'st-rejected' }
}

const STATUS_OPTIONS = [
  { value: '', text: '全部' },
  { value: 'draft', text: '草稿' },
  { value: 'pending', text: '待审批' },
  { value: 'approved', text: '已通过' },
  { value: 'rejected', text: '已驳回' }
]

const PAPER_STEPS = [
  { step: '医务处/护理部/科教处', place: '纸质申请表', hint: '签名' },
  { step: '院感科', place: '纸质申请表', hint: '签名' },
  { step: '医保办、价格管理科', place: '纸质申请表', hint: '是否收费、签名' },
  { step: '采购中心', place: '纸质申请表', hint: '证件是否合格、询价、签名' },
  { step: '分管院长', place: '纸质申请表', hint: '签名' },
  { step: '院长', place: '纸质申请表', hint: '审批时间' }
]

function lineTotal(quantity, unitPrice) {
  const count = Number(quantity)
  const price = Number(unitPrice)
  if (!isFinite(count) || !isFinite(price)) return 0
  return roundMoney(count * price)
}

function hashText(text) {
  let hash = 0
  const value = String(text)
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0
  }
  return hash.toString(16)
}

function normalizeItem(item, index) {
  const quantity = Number(item.quantity)
  const unitPrice = roundMoney(item.unitPrice)
  return {
    id: item.id || ('line-' + (index + 1)),
    sheetNo: index + 1,
    productName: trim(item.productName),
    spec: trim(item.spec),
    usage: trim(item.usage) || '科研需要',
    quantity: isFinite(quantity) ? quantity : 0,
    unitPrice: unitPrice,
    totalPrice: lineTotal(quantity, unitPrice),
    manufacturer: trim(item.manufacturer),
    dealerId: item.dealerId || '',
    dealerName: trim(item.dealerName),
    dealerShortName: trim(item.dealerShortName),
    phone: trim(item.phone)
  }
}

function nextSerial(applications, applyDate) {
  const day = String(applyDate || '').replace(/-/g, '')
  const prefix = 'CG-' + day + '-'
  let max = 0
  ;(applications || []).forEach((app) => {
    if (app.serialNo && app.serialNo.indexOf(prefix) === 0) {
      const number = Number(app.serialNo.slice(prefix.length))
      if (number > max) max = number
    }
  })
  const sequence = String(max + 1)
  const padded = sequence.length < 3 ? ('000' + sequence).slice(-3) : sequence
  return prefix + padded
}

function normalizeForm(form, ctx) {
  const source = form || {}
  const items = (source.items || []).map(normalizeItem)
  const estimatedTotal = roundMoney(items.reduce((sum, item) => sum + item.totalPrice, 0))
  const applyDate = source.applyDate || (ctx && ctx.today) || ''
  const hospital = (ctx && ctx.hospital) || {}
  const user = (ctx && ctx.user) || {}
  let id = source.id || ''
  let serialNo = source.serialNo || ''
  if (!id) {
    serialNo = nextSerial((ctx && ctx.applications) || [], applyDate)
    id = serialNo
  }
  return {
    id: id,
    serialNo: serialNo || id,
    hospitalName: hospital.name || '丽水市第二人民医院',
    formTitle: hospital.formTitle || '临时采购医用耗材购置申请表',
    department: trim(source.department) || user.department || '',
    applicantId: user.id || source.applicantId || '',
    applicantName: trim(source.applicantName) || user.name || '',
    applyDate: applyDate,
    usage: trim(source.usage) || '科研需要',
    reason: trim(source.reason),
    fundNote: trim(source.fundNote),
    printedEstimate: source.printedEstimate || '',
    estimatedTotal: estimatedTotal,
    status: source.status || 'draft',
    items: items,
    invoice: source.invoice || { note: '', files: [] },
    decision: source.decision || null,
    sourceLabel: source.sourceLabel || '小程序新建',
    createdAt: source.createdAt || (ctx && ctx.now) || '',
    updatedAt: (ctx && ctx.now) || '',
    submittedAt: source.submittedAt || ''
  }
}

function validateApplication(app) {
  const errors = []
  if (!trim(app.department)) errors.push('请填写申请科室')
  if (!trim(app.applicantName)) errors.push('请填写申请人')
  if (!app.applyDate) errors.push('请选择申请时间')
  if (!trim(app.reason)) errors.push('请填写申请理由')
  if (!app.items || !app.items.length) errors.push('请至少添加一条采购明细')
  ;(app.items || []).forEach((item, index) => {
    const line = index + 1
    if (!trim(item.productName)) errors.push('第' + line + '行：请填写产品名称')
    if (!trim(item.spec)) errors.push('第' + line + '行：请填写规格型号')
    if (!(Number(item.quantity) > 0)) errors.push('第' + line + '行：采购量需大于 0')
    if (!(Number(item.unitPrice) > 0)) errors.push('第' + line + '行：科室建议购入价需大于 0')
    if (!trim(item.manufacturer)) errors.push('第' + line + '行：请填写生产单位')
    if (!trim(item.dealerName)) errors.push('第' + line + '行：请选择或填写供货单位/经销商')
  })
  return errors
}

function hasDraftContent(app) {
  if (trim(app.reason) || trim(app.fundNote)) return true
  return (app.items || []).some((item) => trim(item.productName) || trim(item.dealerName))
}

function findDealerIndex(dealers, item) {
  const name = trim(item.dealerName)
  if (item.dealerId) {
    const byId = dealers.findIndex((dealer) => dealer.id === item.dealerId)
    if (byId >= 0) return byId
  }
  return dealers.findIndex((dealer) => {
    return dealer.name === name || dealer.shortName === name || (dealer.aliases || []).indexOf(name) >= 0
  })
}

function withPhone(dealer, phone) {
  if (!phone || dealer.phone) return dealer
  return Object.assign({}, dealer, { phone: phone })
}

function matchDealerInput(dealers, name) {
  const text = trim(name)
  const found = (dealers || []).find((dealer) => {
    return dealer.name === text || dealer.shortName === text || (dealer.aliases || []).indexOf(text) >= 0
  })
  if (!found) {
    return {
      dealerId: '',
      dealerName: text,
      dealerShortName: text ? text.slice(0, 8) : ''
    }
  }
  return {
    dealerId: found.id,
    dealerName: found.name,
    dealerShortName: found.shortName
  }
}

function attachDealers(dealers, application) {
  let nextDealers = (dealers || []).map((dealer) => Object.assign({}, dealer))
  const items = (application.items || []).map((item) => {
    const phone = trim(item.phone)
    const name = trim(item.dealerName)
    if (!name && !item.dealerId) {
      return Object.assign({}, item, {
        dealerName: '',
        dealerId: '',
        dealerShortName: ''
      })
    }
    const index = findDealerIndex(nextDealers, item)
    if (index >= 0) {
      const dealer = withPhone(nextDealers[index], phone)
      nextDealers = nextDealers.slice()
      nextDealers[index] = dealer
      const keepSheetName = !!(item.dealerId && name && item.dealerId === dealer.id)
      return Object.assign({}, item, {
        dealerId: dealer.id,
        dealerName: keepSheetName ? name : (dealer.name || name),
        dealerShortName: dealer.shortName
      })
    }
    const created = {
      id: 'dealer-custom-' + hashText(name || 'empty'),
      name: name,
      shortName: name ? name.slice(0, 8) : '未命名',
      aliases: name ? [name] : [],
      phone: phone,
      contactName: '',
      note: '申请人手工录入'
    }
    nextDealers = nextDealers.concat([created])
    return Object.assign({}, item, {
      dealerId: created.id,
      dealerName: created.name,
      dealerShortName: created.shortName
    })
  })
  return {
    dealers: nextDealers,
    application: Object.assign({}, application, { items: items })
  }
}

function markDraft(app, time) {
  return Object.assign({}, app, {
    status: 'draft',
    decision: null,
    updatedAt: time
  })
}

function markSubmitted(app, time) {
  return Object.assign({}, app, {
    status: 'pending',
    decision: null,
    submittedAt: time,
    updatedAt: time
  })
}

function groupItems(items) {
  const order = []
  const map = {}
  ;(items || []).forEach((item) => {
    const key = trim(item.dealerName) || '未填写供货单位'
    if (!map[key]) {
      map[key] = {
        dealerName: key,
        dealerId: item.dealerId || '',
        dealerShortName: item.dealerShortName || '',
        lines: [],
        subtotal: 0
      }
      order.push(key)
    }
    const group = map[key]
    const total = isFinite(Number(item.totalPrice)) ? Number(item.totalPrice) : lineTotal(item.quantity, item.unitPrice)
    group.subtotal = roundMoney(group.subtotal + total)
    group.lines.push(item)
  })
  return order.map((key) => {
    const group = map[key]
    return {
      dealerName: group.dealerName,
      dealerId: group.dealerId,
      dealerShortName: group.dealerShortName,
      count: group.lines.length,
      subtotal: group.subtotal,
      subtotalText: formatMoney(group.subtotal),
      lines: group.lines
    }
  })
}

function haystack(app, dealers) {
  const parts = [
    app.serialNo,
    app.applicantName,
    app.department,
    app.reason,
    app.fundNote,
    app.usage,
    app.sourceLabel
  ]
  ;(app.items || []).forEach((item) => {
    const dealer = (dealers || []).find((row) => row.id === item.dealerId)
    parts.push(item.productName, item.spec, item.manufacturer, item.dealerName, item.dealerShortName, item.phone)
    if (dealer) parts.push(dealer.name, dealer.shortName, (dealer.aliases || []).join(' '), dealer.note || '')
  })
  return parts.join(' ').toLowerCase()
}

function filterApplications(apps, query, dealers) {
  const criteria = query || {}
  let list = (apps || []).slice()
  if (criteria.applicantId) list = list.filter((app) => app.applicantId === criteria.applicantId)
  if (criteria.status) list = list.filter((app) => app.status === criteria.status)
  if (criteria.dealerId) {
    list = list.filter((app) => (app.items || []).some((item) => item.dealerId === criteria.dealerId))
  }
  const keyword = trim(criteria.keyword).toLowerCase()
  if (keyword) list = list.filter((app) => haystack(app, dealers).indexOf(keyword) >= 0)
  list.sort((left, right) => {
    if (left.applyDate === right.applyDate) return left.serialNo < right.serialNo ? 1 : -1
    return left.applyDate < right.applyDate ? 1 : -1
  })
  return list
}

function countByStatus(apps) {
  const counts = { draft: 0, pending: 0, approved: 0, rejected: 0, total: (apps || []).length }
  ;(apps || []).forEach((app) => {
    if (counts[app.status] != null) counts[app.status] += 1
  })
  return counts
}

function sumEstimated(apps) {
  return roundMoney((apps || []).reduce((sum, app) => sum + Number(app.estimatedTotal || 0), 0))
}

function dealerChips(apps, dealers, selectedId) {
  return (dealers || []).map((dealer) => {
    const count = (apps || []).filter((app) => (app.items || []).some((item) => item.dealerId === dealer.id)).length
    return {
      id: dealer.id,
      shortName: dealer.shortName,
      name: dealer.name,
      count: count
    }
  }).filter((chip) => chip.count > 0 || chip.id === selectedId)
}

function filterDealers(dealers, keyword) {
  const needle = trim(keyword).toLowerCase()
  const list = (dealers || []).slice()
  if (!needle) return list
  return list.filter((dealer) => {
    const blob = [dealer.name, dealer.shortName, (dealer.aliases || []).join(' '), dealer.note || ''].join(' ').toLowerCase()
    return blob.indexOf(needle) >= 0
  })
}

function filterCatalog(catalog, dealers, keyword, dealerId) {
  const needle = trim(keyword).toLowerCase()
  return (catalog || []).filter((item) => {
    if (dealerId && item.dealerId !== dealerId) return false
    if (!needle) return true
    const dealer = (dealers || []).find((row) => row.id === item.dealerId)
    const blob = [
      item.productName,
      item.spec,
      item.manufacturer,
      item.dealerName,
      item.dealerShortName,
      dealer ? dealer.aliases.join(' ') : '',
      dealer ? dealer.note : ''
    ].join(' ').toLowerCase()
    return blob.indexOf(needle) >= 0
  })
}

function presentCard(app) {
  const groups = groupItems(app.items || [])
  const tags = []
  const seen = {}
  const names = []
  groups.forEach((group) => {
    const label = group.dealerShortName || group.dealerName
    if (!seen[label]) {
      seen[label] = true
      tags.push({ label: label, name: group.dealerName })
    }
    if (names.indexOf(group.dealerName) < 0) names.push(group.dealerName)
  })
  const summary = names.join('、')
  const meta = STATUS_META[app.status] || STATUS_META.draft
  const invoice = app.invoice || { note: '', files: [] }
  return {
    id: app.id,
    serialNo: app.serialNo,
    status: app.status,
    statusText: meta.text,
    statusClass: meta.cls,
    dateText: formatDateCN(app.applyDate),
    applicantName: app.applicantName,
    department: app.department,
    reasonBrief: brief(app.reason, 48),
    fundNote: app.fundNote || '',
    dealerTags: tags,
    dealerSummary: summary.length > 52 ? summary.slice(0, 52) + '…' : summary,
    itemCount: (app.items || []).length,
    amountText: formatMoney(app.estimatedTotal),
    hasInvoice: !!(trim(invoice.note) || (invoice.files || []).length)
  }
}

function paperFlow(app) {
  let mentorHint = '尚未提交'
  if (app.status === 'pending') mentorHint = '待导师审批'
  if (app.status === 'approved') mentorHint = '已通过'
  if (app.status === 'rejected') mentorHint = '已驳回'
  if (app.decision && app.decision.comment) mentorHint += '：' + app.decision.comment
  const head = [{
    step: '导师',
    place: '本小程序',
    hint: mentorHint,
    done: app.status === 'approved'
  }]
  return head.concat(PAPER_STEPS.map((step) => Object.assign({ done: false }, step)))
}

function presentApplication(app) {
  const groups = groupItems(app.items || []).map((group) => {
    return Object.assign({}, group, {
      lines: group.lines.map((item) => ({
        id: item.id,
        sheetNo: item.sheetNo,
        productName: item.productName,
        spec: item.spec,
        usage: item.usage,
        quantityText: formatQuantity(item.quantity),
        unitPriceText: formatMoney(item.unitPrice),
        totalPriceText: formatMoney(item.totalPrice),
        manufacturer: item.manufacturer,
        dealerName: item.dealerName,
        dealerShortName: item.dealerShortName,
        phoneText: item.phone || '—'
      }))
    })
  })
  const meta = STATUS_META[app.status] || STATUS_META.draft
  const invoice = app.invoice || { note: '', files: [] }
  const files = (invoice.files || []).map((file) => ({
    name: file.name,
    size: file.size,
    sizeText: file.sizeText || formatSize(file.size),
    addedAt: file.addedAt || ''
  }))
  let invoiceEmptyText = '尚未登记发票。'
  if (app.status === 'draft') invoiceEmptyText = '草稿提交后可以补录发票号码或附件说明。'
  if (app.status === 'pending') invoiceEmptyText = '尚未登记。申请人提交后即可补录发票。'
  if (app.status === 'rejected') invoiceEmptyText = '申请已驳回。修改并重新提交后再登记发票。'
  if (app.status === 'approved') invoiceEmptyText = '导师已通过。请申请人补录发票号码或上传说明。'
  return {
    id: app.id,
    serialNo: app.serialNo,
    hospitalName: app.hospitalName,
    formTitle: app.formTitle,
    department: app.department,
    applicantName: app.applicantName,
    applicantId: app.applicantId,
    dateText: formatDateCN(app.applyDate),
    applyDate: app.applyDate,
    usage: app.usage,
    reason: app.reason,
    fundNote: app.fundNote,
    printedEstimate: app.printedEstimate || '',
    amountText: formatMoney(app.estimatedTotal),
    estimatedTotal: app.estimatedTotal,
    status: app.status,
    statusText: meta.text,
    statusClass: meta.cls,
    sourceLabel: app.sourceLabel || '',
    itemCount: (app.items || []).length,
    groups: groups,
    invoiceNote: invoice.note || '',
    invoiceFiles: files,
    hasInvoice: !!(trim(invoice.note) || files.length),
    invoiceEmptyText: invoiceEmptyText,
    decision: app.decision || null,
    decisionText: app.decision ? (app.decision.result === 'approved' ? '通过' : '驳回') : '',
    updatedAt: app.updatedAt || '',
    submittedAt: app.submittedAt || '',
    paperFlow: paperFlow(app)
  }
}

function presentDealerGroups(apps, dealers) {
  const order = (dealers || []).map((dealer) => dealer.id)
  const buckets = {}
  ;(apps || []).forEach((app) => {
    ;(app.items || []).forEach((item) => {
      const id = item.dealerId || ('name:' + item.dealerName)
      if (!buckets[id]) {
        buckets[id] = {
          dealerId: item.dealerId || id,
          names: [],
          dealerShortName: item.dealerShortName || '',
          lines: [],
          subtotal: 0,
          appIds: {}
        }
      }
      const bucket = buckets[id]
      if (bucket.names.indexOf(item.dealerName) < 0) bucket.names.push(item.dealerName)
      bucket.subtotal = roundMoney(bucket.subtotal + Number(item.totalPrice || 0))
      bucket.appIds[app.id] = true
      bucket.lines.push({
        key: app.id + ':' + item.id,
        appId: app.id,
        serialNo: app.serialNo,
        dateText: formatDateCN(app.applyDate),
        applicantName: app.applicantName,
        productName: item.productName,
        spec: item.spec,
        manufacturer: item.manufacturer,
        usage: item.usage,
        quantityText: formatQuantity(item.quantity),
        unitPriceText: formatMoney(item.unitPrice),
        totalPriceText: formatMoney(item.totalPrice),
        dealerName: item.dealerName,
        phoneText: item.phone || '—',
        sheetNo: item.sheetNo
      })
    })
  })
  return Object.keys(buckets).sort((left, right) => {
    const leftIndex = order.indexOf(buckets[left].dealerId)
    const rightIndex = order.indexOf(buckets[right].dealerId)
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
  }).map((id) => {
    const bucket = buckets[id]
    return {
      dealerId: bucket.dealerId,
      dealerName: bucket.names.join(' / '),
      dealerShortName: bucket.dealerShortName,
      count: bucket.lines.length,
      appCount: Object.keys(bucket.appIds).length,
      subtotalText: formatMoney(bucket.subtotal),
      lines: bucket.lines,
      open: true
    }
  })
}

module.exports = {
  STATUS_META,
  STATUS_OPTIONS,
  lineTotal,
  normalizeItem,
  normalizeForm,
  validateApplication,
  hasDraftContent,
  matchDealerInput,
  attachDealers,
  markDraft,
  markSubmitted,
  groupItems,
  filterApplications,
  countByStatus,
  sumEstimated,
  dealerChips,
  filterDealers,
  filterCatalog,
  presentCard,
  presentApplication,
  presentDealerGroups
}
