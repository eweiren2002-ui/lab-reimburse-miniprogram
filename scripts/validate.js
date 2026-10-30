const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const root = path.join(__dirname, '..')
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log('ok  ' + message)
    return
  }
  failed += 1
  console.error('FAIL ' + message)
}

function near(left, right) {
  return Math.abs(Number(left) - Number(right)) < 0.02
}

function checkWxml(file) {
  let text = fs.readFileSync(file, 'utf8')
  text = text.replace(/<!--[\s\S]*?-->/g, '')
  text = text.replace(/\{\{[\s\S]*?\}\}/g, '""')
  const tags = text.match(/<\/?[A-Za-z][^>]*>/g) || []
  const stack = []
  tags.forEach((tag) => {
    if (tag.indexOf('</') === 0) {
      const name = tag.slice(2).replace(/[^A-Za-z0-9_-].*$/, '')
      const open = stack.pop()
      if (open !== name) {
        throw new Error(path.relative(root, file) + ' 标签不匹配: ' + tag + '，栈顶 ' + open)
      }
      return
    }
    if (/\/>\s*$/.test(tag)) return
    const name = tag.slice(1).replace(/[^A-Za-z0-9_-].*$/, '')
    stack.push(name)
  })
  if (stack.length) {
    throw new Error(path.relative(root, file) + ' 未闭合: ' + stack.join(', '))
  }
}

function walk(dir, suffix, found) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach((entry) => {
    if (entry.name === 'node_modules' || entry.name === '.git') return
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, suffix, found)
    else if (entry.name.endsWith(suffix)) found.push(full)
  })
  return found
}

function installWx() {
  const memory = {}
  global.wx = {
    getStorageSync(key) {
      if (!Object.prototype.hasOwnProperty.call(memory, key)) return ''
      return JSON.parse(JSON.stringify(memory[key]))
    },
    setStorageSync(key, value) {
      memory[key] = JSON.parse(JSON.stringify(value))
    }
  }
}

async function expectFail(fn, fragment) {
  try {
    await fn()
  } catch (error) {
    assert(error.message.indexOf(fragment) >= 0, '应拒绝并包含「' + fragment + '」，实际: ' + error.message)
    return
  }
  assert(false, '应当失败: ' + fragment)
}

async function main() {
  const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
  app.pages.forEach((page) => {
    ;['.js', '.json', '.wxml', '.wxss'].forEach((ext) => {
      assert(fs.existsSync(path.join(root, page + ext)), '页面文件 ' + page + ext)
    })
  })
  ;['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'project.config.json', 'config.js', 'README.md'].forEach((file) => {
    assert(fs.existsSync(path.join(root, file)), '根文件 ' + file)
  })

  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'))
  assert(project.appid === 'touristappid', 'AppID 使用游客占位 touristappid')
  assert(project.compileType === 'miniprogram', 'compileType 为 miniprogram')

  walk(root, '.js', []).forEach((file) => {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  })
  console.log('ok  全部 JS 语法检查')

  walk(root, '.wxml', []).forEach((file) => {
    checkWxml(file)
    console.log('ok  WXML ' + path.relative(root, file))
  })

  const seed = require(path.join(root, 'data/seed.js'))
  const domain = require(path.join(root, 'domain/applications.js'))
  const format = require(path.join(root, 'domain/format.js'))
  assert(seed.hospital.name === '丽水市第二人民医院', '医院名称')
  assert(seed.applications.length === 2, '两张演示申请')
  const sept = seed.applications.find((item) => item.applyDate === '2026-09-11')
  const oct = seed.applications.find((item) => item.applyDate === '2026-10-09')
  assert(sept && sept.items.length === 17 && near(sept.estimatedTotal, 37723), '9月批次 17 行，合计 37723')
  assert(oct && oct.items.length === 41 && near(oct.estimatedTotal, 31674.76), '10月批次 41 行，合计 31674.76')
  assert(sept.applicantName === '俞坤强' && oct.applicantName === '俞坤强', '申请人俞坤强')
  assert(sept.department === '中心实验室', '申请科室中心实验室')
  assert(sept.status === 'approved' && oct.status === 'pending', '9月已通过、10月待审批')
  assert(format.formatMoney(sept.estimatedTotal) === '37,723.00', '金额格式 37,723.00')
  assert(format.formatMoney(oct.estimatedTotal) === '31,674.76', '金额格式 31,674.76')

  const shorts = {}
  seed.dealers.forEach((dealer) => {
    shorts[dealer.shortName] = true
  })
  ;['美谷', '晋山', '维通利华', '和元', '森贝伽', '德思特'].forEach((name) => {
    assert(shorts[name], '经销商目录包含 ' + name)
  })
  assert(seed.dealers.some((dealer) => (dealer.aliases || []).indexOf('生航') >= 0), '森贝伽可按生航检索')
  assert(seed.dealers.some((dealer) => (dealer.aliases || []).indexOf('乐美天') >= 0), '德思特关联乐美天')

  seed.applications.forEach((app) => {
    let sum = 0
    app.items.forEach((item) => {
      assert(item.productName && item.spec && item.manufacturer && item.dealerName && item.dealerId, app.serialNo + ' 明细字段完整 ' + item.sheetNo)
      assert(Object.prototype.hasOwnProperty.call(item, 'phone'), '联系电话字段存在')
      assert(near(item.totalPrice, Number(item.quantity) * Number(item.unitPrice)), '总价等于单价乘数量 ' + item.productName)
      sum += Number(item.totalPrice)
    })
    assert(near(sum, app.estimatedTotal), app.serialNo + ' 表头金额等于明细合计')
  })

  const desite = sept.items.find((item) => item.productName === '甘草素')
  assert(desite && desite.manufacturer === '乐美天' && desite.dealerShortName === '德思特', '甘草素：乐美天生产、德思特供货')
  const virus = sept.items.find((item) => item.productName.indexOf('过表达病毒') >= 0)
  assert(virus && virus.dealerShortName === '和元', '和元供货 hes1 病毒')
  assert(oct.items.some((item) => item.productName.indexOf('BEAS-2B') >= 0), '10月批次含 BEAS-2B')
  assert(oct.reason.indexOf('全国重点实验室') >= 0, '10月经费说明')

  const septView = domain.presentApplication(sept)
  assert(septView.groups.map((group) => group.dealerShortName).join(',') === '维通利华,美谷,森贝伽,德思特,晋山,和元', '9月明细按供货单位出现顺序分组')
  assert(septView.groups[1].lines[0].dealerName === '浙江美谷生物科技有限公司', '明细保留表内供货单位全称')

  const invalid = domain.validateApplication(domain.normalizeForm({
    department: '中心实验室',
    applicantName: '俞坤强',
    applyDate: '2026-10-29',
    reason: '测试',
    items: [{ productName: 'A', spec: '盒', quantity: 1, unitPrice: 2, manufacturer: '甲', dealerName: '' }]
  }, { user: seed.users[0], applications: [], hospital: seed.hospital, now: '2026-10-29 09:00' }))
  assert(invalid.some((item) => item.indexOf('经销商') >= 0), '缺少经销商时校验失败')

  installWx()
  const api = require(path.join(root, 'services/api.js'))
  await api.ensureReady()
  const home = await api.home()
  assert(home.user.name === '俞坤强' && home.counts.pending === 1 && home.counts.approved === 1, '申请人首页计数')

  const pending = await api.queryApplications({ status: 'pending', applicantId: home.user.id })
  assert(pending.cards.length === 1 && pending.cards[0].serialNo === 'CG-20261009-001', '待审批只有 10 月单')
  assert(pending.cards[0].dealerTags.map((tag) => tag.label).join(',') === '美谷,晋山', '10月单经销商标签')

  const byShenghang = await api.queryApplications({ keyword: '生航', applicantId: home.user.id })
  assert(byShenghang.cards.some((card) => card.serialNo === 'CG-20260911-001'), '搜索生航命中森贝伽单据')
  const byLemaitian = await api.queryApplications({ keyword: '乐美天' })
  assert(byLemaitian.cards.some((card) => card.serialNo === 'CG-20260911-001'), '搜索乐美天命中德思特单据')
  const byMeigu = await api.queryApplications({ dealerId: 'dealer-meigu' })
  assert(byMeigu.cards.length === 2, '美谷筛选包含两张申请')
  const merged = byMeigu.dealerGroups.find((group) => group.dealerShortName === '美谷')
  assert(merged && merged.dealerName.indexOf('浙江美谷生物科技有限公司') >= 0 && merged.dealerName.indexOf('美谷生物科技有限公司') >= 0, '美谷分组同时保留两种表内写法')

  await expectFail(() => api.decide('CG-20261009-001', { result: 'approved', comment: '越权' }), '请切换到导师')
  await api.setRole('mentor')
  await expectFail(() => api.decide('CG-20261009-001', { result: 'rejected', comment: '' }), '驳回时请填写')
  const mentorHome = await api.home()
  assert(mentorHome.user.role === 'mentor' && mentorHome.counts.total === 2, '导师看到全部申请')

  const form = {
    department: '中心实验室',
    applicantName: '俞坤强',
    applyDate: '2026-10-29',
    usage: '科研需要',
    reason: '演示新建：补充耗材。',
    fundNote: '科室临时经费',
    items: [
      { productName: '示例试剂 A', spec: '盒', usage: '科研需要', quantity: 2, unitPrice: 3.5, manufacturer: '甲厂', dealerName: '美谷', phone: '' },
      { productName: '示例试剂 B', spec: '支', usage: '科研需要', quantity: 1, unitPrice: 10, manufacturer: '乐美天', dealerName: '杭州示例生物科技有限公司', phone: '0571-00000000' },
      { productName: '示例试剂 C', spec: '支', usage: '科研需要', quantity: 1, unitPrice: 4, manufacturer: '乙厂', dealerName: '杭州示例生物科技有限公司', phone: '' }
    ]
  }
  await expectFail(() => api.submitForm(form), '请切换到学生/申请人')
  await api.setRole('applicant')
  let created = await api.submitForm(form)
  assert(created.status === 'pending' && near(created.estimatedTotal, 21), '新建三行申请合计 21 元并提交')
  assert(created.items[0].dealerId === 'dealer-meigu', '简称美谷解析到美谷经销商')
  assert(created.items[0].dealerName === '浙江美谷生物科技有限公司', '简称写入规范全称')
  assert(created.items[1].dealerId === created.items[2].dealerId, '同一新经销商两行共用一个 id')
  assert(created.items[1].dealerName === '杭州示例生物科技有限公司', '手工经销商保留全称')

  const detail = await api.getPresentedApplication(created.id)
  assert(detail.app.groups.length === 2, '新申请按两个经销商分组')

  await api.withdraw(created.id)
  const withdrawn = await api.getPresentedApplication(created.id)
  assert(withdrawn.app.status === 'draft', '申请人可撤回待审批')

  created = await api.submitForm(Object.assign({}, form, { id: created.id, serialNo: created.serialNo }))
  await api.setRole('mentor')
  await api.decide(created.id, { result: 'rejected', comment: '请补充经费文号' })
  await api.setRole('applicant')
  const rejected = await api.getPresentedApplication(created.id)
  assert(rejected.app.status === 'rejected' && rejected.app.decision.comment.indexOf('经费文号') >= 0, '导师驳回意见可查看')
  created = await api.submitForm(Object.assign({}, form, { id: created.id, serialNo: created.serialNo }))
  assert(created.status === 'pending' && created.decision === null, '驳回后重提清空旧意见')

  await api.saveInvoice(created.id, { note: '发票号 12345678', files: [{ name: '发票.pdf', size: 2048 }] })
  const invoiced = await api.getPresentedApplication(created.id)
  assert(invoiced.app.hasInvoice && invoiced.app.invoiceNote.indexOf('12345678') >= 0, '提交后可登记发票')

  await api.setRole('mentor')
  const approved = await api.decide('CG-20261009-001', { result: 'approved', comment: '同意按明细采购。' })
  assert(approved.status === 'approved', '导师通过 10 月申请')
  await expectFail(() => api.decide('CG-20261009-001', { result: 'rejected', comment: '再改' }), '只有待审批')

  await api.setRole('applicant')
  await api.resetDemo()
  const restored = await api.home()
  assert(restored.counts.total === 2 && restored.counts.pending === 1 && restored.counts.approved === 1, '恢复演示数据')
  const dealers = await api.listDealers()
  assert(!dealers.some((dealer) => dealer.name === '杭州示例生物科技有限公司'), '恢复后去掉手工经销商')

  if (failed) {
    console.error(failed + ' 项失败')
    process.exit(1)
  }
  console.log('全部校验通过')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
