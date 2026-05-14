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
