// PFEI スケジュールデータ。
// scripts/update-pfei-schedule.mjs により自動生成 (手動編集禁止)。
// 再生成: `npm run build && node scripts/update-pfei-schedule.mjs`

import type { PfeiSchedule } from "./pfei-parser.js";

export const PFEI_SCHEDULES: ReadonlyArray<PfeiSchedule> = [
  {
    "year": 2026,
    "source": "PFEI Schedule of Release Dates for Principal Federal Economic Indicators",
    "sourceUrl": "https://www.whitehouse.gov/wp-content/uploads/2025/09/pfei_schedule_release_dates_cy2026.pdf",
    "parsedAt": "2026-05-16T04:25:09.632Z",
    "indicators": [
      {
        "key": "employment",
        "name": "米 雇用統計 (Employment Situation)",
        "agency": "BLS",
        "timeEt": "08:30",
        "dataDescription": "Data are for previous month",
        "releases": [
          {
            "month": 1,
            "day": 9
          },
          {
            "month": 2,
            "day": 6
          },
          {
            "month": 3,
            "day": 6
          },
          {
            "month": 4,
            "day": 3
          },
          {
            "month": 5,
            "day": 8
          },
          {
            "month": 6,
            "day": 5
          },
          {
            "month": 7,
            "day": 2
          },
          {
            "month": 8,
            "day": 7
          },
          {
            "month": 9,
            "day": 4
          },
          {
            "month": 10,
            "day": 2
          },
          {
            "month": 11,
            "day": 6
          },
          {
            "month": 12,
            "day": 4
          }
        ]
      },
      {
        "key": "ppi",
        "name": "米 PPI (Producer Price Indexes)",
        "agency": "BLS",
        "timeEt": "08:30",
        "dataDescription": "Data are for previous month",
        "releases": [
          {
            "month": 1,
            "day": 14
          },
          {
            "month": 2,
            "day": 12
          },
          {
            "month": 3,
            "day": 12
          },
          {
            "month": 4,
            "day": 14
          },
          {
            "month": 5,
            "day": 13
          },
          {
            "month": 6,
            "day": 11
          },
          {
            "month": 7,
            "day": 15
          },
          {
            "month": 8,
            "day": 13
          },
          {
            "month": 9,
            "day": 10
          },
          {
            "month": 10,
            "day": 15
          },
          {
            "month": 11,
            "day": 13
          },
          {
            "month": 12,
            "day": 15
          }
        ]
      },
      {
        "key": "cpi",
        "name": "米 CPI (Consumer Price Index)",
        "agency": "BLS",
        "timeEt": "08:30",
        "dataDescription": "Data are for previous month",
        "releases": [
          {
            "month": 1,
            "day": 13
          },
          {
            "month": 2,
            "day": 11
          },
          {
            "month": 3,
            "day": 11
          },
          {
            "month": 4,
            "day": 10
          },
          {
            "month": 5,
            "day": 12
          },
          {
            "month": 6,
            "day": 10
          },
          {
            "month": 7,
            "day": 14
          },
          {
            "month": 8,
            "day": 12
          },
          {
            "month": 9,
            "day": 11
          },
          {
            "month": 10,
            "day": 14
          },
          {
            "month": 11,
            "day": 10
          },
          {
            "month": 12,
            "day": 10
          }
        ]
      }
    ]
  }
];
