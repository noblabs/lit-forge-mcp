// economic-release-pulse の純粋関数テスト。
// ネットワーク fetch は CI で不安定なため、パーサと JST ヘルパのみ対象。

import { describe, it, expect } from "vitest";
import {
  parseCaoDate,
  parseCaoTime,
  parseCaoGdpTable,
} from "../economic-release-pulse/adapters/cao.js";
import { parseEmpireStateTable } from "../economic-release-pulse/adapters/nyfed.js";
import { parseG17Releases } from "../economic-release-pulse/adapters/frb.js";
import { computeJoblessClaimsReleases } from "../economic-release-pulse/adapters/dol-eta.js";
import {
  ffTitleToName,
  parseFfClock,
  ffEventToRelease,
  selectFaireconomyEvents,
} from "../economic-release-pulse/adapters/faireconomy.js";
import { parseCensusAdvanceTable } from "../economic-release-pulse/adapters/census.js";
import {
  jstParts,
  jstToday,
  jstDatePlus,
  isUsEasternDst,
  etToJst,
} from "../economic-release-pulse/util.js";

describe("parseCaoDate", () => {
  it("和暦括弧・曜日付きの内閣府形式をパースする", () => {
    expect(parseCaoDate("2026（令和8）年5月19日（火）")).toBe("2026-05-19");
    expect(parseCaoDate("2027（令和9）年2月15日（月）")).toBe("2027-02-15");
  });
  it("和暦括弧なしでもパースする", () => {
    expect(parseCaoDate("2026年5月1日")).toBe("2026-05-01");
  });
  it("precise でない日付は null", () => {
    expect(parseCaoDate("未定")).toBeNull();
    expect(parseCaoDate("2026（令和8）年12月中旬以降")).toBeNull();
    expect(parseCaoDate("")).toBeNull();
  });
});

describe("parseCaoTime", () => {
  it("「8時50分」形式をパースする", () => {
    expect(parseCaoTime("8時50分")).toBe("08:50");
    expect(parseCaoTime("10時00分")).toBe("10:00");
  });
  it("「-」など時刻でないものは null", () => {
    expect(parseCaoTime("-")).toBeNull();
    expect(parseCaoTime("")).toBeNull();
  });
});

describe("parseCaoGdpTable", () => {
  // 内閣府 公表予定ページの実構造を模した fixture。
  const FIXTURE = `
<h2><span id="a">四半期別GDP速報</span></h2>
<table class="tableBase w_100">
<thead><tr><th scope="col">期間</th><th scope="col">公表予定日</th><th scope="col">公表時刻</th></tr></thead>
<tbody>
<tr>
<td class="txtCenter">2026年1-3月期（1次速報）</td>
<td>2026（令和8）年5月19日（火）</td>
<td class="txtCenter">8時50分</td>
</tr>
<tr>
<td class="txtCenter">2026年4-6月期（1次速報）</td>
<td>2026（令和8）年8月17日（月）</td>
<td class="txtCenter">8時50分</td>
</tr>
</tbody>
</table>
<h2><span id="b">国民経済計算年次推計</span></h2>
<table class="tableBase w_100">
<tbody>
<tr><td class="txtCenter">2025年度</td><td>2026（令和8）年12月中旬以降</td><td class="txtCenter">-</td></tr>
</tbody>
</table>`;

  it("GDP 速報テーブルの行を ReleaseEvent に変換する", () => {
    const events = parseCaoGdpTable(FIXTURE);
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({
      date: "2026-05-19",
      time: "08:50",
      country: "JP",
      name: "日 GDP速報 2026年1-3月期（1次速報）",
      source: "内閣府",
      sourceUrl: "https://www.esri.cao.go.jp/jp/sna/kouhyou/kouhyou_top.html",
    });
    expect(events[1].date).toBe("2026-08-17");
  });

  it("四半期別GDP速報の最初のテーブルのみ対象（年次推計テーブルは含めない）", () => {
    const events = parseCaoGdpTable(FIXTURE);
    // 年次推計の「12月中旬以降」行は別テーブルなので拾わない
    expect(events.every((e) => e.name.includes("速報"))).toBe(true);
    expect(events.some((e) => e.date.startsWith("2026-12"))).toBe(false);
  });

  it("該当テーブルが無ければ空配列", () => {
    expect(parseCaoGdpTable("<html><body>no table</body></html>")).toEqual([]);
  });
});

describe("jstParts / jstToday / jstDatePlus", () => {
  it("UTC タイムスタンプを JST の日付・時刻に変換する", () => {
    // 12:30 UTC = 21:30 JST 同日
    expect(jstParts(Date.parse("2026-05-28T12:30:00+00:00"))).toEqual({
      date: "2026-05-28",
      time: "21:30",
    });
  });
  it("日付境界を跨ぐ変換（UTC 夜 → JST 翌朝）", () => {
    // 20:00 UTC 5/14 = 05:00 JST 5/15
    expect(jstParts(Date.parse("2026-05-14T20:00:00+00:00"))).toEqual({
      date: "2026-05-15",
      time: "05:00",
    });
  });
  it("jstToday は JST の当日を返す", () => {
    // 2026-05-15 00:00 JST = 2026-05-14 15:00 UTC
    expect(jstToday(new Date("2026-05-14T15:00:00Z"))).toBe("2026-05-15");
  });
  it("jstDatePlus は JST で N 日後を返す", () => {
    expect(jstDatePlus(6, new Date("2026-05-14T15:00:00Z"))).toBe("2026-05-21");
    expect(jstDatePlus(0, new Date("2026-05-14T15:00:00Z"))).toBe("2026-05-15");
  });
});

describe("isUsEasternDst / etToJst", () => {
  it("夏（DST 期間）と冬（標準時）を判定する", () => {
    expect(isUsEasternDst("2026-05-15")).toBe(true);
    expect(isUsEasternDst("2026-07-04")).toBe(true);
    expect(isUsEasternDst("2026-01-15")).toBe(false);
    expect(isUsEasternDst("2026-12-25")).toBe(false);
  });
  it("ET 午前を JST 夜（同日）に変換する — DST 期間は +13h", () => {
    expect(etToJst("2026-05-15", "08:30")).toEqual({
      date: "2026-05-15",
      time: "21:30",
    });
    expect(etToJst("2026-05-15", "09:15")).toEqual({
      date: "2026-05-15",
      time: "22:15",
    });
  });
  it("ET 午前を JST 夜（同日）に変換する — 標準時は +14h", () => {
    expect(etToJst("2026-01-15", "08:30")).toEqual({
      date: "2026-01-15",
      time: "22:30",
    });
    expect(etToJst("2026-01-15", "09:15")).toEqual({
      date: "2026-01-15",
      time: "23:15",
    });
  });
});

describe("parseEmpireStateTable", () => {
  // NY 連銀 overview ページの greyborder テーブル実構造を模した fixture。
  const FIXTURE = `
<table width="100%" class="greyborder" border="0">
<tbody>
<tr class="tdtblhdr">
<td class="tdhdrcol" style="width: 105px;"><div>JAN</div></td>
<td class="tdhdrcolR" style="width: 105px;"><div>FEB </div></td>
</tr>
<tr valign="top">
<td class="dirCol" style="width: 105px; height: 50px;"><div>15<a href="/medialibrary/media/survey/empire/empire2026/esms_2026_01.pdf?sc_lang=en">&nbsp;report</a></div></td>
<td class="dirCol" style="width: 105px; height: 50px;"><div>17<a href="/medialibrary/media/survey/empire/empire2026/esms_2026_02.pdf">&nbsp;report</a></div></td>
</tr>
<tr class="tdtblhdr">
<td class="tdhdrcol" style="width: 105px;"><div>MAY</div></td>
</tr>
<tr valign="top">
<td class="dirCol" style="width: 105px; height: 50px;"><div>15<a href="/medialibrary/media/survey/empire/empire2026/esms_2026_05.pdf">&nbsp;report</a></div></td>
</tr>
</tbody>
</table>`;

  it("月名ヘッダと日付セルを zip して ReleaseEvent に変換する", () => {
    const events = parseEmpireStateTable(FIXTURE);
    expect(events).toHaveLength(3);
    // JAN 15（標準時）→ 22:30 JST 同日
    expect(events[0]).toEqual({
      date: "2026-01-15",
      time: "22:30",
      country: "US",
      name: "米 NY 連銀製造業景気指数",
      source: "NY 連銀",
      sourceUrl:
        "https://www.newyorkfed.org/survey/empire/empiresurvey_overview.html",
    });
    expect(events[1].date).toBe("2026-02-17");
    // MAY 15（DST 期間）→ 21:30 JST 同日
    expect(events[2]).toMatchObject({ date: "2026-05-15", time: "21:30" });
  });

  it("greyborder テーブルが無ければ空配列", () => {
    expect(parseEmpireStateTable("<html>no table</html>")).toEqual([]);
  });
});

describe("parseG17Releases", () => {
  // FRB G.17 default ページの 2026 リリース節を模した fixture。
  // 「May 15」と「,」の間に <a>(most recent monthly)</a> が挟まるケースを含む。
  const FIXTURE = `
<h5>The monthly G.17 release will be released at 9:15 a.m. on these dates:</h5>
<p><strong>2026:</strong>
January&nbsp;16,
February&nbsp;18,
May&nbsp;15 <a href="Current/default.htm">(most recent monthly)</a>,
and December&nbsp;16.
</p>`;

  it("年ブロックから月名+日を全抽出して ReleaseEvent に変換する", () => {
    const events = parseG17Releases(FIXTURE);
    expect(events).toHaveLength(4);
    // January 16（標準時）→ 23:15 JST 同日
    expect(events[0]).toEqual({
      date: "2026-01-16",
      time: "23:15",
      country: "US",
      name: "米 鉱工業生産",
      source: "FRB",
      sourceUrl: "https://www.federalreserve.gov/releases/g17/default.htm",
    });
    // <a> が挟まる May 15（DST 期間）も拾える → 22:15 JST 同日
    expect(events[2]).toMatchObject({ date: "2026-05-15", time: "22:15" });
    expect(events[3].date).toBe("2026-12-16");
  });

  it("該当する年ブロックが無ければ空配列", () => {
    expect(parseG17Releases("<p>no schedule here</p>")).toEqual([]);
  });
});

describe("computeJoblessClaimsReleases", () => {
  it("通常週は木曜 08:30 ET を JST に変換して返す（DST 期間 → 21:30 同日）", () => {
    // 2026-05-21 は木曜（Memorial Day 前週で祝日補正なし）。
    const events = computeJoblessClaimsReleases("2026-05-18", "2026-05-24");
    expect(events).toEqual([
      {
        date: "2026-05-21",
        time: "21:30",
        country: "US",
        name: "米 新規失業保険申請件数",
        source: "DOL/ETA",
        sourceUrl: "https://www.dol.gov/ui/data.pdf",
      },
    ]);
  });

  it("標準時（冬）は +14h で 22:30 JST 同日になる", () => {
    // 2026-01-08 は木曜（標準時期間）。
    const events = computeJoblessClaimsReleases("2026-01-05", "2026-01-11");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2026-01-08", time: "22:30" });
  });

  it("月内の全木曜を返す", () => {
    // 2026-05 の木曜: 7 / 14 / 21 / 28。
    const events = computeJoblessClaimsReleases("2026-05-01", "2026-05-31");
    expect(events.map((e) => e.date)).toEqual([
      "2026-05-07",
      "2026-05-14",
      "2026-05-21",
      "2026-05-28",
    ]);
  });

  it("感謝祭週は祝日オーバーライドで前日水曜に前倒しされる", () => {
    // 2026-11-26（木・感謝祭）→ 2026-11-25（水）。標準時のため 22:30 JST。
    const events = computeJoblessClaimsReleases("2026-11-23", "2026-11-29");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ date: "2026-11-25", time: "22:30" });
  });
});

describe("parseFfClock", () => {
  it("am/pm を 24 時間表記に変換する", () => {
    expect(parseFfClock("2:00pm")).toEqual({ h: 14, m: 0 });
    expect(parseFfClock("10:30am")).toEqual({ h: 10, m: 30 });
    expect(parseFfClock("12:00am")).toEqual({ h: 0, m: 0 });
    expect(parseFfClock("12:00pm")).toEqual({ h: 12, m: 0 });
  });
  it("時刻でない値（All Day/Tentative/空）は null", () => {
    expect(parseFfClock("All Day")).toBeNull();
    expect(parseFfClock("Tentative")).toBeNull();
    expect(parseFfClock("")).toBeNull();
  });
});

describe("ffTitleToName", () => {
  it("対象の米指標タイトルだけを日本語名に変換する（完全一致）", () => {
    expect(ffTitleToName("JOLTS Job Openings")).toBe("米 JOLTS（求人件数）");
    expect(ffTitleToName("ISM Manufacturing PMI")).toBe("米 ISM製造業景況指数");
    expect(ffTitleToName("ISM Services PMI")).toBe("米 ISM非製造業景況指数");
    expect(ffTitleToName("Flash Services PMI")).toBe("米 サービス業PMI（速報）");
    expect(ffTitleToName("CB Consumer Confidence")).toBe("米 消費者信頼感指数（CB）");
    expect(ffTitleToName("ADP Non-Farm Employment Change")).toBe(
      "米 ADP雇用統計（民間部門）",
    );
  });
  it("PFEI/DOL 等が既出の指標や紛らわしい部分一致は対象外（null）", () => {
    // PFEI が出す → 重複防止のため対象外
    expect(ffTitleToName("Non-Farm Employment Change")).toBeNull();
    expect(ffTitleToName("CPI m/m")).toBeNull();
    // DOL/ETA が出す → 対象外
    expect(ffTitleToName("Unemployment Claims")).toBeNull();
    // 部分一致の誤爆防止（"ISM Manufacturing Prices" は PMI ではない）
    expect(ffTitleToName("ISM Manufacturing Prices")).toBeNull();
    expect(ffTitleToName("Final Manufacturing PMI")).toBeNull();
  });
});

describe("ffEventToRelease", () => {
  it("GMT 時刻を JST に変換する（夏時間: 06-02 2:00pm GMT = 10:00 EDT → 23:00 JST 同日）", () => {
    const r = ffEventToRelease({
      title: "JOLTS Job Openings",
      country: "USD",
      date: "06-02-2026",
      time: "2:00pm",
      impact: "Medium",
      url: "https://www.forexfactory.com/calendar/578-us-jolts-job-openings",
    });
    expect(r).toEqual({
      date: "2026-06-02",
      time: "23:00",
      country: "US",
      name: "米 JOLTS（求人件数）",
      source: "ForexFactory",
      sourceUrl: "https://www.forexfactory.com/calendar/578-us-jolts-job-openings",
    });
  });

  it("標準時の発表は日跨ぎを正しく処理する（12-01 3:00pm GMT = 10:00 EST → 00:00 JST 翌日）", () => {
    const r = ffEventToRelease({
      title: "ISM Manufacturing PMI",
      country: "USD",
      date: "12-01-2026",
      time: "3:00pm",
      impact: "High",
    });
    expect(r).toMatchObject({
      date: "2026-12-02",
      time: "00:00",
      country: "US",
      name: "米 ISM製造業景況指数",
      source: "ForexFactory",
    });
  });

  it("対象外 / USD でない / 時刻不明は除外（null）", () => {
    // マップ外（PFEI が出す）
    expect(
      ffEventToRelease({ title: "Non-Farm Employment Change", country: "USD", date: "06-05-2026", time: "1:30pm", impact: "High" }),
    ).toBeNull();
    // USD でない（EU の ISM 相当は無いが、country で弾く確認）
    expect(
      ffEventToRelease({ title: "Flash Services PMI", country: "EUR", date: "06-23-2026", time: "9:00am", impact: "High" }),
    ).toBeNull();
    // 時刻不明
    expect(
      ffEventToRelease({ title: "JOLTS Job Openings", country: "USD", date: "06-02-2026", time: "All Day", impact: "Medium" }),
    ).toBeNull();
  });

  it("selectFaireconomyEvents は混在フィードから対象指標だけを抽出する", () => {
    const events = [
      { title: "Unemployment Claims", country: "USD", date: "06-04-2026", time: "12:30pm", impact: "Medium" }, // DOL 担当→対象外
      { title: "JOLTS Job Openings", country: "USD", date: "06-02-2026", time: "2:00pm", impact: "Medium" },
      { title: "ISM Services PMI", country: "USD", date: "06-03-2026", time: "3:00pm", impact: "High" },
      { title: "FOMC Member Logan Speaks", country: "USD", date: "06-02-2026", time: "5:00pm", impact: "Low" }, // 発言→対象外
      { title: "German Final Services PMI", country: "EUR", date: "06-03-2026", time: "8:55am", impact: "Medium" }, // 非USD→対象外
    ];
    const out = selectFaireconomyEvents(events);
    expect(out.map((e) => e.name).sort()).toEqual([
      "米 ISM非製造業景況指数",
      "米 JOLTS（求人件数）",
    ]);
  });
});

describe("parseCensusAdvanceTable", () => {
  // 公式 List View HTML の実構造を模した fixture。
  // 対象行（Advance Economic Indicators Report）+ 紛らわしい非対象行を 2 つ混ぜ、
  // パーサが Advance 行だけを拾うことを検証する。
  const FIXTURE = `
    <table class="sortable">
    <tr height="20">
      <td height="20"><a href="/manufacturing/m3/">Advance Report on Durable Goods--Manufacturers' Shipments, Inventories, and Orders</a></td>
      <td sorttable_customkey="202605260830">May 26, 2026</td><td>8:30 AM</td><td>April 2026</td>
    </tr>
    <tr height="20">
      <td height="20"><a href="/econ/indicators/">Advance Economic Indicators Report (International Trade, Retail, &amp; Wholesale)</a></td>
      <td sorttable_customkey="202605290830">May 29, 2026</td><td>8:30 AM</td><td>April 2026</td>
    </tr>
    <tr height="20">
      <td height="20"><a href="/wholesale/">Wholesale Trade: Sales and Inventories</a></td>
      <td sorttable_customkey="202606091000">June 9, 2026</td><td>10:00 AM</td><td>April 2026</td>
    </tr>
    <tr height="20">
      <td height="20"><a href="/econ/indicators/">Advance Economic Indicators Report (International Trade, Retail, &amp; Wholesale)</a></td>
      <td sorttable_customkey="202606260830">June 26, 2026</td><td>8:30 AM</td><td>May 2026</td>
    </tr>
    </table>`;

  it("Advance 行だけを 3 速報（卸売在庫・小売在庫・財貿易収支）に展開する（08:30 ET → 21:30 JST 同日, DST 期間）", () => {
    const events = parseCensusAdvanceTable(FIXTURE);
    // 対象 2 行 × 3 系列 = 6 件。耐久財速報・確報卸売は拾わない。
    expect(events).toHaveLength(6);

    const may29 = events.filter((e) => e.date === "2026-05-29");
    expect(may29).toHaveLength(3);
    expect(may29.map((e) => e.name).sort()).toEqual([
      "米 卸売在庫（速報）",
      "米 小売在庫（速報）",
      "米 貿易収支（財・速報）",
    ]);
    for (const e of may29) {
      expect(e).toMatchObject({
        date: "2026-05-29",
        time: "21:30",
        country: "US",
        source: "U.S. Census Bureau（Advance Economic Indicators Report）",
        sourceUrl:
          "https://www.census.gov/economic-indicators/calendar-listview.html",
      });
    }
  });

  it("翌月（6/26）も同様に拾う＝ライブ HTML 由来で未来も自動対応", () => {
    const jun26 = parseCensusAdvanceTable(FIXTURE).filter(
      (e) => e.date === "2026-06-26",
    );
    expect(jun26).toHaveLength(3);
    expect(jun26.every((e) => e.time === "21:30")).toBe(true);
  });

  it("該当行が無ければ空配列（紛らわしい行だけの HTML）", () => {
    const noAdvance = `<tr><td><a href="/x">Wholesale Trade: Sales and Inventories</a></td><td sorttable_customkey="202606091000">June 9, 2026</td></tr>`;
    expect(parseCensusAdvanceTable(noAdvance)).toEqual([]);
  });
});
