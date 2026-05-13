import { describe, expect, it } from "vitest";
import {
  articleDedupeKey,
  dedupeArticles,
  filterByRecency,
  matchesTopicKeywords,
  normalizeDate,
  parseRss,
  sortByDateDesc,
  type PulseArticle,
} from "../geopolitical-pulse.js";

describe("parseRss (RSS 2.0)", () => {
  it("基本的な <item> を抽出する", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <rss>
        <channel>
          <title>BBC World</title>
          <item>
            <title>Trump arrives in Beijing for talks with Xi</title>
            <link>https://example.com/a</link>
            <pubDate>Wed, 13 May 2026 17:00:12 GMT</pubDate>
            <description>Top story</description>
          </item>
          <item>
            <title>Iran tensions rise</title>
            <link>https://example.com/b</link>
            <pubDate>Wed, 13 May 2026 16:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`;
    const articles = parseRss(xml, "BBC World");
    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe("Trump arrives in Beijing for talks with Xi");
    expect(articles[0].url).toBe("https://example.com/a");
    expect(articles[0].publishedAt).toBe("2026-05-13T17:00:12.000Z");
    expect(articles[0].source).toBe("BBC World");
    expect(articles[0].description).toBe("Top story");
    expect(articles[1].description).toBeUndefined();
  });

  it("CDATA を剥がす", () => {
    const xml = `<rss><channel><item>
      <title><![CDATA[Title with <strong>HTML</strong>]]></title>
      <link>https://example.com/c</link>
      <pubDate>Wed, 13 May 2026 12:00:00 GMT</pubDate>
    </item></channel></rss>`;
    const articles = parseRss(xml, "test");
    expect(articles[0].title).toBe("Title with HTML");
  });

  it("HTML エンティティをデコードする", () => {
    const xml = `<rss><channel><item>
      <title>Trump &amp; Xi meet</title>
      <link>https://example.com/d</link>
    </item></channel></rss>`;
    const articles = parseRss(xml, "test");
    expect(articles[0].title).toBe("Trump & Xi meet");
  });

  it("Atom <entry> 形式に対応する", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <title>Atom format title</title>
        <link href="https://example.com/atom"/>
        <updated>2026-05-13T10:00:00Z</updated>
      </entry>
    </feed>`;
    const articles = parseRss(xml, "test");
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Atom format title");
    expect(articles[0].url).toBe("https://example.com/atom");
    expect(articles[0].publishedAt).toBe("2026-05-13T10:00:00.000Z");
  });

  it("title または link 欠落の item は除外する", () => {
    const xml = `<rss><channel>
      <item><title>No link</title></item>
      <item><link>https://x.com</link></item>
      <item><title>Both</title><link>https://y.com</link></item>
    </channel></rss>`;
    const articles = parseRss(xml, "test");
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe("Both");
  });

  it("description は 300 文字でトランケートする", () => {
    const longDesc = "x".repeat(500);
    const xml = `<rss><channel><item>
      <title>T</title><link>https://x.com</link>
      <description>${longDesc}</description>
    </item></channel></rss>`;
    const articles = parseRss(xml, "test");
    expect(articles[0].description?.length).toBe(300);
  });
});

describe("normalizeDate", () => {
  it("RFC 2822 形式を ISO 8601 に変換", () => {
    expect(normalizeDate("Wed, 13 May 2026 17:00:12 GMT")).toBe(
      "2026-05-13T17:00:12.000Z",
    );
  });

  it("ISO 8601 を解釈する", () => {
    expect(normalizeDate("2026-05-13T17:00:12Z")).toBe("2026-05-13T17:00:12.000Z");
  });

  it("オフセット付き ISO も処理する", () => {
    expect(normalizeDate("2026-05-13T17:00:12+09:00")).toBe(
      "2026-05-13T08:00:12.000Z",
    );
  });

  it("不正な文字列は null を返す", () => {
    expect(normalizeDate("not a date")).toBeNull();
    expect(normalizeDate("")).toBeNull();
    expect(normalizeDate(null)).toBeNull();
  });
});

describe("matchesTopicKeywords", () => {
  function mkArticle(title: string, description?: string): PulseArticle {
    return { title, url: "https://x", publishedAt: null, source: "t", description };
  }

  it("us-china: China/Xi/Beijing を含む記事が一致する", () => {
    expect(
      matchesTopicKeywords(
        mkArticle("Trump arrives in Beijing for talks"),
        "us-china",
      ),
    ).toBe(true);
    expect(
      matchesTopicKeywords(
        mkArticle("Xi Jinping meets foreign delegation"),
        "us-china",
      ),
    ).toBe(true);
  });

  it("us-china: 'trump' 単独では一致しない（米国内ニュース誤検出を避ける）", () => {
    expect(
      matchesTopicKeywords(
        mkArticle("Trump taps Venturella to lead ICE"),
        "us-china",
      ),
    ).toBe(false);
  });

  it("japan: 現職の高市総理（takaichi）を含む記事が一致する", () => {
    expect(
      matchesTopicKeywords(mkArticle("Takaichi to visit UK and Italy"), "japan"),
    ).toBe(true);
  });

  it("japan: 過去の前任 (ishiba / kishida) も拾える", () => {
    expect(matchesTopicKeywords(mkArticle("Ishiba LDP review"), "japan")).toBe(true);
    expect(matchesTopicKeywords(mkArticle("Kishida memoir"), "japan")).toBe(true);
  });

  it("middle-east: Iran/Israel/Gaza が一致する", () => {
    expect(matchesTopicKeywords(mkArticle("Iran tensions rise"), "middle-east")).toBe(
      true,
    );
    expect(matchesTopicKeywords(mkArticle("Israel-Gaza ceasefire"), "middle-east")).toBe(
      true,
    );
  });

  it("ukraine: Ukraine/Russia/Kyiv が一致する", () => {
    expect(matchesTopicKeywords(mkArticle("Ukraine war update"), "ukraine")).toBe(
      true,
    );
    expect(matchesTopicKeywords(mkArticle("Russia demands Kyiv withdrawal"), "ukraine")).toBe(
      true,
    );
  });

  it("global: 全て一致する（フィルタなし）", () => {
    expect(matchesTopicKeywords(mkArticle("Random news"), "global")).toBe(true);
  });

  it("description にもキーワードを探す", () => {
    expect(
      matchesTopicKeywords(mkArticle("Vague title", "Iran sanctions imposed"), "middle-east"),
    ).toBe(true);
  });

  it("大文字小文字を区別しない", () => {
    expect(matchesTopicKeywords(mkArticle("IRAN STRIKES"), "middle-east")).toBe(true);
    expect(matchesTopicKeywords(mkArticle("UKRAINE"), "ukraine")).toBe(true);
  });
});

describe("articleDedupeKey", () => {
  function mkArticle(title: string): PulseArticle {
    return { title, url: "x", publishedAt: null, source: "t" };
  }

  it("記号と大文字小文字を正規化する", () => {
    const k1 = articleDedupeKey(mkArticle("Trump, Xi Meet in Beijing"));
    const k2 = articleDedupeKey(mkArticle("Trump Xi meet in Beijing!"));
    expect(k1).toBe(k2);
  });

  it("先頭 60 文字に制限する", () => {
    const long = "a".repeat(100);
    expect(articleDedupeKey(mkArticle(long)).length).toBe(60);
  });

  it("非ラテン文字（日本語）も保持する", () => {
    const k = articleDedupeKey(mkArticle("トランプ氏 北京到着"));
    expect(k).toContain("トランプ");
  });
});

describe("dedupeArticles", () => {
  function mk(title: string, source = "s1"): PulseArticle {
    return { title, url: "x", publishedAt: null, source };
  }

  it("同一タイトルは先勝ちで 1 件のみ残す", () => {
    const r = dedupeArticles([
      mk("Trump Xi meet in Beijing", "BBC"),
      mk("Trump, Xi meet in Beijing!", "Google"),
      mk("Different news"),
    ]);
    expect(r).toHaveLength(2);
    expect(r[0].source).toBe("BBC");
  });

  it("空配列は空を返す", () => {
    expect(dedupeArticles([])).toEqual([]);
  });
});

describe("filterByRecency", () => {
  const now = new Date("2026-05-14T00:00:00Z");

  function mk(publishedAt: string | null): PulseArticle {
    return { title: "x", url: "y", publishedAt, source: "s" };
  }

  it("hoursBack 内の記事を残す", () => {
    const r = filterByRecency(
      [mk("2026-05-13T20:00:00Z"), mk("2026-05-12T00:00:00Z")],
      12,
      now,
    );
    expect(r).toHaveLength(1);
    expect(r[0].publishedAt).toBe("2026-05-13T20:00:00Z");
  });

  it("publishedAt が null の記事は通す", () => {
    const r = filterByRecency([mk(null)], 6, now);
    expect(r).toHaveLength(1);
  });

  it("ちょうど境界の記事は残す", () => {
    const r = filterByRecency([mk("2026-05-13T12:00:00Z")], 12, now);
    expect(r).toHaveLength(1);
  });
});

describe("sortByDateDesc", () => {
  function mk(publishedAt: string | null, title = "x"): PulseArticle {
    return { title, url: "y", publishedAt, source: "s" };
  }

  it("新しい順にソートする", () => {
    const r = sortByDateDesc([
      mk("2026-05-13T10:00:00Z", "old"),
      mk("2026-05-13T20:00:00Z", "new"),
      mk("2026-05-13T15:00:00Z", "mid"),
    ]);
    expect(r.map((a) => a.title)).toEqual(["new", "mid", "old"]);
  });

  it("publishedAt が null の記事は末尾に来る", () => {
    const r = sortByDateDesc([
      mk(null, "nulldate"),
      mk("2026-05-13T15:00:00Z", "mid"),
    ]);
    expect(r.map((a) => a.title)).toEqual(["mid", "nulldate"]);
  });

  it("入力配列を破壊しない", () => {
    const input = [mk("2026-05-13T10:00:00Z", "a"), mk("2026-05-13T20:00:00Z", "b")];
    const before = input.map((a) => a.title);
    sortByDateDesc(input);
    expect(input.map((a) => a.title)).toEqual(before);
  });
});
