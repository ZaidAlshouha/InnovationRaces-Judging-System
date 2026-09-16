import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

interface Row {
  name: string;
  score: number;
}

const columns = [
  { header: "الاسم", accessor: (r: Row) => r.name },
  { header: "الدرجة", accessor: (r: Row) => r.score },
];

describe("toCsv", () => {
  it("builds a header row followed by one line per record", () => {
    const csv = toCsv(columns, [
      { name: "أحمد", score: 9.5 },
      { name: "مها", score: 8 },
    ]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines).toEqual(["الاسم,الدرجة", "أحمد,9.5", "مها,8"]);
  });

  it("quotes fields containing commas, quotes, or newlines", () => {
    const csv = toCsv(columns, [{ name: 'فريق "ألفا", الأول\nملاحظة', score: 1 }]);
    const lines = csv.replace(/^﻿/, "").split("\r\n");
    expect(lines[1]).toBe('"فريق ""ألفا"", الأول\nملاحظة",1');
  });

  it("renders null/undefined accessor results as an empty field", () => {
    const csv = toCsv(
      [{ header: "قيمة", accessor: () => null }],
      [{ name: "x", score: 1 }]
    );
    expect(csv.replace(/^﻿/, "")).toBe("قيمة\r\n");
  });

  it("returns only the header row for an empty dataset", () => {
    const csv = toCsv(columns, []);
    expect(csv.replace(/^﻿/, "")).toBe("الاسم,الدرجة");
  });
});
