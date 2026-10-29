#!/usr/bin/env python3
"""Rebuild data/seed.js from the two hospital approval workbooks.

Usage:
  python3 scripts/build_seed.py batch1.xls batch2.xls
"""

from __future__ import annotations

import json
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import xlrd


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "seed.js"

HOSPITAL = {
    "name": "丽水市第二人民医院",
    "department": "中心实验室",
    "formTitle": "临时采购医用耗材购置申请表",
}

DEALERS = [
    {
        "id": "dealer-meigu",
        "name": "浙江美谷生物科技有限公司",
        "shortName": "美谷",
        "aliases": ["浙江美谷生物科技有限公司", "美谷生物科技有限公司", "美谷"],
        "phone": "",
        "contactName": "",
        "note": "两批审批表均有供货。10月批次封面写为「美谷生物科技有限公司」，明细保留原表写法。",
    },
    {
        "id": "dealer-jinshan",
        "name": "温州晋山生物科技公司",
        "shortName": "晋山",
        "aliases": ["温州晋山生物科技公司", "晋山生物科技有限公司", "晋山"],
        "phone": "",
        "contactName": "",
        "note": "9月批次写「温州晋山生物科技公司」，10月批次写「晋山生物科技有限公司」。",
    },
    {
        "id": "dealer-vtlh",
        "name": "浙江维通利华实验动物技术有限公司",
        "shortName": "维通利华",
        "aliases": ["浙江维通利华实验动物技术有限公司", "维通利华"],
        "phone": "",
        "contactName": "",
        "note": "",
    },
    {
        "id": "dealer-heyuan",
        "name": "上海和元生物技术有限公司",
        "shortName": "和元",
        "aliases": ["上海和元生物技术有限公司", "和元", "和元生物"],
        "phone": "",
        "contactName": "",
        "note": "9月批次原单元格有前导空格，已去掉。",
    },
    {
        "id": "dealer-senbeijia",
        "name": "南京森贝伽生物科技有限公司",
        "shortName": "森贝伽",
        "aliases": ["南京森贝伽生物科技有限公司", "森贝伽", "生航"],
        "phone": "",
        "contactName": "",
        "note": "审批表供货单位为南京森贝伽生物科技有限公司（生产单位 Bio-Channel）。检索「生航」时归入本供货单位。",
    },
    {
        "id": "dealer-desite",
        "name": "成都德思特生物技术有限公司",
        "shortName": "德思特",
        "aliases": ["成都德思特生物技术有限公司", "德思特", "乐美天"],
        "phone": "",
        "contactName": "",
        "note": "乐美天是生产单位，德思特是供货单位/经销商。",
    },
]

USERS = [
    {
        "id": "user-yu",
        "name": "俞坤强",
        "role": "applicant",
        "roleLabel": "学生/申请人",
        "department": "中心实验室",
        "title": "申请人",
        "openid": "",
    },
    {
        "id": "user-mentor",
        "name": "导师（演示）",
        "role": "mentor",
        "roleLabel": "导师",
        "department": "中心实验室",
        "title": "导师",
        "openid": "",
    },
]


def money(value):
    dec = Decimal(str(value)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if dec == dec.to_integral():
        return int(dec)
    return float(dec)


def text(value):
    return str(value).replace("\r", "").strip()


def match_dealer(raw):
    name = text(raw)
    for dealer in DEALERS:
        names = [dealer["name"]] + dealer["aliases"]
        if name in names:
            return dealer
    raise SystemExit("未识别的供货单位: " + name)


def sheet_by_name(book, name):
    for sheet in book.sheets():
        if sheet.name == name:
            return sheet
    raise SystemExit("缺少工作表: " + name)


def header_map(sheet):
    headers = {}
    for col in range(sheet.ncols):
        key = text(sheet.cell_value(1, col))
        if key:
            headers[key] = col
    return headers


def cell(sheet, row, headers, key, default=""):
    if key not in headers:
        return default
    return sheet.cell_value(row, headers[key])


def parse_cover(sheet):
    banner = text(sheet.cell_value(1, 0))
    dept = re.search(r"申请科室[:：]\s*(\S+)", banner)
    person = re.search(r"申请人[:：]\s*(\S+)", banner)
    date = re.search(r"申请时间[:：]\s*(\d{4})\s*年\s*(\d{1,2})月\s*(\d{1,2})日", banner)
    if not (dept and person and date):
        raise SystemExit("无法解析封面抬头: " + banner)
    reason = ""
    usage = ""
    for row in range(sheet.nrows):
        label = text(sheet.cell_value(row, 0))
        if label == "用途":
            usage = text(sheet.cell_value(row, 1))
        if label.startswith("申请理由"):
            reason = text(sheet.cell_value(row, 1))
    if not reason:
        raise SystemExit("缺少申请理由")
    iso = "%s-%02d-%02d" % (int(date.group(1)), int(date.group(2)), int(date.group(3)))
    estimate = ""
    found = re.search(r"约\s*[0-9.]+\s*万元", reason)
    if found:
        estimate = found.group(0).replace(" ", "")
    if "医坛新秀" in reason:
        fund = "浙江省医坛新秀培养经费"
    elif "全国重点实验室" in reason:
        fund = "2026年全国重点实验室项目"
    else:
        fund = ""
    return {
        "department": dept.group(1),
        "applicantName": person.group(1),
        "applyDate": iso,
        "usage": usage or "科研需要",
        "reason": reason,
        "fundNote": fund,
        "printedEstimate": estimate,
    }


def parse_lines(sheet, serial):
    headers = header_map(sheet)
    required = ["产品名称", "规格型号", "用途", "采购量", "科室建议购入价", "总价（元）", "生产单位", "供货单位"]
    for key in required:
        if key not in headers:
            raise SystemExit("明细缺少列: " + key)
    items = []
    for row in range(2, sheet.nrows):
        name = text(cell(sheet, row, headers, "产品名称"))
        if not name or "合计" in name:
            break
        dealer_raw = text(cell(sheet, row, headers, "供货单位"))
        dealer = match_dealer(dealer_raw)
        quantity = money(cell(sheet, row, headers, "采购量"))
        unit_price = money(cell(sheet, row, headers, "科室建议购入价"))
        total_price = money(cell(sheet, row, headers, "总价（元）"))
        expected = money(Decimal(str(quantity)) * Decimal(str(unit_price)))
        if Decimal(str(expected)) != Decimal(str(total_price)):
            raise SystemExit(
                "总价与单价×数量不一致: %s %s*%s=%s 表内 %s" % (name, quantity, unit_price, expected, total_price)
            )
        items.append(
            {
                "id": "%s-%02d" % (serial, len(items) + 1),
                "sheetNo": len(items) + 1,
                "productName": name,
                "spec": text(cell(sheet, row, headers, "规格型号")),
                "usage": text(cell(sheet, row, headers, "用途")) or "科研需要",
                "quantity": quantity,
                "unitPrice": unit_price,
                "totalPrice": total_price,
                "manufacturer": text(cell(sheet, row, headers, "生产单位")),
                "dealerId": dealer["id"],
                "dealerName": dealer_raw,
                "dealerShortName": dealer["shortName"],
                "phone": text(cell(sheet, row, headers, "联系电话")),
            }
        )
    if not items:
        raise SystemExit("没有解析到明细")
    return items


def sum_total(items):
    total = Decimal("0")
    for item in items:
        total += Decimal(str(item["totalPrice"]))
    return money(total)


def build_application(path, source_name):
    book = xlrd.open_workbook(path)
    cover = parse_cover(sheet_by_name(book, "临时采购"))
    serial = "CG-%s-001" % cover["applyDate"].replace("-", "")
    items = parse_lines(sheet_by_name(book, "Sheet1"), serial)
    total = sum_total(items)
    approved = cover["applyDate"] == "2026-09-11"
    application = {
        "id": serial,
        "serialNo": serial,
        "hospitalName": HOSPITAL["name"],
        "formTitle": HOSPITAL["formTitle"],
        "department": cover["department"],
        "applicantId": "user-yu",
        "applicantName": cover["applicantName"],
        "applyDate": cover["applyDate"],
        "usage": cover["usage"],
        "reason": cover["reason"],
        "fundNote": cover["fundNote"],
        "printedEstimate": cover["printedEstimate"],
        "estimatedTotal": total,
        "status": "approved" if approved else "pending",
        "items": items,
        "invoice": {"note": "", "files": []},
        "decision": None,
        "sourceLabel": "临时采购审批表 · %s" % source_name,
        "createdAt": cover["applyDate"] + " 09:00",
        "updatedAt": cover["applyDate"] + " 09:00",
        "submittedAt": cover["applyDate"] + " 09:00",
    }
    if approved:
        application["decision"] = {
            "result": "approved",
            "comment": "演示预置：同意按采购明细执行，经费从浙江省医坛新秀培养经费列支。纸质表签名栏原为空白。",
            "reviewerId": "user-mentor",
            "reviewerName": "导师（演示）",
            "reviewerRole": "mentor",
            "time": "2026-09-12 10:30",
        }
        application["updatedAt"] = "2026-09-12 10:30"
    return application


def main():
    if len(sys.argv) != 3:
        raise SystemExit("用法: python3 scripts/build_seed.py <batch1.xls> <batch2.xls>")
    applications = [
        build_application(sys.argv[1], "2026年9月11日"),
        build_application(sys.argv[2], "2026年10月9日"),
    ]
    catalog = []
    for app in applications:
        for item in app["items"]:
            catalog.append(
                {
                    "id": "cat-" + item["id"],
                    "productName": item["productName"],
                    "spec": item["spec"],
                    "usage": item["usage"],
                    "quantity": item["quantity"],
                    "unitPrice": item["unitPrice"],
                    "manufacturer": item["manufacturer"],
                    "dealerId": item["dealerId"],
                    "dealerName": item["dealerName"],
                    "dealerShortName": item["dealerShortName"],
                    "phone": item["phone"],
                    "sourceSerial": app["serialNo"],
                }
            )
    payload = {
        "hospital": HOSPITAL,
        "users": USERS,
        "dealers": DEALERS,
        "catalog": catalog,
        "applications": applications,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    header = """/* eslint-disable */
// Generated by scripts/build_seed.py from the two temporary-purchase workbooks.
// Do not hand-edit item rows. Re-run the script when the source sheets change.
"""
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(header + "module.exports = " + body + "\n", encoding="utf-8")
    for app in applications:
        print(app["serialNo"], app["status"], len(app["items"]), app["estimatedTotal"], app["fundNote"])


if __name__ == "__main__":
    main()
