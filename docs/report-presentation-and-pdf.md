# Report presentation and PDF delivery

All four dashboards share the blue company palette, a consistent navigation shell, KPI cards, chart containers, year selectors and a collapsible filter toolbar. The toolbar always shows the current selection and keeps Run report available when filters are collapsed. Labels, keyboard controls and layouts support Arabic and English.

Arabic fonts are served locally. PDF generation is loaded on demand, captures the dashboard in the browser, and downloads a file directly. Every PDF page has the company logo/name, report title, period and a numbered Codit footer. Dashboard images preserve Arabic shaping, colours and chart labels. The export uses a snapshot taken before asynchronous rendering, so switching reports cannot mix one report's numbers with another title.

The export builds a separate layout without navigation or filters. It expands scrollable lists, includes all month columns and splits long charts/tables into groups of at most 12 months. Larger blocks break near row/section boundaries. Export progress, duplicate-click protection and retryable errors are shown in the page. The executive report retains its five-section portrait format; other reports use landscape pages.

Financial dashboards use **net profit = accounting income - expenses**, and **net margin = net profit / positive accounting income**. A margin is not displayed without a positive denominator. The customer dashboard continues to label DSR earnings as service income before expenses. Changing customer/centre filters clears previously loaded figures and disables export until the matching report is loaded.

Validation: 63 tests passed, including financial reconciliation and download error/retry protection. Browser checks passed for all dashboards, comparison views, Arabic/English, mobile widths of 360/390 pixels, direct downloads, filter changes and an 18-month export. All 18 columns were present in the separate export layout, grouped as 12 and 6 months.

An authenticated live TRAACS check on 29 October 2026 separately verified 1 January-30 September 2026 across all five centre IDs. Sales, centre and executive dashboards agreed: service sales SAR 11,462,547.88; accounting income SAR 10,779,039.52; expenses SAR 8,839,059.34; net profit SAR 1,939,980.18; accounting net margin 18.0%. A PDF was downloaded successfully using those live figures. These expense/profit figures reflect the current TRAACS responses, rather than the older reference PDF.
