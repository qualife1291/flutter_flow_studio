# Nielsen review

Date: 2026-10-23 (Asia/Ho_Chi_Minh). Final production build reviewed against the real example graph from source `300427c`.

Reviewed views: [Developer](logs/review-dev.png), [BA](logs/review-ba.png), [Tester](logs/review-tester.png), [Low-Code](logs/review-lowcode.png). Keyboard, inspector, export, error recovery and accessibility checks: [browser results](logs/playwright.json). Connected runtime evidence: [live CLI smoke](logs/live-studio-smoke.txt).

| # | Heuristic | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Visibility of system status | Đạt | Canvas status bar, runtime device name, Tester separates confirmed from Inferred |
| 2 | Match system / real world | Đạt | BA/Low-Code business labels; annotations supported |
| 3 | User control and freedom | Đạt | Confirmed reset, Escape drawer/modal, clear search; browser tests |
| 4 | Consistency and standards | Đạt | Six semantic node kinds, Lucide icons, persistent Export toolbar button |
| 5 | Error prevention | Đạt | API payload unchecked by default; opt-in requires confirmation |
| 6 | Recognition rather than recall | Đạt | Visible legend and Tested / Untested / Inferred labels |
| 7 | Flexibility and efficiency | Đạt | Search, fit-view and visible Alt+1…4 hints; browser tests |
| 8 | Aesthetic and minimalist | Đạt | Low-Code bridge collapse; sidebar remains separate from canvas |
| 9 | Recover from errors | Đạt | Token error guidance, empty graph guidance, unmatched event notice, invalid snapshot test |
| 10 | Help and documentation | Đạt | Footer links to README and limitations |
