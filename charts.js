/* ==========================================================================
   data_bulletin/charts.js
   ==========================================================================
   Draws everything on the 2026 Data Bulletin dashboard page. Read top to bottom.

   WHAT HAPPENS WHEN THE PAGE LOADS
     1. Load data/data.json (the numbers, built by update_data_here/build_data.py).
     2. Fill in the numbers written inside sentences (the <span data-fill> tags in index.html).
     3. Draw the four headline tiles.
     4. Wire the chapter tabs: show the chapter named in the web address (#chapter-2, #map),
        or chapter 1; draw a chapter's charts the first time it is opened.
     5. (Layer 2) the sticky-scroll stories, (Layer 3) the community map: added later,
        in their own parts of this file.

   Nothing here defines a color; every color is read from styles.css (WCA.colors, WCA.db).

   PART ONE  ·  helpers, all on one object called WCA  (the youth_justice template, unchanged,
                plus the design kit's WCA.db colors and four Chart.js add-ons)
     WCA.colors        the brand colors, read from styles.css
     WCA.db            the Data Bulletin's colors (families, race groups, teal, callout...), read from styles.css
     WCA.fmt           number formatting: 6395 -> "6,395", 13.9 -> "13.9%"
     WCA.get           read a value out of data.json by a dotted path
     WCA.fillNumbers   fill the <span data-fill> tags in the page text
     WCA.tooltip       the hover box: show(html, x, y) and hide()
     WCA.legend        write an HTML legend for a chart
     WCA.applyChartDefaults   the look every Chart.js chart shares
     WCA.plugins       small Chart.js add-ons: valueLabels, pointNotes (template);
                       benchmark, endLabels, pointValues, gapCallouts (design kit)

   PART TWO  ·  this page
     0. Settings
     1. Start-up
     2. Headline tiles
     3. Chapter tabs
     4. Chapter charts: one function per Bulletin page (chapter 1 is in; 2 to 4 to come)
     5. Small helpers: tools the charts share, and three more Chart.js add-ons
        (barNotes, seriesNamesInBars, hoverLine)
   ========================================================================== */


/* ##########################################################################
   PART ONE  ·  HELPERS
   ########################################################################## */

const WCA = {};


/* --------------------------------------------------------------------------
   COLORS  ·  read from the CSS variables in styles.css
   --------------------------------------------------------------------------
   Keeping the values in CSS means styles.css is the only place a color
   is defined. WCA.colors.blue is the same value as var(--wca-blue). */

WCA.cssVar = function (name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
};

WCA.colors = {
  blue:      WCA.cssVar("--wca-blue"),
  green:     WCA.cssVar("--wca-green"),
  blue100:   WCA.cssVar("--wca-blue-100"),
  blue200:   WCA.cssVar("--wca-blue-200"),
  blue300:   WCA.cssVar("--wca-blue-300"),
  blue500:   WCA.cssVar("--wca-blue-500"),
  blue700:   WCA.cssVar("--wca-blue-700"),
  orange:    WCA.cssVar("--wca-orange"),
  orange100: WCA.cssVar("--wca-orange-100"),
  ink:       WCA.cssVar("--ink"),
  body:      WCA.cssVar("--body"),
  fine:      WCA.cssVar("--fine"),
  muted:     WCA.cssVar("--muted"),
  rule:      WCA.cssVar("--rule"),
  panel:     WCA.cssVar("--panel"),
  noData:    WCA.cssVar("--map-no-data"),
};

WCA.font = WCA.cssVar("--font");

/* The blue ramp for maps: 5 steps, light to dark. One hue, so darker always means more. */
WCA.blueRamp = [WCA.colors.blue100, WCA.colors.blue200, WCA.colors.blue300, WCA.colors.blue500, WCA.colors.blue700];


/* --------------------------------------------------------------------------
   DATA BULLETIN COLORS  ·  the design kit's tokens/bulletin-colors.js
   --------------------------------------------------------------------------
   Same idea as above: no color is typed here. Every value is read from the
   --db-* names in styles.css (part A2), so styles.css stays the only place a
   color is defined.

   Use in a chart:
     backgroundColor: WCA.db.family.mother.steps   // [light, mid, full] for 2014, 2019, 2024
     backgroundColor: WCA.db.race.order.map(function (k) { return WCA.db.race[k].full; }) */

WCA.db = (function () {
  var v = WCA.cssVar;
  function hue(name, withMid) {
    var full = v("--db-" + name), light = v("--db-" + name + "-light");
    var mid = withMid ? v("--db-" + name + "-mid") : null;
    return {
      full: full, light: light, mid: mid,
      bg: v("--db-" + name + "-bg") || null,
      /* earlier years lighter, latest year full: 2 steps or 3 steps */
      steps: withMid ? [light, mid, full] : [light, full],
    };
  }
  return {
    title: v("--db-title"),
    titleRule: v("--db-title-rule"),
    panel: v("--db-panel"),
    highlight: v("--db-highlight"),
    highlightStrong: v("--db-highlight-strong"),
    remainder: v("--db-remainder"),
    gapBand: v("--db-gap-band"),
    callout: v("--db-callout"),
    calloutText: v("--db-callout-text"),
    teal: hue("teal", true),
    tealText: v("--db-teal-text"),
    econ: { secure: v("--db-econ-secure"), disadvantaged: v("--db-teal") },
    map: { base: v("--db-map-base"), highlight: v("--db-map-highlight"), state: v("--db-map-state") },
    tiles: { steel: v("--db-tile-steel"), plum: v("--db-tile-plum"), brown: v("--db-tile-brown") },

    /* Family types. Always draw in this order (green in the middle). */
    family: {
      order: ["married", "father", "mother"],
      labels: { married: "Married couple", father: "Single father", mother: "Single mother" },
      married: hue("married", true),
      father: hue("father", true),
      mother: hue("mother", true),
    },

    /* Race / ethnicity. Same color for a group on every chart. */
    race: {
      order: ["asian", "black", "hispanic", "multiracial", "white"],
      labels: { asian: "Asian", black: "Black", hispanic: "Hispanic or Latino",
                multiracial: "Multiracial", white: "White", all: "All" },
      asian: hue("asian"), black: hue("black"), hispanic: hue("hispanic"),
      multiracial: hue("multiracial"), white: hue("white"), all: hue("all"),
    },
  };
})();


/* --------------------------------------------------------------------------
   NUMBER FORMATTING
   -------------------------------------------------------------------------- */

WCA.fmt = {
  /* 6395 -> "6,395" */
  count: function (n) {
    if (n === null || n === undefined) return "n/a";
    return Number(n).toLocaleString("en-US");
  },

  /* 13.9 -> "13.9%". Shares in data.json are already rounded to one decimal. */
  pct: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    return Number(n).toFixed(decimals) + "%";
  },

  /* 10.1 -> "+10.1%", -4.9 -> "−4.9%" (a real minus sign) */
  change: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    var sign = n > 0 ? "+" : (n < 0 ? "−" : "");
    return sign + Math.abs(Number(n)).toFixed(decimals) + "%";
  },

  /* 10.1 -> "up 10.1%", -4.9 -> "down 4.9%", 0 -> "unchanged": the direction in words, for headings */
  direction: function (n, decimals) {
    if (n === null || n === undefined) return "n/a";
    if (decimals === undefined) decimals = 1;
    if (n === 0) return "unchanged";
    return (n > 0 ? "up " : "down ") + Math.abs(Number(n)).toFixed(decimals) + "%";
  },

  /* 242313 -> "$242,313"; 1.5 -> "$1.50" when the number has cents */
  dollars: function (n) {
    if (n === null || n === undefined) return "n/a";
    var whole = Number.isInteger(Number(n));
    return "$" + Number(n).toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 });
  },

  /* Pick the right formatter for a unit named in data.json ("count", "%", "change", "$");
     decimals (optional) overrides the one decimal shares and changes get by default */
  byUnit: function (n, unit, decimals) {
    if (unit === "%") return WCA.fmt.pct(n, decimals);
    if (unit === "change") return WCA.fmt.change(n, decimals);
    if (unit === "$") return WCA.fmt.dollars(n);
    return WCA.fmt.count(n);
  },
};


/* --------------------------------------------------------------------------
   READ FROM data.json BY PATH
   --------------------------------------------------------------------------
   WCA.get(data, "charts.by_place.values.0") -> 22.6
   Used to fill numbers written in the page text, so the text can never
   disagree with the data. */

WCA.get = function (object, path) {
  var parts = path.split(".");
  var value = object;
  for (var i = 0; i < parts.length; i++) {
    if (value === null || value === undefined) return undefined;
    value = value[parts[i]];
  }
  return value;
};

/* Fill every element with a data-fill attribute:
     <span data-fill="headlines.0.value" data-format="count"></span>
   data-format is count (default), pct, pct0, change, change0, direction, direction0, dollars, or raw.
   A path that is not in data.json gets a dash and the class "missing" (red dotted underline in
   styles.css), and is listed once in the browser console, so a gap is seen, never "undefined". */
WCA.fillNumbers = function (data) {
  var elements = document.querySelectorAll("[data-fill]");
  var missing = [];
  for (var i = 0; i < elements.length; i++) {
    var el = elements[i];
    var path = el.getAttribute("data-fill");
    var value = WCA.get(data, path);
    var format = el.getAttribute("data-format") || "count";
    if (value === undefined || value === null) {
      el.textContent = "—";
      el.classList.add("missing");
      missing.push(path);
      continue;
    }
    el.classList.remove("missing");
    if (format === "raw") el.textContent = value;
    else if (format === "pct") el.textContent = WCA.fmt.pct(value);
    else if (format === "pct0") el.textContent = WCA.fmt.pct(value, 0);
    else if (format === "change") el.textContent = WCA.fmt.change(value);
    else if (format === "change0") el.textContent = WCA.fmt.change(value, 0);
    else if (format === "direction") el.textContent = WCA.fmt.direction(value, 1);
    else if (format === "direction0") el.textContent = WCA.fmt.direction(value, 0);
    else if (format === "dollars") el.textContent = WCA.fmt.dollars(value);
    else el.textContent = WCA.fmt.count(value);
  }
  if (missing.length) console.warn("data-fill paths not in data.json (" + missing.length + "):", missing);
};


/* --------------------------------------------------------------------------
   TOOLTIP  ·  one hover box for the whole page (used by the map)
   -------------------------------------------------------------------------- */

WCA.tooltip = {
  element: null,

  /* Make the box the first time it's needed */
  init: function () {
    if (WCA.tooltip.element) return;
    var box = document.createElement("div");
    box.className = "tooltip";
    document.body.appendChild(box);
    WCA.tooltip.element = box;
  },

  /* Show html near the mouse position (x, y are page pixels from the event) */
  show: function (html, x, y) {
    WCA.tooltip.init();
    var box = WCA.tooltip.element;
    box.innerHTML = html;
    box.classList.add("show");
    /* Keep the box on screen: flip it to the left near the right edge */
    var pad = 14;
    var left = x + pad;
    if (left + box.offsetWidth > window.innerWidth - 8) left = x - pad - box.offsetWidth;
    var top = y + pad;
    if (top + box.offsetHeight > window.innerHeight - 8) top = y - pad - box.offsetHeight;
    box.style.left = left + "px";
    box.style.top = top + "px";
  },

  hide: function () {
    if (WCA.tooltip.element) WCA.tooltip.element.classList.remove("show");
  },
};


/* --------------------------------------------------------------------------
   HTML LEGEND
   --------------------------------------------------------------------------
   WCA.legend(container, [{label: "Westchester", color: "#098342"}, ...])
   Writes a row of color swatches with labels. Charts with two or more series
   always get one, so a reader never has to guess from color alone. */

WCA.legend = function (container, items) {
  if (typeof container === "string") container = document.querySelector(container);
  var html = "";
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var swatch = item.pattern
      ? '<span class="swatch" style="background:' + item.pattern + '"></span>'
      : '<span class="swatch" style="background:' + item.color + '"></span>';
    html += '<span class="legend-item">' + swatch + item.label + "</span>";
  }
  container.innerHTML = html;
};


/* --------------------------------------------------------------------------
   CHART.JS DEFAULTS  ·  the look every chart shares
   --------------------------------------------------------------------------
   Called once by the dashboard before it draws anything. Thin marks, light
   solid gridlines, WCA font and text colors, tooltips in the house style. */

WCA.applyChartDefaults = function () {
  var d = Chart.defaults;
  d.font.family = WCA.font;
  d.font.size = 13;
  d.color = WCA.colors.body;                 /* axis labels and legend text */
  d.responsive = true;
  d.maintainAspectRatio = false;             /* the .chart-box height decides */
  d.animation = false;                       /* nothing moves; easier to read and to screenshot */

  d.plugins.legend.display = false;          /* legends are written in HTML (WCA.legend) */
  d.plugins.tooltip.backgroundColor = WCA.colors.ink;
  d.plugins.tooltip.titleFont = { family: WCA.font, size: 13, weight: "600" };
  d.plugins.tooltip.bodyFont = { family: WCA.font, size: 13 };
  d.plugins.tooltip.padding = 8;
  d.plugins.tooltip.cornerRadius = 6;
  d.plugins.tooltip.displayColors = false;

  d.scale.grid.color = WCA.colors.panel;     /* faint, solid gridlines */
  d.scale.grid.drawTicks = false;
  d.scale.border.display = false;
  d.scale.ticks.color = WCA.colors.fine;
  d.scale.ticks.padding = 6;

  d.elements.bar.borderRadius = 4;           /* rounded data ends */
  d.elements.bar.borderSkipped = "start";    /* ...but square at the baseline */
  d.elements.line.borderWidth = 2;
  d.elements.line.tension = 0;               /* straight segments between points */
  d.elements.point.radius = 4;
  d.elements.point.hoverRadius = 6;
  d.elements.point.hitRadius = 12;           /* easy to hover without landing dead center */
};


/* --------------------------------------------------------------------------
   SMALL CHART.JS ADD-ONS ("plugins")
   --------------------------------------------------------------------------
   Chart.js lets us draw extra things after it draws the chart. The first two
   are the template's; the next four come from the design kit (the Bulletin's
   callouts, benchmark lines and written-on values). No plugin library is loaded. */

WCA.plugins = {};

/* valueLabels: write each bar's value just past its end.
   Works for vertical and horizontal bars, and for the first segment of a stack.
   Turn on per chart with:
     plugins: { valueLabels: { datasets: [0], format: WCA.fmt.pct } }
   datasets = which series to label (by index); format = how to write the number. */
WCA.plugins.valueLabels = {
  id: "valueLabels",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.datasets) return;
    var ctx = chart.ctx;
    var horizontal = chart.options.indexAxis === "y";
    ctx.save();
    ctx.font = "600 13px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;         /* text wears text color, not the series color */
    options.datasets.forEach(function (datasetIndex) {
      var meta = chart.getDatasetMeta(datasetIndex);
      var values = chart.data.datasets[datasetIndex].data;
      meta.data.forEach(function (bar, i) {
        var value = values[i];
        if (value === null || value === undefined) return;
        var text = options.format ? options.format(value) : String(value);
        if (horizontal) {
          ctx.textAlign = "left"; ctx.textBaseline = "middle";
          ctx.fillText(text, bar.x + 6, bar.y);
        } else {
          ctx.textAlign = "center"; ctx.textBaseline = "bottom";
          ctx.fillText(text, bar.x, bar.y - 4);
        }
      });
    });
    ctx.restore();
  },
};

/* pointNotes: a short note beside chosen points on a line chart, e.g. the
   value at the first and last point, or "COVID-19 low" at 2021.
   Turn on per chart with:
     plugins: { pointNotes: { notes: [ {dataset: 0, index: 2, text: "COVID-19 low", place: "below"} ] } }
   place is "above" (default) or "below". */
WCA.plugins.pointNotes = {
  id: "pointNotes",
  afterDatasetsDraw: function (chart, args, options) {
    if (!options || !options.notes) return;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 12px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;
    ctx.textAlign = "center";
    options.notes.forEach(function (note) {
      var meta = chart.getDatasetMeta(note.dataset || 0);
      var point = meta.data[note.index];
      if (!point) return;
      /* keep the text inside the chart area, left or right */
      var x = Math.min(Math.max(point.x, chart.chartArea.left + 28), chart.chartArea.right - 28);
      if (note.place === "below") { ctx.textBaseline = "top";    ctx.fillText(note.text, x, point.y + 8); }
      else                        { ctx.textBaseline = "bottom"; ctx.fillText(note.text, x, point.y - 8); }
    });
    ctx.restore();
  },
};

/* benchmark: a dashed line with a label, e.g. the 7% federal affordability benchmark (2.4)
   or "All students: 18.2%" (3.17). Turn on per chart with:
     plugins: { benchmark: { value: 18.2, label: "All students: 18.2%", color: WCA.db.callout } }
   On a horizontal bar chart (indexAxis "y") the line is vertical. */
WCA.plugins.benchmark = {
  id: "benchmark",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || o.value === undefined) return;
    var horizontal = chart.options.indexAxis === "y";
    var scale = horizontal ? chart.scales.x : chart.scales.y;
    var pos = scale.getPixelForValue(o.value), area = chart.chartArea, ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = o.color || WCA.db.callout;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(pos, area.top); ctx.lineTo(pos, area.bottom); }
    else            { ctx.moveTo(area.left, pos); ctx.lineTo(area.right, pos); }
    ctx.stroke();
    ctx.setLineDash([]);
    if (o.label) {
      ctx.font = "600 13px " + WCA.font;
      ctx.fillStyle = o.textColor || WCA.db.calloutText;
      ctx.textAlign = horizontal ? "center" : "right";
      ctx.textBaseline = "bottom";
      if (horizontal) ctx.fillText(o.label, pos, area.top - 4);
      else            ctx.fillText(o.label, area.right, pos - 4);
    }
    ctx.restore();
  },
};

/* endLabels: write the first and/or last value of each line beside the point,
   the Bulletin way (2.14). Labels that would overlap are pushed apart.
   Text is the series color when that color passes 4.5:1 on white (all full
   family/race colors except olive, rust-orange and teal); list the others in
   inkFor and they are written in ink, or give exact text colors per dataset in
   colors (e.g. [null, WCA.db.tealText]). Leave room with layout.padding.right: 56.
   Turn on per chart with:
     plugins: { endLabels: { first: true, last: true, format: WCA.fmt.pct, inkFor: [WCA.db.teal.full] } } */
WCA.plugins.endLabels = {
  id: "endLabels",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || (!o.first && !o.last)) return;   /* off unless the chart asks */
    var ctx = chart.ctx, ink = WCA.colors.ink, inkFor = o.inkFor || [], gap = 16;
    function collect(which) {
      var items = [];
      chart.data.datasets.forEach(function (ds, di) {
        var meta = chart.getDatasetMeta(di);
        if (meta.hidden) return;
        var i = which === "first" ? 0 : meta.data.length - 1, pt = meta.data[i], v = ds.data[i];
        if (!pt || v === null || v === undefined) return;
        items.push({ x: pt.x, y: pt.y, text: o.format ? o.format(v) : String(v),
                     color: (o.colors && o.colors[di]) || (inkFor.indexOf(ds.borderColor) >= 0 ? ink : ds.borderColor) });
      });
      items.sort(function (a, b) { return a.y - b.y; });
      for (var k = 1; k < items.length; k++) {           /* push overlapping labels down */
        if (items[k].y - items[k - 1].y < gap) items[k].y = items[k - 1].y + gap;
      }
      return items;
    }
    ctx.save();
    ctx.font = "600 14px " + WCA.font;
    ctx.textBaseline = "middle";
    ["first", "last"].forEach(function (which) {
      if (!o[which]) return;
      collect(which).forEach(function (it) {
        ctx.fillStyle = it.color;
        ctx.textAlign = "left";
        ctx.fillText(it.text, it.x + 10, it.y);
      });
    });
    ctx.restore();
  },
};

/* pointValues: write every point's value above (or below) it, in the series
   color (or ink, as above), as on 3.16. Turn on per chart with:
     plugins: { pointValues: { place: ["above", "below"], format: WCA.fmt.pct, colors: [null, WCA.db.tealText] } }
   place and colors give one entry per dataset. */
WCA.plugins.pointValues = {
  id: "pointValues",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.place) return;                 /* off unless the chart asks */
    var ctx = chart.ctx, ink = WCA.colors.ink, inkFor = o.inkFor || [];
    ctx.save();
    ctx.font = "600 15px " + WCA.font;
    ctx.textAlign = "center";
    chart.data.datasets.forEach(function (ds, di) {
      var meta = chart.getDatasetMeta(di), below = o.place[di] === "below";
      if (meta.hidden) return;
      ctx.fillStyle = (o.colors && o.colors[di]) || (inkFor.indexOf(ds.borderColor) >= 0 ? ink : ds.borderColor);
      ctx.textBaseline = below ? "top" : "bottom";
      meta.data.forEach(function (pt, i) {
        var v = ds.data[i];
        if (v === null || v === undefined) return;
        var r = (ds.pointRadius || 4) + 6;
        ctx.fillText(o.format ? o.format(v) : String(v), pt.x, below ? pt.y + r : pt.y - r);
      });
    });
    ctx.restore();
  },
};

/* gapCallouts: a rust box with white text halfway between two lines at each
   x position, e.g. "35.4% Difference" (3.16). Turn on per chart with:
     plugins: { gapCallouts: { top: 0, bottom: 1, text: function (gap) { return [WCA.fmt.pct(gap), "Difference"]; } } }
   top/bottom are dataset indexes. */
WCA.plugins.gapCallouts = {
  id: "gapCallouts",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || typeof o.text !== "function") return;   /* off unless the chart asks */
    var ctx = chart.ctx, a = chart.getDatasetMeta(o.top), b = chart.getDatasetMeta(o.bottom);
    var va = chart.data.datasets[o.top].data, vb = chart.data.datasets[o.bottom].data;
    ctx.save();
    ctx.font = "600 14px " + WCA.font;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    a.data.forEach(function (pa, i) {
      var pb = b.data[i];
      if (!pb || va[i] == null || vb[i] == null) return;
      var lines = o.text(Math.abs(va[i] - vb[i]));
      var w = Math.max.apply(null, lines.map(function (t) { return ctx.measureText(t).width; })) + 20;
      var h = lines.length * 18 + 12, x = pa.x, y = (pa.y + pb.y) / 2;
      ctx.fillStyle = WCA.db.callout;
      ctx.fillRect(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = "#FFFFFF";
      lines.forEach(function (t, k) { ctx.fillText(t, x, y - h / 2 + 15 + k * 18); });
    });
    ctx.restore();
  },
};


/* ##########################################################################
   PART TWO  ·  THIS PAGE
   ########################################################################## */

/* --------------------------------------------------------------------------
   0. SETTINGS  ·  the things a person might change
   -------------------------------------------------------------------------- */

var DATA_FILE = "data/data.json";

/* The five tabs, in order. Each id is a <section class="chapter"> in index.html and the
   part of the web address after # that opens it (…/#chapter-2). */
var TAB_IDS = ["chapter-1", "chapter-2", "chapter-3", "chapter-4", "map"];
var DEFAULT_TAB = "chapter-1";

/* The PDF Bulletin, for the "Bulletin page 1.3" tags on every card and the banner link.
   Leave PDF_URL empty until the report is online; the tags then stay plain text.
   PDF_PAGE_OFFSET turns a Bulletin page number into a PDF page: 1.3 -> 4 + 3 = page 7. */
var PDF_URL = "";
var PDF_PAGE_OFFSET = { 1: 4, 2: 20, 3: 37, 4: 55 };

/* Which functions draw each chapter's charts. A chapter's charts are drawn the first time
   its tab opens (a chart can't be measured while its tab is hidden). Filled in chapter by chapter. */
var CHAPTER_CHARTS = {
  "chapter-1": [drawPopulation, drawRaceEthnicity, drawBirthsAndYoungChildren, drawIncomeByFamilyType, drawFamilyComposition,
                drawPovertyByRace, drawRentAndChildCare, drawCostOfLiving, drawInflation, drawSignsOfDistress,
                drawHomelessChildren, drawCreditCardDebt],
  "chapter-2": [],
  "chapter-3": [],
  "chapter-4": [],
  "map": [],
};

/* Page 1.10: the words in and around each ring. They change with the year a reader picks, so they are
   written by the code and kept here, not in index.html. */
var RING_WORDS = {
  left: "Amount left to live on:",
  short: "Over budget each month:",                /* when rent and child care cost more than the income */
  rent: "Rent",                                    /* under each ring: "Rent 13.7%" */
  care: "Child care",
  /* the line beside the year buttons; {rent}, {month} and {care} are filled in from data.json */
  costs: "Rent: {rent} a month ({month}) · Infant child care: {care} a month",
  standIn: "the earliest month in Zillow's file",  /* added after {month} when the year has no January of its own */
  parts: ["Infant child care", "Rent", "Left to live on"],   /* the three parts of a ring, in drawing order */
};


/* --------------------------------------------------------------------------
   1. START-UP  ·  load the data, then draw everything
   -------------------------------------------------------------------------- */

var page = { data: null, drawn: {} };   /* what has been loaded and which tabs have had their charts drawn */

fetch(DATA_FILE)
  .then(function (r) { if (!r.ok) throw new Error(DATA_FILE + " not found"); return r.json(); })
  .then(function (data) {
    page.data = data;
    WCA.applyChartDefaults();
    useHoverBox();
    WCA.fillNumbers(data);
    drawHeadlines(data);
    linkPdfPages();
    initTabs();
  })
  .catch(function (error) {
    /* Most likely cause: the page was opened straight from a folder (file://), which
       blocks loading data files. It needs a web server; see the README. */
    document.getElementById("tiles").innerHTML =
      '<p class="fine">Couldn\'t load the data (' + error.message + '). ' +
      'This page has to be opened through a web server, not straight from a folder. See the README.</p>';
    console.error(error);
  });


/* --------------------------------------------------------------------------
   2. HEADLINE TILES  ·  one tile per entry in data.json "headlines"
   -------------------------------------------------------------------------- */

function drawHeadlines(data) {
  var html = "";
  data.headlines.forEach(function (h) {
    /* "display" is a ready-made way of writing the number ("1 in 8"); otherwise format the value */
    var value = h.display ? h.display : (typeof h.value === "number" ? WCA.fmt.byUnit(h.value, h.unit) : h.value);
    html += '<div class="tile">';
    html += '  <div class="value">' + value + "</div>";
    html += '  <div class="label">' + h.label + "</div>";
    if (h.compare) {
      /* either a ready-made sentence from the script ("text"), or a label and a value to format */
      var compare = h.compare.text ? h.compare.text
                  : capitalize(h.compare.label) + ": " + WCA.fmt.byUnit(h.compare.value, h.compare.unit, h.compare.decimals);
      html += '  <div class="compare">' + compare + "</div>";
    }
    html += "</div>";
  });
  document.getElementById("tiles").innerHTML = html;
}


/* --------------------------------------------------------------------------
   3. CHAPTER TABS  ·  one chapter (or the map) showing at a time
   --------------------------------------------------------------------------
   How it works:
     a. The tabs are <button role="tab"> elements in index.html; the panels are
        <section class="chapter"> with matching ids. showTab(id) hides every panel
        but one and marks its tab selected.
     b. The web address keeps the chosen tab (#chapter-2), so a link can open it.
        A link to something inside a chapter (#part-1-2, #card-3-3) opens that
        chapter first, then scrolls to it.
     c. The first time a tab opens, its charts are drawn (CHAPTER_CHARTS).
     d. Left and right arrow keys move between tabs when one has keyboard focus.
   -------------------------------------------------------------------------- */

function initTabs() {
  var tabs = document.querySelectorAll(".chapter-nav .tab");
  tabs.forEach(function (tab, i) {
    tab.addEventListener("click", function () { openTab(tab.getAttribute("aria-controls"), true); });
    tab.addEventListener("keydown", function (e) {
      var step = e.key === "ArrowRight" ? 1 : (e.key === "ArrowLeft" ? -1 : 0);
      if (!step) return;
      e.preventDefault();
      var next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      openTab(next.getAttribute("aria-controls"), true);
    });
  });

  /* Any link to #chapter-n, or to something inside a chapter, goes through revealHash */
  window.addEventListener("hashchange", revealHash);
  revealHash();
  /* The font arrives a moment after the page; text reflows and moves everything a little,
     so a link to something inside a chapter is scrolled to again once the font is in. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(revealHash);
}

/* Show one tab's panel, hide the others, remember it in the address bar */
function showTab(id) {
  if (TAB_IDS.indexOf(id) < 0) id = DEFAULT_TAB;
  TAB_IDS.forEach(function (tabId) {
    var panel = document.getElementById(tabId);
    var tab = document.querySelector('.tab[aria-controls="' + tabId + '"]');
    var on = tabId === id;
    if (panel) panel.hidden = !on;
    if (tab) { tab.setAttribute("aria-selected", on ? "true" : "false"); tab.tabIndex = on ? 0 : -1; }
  });
  drawTabCharts(id);
  return id;
}

/* Open a tab from a click (scrolls so the tabs sit at the top, with the chapter below) */
function openTab(id, fromClick) {
  showTab(id);
  if (location.hash !== "#" + id) history.replaceState(null, "", "#" + id);
  if (fromClick) {
    var nav = document.querySelector(".chapter-nav");
    var top = nav.getBoundingClientRect().top + window.scrollY;
    if (window.scrollY > top) window.scrollTo({ top: top, behavior: "auto" });   /* don't jump down; only up to the tabs */
  }
}

/* Open whatever the address bar asks for: a tab, or an element inside one */
function revealHash() {
  var id = decodeURIComponent(location.hash.replace("#", ""));
  if (!id) { showTab(DEFAULT_TAB); return; }
  if (TAB_IDS.indexOf(id) >= 0) { showTab(id); return; }
  var target = document.getElementById(id);
  var panel = target ? target.closest(".chapter") : null;
  if (panel) {
    showTab(panel.id);
    target.scrollIntoView({ block: "start" });   /* scroll-margin-top in styles.css keeps it below the tabs */
  }
}

/* Draw a tab's charts once, the first time it is shown */
function drawTabCharts(id) {
  if (page.drawn[id] || !page.data) return;
  page.drawn[id] = true;
  (CHAPTER_CHARTS[id] || []).forEach(function (draw) {
    /* if one chart can't be drawn (say its block is missing from data.json), the others still are */
    try { draw(page.data); } catch (error) { console.error("Could not draw " + draw.name + ":", error); }
  });
}

/* The "Bulletin page 1.3" tag on each card becomes a link to that page of the PDF, once PDF_URL is set */
function linkPdfPages() {
  if (!PDF_URL) return;
  document.querySelectorAll(".page-tag[data-page]").forEach(function (tag) {
    var parts = tag.getAttribute("data-page").split(".");           /* "1.3" -> chapter 1, page 3 */
    var pdfPage = (PDF_PAGE_OFFSET[parts[0]] || 0) + Number(parts[1]);
    var link = document.createElement("a");
    link.className = tag.className;
    link.href = PDF_URL + "#page=" + pdfPage;
    link.target = "_blank"; link.rel = "noopener";
    link.textContent = tag.textContent;
    tag.replaceWith(link);
  });
}


/* --------------------------------------------------------------------------
   4. CHAPTER CHARTS  ·  one function per Bulletin page
   --------------------------------------------------------------------------
   Each function reads one block of data.json "charts" (s1_7_... is page 1.7)
   and is listed in CHAPTER_CHARTS (Settings) under its chapter. Most charts
   are Chart.js. Bars that carry a silhouette or a printed share are plain
   HTML, sized from the same numbers. The small tools they share are in part 5.
   -------------------------------------------------------------------------- */


/* ---- CHAPTER 1 ---------------------------------------------------------- */

/* Page 1.3: a ring of all residents. Children and youth are the blue part, the hatched piece of it is
   the share of them who are low income, and everyone older is pale blue. */
function drawPopulation(data) {
  var chart = data.charts.s1_3_population;
  var young = chart.children_and_youth, low = chart.low_income, older = chart.older_residents;
  var canvas = document.getElementById("chart-population");

  /* "Low income" is a share OF children and youth, so it is drawn as a piece of their slice */
  var lowPiece = young.share_pct * low.share_pct / 100;

  new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: [young.label, low.label, older.label],
      datasets: [{
        data: [young.share_pct - lowPiece, lowPiece, older.share_pct],
        backgroundColor: [WCA.colors.blue, hatch(WCA.colors.blue, SURFACE), WCA.db.remainder],
        borderColor: SURFACE, borderWidth: 2, hoverBorderColor: SURFACE, hoverOffset: 0,
      }],
    },
    options: {
      cutout: "46%",
      plugins: { tooltip: { callbacks: {
        label: function (item) {
          if (item.dataIndex === 0) return [WCA.fmt.pct(young.share_pct) + " of all residents", WCA.fmt.count(young.people) + " people"];
          if (item.dataIndex === 1) return [WCA.fmt.pct(low.share_pct) + " of children and youth",
                                            WCA.fmt.count(low.people) + " of the " + WCA.fmt.count(low.of) + " whose income was measured",
                                            capitalize(low.means)];
          return [WCA.fmt.pct(older.share_pct) + " of all residents", WCA.fmt.count(older.people) + " people"];
        },
      } } },
    },
  });

  describe(canvas, chart.title + ". " + young.label + ": " + WCA.fmt.count(young.people) + ", " + WCA.fmt.pct(young.share_pct) +
    " of " + WCA.fmt.count(chart.residents) + " residents. Of them, " + WCA.fmt.pct(low.share_pct) + " are low income.");
}


/* Page 1.4: each group's share of residents ages 0 to 24, the earlier year (lighter) beside the latest (full color). */
function drawRaceEthnicity(data) {
  var chart = data.charts.s1_4_race_ethnicity;
  var race = WCA.db.race;
  var canvas = document.getElementById("chart-race");
  var last = chart.years.length - 1;
  var highest = Math.max.apply(null, chart.groups.map(function (g) { return Math.max.apply(null, g.shares); }));

  /* The legend explains the two steps, in gray so it stands for every group */
  WCA.legend("#legend-race", chart.years.map(function (year, y) {
    return { label: year + (y === last ? " (full color)" : " (lighter)"), color: race.all.steps[y] };
  }));

  function share(datasetIndex, index) { return WCA.fmt.pct(chart.groups[index].shares[datasetIndex]); }

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: chart.groups.map(function (g) { return g.label; }),
      datasets: chart.years.map(function (year, y) {
        return {
          label: String(year),
          data: chart.groups.map(function (g) { return g.shares[y]; }),
          backgroundColor: chart.groups.map(function (g) { return race[g.key].steps[y]; }),
        };
      }),
    },
    options: {
      datasets: { bar: { barPercentage: 0.94, categoryPercentage: 0.74, maxBarThickness: 46 } },
      layout: { padding: { top: 20 } },
      scales: {
        /* every group's name stays under its bars, level: broken into shorter lines, in smaller type, on a narrow screen */
        x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0,
             font: function (context) { return { size: context.chart.width < 520 ? 11 : 13 }; },
             callback: function (value) { return wrap(this.getLabelForValue(value), this.chart.width < 520 ? 9 : 16); } } },
        y: { beginAtZero: true, max: roundStep(highest), ticks: { callback: pctTick, maxTicksLimit: 6 } },
      },
      plugins: {
        /* every bar's share on a wide screen; on a narrow one only the latest year's (the rest on hover) */
        barNotes: { text: share, narrow: 520, narrowText: function (d, i) { return d === last ? share(d, i) : null; } },
        seriesNamesInBars: { on: true },
        tooltip: { callbacks: {
          title: function (items) { return chart.groups[items[0].dataIndex].label; },
          label: function (item) {
            var group = chart.groups[item.dataIndex], y = item.datasetIndex;
            return [chart.years[y] + ": " + WCA.fmt.pct(group.shares[y]),
                    WCA.fmt.count(group.people[y]) + " of " + WCA.fmt.count(chart.residents_0_24[y]) + " residents ages 0 to 24"];
          },
        } },
      },
    },
    plugins: [barNotes, seriesNamesInBars],
  });

  describe(canvas, chart.title + ". " + chart.groups.map(function (g) {
    return g.label + ": " + chart.years.map(function (year, y) { return WCA.fmt.pct(g.shares[y]) + " in " + year; }).join(", ");
  }).join("; ") + ".");
}


/* Page 1.5: a row of baby figures for the first and the latest year of births, and a line of children
   under 5 by year. (The two circles are text in index.html.) */
function drawBirthsAndYoungChildren(data) {
  var chart = data.charts.s1_5_births_and_young_children;
  var births = chart.births, children = chart.under_5;

  /* The picture rows: one figure for every `per_figure` births, the last one filled part of the way.
     Both rows have as many figures as the larger year needs, so the smaller year shows what is gone. */
  var figures = Math.ceil(Math.max.apply(null, births.values) / births.per_figure);
  var html = "";
  births.years.forEach(function (year, i) {
    var worth = births.values[i] / births.per_figure;               /* 11,517 births = 11.517 figures */
    html += '<div class="picto-row"><div><span class="picto-year">' + year + '</span>' +
            '<span class="picto-value">' + WCA.fmt.count(births.values[i]) + '</span></div><div class="picto-figures">';
    for (var k = 0; k < figures; k++) {
      var filled = Math.max(0, Math.min(1, worth - k));              /* this figure counts fully, partly or not at all */
      html += '<span class="picto-figure" style="--filled:' + Math.round(filled * 100) + '%"></span>';
    }
    html += "</div></div>";
  });
  var picture = document.getElementById("pictogram-births");
  picture.innerHTML = html;
  describe(picture, "Babies born to Westchester residents: " + births.years.map(function (year, i) {
    return WCA.fmt.count(births.values[i]) + " in " + year;
  }).join(", ") + ".");

  /* The line: one point a year. A year with no estimate (2020) is skipped and the line runs across it. */
  var canvas = document.getElementById("chart-under-5");
  var end = children.values.length - 1;
  new Chart(canvas, {
    type: "line",
    data: { labels: children.years, datasets: [lineSeries("Children under 5", children.values, WCA.colors.blue)] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 8 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(3) } },
        y: { beginAtZero: true, grace: "18%", ticks: { callback: compactCount, maxTicksLimit: 5 } },
      },
      plugins: {
        pointNotes: { notes: [{ index: 0, text: WCA.fmt.count(children.values[0]) }, { index: end, text: WCA.fmt.count(children.values[end]) }] },
        tooltip: { callbacks: {
          title: function (items) { return "Children under 5, " + items[0].label; },
          label: function (item) { return WCA.fmt.count(item.parsed.y); },
        } },
      },
    },
    plugins: [WCA.plugins.pointNotes, hoverLine],
  });
  describe(canvas, "Children under 5 in Westchester County: " + WCA.fmt.count(children.first.value) + " in " + children.first.year +
    ", " + WCA.fmt.count(children.last.value) + " in " + children.last.year + ".");
}


/* Page 1.7: median income by family type. Plain HTML bars, so each family's silhouette lines up with its
   three bars. index.html holds the rows and the two callouts; this fills each row's bars, and puts every
   ALICE budget (the callout's pointer and a dashed line) at its place on the scale. */
function drawIncomeByFamilyType(data) {
  var chart = data.charts.s1_7_income_by_family_type;
  var box = document.getElementById("chart-income");
  var last = chart.years.length - 1;

  /* One scale for every bar: from $0 to a round number at or above the largest amount shown */
  var amounts = chart.budgets.map(function (b) { return b.amount; });
  chart.families.forEach(function (family) { amounts = amounts.concat(family.values); });
  var top = niceCeiling(Math.max.apply(null, amounts));
  function place(amount) { return (amount / top * 100).toFixed(2) + "%"; }

  chart.families.forEach(function (family) {
    var plot = box.querySelector('.fb-row[data-family="' + family.key + '"] .fb-plot');
    var steps = WCA.db.family[family.key].steps;                    /* lighter for earlier years, full color for the latest */
    var html = "";
    family.values.forEach(function (value, y) {
      html += '<div class="fb-bar' + (y === last ? " latest" : "") + '" style="width:' + place(value) + ";background:" + steps[y] + '">' +
              '<span class="fb-year">' + chart.years[y] + '</span>' +
              '<span class="fb-value" data-year="' + chart.years[y] + '">' + WCA.fmt.dollars(value) + "</span></div>";
    });
    chart.budgets.forEach(function (budget) {                       /* the dashed line of the budget this family is held against */
      if (budget.families.indexOf(family.key) >= 0) html += '<div class="fb-benchmark" style="--at:' + place(budget.amount) + '"></div>';
    });
    plot.innerHTML = html;
    plot.querySelectorAll(".fb-bar").forEach(function (bar, y) {
      bar.tip = "<strong>" + plainText(family.label) + ", " + chart.years[y] + "</strong><br>" + WCA.fmt.dollars(family.values[y]) + " median family income";
    });
  });

  /* Each callout in index.html has data-budget="0", "1"...: the budget it describes */
  box.querySelectorAll(".fb-callout").forEach(function (callout) {
    var budget = chart.budgets[Number(callout.getAttribute("data-budget"))];
    if (budget) callout.style.setProperty("--at", place(budget.amount));
  });

  /* The scale under the bars: six labels from $0 to the top */
  var axis = "";
  for (var step = 0; step <= 5; step++) axis += '<span style="left:' + (step * 20) + '%">' + compactDollars(top / 5 * step) + "</span>";
  box.querySelector(".fb-axis").innerHTML = axis;

  /* A value is written inside its bar's end when it fits there and the dashed line doesn't run through it;
     otherwise just past the bar. Checked again whenever the window changes size. */
  function placeValues() {
    box.querySelectorAll(".fb-bar").forEach(function (bar) {
      bar.classList.remove("value-outside", "year-outside");
      var year = bar.querySelector(".fb-year"), value = bar.querySelector(".fb-value");
      var width = bar.clientWidth;
      var line = bar.parentNode.querySelector(".fb-benchmark");
      var crossed = line && line.offsetLeft > width - value.offsetWidth && line.offsetLeft < width + 2;
      if (width < year.offsetWidth + value.offsetWidth + 6 || crossed) bar.classList.add("value-outside");
      if (width < year.offsetWidth + 4) bar.classList.add("year-outside");
    });
  }
  placeValues();
  whenLayoutChanges(placeValues);
  hoverTips(box);

  describe(box, chart.title + ". " + chart.families.map(function (family) {
    return family.label + ": " + family.values.map(function (value, y) { return WCA.fmt.dollars(value) + " in " + chart.years[y]; }).join(", ");
  }).join("; ") + ". ALICE Household Survival Budgets: " + chart.budgets.map(function (b) { return WCA.fmt.dollars(b.amount); }).join(" and ") + ".");
}


/* Page 1.8: two sets of split bars. Each bar is one group's families with children, split into
   married-couple, single-father and single-mother families (100% together). The first set is families at
   or above the poverty level, the second families below it. A group marked * uses 5-year estimates. */
function drawFamilyComposition(data) {
  var chart = data.charts.s1_8_family_composition;

  function panel(id, part, words) {
    var box = document.getElementById(id);
    var html = "", spoken = [];
    chart.order.forEach(function (key) {
      var group = chart.groups[key];
      var name = group.label + (group.release === "5-year" ? "*" : "");
      html += '<div class="sb-row' + (key === "all" ? " apart" : "") + '"><div class="sb-label">' + plainText(name) + '</div><div class="sb-bar">';
      chart.family_types.forEach(function (type) {
        var piece = group[part][type.key];
        if (!piece.share) return;                                    /* nothing to draw for a share of zero */
        html += '<div class="sb-part ' + type.key + '" style="flex:' + piece.share + ' 1 0%" data-group="' + key + '" data-type="' + type.key + '">' +
                "<span>" + WCA.fmt.pct(piece.share) + "</span></div>";
      });
      html += "</div></div>";
      spoken.push(name + ": " + chart.family_types.map(function (type) { return type.label + " " + WCA.fmt.pct(group[part][type.key].share); }).join(", "));
    });
    box.innerHTML = html;
    box.querySelectorAll(".sb-part").forEach(function (el) {
      var group = chart.groups[el.getAttribute("data-group")], type = el.getAttribute("data-type");
      var piece = group[part][type];
      var label = chart.family_types.filter(function (t) { return t.key === type; })[0].label;
      el.tip = "<strong>" + plainText(group.label + " · " + label) + "</strong><br>" +
               WCA.fmt.pct(piece.share) + " of families with children " + words +
               (piece.margin === null ? "" : " (± " + piece.margin.toFixed(1) + " points)") + "<br>" +
               WCA.fmt.count(piece.families) + " of " + WCA.fmt.count(group[part].families) + " families · " +
               plainText(group.period) + (group.release === "5-year" ? " five-year estimate" : " one-year estimate");
    });
    hoverTips(box);
    describe(box, "Families with children " + words + ", by family type. " + spoken.join("; ") + ".");
    return box;
  }

  var boxes = [panel("chart-composition-above", "at_or_above", "at or above the poverty level"),
               panel("chart-composition-below", "below", "below the poverty level")];

  /* The * note is shown only when a group really uses 5-year estimates */
  document.getElementById("note-composition-five-year").hidden = !chart.five_year_period;

  /* A share is printed on its part only where it fits; checked again when the window changes size */
  function fitShares() {
    boxes.forEach(function (box) {
      box.querySelectorAll(".sb-part span").forEach(function (text) {
        text.classList.remove("too-wide");                           /* show it, measure it, then hide it if it doesn't fit */
        text.classList.toggle("too-wide", text.offsetWidth + 10 > text.parentNode.clientWidth);
      });
    });
  }
  fitShares();
  whenLayoutChanges(fitShares);
}


/* Page 1.9: six small charts, one per group, all on the same scale so they can be compared.
   In each: three age groups, the earlier year (lighter) beside the latest (full color, value printed).
   A dagger marks a value the warehouse flags as unreliable. */
function drawPovertyByRace(data) {
  var chart = data.charts.s1_9_poverty_by_race;
  var box = document.getElementById("chart-poverty-panels");
  var last = chart.years.length - 1;
  var top = roundStep(chart.highest_rate);                           /* 26.2 -> 30, the top of every panel */
  var someUnreliable = false;

  WCA.legend("#legend-poverty", chart.years.map(function (year, y) {
    return { label: year + (y === last ? " (full color, value shown)" : " (lighter)"), color: WCA.db.race.all.steps[y] };
  }));

  chart.order.forEach(function (key) {
    var group = chart.groups[key];
    var steps = WCA.db.race[key].steps;
    var panel = document.createElement("div");
    panel.className = "sm-panel";
    panel.innerHTML = '<h4></h4><div class="chart-box"><canvas></canvas></div>';
    panel.querySelector("h4").textContent = group.label;
    box.appendChild(panel);
    var canvas = panel.querySelector("canvas");

    new Chart(canvas, {
      type: "bar",
      data: {
        labels: chart.ages,
        datasets: chart.years.map(function (year, y) {
          return { label: String(year), data: group.rates.map(function (pair) { return pair[y]; }), backgroundColor: steps[y] };
        }),
      },
      options: {
        datasets: { bar: { barPercentage: 0.9, categoryPercentage: 0.72, maxBarThickness: 24 } },
        layout: { padding: { top: 16 } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 }, maxRotation: 0, autoSkip: false,
               /* "Under 18" becomes two lines where the panel is narrow (a phone) */
               callback: function (value) { var age = this.getLabelForValue(value); return this.chart.width < 190 ? wrap(age, 6) : age; } } },
          y: { beginAtZero: true, max: top, ticks: { callback: pctTick, stepSize: 10, font: { size: 12 } } },
        },
        plugins: {
          barNotes: { size: 12, text: function (d, i) {
            var rate = group.rates[i][d];
            if (d !== last || rate === null) return null;
            return rate.toFixed(1) + (group.unreliable[i][d] ? "†" : "");
          } },
          tooltip: { callbacks: {
            title: function (items) { return group.label + ", " + chart.ages[items[0].dataIndex].toLowerCase(); },
            label: function (item) {
              var i = item.dataIndex, y = item.datasetIndex;
              if (group.rates[i][y] === null) return chart.years[y] + ": no estimate";
              var lines = [chart.years[y] + ": " + WCA.fmt.pct(group.rates[i][y]) +
                           (group.margins[i][y] === null ? "" : " (± " + group.margins[i][y].toFixed(1) + " points)"),
                           WCA.fmt.count(group.below_poverty[i][y]) + " of " + WCA.fmt.count(group.people[i][y]) + " people"];
              if (group.unreliable[i][y]) lines.push("Unreliable estimate");
              if (group.five_year[i][y]) lines.push("Five-year estimate");
              return lines;
            },
          } },
        },
      },
      plugins: [barNotes],
    });

    group.unreliable.forEach(function (pair) { if (pair[last]) someUnreliable = true; });
    describe(canvas, group.label + ", poverty rate. " + chart.ages.map(function (age, i) {
      return age + ": " + chart.years.map(function (year, y) { return WCA.fmt.pct(group.rates[i][y]) + " in " + year; }).join(", ");
    }).join("; ") + ".");
  });

  /* The notes under the panels show only when they apply */
  document.getElementById("note-poverty-unreliable").hidden = !someUnreliable;
  document.getElementById("note-poverty-five-year").hidden = !chart.five_year_used;
}


/* Page 1.10: three rings, one per family type. Each ring is a month of median income: the part that goes
   to infant child care, the part that goes to rent, and what is left. The buttons switch the year; every
   number in and around the rings changes with it. Costs sit at the bottom of the ring, what is left on top. */
function drawRentAndChildCare(data) {
  var chart = data.charts.s1_10_rent_and_child_care;
  var box = document.getElementById("chart-rent");
  var colors = { care: WCA.colors.blue, rent: WCA.db.teal.full, left: WCA.db.remainder };
  var rings = {};

  WCA.legend("#legend-rent", [
    { label: RING_WORDS.parts[1], color: colors.rent },
    { label: RING_WORDS.parts[0], color: colors.care },
    { label: RING_WORDS.parts[2], color: colors.left },
  ]);

  chart.families.forEach(function (family) {
    var cell = box.querySelector('.donut-cell[data-family="' + family.key + '"]');
    rings[family.key] = new Chart(cell.querySelector("canvas"), {
      type: "doughnut",
      data: {
        labels: RING_WORDS.parts,
        datasets: [{ data: [0, 0, 1], backgroundColor: [colors.care, colors.rent, colors.left],
                     borderColor: SURFACE, borderWidth: 2, hoverBorderColor: SURFACE, hoverOffset: 0 }],
      },
      options: {
        cutout: "66%",
        plugins: { tooltip: { callbacks: {
          title: function () { return family.label; },
          label: function (item) { return item.label + ": " + WCA.fmt.dollars(item.raw) + " a month"; },
        } } },
      },
    });
  });

  /* Show one year (y is its position in chart.years) */
  function show(y) {
    var rent = chart.rent[y], care = chart.infant_care[y];
    chart.families.forEach(function (family) {
      var cell = box.querySelector('.donut-cell[data-family="' + family.key + '"]');
      var ring = rings[family.key];
      var left = family.left[y];                                     /* below zero: rent and care cost more than the income */
      var over = left < 0;

      ring.data.datasets[0].data = [care, rent.value, Math.max(left, 0)];
      /* turn the ring so the two costs are centered at the bottom */
      var costs = (care + rent.value) / (care + rent.value + Math.max(left, 0));
      ring.options.rotation = 180 - costs * 180;
      ring.update();

      cell.querySelector(".js-income").textContent = WCA.fmt.dollars(family.income_monthly[y]);
      cell.querySelector(".js-left-words").textContent = over ? RING_WORDS.short : RING_WORDS.left;
      cell.querySelector(".js-left").textContent = (over ? "−" : "") + WCA.fmt.dollars(Math.abs(left));
      cell.querySelector(".donut-center").classList.toggle("short", over);
      cell.querySelector(".js-rent").textContent = RING_WORDS.rent + " " + WCA.fmt.pct(family.rent_share_pct[y]);
      cell.querySelector(".js-care").textContent = RING_WORDS.care + " " + WCA.fmt.pct(family.care_share_pct[y]);
      describe(ring.canvas, family.label + ", " + chart.years[y] + ": median monthly income " + WCA.fmt.dollars(family.income_monthly[y]) +
        "; rent " + WCA.fmt.pct(family.rent_share_pct[y]) + " of it, infant child care " + WCA.fmt.pct(family.care_share_pct[y]) +
        "; " + (over ? "short by " : "left to live on ") + WCA.fmt.dollars(Math.abs(left)) + ".");
    });

    /* The line beside the buttons: that year's rent (with the month it really is) and child care */
    var month = rent.label + (rent.is_that_january ? "" : ", " + RING_WORDS.standIn);
    document.getElementById("rent-costs").innerHTML = plainText(RING_WORDS.costs)
      .replace("{rent}", "<strong>" + WCA.fmt.dollars(rent.value) + "</strong>")
      .replace("{month}", plainText(month))
      .replace("{care}", "<strong>" + WCA.fmt.dollars(care) + "</strong>");

    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
  }

  /* One button per year; the latest year shows first */
  var switcher = document.getElementById("rent-years");
  var buttons = chart.years.map(function (year, y) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = year;
    button.addEventListener("click", function () { show(y); });
    switcher.appendChild(button);
    return button;
  });
  show(chart.years.length - 1);
}


/* Page 1.11: the cost-of-living table. Its words and most of its numbers are in index.html (data-fill).
   This writes the last column, which needs a dash where nothing newer than the "now" year is published,
   and copies each column's heading onto its cells (the phone layout shows it above every figure). */
function drawCostOfLiving(data) {
  var chart = data.charts.s1_11_cost_of_living;
  var table = document.getElementById("table-costs");

  table.querySelectorAll(".js-latest-change").forEach(function (cell) {
    var item = chart.items[cell.getAttribute("data-item")];
    var change = item ? item.latest_change_pct : null;
    cell.textContent = (change === null || change === undefined) ? "—" : WCA.fmt.change(change);
  });

  var headings = table.querySelectorAll("thead th");
  table.querySelectorAll("tbody tr").forEach(function (row) {
    row.querySelectorAll("td").forEach(function (cell, i) {
      cell.setAttribute("data-label", headings[i + 1].textContent.replace(/\s+/g, " ").trim());
    });
  });
}


/* Page 1.12: inflation month by month, one line. The lowest and the highest month are labelled and the
   latest month is a dot (the callout above the chart says its value); hover for any other month.
   A month that was never published leaves no point (the line runs across it). */
function drawInflation(data) {
  var chart = data.charts.s1_12_inflation;
  var canvas = document.getElementById("chart-inflation");
  var end = chart.values.length - 1;

  var notes = [
    { index: chart.months.indexOf(chart.low.month), text: WCA.fmt.pct(chart.low.value), place: "below" },
    { index: chart.months.indexOf(chart.peak.month), text: WCA.fmt.pct(chart.peak.value) },
  ];

  var series = lineSeries("Inflation", chart.values, WCA.colors.blue);
  series.borderWidth = 2;
  series.pointRadius = function (context) { return context.dataIndex === end ? 4 : 0; };   /* a dot on the latest month only */
  series.pointHoverRadius = 5;

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.months, datasets: [series] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 20, right: 14 } },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0,
             /* one label a year, under its January; every other year on a narrow screen */
             callback: function (value, index) {
               var month = chart.months[index];
               if (month.slice(5) !== "01") return null;
               var year = Number(month.slice(0, 4));
               return (this.chart.width < 520 && year % 2) ? null : year;
             } } },
        y: { ticks: { callback: pctTick },
             grid: { color: function (context) { return context.tick && context.tick.value === 0 ? WCA.colors.muted : WCA.colors.panel; } } },
      },
      plugins: {
        pointNotes: { notes: notes },
        tooltip: { callbacks: {
          title: function (items) { return monthName(chart.months[items[0].dataIndex]); },
          label: function (item) { return WCA.fmt.pct(item.parsed.y) + " higher than a year earlier"; },
        } },
      },
    },
    plugins: [WCA.plugins.pointNotes, hoverLine],
  });

  describe(canvas, chart.title + ", " + chart.first.label + " to " + chart.latest.label + ". Lowest " + WCA.fmt.pct(chart.low.value) +
    " in " + chart.low.label + ", highest " + WCA.fmt.pct(chart.peak.value) + " in " + chart.peak.label +
    ", latest " + WCA.fmt.pct(chart.latest.value) + " in " + chart.latest.label + ".");
}


/* Page 1.13: three charts in one card. */
function drawSignsOfDistress(data) {
  var chart = data.charts.s1_13_signs_of_distress;
  var food = chart.food, snap = chart.snap, premiums = chart.premiums;

  /* a. Food insecurity and poverty in each community: two bars per place */
  var foodSeries = [
    { label: "Food insecure", color: WCA.db.teal.full, values: food.food_insecure_pct },
    { label: "Below the poverty level", color: WCA.colors.blue, values: food.poverty_pct },
  ];
  WCA.legend("#legend-food", foodSeries);
  var foodCanvas = document.getElementById("chart-food");
  new Chart(foodCanvas, {
    type: "bar",
    data: {
      labels: food.places.map(function (place) { return wrap(place, 12); }),
      datasets: foodSeries.map(function (s) { return { label: s.label, data: s.values, backgroundColor: s.color }; }),
    },
    options: {
      indexAxis: "y",
      datasets: { bar: { barPercentage: 0.88, categoryPercentage: 0.74, maxBarThickness: 16 } },
      layout: { padding: { right: 46 } },
      scales: {
        x: { beginAtZero: true, grace: "5%", ticks: { callback: pctTick, maxTicksLimit: 5 } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } },
      },
      plugins: {
        valueLabels: { datasets: [0, 1], format: WCA.fmt.pct },
        tooltip: { callbacks: {
          title: function (items) { return food.places[items[0].dataIndex]; },
          label: function (item) {
            var i = item.dataIndex;
            if (item.datasetIndex === 0) return ["Food insecure: " + WCA.fmt.pct(food.food_insecure_pct[i]),
                                                 WCA.fmt.count(food.people_food_insecure[i]) + " of " + WCA.fmt.count(food.population[i]) + " people"];
            return "Below the poverty level: " + WCA.fmt.pct(food.poverty_pct[i]);
          },
        } },
      },
    },
    plugins: [WCA.plugins.valueLabels],
  });
  describe(foodCanvas, "Food insecurity and poverty, " + food.year + ". " + food.places.map(function (place, i) {
    return place + ": " + WCA.fmt.pct(food.food_insecure_pct[i]) + " food insecure, " + WCA.fmt.pct(food.poverty_pct[i]) + " below the poverty level";
  }).join("; ") + ".");

  /* b. SNAP recipients by year: a filled area running from blue to green, as in the Bulletin */
  var snapCanvas = document.getElementById("chart-snap");
  var snapEnd = snap.values.length - 1;
  var area = lineSeries("SNAP recipients", snap.values, WCA.colors.blue);
  area.borderWidth = 0;
  area.pointRadius = 0;
  area.fill = "origin";
  area.backgroundColor = function (context) {                        /* a solid fill, blue at the left to green at the right */
    var plot = context.chart.chartArea;
    if (!plot) return WCA.colors.blue;
    var blend = context.chart.ctx.createLinearGradient(plot.left, 0, plot.right, 0);
    blend.addColorStop(0, WCA.colors.blue);
    blend.addColorStop(1, WCA.colors.green);
    return blend;
  };
  new Chart(snapCanvas, {
    type: "line",
    data: { labels: snap.years, datasets: [area] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 18, right: 10 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(4) } },
        y: { beginAtZero: true, grace: "12%", ticks: { callback: compactCount, maxTicksLimit: 5 } },
      },
      plugins: {
        pointNotes: { notes: [{ index: 0, text: WCA.fmt.count(snap.values[0]) }, { index: snapEnd, text: WCA.fmt.count(snap.values[snapEnd]) }] },
        tooltip: { callbacks: {
          title: function (items) { return "July " + items[0].label; },
          label: function (item) { return WCA.fmt.count(item.parsed.y) + " people receiving SNAP"; },
        } },
      },
    },
    plugins: [WCA.plugins.pointNotes, hoverLine],
  });
  describe(snapCanvas, "SNAP recipients in Westchester each July: " + WCA.fmt.count(snap.first.value) + " in " + snap.first.year +
    ", a high of " + WCA.fmt.count(snap.peak.value) + " in " + snap.peak.year + ", " + WCA.fmt.count(snap.last.value) + " in " + snap.last.year + ".");

  /* c. The benchmark premium: New York State in blue, the United States in gray for comparison */
  var premiumColors = { ny: WCA.colors.blue, us: WCA.db.race.all.full };
  WCA.legend("#legend-premiums", premiums.series.map(function (s) { return { label: s.label, color: premiumColors[s.key] }; }));
  var premiumCanvas = document.getElementById("chart-premiums");
  new Chart(premiumCanvas, {
    type: "line",
    data: {
      labels: premiums.years,
      datasets: premiums.series.map(function (s) { return lineSeries(s.label, s.values, premiumColors[s.key]); }),
    },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 50 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(3) } },
        y: { beginAtZero: true, ticks: { callback: function (v) { return WCA.fmt.dollars(v); }, maxTicksLimit: 5 } },
      },
      plugins: {
        endLabels: { last: true, format: WCA.fmt.dollars },
        tooltip: { callbacks: { label: function (item) { return item.dataset.label + ": " + WCA.fmt.dollars(item.parsed.y) + " a month"; } } },
      },
    },
    plugins: [WCA.plugins.endLabels, hoverLine],
  });
  describe(premiumCanvas, "Monthly benchmark premium. " + premiums.series.map(function (s) {
    return s.label + ": " + WCA.fmt.dollars(s.values[0]) + " in " + premiums.years[0] + ", " +
           WCA.fmt.dollars(s.values[s.values.length - 1]) + " in " + premiums.years[premiums.years.length - 1];
  }).join("; ") + ".");
}


/* Page 1.14: two lines that count different things. Each line's first, lowest and latest value is
   labelled; hover for the other years, and for the years to read with care. */
function drawHomelessChildren(data) {
  var chart = data.charts.s1_14_homeless_children;
  var canvas = document.getElementById("chart-homeless");
  var colors = { nysed: WCA.colors.blue, hud: WCA.db.teal.full };

  WCA.legend("#legend-homeless", chart.series.map(function (s) { return { label: s.label, color: colors[s.key] }; }));

  var notes = [];
  chart.series.forEach(function (s, d) {
    var known = s.values.map(function (v, i) { return v === null ? null : i; }).filter(function (i) { return i !== null; });
    var first = known[0], latest = known[known.length - 1];
    var lowest = known.reduce(function (a, b) { return s.values[b] < s.values[a] ? b : a; });
    notes.push({ dataset: d, index: first, text: WCA.fmt.count(s.values[first]) });
    notes.push({ dataset: d, index: latest, text: WCA.fmt.count(s.values[latest]) });
    if (lowest !== first && lowest !== latest) notes.push({ dataset: d, index: lowest, text: WCA.fmt.count(s.values[lowest]), place: "below" });
  });

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: chart.series.map(function (s) { return lineSeries(s.label, s.values, colors[s.key]); }) },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 20, right: 12 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1) } },
        y: { beginAtZero: true, grace: "8%", ticks: { callback: WCA.fmt.count, maxTicksLimit: 6 } },
      },
      plugins: {
        pointNotes: { notes: notes },
        tooltip: { callbacks: {
          label: function (item) {
            var s = chart.series[item.datasetIndex], year = chart.years[item.dataIndex];
            var lines = [(s.key === "nysed" ? "NYSED, school year " + s.school_years[item.dataIndex] : "HUD, January " + year) +
                         ": " + WCA.fmt.count(item.parsed.y)];
            if (s.notes[year]) lines.push("(" + s.notes[year] + ")");
            return lines;
          },
        } },
      },
    },
    plugins: [WCA.plugins.pointNotes, hoverLine],
  });

  describe(canvas, chart.title + ". " + chart.series.map(function (s) {
    return s.label + ": " + chart.years.map(function (year, i) { return year + " " + WCA.fmt.count(s.values[i]); }).join(", ");
  }).join(". ") + ".");
}


/* Page 1.16: credit card debt per person, one bar a year. The first, the highest before the latest and
   the latest bar are labelled; the axis and hover carry the rest. */
function drawCreditCardDebt(data) {
  var chart = data.charts.s1_16_credit_card_debt;
  var canvas = document.getElementById("chart-credit-card");
  var end = chart.values.length - 1;

  new Chart(canvas, {
    type: "bar",
    data: { labels: chart.years, datasets: [{ label: "Credit card debt per person", data: chart.values, backgroundColor: WCA.colors.blue }] },
    options: {
      datasets: { bar: { barPercentage: 0.9, categoryPercentage: 0.8, maxBarThickness: 28 } },
      layout: { padding: { top: 20 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1) } },
        y: { beginAtZero: true, ticks: { callback: function (v) { return WCA.fmt.dollars(v); }, maxTicksLimit: 6 } },
      },
      plugins: {
        barNotes: { size: 12, text: function (d, i) { return (i === 0 || i === end) ? WCA.fmt.dollars(chart.values[i]) : null; } },
        tooltip: { callbacks: {
          title: function (items) { return "End of " + items[0].label; },
          label: function (item) { return WCA.fmt.dollars(item.parsed.y) + " per person"; },
        } },
      },
    },
    plugins: [barNotes],
  });

  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) { return year + ": " + WCA.fmt.dollars(chart.values[i]); }).join(", ") + ".");
}


/* --------------------------------------------------------------------------
   5. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* The page's own background color, for the thin gaps between touching marks (read from styles.css) */
var SURFACE = WCA.cssVar("--white");

/* Say in words what a chart shows, for people using a screen reader (a chart is a picture to them) */
function describe(element, text) {
  element.setAttribute("role", "img");
  element.setAttribute("aria-label", text);
}

/* One line on a Chart.js line chart, in the Bulletin's look: 3px line, dots with a thin white ring */
function lineSeries(label, values, color) {
  return {
    label: label, data: values, spanGaps: true,
    borderColor: color, backgroundColor: color, borderWidth: 3,
    pointBackgroundColor: color, pointBorderColor: SURFACE, pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 6,
  };
}

/* A striped fill for Chart.js: `color` with thin diagonal `stripe` lines over it (page 1.3's low-income piece) */
function hatch(color, stripe) {
  var sharp = window.devicePixelRatio || 1;                        /* draw at the screen's own sharpness */
  var size = 8 * sharp;
  var tile = document.createElement("canvas");
  tile.width = tile.height = size;
  var pen = tile.getContext("2d");
  pen.fillStyle = color;
  pen.fillRect(0, 0, size, size);
  pen.strokeStyle = stripe;
  pen.lineWidth = 2 * sharp;
  pen.beginPath();                                                   /* one stripe corner to corner, and its two halves, so tiles join up */
  pen.moveTo(0, size); pen.lineTo(size, 0);
  pen.moveTo(-size / 2, size / 2); pen.lineTo(size / 2, -size / 2);
  pen.moveTo(size / 2, size * 1.5); pen.lineTo(size * 1.5, size / 2);
  pen.stroke();
  var pattern = pen.createPattern(tile, "repeat");
  if (pattern.setTransform && window.DOMMatrix) pattern.setTransform(new DOMMatrix().scale(1 / sharp));
  return pattern;
}

/* White or dark text, whichever reads better on a fill color like "#7A9A36" */
function textOn(color) {
  var c = color.replace("#", "");
  var parts = [0, 2, 4].map(function (i) {
    var v = parseInt(c.substr(i, 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  var light = 0.2126 * parts[0] + 0.7152 * parts[1] + 0.0722 * parts[2];
  return (1.05 / (light + 0.05)) >= 4.5 ? SURFACE : WCA.colors.ink;   /* white only where it passes 4.5:1 */
}

/* Axis labels: 20 -> "20%", 60000 -> "60K", 250000 -> "$250K" */
function pctTick(value) { return value + "%"; }
function compactCount(value) { return value >= 1000 ? (value / 1000) + "K" : String(value); }
function compactDollars(value) { return "$" + compactCount(value); }

/* For a row of years along the bottom of a chart: label every `step`-th year, counted back from the
   LATEST year so that one always has its label, and fewer of them where the chart is too narrow.
     x: { ticks: { autoSkip: false, maxRotation: 0, callback: yearTicks(3) } } */
function yearTicks(step) {
  return function (value, index, ticks) {
    var every = step, room = this.maxWidth || 0;                         /* the pixels the axis has */
    while (room > 0 && every < ticks.length && room / (ticks.length / every) < 36) every += step;   /* a label needs about 36 */
    return (ticks.length - 1 - index) % every === 0 ? this.getLabelForValue(value) : null;
  };
}

/* 242,313 -> 250,000: a round number at or above x, for the top of a scale */
function niceCeiling(x) {
  var power = Math.pow(10, Math.floor(Math.log10(x)));
  var steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (var i = 0; i < steps.length; i++) if (steps[i] * power >= x) return steps[i] * power;
  return 10 * power;
}

/* "2022-06" -> "June 2022" */
function monthName(month) {
  var parts = month.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

/* Run fn again whenever the layout may have moved: the window changed size, or the web font arrived */
function whenLayoutChanges(fn) {
  var waiting = false;
  window.addEventListener("resize", function () {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(function () { waiting = false; fn(); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
}

/* Chart.js normally draws its hover box inside the chart, where a small chart cuts it off. Called once at
   start-up, this makes every chart show the page's own hover box instead (WCA.tooltip, the same box the
   HTML bars use), so the whole page has one hover box and nothing is cut off. */
function useHoverBox() {
  Chart.defaults.plugins.tooltip.enabled = false;
  Chart.defaults.plugins.tooltip.external = function (context) {
    var tip = context.tooltip;
    if (!tip || tip.opacity === 0) { WCA.tooltip.hide(); return; }
    var lines = [];
    (tip.title || []).forEach(function (line) { lines.push("<strong>" + plainText(line) + "</strong>"); });
    (tip.body || []).forEach(function (part) { part.lines.forEach(function (line) { lines.push(plainText(line)); }); });
    var canvas = context.chart.canvas.getBoundingClientRect();
    WCA.tooltip.show(lines.join("<br>"), canvas.left + tip.caretX, canvas.top + tip.caretY);
  };
}

/* Text made safe to put inside HTML (a label is data, and data is never trusted to be free of < or &) */
function plainText(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* Hover boxes for charts made of plain HTML: any element inside `box` that was given a .tip
   (a line of HTML) shows it in the page's hover box while the mouse is over it. */
function hoverTips(box) {
  box.addEventListener("mousemove", function (event) {
    var el = event.target;
    while (el && el !== box && !el.tip) el = el.parentNode;
    if (el && el.tip) WCA.tooltip.show(el.tip, event.clientX, event.clientY);
    else WCA.tooltip.hide();
  });
  box.addEventListener("mouseleave", WCA.tooltip.hide);
}

/* barNotes (a Chart.js add-on): write a short text above chosen bars. Unlike the template's valueLabels
   the text can depend on WHICH bar it is, so it can carry a mark ("22.3†") or label only some bars.
     plugins: { barNotes: { text: function (datasetIndex, index) { return "22.3"; } } }     null = no label
   `size` is the font size (13). With `narrow` (pixels) and `narrowText`, a chart narrower than that uses
   narrowText instead, to label fewer bars on a phone. */
var barNotes = {
  id: "barNotes",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.text) return;
    var write = (o.narrow && o.narrowText && chart.width < o.narrow) ? o.narrowText : o.text;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 " + (o.size || 13) + "px " + WCA.font;
    ctx.fillStyle = WCA.colors.ink;
    ctx.strokeStyle = SURFACE; ctx.lineWidth = 3; ctx.lineJoin = "round";
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    chart.data.datasets.forEach(function (dataset, d) {
      chart.getDatasetMeta(d).data.forEach(function (bar, i) {
        var text = write(d, i);
        if (text === null || text === undefined) return;
        var at = bar.getProps(["x", "y"], true);
        ctx.strokeText(text, at.x, at.y - 4);       /* a thin white edge, in case the text touches a neighbouring bar */
        ctx.fillText(text, at.x, at.y - 4);
      });
    });
    ctx.restore();
  },
};

/* seriesNamesInBars (a Chart.js add-on): write each bar's series name (the year) inside the foot of the
   bar, the Bulletin way, wherever the bar is wide and tall enough to hold it.
     plugins: { seriesNamesInBars: { on: true } } */
var seriesNamesInBars = {
  id: "seriesNamesInBars",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.on) return;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 12px " + WCA.font;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    chart.data.datasets.forEach(function (dataset, d) {
      var width = ctx.measureText(dataset.label).width;
      chart.getDatasetMeta(d).data.forEach(function (bar, i) {
        var at = bar.getProps(["x", "y", "base", "width"], true);
        if (at.width < width + 6 || at.base - at.y < 22) return;
        var fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
        ctx.fillStyle = textOn(fill);
        ctx.fillText(dataset.label, at.x, at.base - 4);
      });
    });
    ctx.restore();
  },
};

/* hoverLine (a Chart.js add-on): on a line chart, a thin vertical line at the point the mouse is nearest
   to, so the reader aims at a date and not at the line itself. Used with
   interaction: { mode: "index", intersect: false }. */
var hoverLine = {
  id: "hoverLine",
  afterDatasetsDraw: function (chart) {
    var active = chart.tooltip && chart.tooltip.getActiveElements ? chart.tooltip.getActiveElements() : [];
    if (!active.length) return;
    var x = active[0].element.x, area = chart.chartArea, ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = WCA.colors.muted;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, area.top); ctx.lineTo(x, area.bottom); ctx.stroke();
    ctx.restore();
  },
};

/* The options every horizontal bar chart shares: bars run left to right, the value axis
   shows percentages, room on the right for the value labels. `plugins` adds the chart's own. */
function horizontalBarOptions(plugins) {
  return {
    indexAxis: "y",
    datasets: { bar: { barPercentage: 0.7, categoryPercentage: 0.75 } },
    layout: { padding: { right: 48 } },
    scales: {
      x: { beginAtZero: true, grace: "10%", ticks: { callback: function (v) { return v + "%"; }, maxTicksLimit: 6 } },
      y: { grid: { display: false } },
    },
    plugins: plugins,
  };
}

/* Break text into lines of about `width` characters, at spaces */
function wrap(text, width) {
  var words = text.split(" "), lines = [], line = "";
  words.forEach(function (word) {
    if ((line + " " + word).trim().length > width && line) { lines.push(line); line = word; }
    else line = (line + " " + word).trim();
  });
  if (line) lines.push(line);
  return lines;
}

/* 23 -> 25, 7 -> 10, 2.4 -> 2.5 : a round number at or above x, for legend steps */
function roundStep(x) {
  var candidates = [1, 2, 2.5, 5, 10, 15, 20, 25, 30, 40, 50, 100];
  for (var i = 0; i < candidates.length; i++) if (candidates[i] >= x) return candidates[i];
  return Math.ceil(x / 100) * 100;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
