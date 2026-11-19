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
     5. Small helpers: tools the charts share, and more Chart.js add-ons (barNotes, pointWords,
        valuesInBars, lineNames, ringPointers, seriesNamesInBars, hoverLine)
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

/* Page 1.5: the Bulletin's line of children under 5 has three points and no more: the first year, the
   latest year and one year in between. The first and the latest come from data.json (so the latest moves
   on by itself when new data arrives); the year in between is named here, with the words written under
   the first point's number. */
var UNDER_5_MIDDLE_YEAR = 2016;
var UNDER_5_WORDS = "Children Under 5";

/* Page 1.8: the two charts open showing everything ("full"). To open them on one of the buttons instead,
   put that button's name here: "all" (All races), "married", "father" or "mother". */
var COMPOSITION_FIRST_VIEW = "full";
/* What a screen reader is told when a button changes the two charts ({type} is the words on the button) */
var COMPOSITION_STATUS = {
  full: "Both charts show every family type for every group.",
  all: "Both charts show all races together, as one tall bar each.",
  type: "Both charts show {type} only, with the groups ordered from the smallest share to the largest.",
};

/* Page 1.10: the words in and around each ring. They change with the year a reader picks, so they are
   written by the code and kept here, not in index.html. */
var RING_WORDS = {
  left: "Amount left to live on:",
  short: "Over budget each month:",                /* when rent and child care cost more than the income */
  rent: "Rent",                                    /* under each ring, joined to its part by a line: "Rent 13.7%" */
  care: "Child Care",
  standIn: "earliest available",                   /* added after the rent's month when the year has no January of its own ("January 2015, earliest available") */
  parts: ["Infant child care", "Rent", "Left to live on"],   /* the three parts of a ring, in drawing order (the hover box names them) */
};

/* Page 1.13: the names written in the food chart's last pair of bars and on the two premium lines (the
   Bulletin's own words; they stand in for a key). */
var FOOD_BAR_NAMES = { food: "Food Insecure Population", poverty: "Poverty Population" };
var PREMIUM_LINE_NAMES = { ny: "New York", us: "USA" };


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
    useChartLines();
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

   Three cards answer to buttons (1.8 the family types, 1.9 the two years,
   1.10 the year): the buttons change what is shown, never the numbers. Words
   that sit ON a chart (a line's name, a small callout) are HTML laid over
   the chart and put in place by the chart's function (1.14, 1.16).
   -------------------------------------------------------------------------- */


/* ---- CHAPTER 1 ---------------------------------------------------------- */

/* Page 1.3: a pie of all residents, drawn as plain SVG. Children and youth are the magenta slice, turned
   to the right so it faces the two boxed statements; the striped end of it is the share of them who are
   low income; everyone older is the blue slice. The words on the slices are in index.html and are put in
   place here. A thin line joins each boxed statement to the piece of the pie it is about. */
function drawPopulation(data) {
  var chart = data.charts.s1_3_population;
  var young = chart.children_and_youth, low = chart.low_income, older = chart.older_residents;
  var row = document.getElementById("pie-population");
  var pie = row.querySelector(".pie");

  /* Angles are in degrees, clockwise from 12 o'clock. The children and youth slice is centered a little
     above 3 o'clock, as in the Bulletin. "Low income" is a share OF children and youth, so it is the
     last part of their slice and not a slice of its own. */
  var sweep = young.share_pct / 100 * 360;
  var from = 80 - sweep / 2, to = from + sweep;
  var lowFrom = to - sweep * low.share_pct / 100;
  var HOLE = 31;                                                     /* the hole's radius; the pie's is 100 */

  /* A point `r` from the pie's center at `angle`, and the outline of the piece of pie between two angles */
  function point(angle, r) {
    var a = angle * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + " " + (-r * Math.cos(a)).toFixed(2);
  }
  function piece(a0, a1) {
    var large = a1 - a0 > 180 ? 1 : 0;
    return "M" + point(a0, 100) + "A100 100 0 " + large + " 1 " + point(a1, 100) +
           "L" + point(a1, HOLE) + "A" + HOLE + " " + HOLE + " 0 " + large + " 0 " + point(a0, HOLE) + "Z";
  }

  pie.insertAdjacentHTML("afterbegin",
    '<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">' +
    '<defs><pattern id="pie-stripes" width="4.6" height="4.6" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">' +
    '<rect width="1.1" height="4.6" fill="' + SURFACE + '"/></pattern></defs>' +
    '<path class="pie-slice older" d="' + piece(to, from + 360) + '"/>' +
    '<path class="pie-slice young" d="' + piece(from, to) + '"/>' +
    '<path class="pie-slice low" d="' + piece(lowFrom, to) + '" fill="url(#pie-stripes)"/></svg>');

  /* What the hover box says for each piece */
  pie.querySelector(".young").tip = "<strong>" + plainText(young.label) + "</strong><br>" +
    WCA.fmt.pct(young.share_pct) + " of all residents<br>" + WCA.fmt.count(young.people) + " people";
  pie.querySelector(".low").tip = "<strong>" + plainText(low.label) + "</strong><br>" +
    WCA.fmt.pct(low.share_pct) + " of children and youth<br>" +
    WCA.fmt.count(low.people) + " of the " + WCA.fmt.count(low.of) + " whose income was measured<br>" + plainText(capitalize(low.means));
  pie.querySelector(".older").tip = "<strong>" + plainText(older.label) + "</strong><br>" +
    WCA.fmt.pct(older.share_pct) + " of all residents<br>" + WCA.fmt.count(older.people) + " people";
  hoverTips(pie);

  /* The words on the slices, both at one height above the hole: on the plain (not striped) part of the
     children and youth slice, and across from it on the older residents' slice */
  function label(name, angle, r) {
    var a = angle * Math.PI / 180, words = pie.querySelector('.pie-label[data-slice="' + name + '"]');
    words.style.left = (50 + r * Math.sin(a) / 2) + "%";
    words.style.top = (50 - r * Math.cos(a) / 2) + "%";
  }
  label("young", Math.min(Math.max(55, from + 24), lowFrom - 24), 68);
  label("older", 312, 59);

  /* A line from each boxed statement to its piece of the pie. It leaves the pie's edge as near the middle
     of the box as that piece reaches, and runs level whenever the box reaches that height too. When the
     boxes have dropped under the pie (a narrow screen) there are no lines: "stacked" shows color keys. */
  var pieces = { young: [from, lowFrom], low: [lowFrom, to] };
  var lines = row.querySelector(".pie-lines");
  function joinBoxes() {
    var frame = row.getBoundingClientRect(), disc = pie.getBoundingClientRect();
    var beside = disc.width > 0 && row.querySelector(".pie-notes").getBoundingClientRect().left >= disc.right;
    row.classList.toggle("stacked", !beside);
    var html = "";
    if (beside) {
      var cx = disc.left - frame.left + disc.width / 2, cy = disc.top - frame.top + disc.height / 2, R = disc.width / 2;
      row.querySelectorAll(".note-box[data-slice]").forEach(function (box) {
        var span = pieces[box.getAttribute("data-slice")], b = box.getBoundingClientRect();
        var top = b.top - frame.top, bottom = b.bottom - frame.top;
        var inset = Math.min(4, (span[1] - span[0]) / 4);                /* stay a little inside the piece */
        function edgeHeight(angle) { return cy - R * Math.cos(angle * Math.PI / 180); }
        var y1 = Math.min(Math.max((top + bottom) / 2, edgeHeight(span[0] + inset)), edgeHeight(span[1] - inset));
        var x1 = cx + Math.sqrt(Math.max(R * R - (y1 - cy) * (y1 - cy), 0)) - 1;
        var y2 = Math.min(Math.max(y1, top + 10), bottom - 10);
        html += '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + (b.left - frame.left).toFixed(1) + '" y2="' + y2.toFixed(1) + '"/>';
      });
    }
    lines.innerHTML = html;
  }
  joinBoxes();
  whenLayoutChanges(joinBoxes, row);

  describe(pie, chart.title + ". " + young.label + ": " + WCA.fmt.count(young.people) + ", " + WCA.fmt.pct(young.share_pct) +
    " of " + WCA.fmt.count(chart.residents) + " residents. Of them, " + WCA.fmt.pct(low.share_pct) + " are low income.");
}


/* Page 1.4: each group's share of residents ages 0 to 24, the earlier year (lighter) beside the latest (full color). */
function drawRaceEthnicity(data) {
  var chart = data.charts.s1_4_race_ethnicity;
  var race = WCA.db.race;
  var canvas = document.getElementById("chart-race");
  var last = chart.years.length - 1;
  var highest = Math.max.apply(null, chart.groups.map(function (g) { return Math.max.apply(null, g.shares); }));

  /* No key on this chart: each bar has its year printed in its foot (seriesNamesInBars, below) */
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
      datasets: { bar: { barPercentage: 0.94, categoryPercentage: 0.74, maxBarThickness: 50 } },
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


/* Page 1.5: rows of baby figures for the first and the latest year of births, and the Bulletin's line of
   children under 5. (The two circles with their arrows are text in index.html.) */
function drawBirthsAndYoungChildren(data) {
  var chart = data.charts.s1_5_births_and_young_children;
  var births = chart.births, children = chart.under_5;

  /* The picture rows: one figure for every `per_figure` births, the last one counting part of the way
     (11,517 births = 11 whole figures and about half of a twelfth). The year with fewer births has the
     shorter row, as in the Bulletin. */
  var counts = births.values.map(function (value) { return Math.ceil(value / births.per_figure); });
  var html = "";
  births.years.forEach(function (year, i) {
    var worth = births.values[i] / births.per_figure;               /* 11,517 births = 11.517 figures */
    html += '<div class="picto-row"><div><span class="picto-year">' + year + '</span>' +
            '<span class="picto-value">' + WCA.fmt.count(births.values[i]) + '</span></div><div class="picto-figures">';
    for (var k = 0; k < counts[i]; k++) {
      var filled = Math.max(0, Math.min(1, worth - k));              /* this figure counts fully or partly */
      html += '<span class="picto-figure" style="--filled:' + Math.round(filled * 100) + '%"></span>';
    }
    html += "</div></div>";
  });
  var picture = document.getElementById("pictogram-births");
  picture.style.setProperty("--count", Math.max.apply(null, counts));   /* every row is ruled for the longest one */
  picture.innerHTML = html;
  describe(picture, "Babies born to Westchester residents: " + births.years.map(function (year, i) {
    return WCA.fmt.count(births.values[i]) + " in " + year;
  }).join(", ") + ".");

  /* The line, as the Bulletin draws it: three points (the first year, UNDER_5_MIDDLE_YEAR in Settings, and
     the latest year), each with its number written above it, on a scale that starts one step below the
     lowest of them and ends one step above the highest (45,000 to 65,000). The years sit where they fall
     in time, so the two stretches of the line are as long as the years between their points. */
  var canvas = document.getElementById("chart-under-5");
  var points = [];
  children.years.forEach(function (year, i) {
    var wanted = i === 0 || i === children.years.length - 1 || year === UNDER_5_MIDDLE_YEAR;
    if (wanted && children.values[i] !== null) points.push({ x: year, y: children.values[i] });
  });
  var years = points.map(function (p) { return p.x; }), values = points.map(function (p) { return p.y; });
  var STEP = 5000;
  var low = Math.floor(Math.min.apply(null, values) / STEP) * STEP - STEP;
  var high = Math.ceil(Math.max.apply(null, values) / STEP) * STEP + STEP;
  var span = years[years.length - 1] - years[0];
  var color = WCA.cssVar("--db-under-5");                             /* the color of this chart's circle */

  var series = lineSeries(UNDER_5_WORDS, points, color);
  series.borderWidth = 4;
  series.pointRadius = 6;
  series.pointHoverRadius = 7;

  new Chart(canvas, {
    type: "line",
    data: { datasets: [series] },
    options: {
      interaction: { mode: "nearest", axis: "x", intersect: false },
      layout: { padding: { top: 4, right: 6 } },
      scales: {
        x: { type: "linear", min: years[0] - span * 0.1, max: years[years.length - 1] + span * 0.07,
             grid: { display: false },
             afterBuildTicks: function (axis) { axis.ticks = years.map(function (year) { return { value: year }; }); },
             ticks: { maxRotation: 0, autoSkip: false, font: { size: 14 }, callback: function (value) { return String(value); } } },
        y: { min: low, max: high, ticks: { stepSize: STEP, font: { size: 14 }, callback: function (value) { return WCA.fmt.count(value); } } },
      },
      plugins: {
        /* the first point carries the words as well ("59,333 Children Under 5"), the others their number */
        pointWords: { size: 14, notes: points.map(function (p, i) {
          return { index: i, lines: [WCA.fmt.count(p.y)].concat(i === 0 ? wrap(UNDER_5_WORDS, 9) : []) };
        }) },
        tooltip: { callbacks: {
          title: function (items) { return UNDER_5_WORDS + ", " + items[0].parsed.x; },
          label: function (item) { return WCA.fmt.count(item.parsed.y); },
        } },
      },
    },
    plugins: [pointWords, hoverLine],
  });
  describe(canvas, "Children under 5 in Westchester County: " + points.map(function (p) {
    return WCA.fmt.count(p.y) + " in " + p.x;
  }).join(", ") + ".");
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

  chart.families.forEach(function (family, f) {
    var plot = box.querySelector('.fb-row[data-family="' + family.key + '"] .fb-plot');
    var steps = WCA.db.family[family.key].steps;                    /* lighter for earlier years, full color for the latest */
    var html = "";
    family.values.forEach(function (value, y) {
      /* The years are printed in the first family's bars only, as in the Bulletin: every family's bars
         are in the same order, lightest to full color. (Hovering over any bar names its year.) */
      html += '<div class="fb-bar' + (y === last ? " latest" : "") + '" style="width:' + place(value) + ";background:" + steps[y] + '">' +
              (f === 0 ? '<span class="fb-year">' + chart.years[y] + '</span>' : "") +
              '<span class="fb-value">' + WCA.fmt.dollars(value) + "</span></div>";
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

  /* The scale under the bars: six amounts from $0 to the top, and a gray line up from each of them */
  var axis = "", lines = "";
  for (var step = 0; step <= 5; step++) {
    axis += '<span style="left:' + (step * 20) + '%">' + WCA.fmt.dollars(top / 5 * step) + "</span>";
    lines += '<span style="left:' + (step * 20) + '%"></span>';
  }
  box.querySelector(".fb-axis").innerHTML = axis;
  box.querySelector(".fb-grid").innerHTML = lines;

  /* Every amount is written inside the end of its bar. Two things give way on a narrow screen, and are
     checked again whenever the window changes size: a bar too short for its year and its amount drops
     the year, and a bar shorter than the amount itself has it just past its end. */
  function placeValues() {
    box.querySelectorAll(".fb-bar").forEach(function (bar) {
      bar.classList.remove("value-outside", "no-year");
      var year = bar.querySelector(".fb-year"), value = bar.querySelector(".fb-value");
      var width = bar.clientWidth;
      if (year && width < year.offsetWidth + value.offsetWidth + 10) bar.classList.add("no-year");
      if (width < value.offsetWidth + 2) bar.classList.add("value-outside");
    });
  }
  placeValues();
  whenLayoutChanges(placeValues, box);
  hoverTips(box);

  describe(box, chart.title + ". " + chart.families.map(function (family) {
    return family.label + ": " + family.values.map(function (value, y) { return WCA.fmt.dollars(value) + " in " + chart.years[y]; }).join(", ");
  }).join("; ") + ". ALICE Household Survival Budgets: " + chart.budgets.map(function (b) { return WCA.fmt.dollars(b.amount); }).join(" and ") + ".");
}


/* Page 1.8: two sets of split bars. Each bar is one group's families with children, split into
   married-couple, single-father and single-mother families (100% together). The first set is families at
   or above the poverty level, the second families below it. A group marked * uses 5-year estimates.

   The key above the charts is a row of buttons, and each button is a way of looking at the same bars:
     nothing pressed    every group's bar, split into its three parts (how the charts open)
     All races          each chart folds into its "All races" bar alone, drawn tall
     a family type      only that type's part of every bar, lined up on the left, with the groups put in
                        order from the smallest share to the largest (each chart in its own order)
   Pressing the button that is already pressed brings everything back. Nothing is redrawn when a button
   is pressed: the code only sets each part's width and each row's place, and styles.css slides them
   there. A change that has two moves starts them a moment apart (the parts begin to fold, then the rows
   begin to change places), so that the eye can follow it. */
function drawFamilyComposition(data) {
  var chart = data.charts.s1_8_family_composition;
  var types = chart.family_types.map(function (type) { return type.key; });
  var switcher = document.getElementById("composition-views");
  var buttons = Array.prototype.slice.call(switcher.querySelectorAll("button[data-view]"));
  var status = document.getElementById("composition-status");
  var STEP_MS = 320;                                                 /* how long after a change's first move its second one starts. A move takes --move
                                                                        in styles.css (0.6 seconds), so the second begins while the first is finishing
                                                                        and the two read as one change. */

  /* The words on each button, as index.html has them ("Married Couples"); they are also written in the tall bar */
  var words = {};
  buttons.forEach(function (button) { words[button.getAttribute("data-view")] = button.textContent.trim(); });

  /* Build one chart: a row per group, each with its three parts (and a place for a share that has to be
     printed past the end of a short bar) */
  function panel(id, part, description) {
    var box = document.getElementById(id);
    var html = "", spoken = [];
    chart.order.forEach(function (key) {
      var group = chart.groups[key];
      var name = group.label + (group.release === "5-year" ? "*" : "");
      /* The three shares can come to 99.9 or 100.1 once each is rounded. A part's width is its share of
         their sum, so every bar is exactly full. */
      var sum = types.reduce(function (total, type) { return total + group[part][type].share; }, 0);
      html += '<div class="sb-row' + (key === "all" ? " apart" : "") + '" data-group="' + key + '"><div class="sb-label">' + plainText(name) + '</div><div class="sb-bar">';
      types.forEach(function (type) {
        var width = (group[part][type].share / sum * 100).toFixed(3);
        html += '<div class="sb-part ' + type + '" data-group="' + key + '" data-type="' + type + '" data-width="' + width + '" style="width:' + width + '%">' +
                '<span class="sb-value">' + WCA.fmt.pct(group[part][type].share) + '</span>' +
                '<span class="sb-name">' + plainText(words[type] || "") + "</span></div>";
      });
      html += '<span class="sb-out"></span></div></div>';
      spoken.push(name + ": " + chart.family_types.map(function (type) { return type.label + " " + WCA.fmt.pct(group[part][type.key].share); }).join(", "));
    });
    box.innerHTML = html;
    box.querySelectorAll(".sb-part").forEach(function (el) {
      var group = chart.groups[el.getAttribute("data-group")], type = el.getAttribute("data-type");
      var piece = group[part][type];
      var label = chart.family_types.filter(function (t) { return t.key === type; })[0].label;
      el.tip = "<strong>" + plainText(group.label + " · " + label) + "</strong><br>" +
               WCA.fmt.pct(piece.share) + " of families with children " + description +
               (piece.margin === null ? "" : " (± " + piece.margin.toFixed(1) + " points)") + "<br>" +
               WCA.fmt.count(piece.families) + " of " + WCA.fmt.count(group[part].families) + " families · " +
               plainText(group.period) + (group.release === "5-year" ? " five-year estimate" : " one-year estimate");
    });
    hoverTips(box);
    describe(box, "Families with children " + description + ", by family type. " + spoken.join("; ") + ".");
    return { box: box, part: part };
  }

  var panels = [panel("chart-composition-above", "at_or_above", "at or above the poverty level"),
                panel("chart-composition-below", "below", "below the poverty level")];

  /* The * note is shown only when a group really uses 5-year estimates */
  document.getElementById("note-composition-five-year").hidden = !chart.five_year_period;

  /* What the two charts show at this moment:
       type    the one family type on show (null: all three parts)
       sorted  the family type the groups are ordered by (null: the Bulletin's order)
       tall    true when "All races" stands alone as a tall bar */
  var state = { type: null, sorted: null, tall: false };
  var view = "full";                                                 /* the button pressed in: "full" when none is */
  var timer = null;

  /* Put the page in step with `state` */
  function render() {
    panels.forEach(function (p) {
      p.box.classList.toggle("view-all", state.tall);
      /* the rows' order: "All races" stays first; the groups follow, smallest share first when one type is on show */
      var keys = chart.order.filter(function (key) { return key !== "all"; });
      if (state.sorted) keys.sort(function (a, b) {
        return chart.groups[a][p.part][state.sorted].share - chart.groups[b][p.part][state.sorted].share;
      });
      keys.forEach(function (key, i) {
        p.box.querySelector('.sb-row[data-group="' + key + '"]').style.setProperty("--slot", i + 1);
      });
      /* each part is as wide as its share, or folded away when another type is on show alone */
      p.box.querySelectorAll(".sb-part").forEach(function (el) {
        var shown = !state.type || el.getAttribute("data-type") === state.type;
        el.style.width = shown ? el.getAttribute("data-width") + "%" : "0%";
        el.classList.toggle("gone", !shown);
      });
    });
    fitLabels();
  }

  /* A share is printed on its part only where it fits. In a bar that shows one type alone, a share too
     wide for its bar is printed just past the bar's end. In the tall bar the numbers are larger, and a
     part with room for it carries its name as well. Worked out from the widths the parts are going to
     have (not the ones they have while they are still sliding), and again when the window changes size. */
  function fitLabels() {
    panels.forEach(function (p) {
      p.box.querySelectorAll(".sb-row").forEach(function (row) {
        var track = row.querySelector(".sb-bar").clientWidth;
        var tall = state.tall && row.classList.contains("apart");
        var past = row.querySelector(".sb-out"), pastText = null, pastAt = null;
        row.querySelectorAll(".sb-part").forEach(function (el) {
          var type = el.getAttribute("data-type"), text = el.querySelector(".sb-value").textContent;
          var width = track * Number(el.getAttribute("data-width")) / 100;
          el.classList.remove("no-value", "small-value", "with-name");
          if (tall) {
            if (width < textWidth(text, "600 22px") + 24) el.classList.add(width < textWidth(text, "600 13px") + 9 ? "no-value" : "small-value");
            else if (width >= textWidth(words[type] || "", "600 13px") + 24) el.classList.add("with-name");
          } else if (width < textWidth(text, "600 12px") + 9) {
            el.classList.add("no-value");
            if (state.type === type) { pastText = text; pastAt = el.getAttribute("data-width") + "%"; }
          }
        });
        /* the share past a short bar's end: taken away at once, then faded in at its new place */
        if (past.textContent !== (pastText || "") || past.style.left !== (pastAt || "")) {
          past.style.transition = "none"; past.classList.remove("on"); void past.offsetWidth; past.style.transition = "";
          past.textContent = pastText || ""; past.style.left = pastAt || "";
        }
        past.classList.toggle("on", pastText !== null);
      });
    });
  }

  /* Change some of `state`; says whether anything really changed */
  function change(to) {
    var moved = false;
    Object.keys(to).forEach(function (key) { if (state[key] !== to[key]) { state[key] = to[key]; moved = true; } });
    if (moved) render();
    return moved;
  }

  /* Go to a view: "full", "all" or a family type. `atOnce` skips the sliding (used when the page opens). */
  function show(next, atOnce) {
    clearTimeout(timer);
    var first, second;
    if (next === "all")       { first = { type: null, sorted: null }; second = { tall: true }; }       /* everything comes back, then folds into the tall bar */
    else if (next === "full") { first = { tall: false, sorted: null }; second = { type: null }; }      /* the rows go back to their order, then the parts unfold */
    else                      { first = { tall: false, type: next };  second = { sorted: next }; }     /* the other parts fold away, then the rows change places */
    if (change(first) && !atOnce && !STILL) timer = setTimeout(function () { change(second); }, STEP_MS);
    else change(second);

    view = next;
    buttons.forEach(function (button) { button.setAttribute("aria-pressed", button.getAttribute("data-view") === view ? "true" : "false"); });
    status.textContent = (COMPOSITION_STATUS[view] || COMPOSITION_STATUS.type).replace("{type}", words[view] || "");
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      var wanted = button.getAttribute("data-view");
      show(wanted === view ? "full" : wanted);                         /* the pressed button, pressed again, lets go */
    });
  });

  render();
  if (COMPOSITION_FIRST_VIEW !== "full" && words[COMPOSITION_FIRST_VIEW]) show(COMPOSITION_FIRST_VIEW, true);
  status.textContent = "";                                             /* nothing to announce until a button is pressed */
  whenLayoutChanges(fitLabels, panels[0].box);
}


/* Page 1.9: six small charts, one per group, all on the same scale so they can be compared.
   In each: three age groups, the earlier year (lighter) beside the latest (full color, value printed).
   A dagger marks a value the warehouse flags as unreliable.
   The key is two buttons, one per year. Pressing one, or clicking any bar of that year, shows that year
   alone in all six charts, with its values printed; doing the same again brings both years back. */
function drawPovertyByRace(data) {
  var chart = data.charts.s1_9_poverty_by_race;
  var box = document.getElementById("chart-poverty-panels");
  var last = chart.years.length - 1;
  var top = roundStep(chart.highest_rate);                           /* 26.2 -> 30, the top of every panel */
  var someUnreliable = false;
  var panels = [];                                                   /* the six charts, so that a button can change them all */
  var only = null;                                                   /* the one year on show (its place in chart.years); null = both */

  /* The key, as buttons. The swatches are gray (the "All races" chart's own colors) so they stand for every group. */
  var switcher = document.getElementById("poverty-years");
  var buttons = chart.years.map(function (year, y) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "view-button";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<span class="swatch" style="background:' + WCA.db.race.all.steps[y] + '"></span>';
    button.appendChild(document.createTextNode(year + (y === last ? " (full color)" : " (lighter)")));
    button.addEventListener("click", function () { showYear(y); });
    switcher.appendChild(button);
    return button;
  });

  /* Show one year alone (y is its place in chart.years); the year already on show alone goes back to both */
  function showYear(y) {
    only = (only === y) ? null : y;
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === only ? "true" : "false"); });
    panels.forEach(function (panel) {
      if (!STILL) panel.options.animation = { duration: 450 };       /* this change is allowed to move, so the eye can follow it */
      chart.years.forEach(function (year, i) { panel.setDatasetVisibility(i, only === null || i === only); });
      panel.update();
    });
  }

  chart.order.forEach(function (key) {
    var group = chart.groups[key];
    var steps = WCA.db.race[key].steps;
    var panel = document.createElement("div");
    panel.className = "sm-panel";
    panel.innerHTML = '<h4></h4><div class="chart-box"><canvas></canvas></div>';
    panel.querySelector("h4").textContent = group.label;
    box.appendChild(panel);
    var canvas = panel.querySelector("canvas");

    panels.push(new Chart(canvas, {
      type: "bar",
      data: {
        labels: chart.ages,
        datasets: chart.years.map(function (year, y) {
          return { label: String(year), data: group.rates.map(function (pair) { return pair[y]; }), backgroundColor: steps[y] };
        }),
      },
      options: {
        datasets: { bar: { barPercentage: 0.9, categoryPercentage: 0.72, maxBarThickness: 26 } },
        layout: { padding: { top: 16 } },
        /* a click on a bar is the same as pressing its year's button; the hand cursor says a bar can be clicked */
        onClick: function (event, bars) { if (bars.length) showYear(bars[0].datasetIndex); },
        onHover: function (event, bars) { event.native.target.style.cursor = bars.length ? "pointer" : "default"; },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 12 }, maxRotation: 0, autoSkip: false,
               /* "Under 18" becomes two lines where the panel is narrow (a phone) */
               callback: function (value) { var age = this.getLabelForValue(value); return this.chart.width < 190 ? wrap(age, 6) : age; } } },
          y: { beginAtZero: true, max: top, ticks: { callback: pctTick, stepSize: 10, font: { size: 12 } } },
        },
        plugins: {
          /* the latest year's values while both years show; the chosen year's when it shows alone */
          barNotes: { size: 12, text: function (d, i) {
            var rate = group.rates[i][d];
            if (d !== (only === null ? last : only) || rate === null) return null;
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
    }));

    group.unreliable.forEach(function (pair) { if (pair.indexOf(true) >= 0) someUnreliable = true; });
    describe(canvas, group.label + ", poverty rate. " + chart.ages.map(function (age, i) {
      return age + ": " + chart.years.map(function (year, y) { return WCA.fmt.pct(group.rates[i][y]) + " in " + year; }).join(", ");
    }).join("; ") + ".");
  });

  /* The notes under the panels show only when they apply */
  document.getElementById("note-poverty-unreliable").hidden = !someUnreliable;
  document.getElementById("note-poverty-five-year").hidden = !chart.five_year_used;
}


/* Page 1.10: three rings, one per family type. Each ring is a month of median income: the part that goes
   to infant child care, the part that goes to rent, and what is left. The costs sit at the bottom of the
   ring, what is left on top; under the ring, each cost's share is written and joined to its part by a line.
   The year buttons are in the yellow panel on the left, with that year's rent and infant child care; every
   number in the panel and in, above and under the rings changes with the year. */
function drawRentAndChildCare(data) {
  var chart = data.charts.s1_10_rent_and_child_care;
  var box = document.getElementById("chart-rent");
  var colors = { care: WCA.colors.blue, rent: WCA.db.teal.full, left: WCA.db.remainder };
  var rings = {};

  chart.families.forEach(function (family) {
    var cell = box.querySelector('.donut-cell[data-family="' + family.key + '"]');
    var room = parseFloat(getComputedStyle(cell.querySelector(".donut-box")).getPropertyValue("--labels")) || 52;   /* the height kept under the ring (styles.css) */
    rings[family.key] = new Chart(cell.querySelector("canvas"), {
      type: "doughnut",
      data: {
        labels: RING_WORDS.parts,
        datasets: [{ data: [0, 0, 1], backgroundColor: [colors.care, colors.rent, colors.left],
                     borderColor: SURFACE, borderWidth: 2, hoverBorderColor: SURFACE, hoverOffset: 0 }],
      },
      options: {
        cutout: "66%",
        layout: { padding: { bottom: room } },
        plugins: {
          ringPointers: { parts: [] },                               /* filled in for the year on show, below */
          tooltip: { callbacks: {
            title: function () { return family.label; },
            label: function (item) { return item.label + ": " + WCA.fmt.dollars(item.raw) + " a month"; },
          } },
        },
      },
      plugins: [ringPointers],
    });
  });

  /* Show one year (y is its position in chart.years). `moving` lets the rings turn to their new shape
     instead of jumping there (not when the page first draws them). */
  function show(y, moving) {
    var rent = chart.rent[y], care = chart.infant_care[y];
    chart.families.forEach(function (family) {
      var cell = box.querySelector('.donut-cell[data-family="' + family.key + '"]');
      var ring = rings[family.key];
      var left = family.left[y];                                     /* below zero: rent and care cost more than the income */
      var over = left < 0;

      ring.data.datasets[0].data = [care, rent.value, Math.max(left, 0)];
      /* turn the ring so the two costs are centered at the bottom: child care to the right, rent to the left */
      var costs = (care + rent.value) / (care + rent.value + Math.max(left, 0));
      ring.options.rotation = 180 - costs * 180;
      ring.options.plugins.ringPointers.parts = [
        { index: 1, side: "left",  lines: [RING_WORDS.rent, WCA.fmt.pct(family.rent_share_pct[y])] },
        { index: 0, side: "right", lines: [RING_WORDS.care, WCA.fmt.pct(family.care_share_pct[y])] },
      ];
      if (moving && !STILL) ring.options.animation = { duration: 500 };
      ring.update();

      cell.querySelector(".js-income").textContent = WCA.fmt.dollars(family.income_monthly[y]);
      cell.querySelector(".js-left-words").textContent = over ? RING_WORDS.short : RING_WORDS.left;
      cell.querySelector(".js-left").textContent = (over ? "−" : "") + WCA.fmt.dollars(Math.abs(left));
      cell.querySelector(".donut-center").classList.toggle("short", over);
      describe(ring.canvas, family.label + ", " + chart.years[y] + ": median monthly income " + WCA.fmt.dollars(family.income_monthly[y]) +
        "; rent " + WCA.fmt.pct(family.rent_share_pct[y]) + " of it, infant child care " + WCA.fmt.pct(family.care_share_pct[y]) +
        "; " + (over ? "short by " : "left to live on ") + WCA.fmt.dollars(Math.abs(left)) + ".");
    });

    /* The yellow panel: that year's rent (with the month it really is) and infant child care */
    box.querySelector(".js-rent").textContent = WCA.fmt.dollars(rent.value);
    box.querySelector(".js-rent-month").textContent = rent.label + (rent.is_that_january ? "" : ", " + RING_WORDS.standIn);
    box.querySelector(".js-care").textContent = WCA.fmt.dollars(care);

    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
  }

  /* One button per year; the latest year shows first */
  var switcher = document.getElementById("rent-years");
  var buttons = chart.years.map(function (year, y) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = year;
    button.addEventListener("click", function () { show(y, true); });
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
    { index: chart.months.indexOf(chart.low.month), lines: [WCA.fmt.pct(chart.low.value)], place: "below" },
    { index: chart.months.indexOf(chart.peak.month), lines: [WCA.fmt.pct(chart.peak.value)] },
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
             grid: { color: function (context) { return context.tick && context.tick.value === 0 ? WCA.colors.muted : GRID; } } },
      },
      plugins: {
        pointWords: { size: 12, weight: "600", notes: notes },        /* on a white patch, so the chart's gray lines don't run through the numbers */
        tooltip: { callbacks: {
          title: function (items) { return monthName(chart.months[items[0].dataIndex]); },
          label: function (item) { return WCA.fmt.pct(item.parsed.y) + " higher than a year earlier"; },
        } },
      },
    },
    plugins: [pointWords, hoverLine],
  });

  describe(canvas, chart.title + ", " + chart.first.label + " to " + chart.latest.label + ". Lowest " + WCA.fmt.pct(chart.low.value) +
    " in " + chart.low.label + ", highest " + WCA.fmt.pct(chart.peak.value) + " in " + chart.peak.label +
    ", latest " + WCA.fmt.pct(chart.latest.value) + " in " + chart.latest.label + ".");
}


/* Page 1.13: three charts in one card. */
function drawSignsOfDistress(data) {
  var chart = data.charts.s1_13_signs_of_distress;
  var food = chart.food, snap = chart.snap, premiums = chart.premiums;

  /* a. Food insecurity and poverty in each community: two thick bars per place, in the Bulletin's purple
        and orange, each with its value inside its end. The two names are written in the last place's bars
        instead of a key; where the chart is too narrow for that, the key above the chart shows instead. */
  var foodSeries = [
    { label: FOOD_BAR_NAMES.food, color: WCA.cssVar("--db-food-insecure"), values: food.food_insecure_pct },
    { label: FOOD_BAR_NAMES.poverty, color: WCA.cssVar("--db-poverty"), values: food.poverty_pct },
  ];
  var foodKey = document.getElementById("legend-food");
  WCA.legend(foodKey, foodSeries);
  var foodCanvas = document.getElementById("chart-food");
  var highest = Math.max.apply(null, food.food_insecure_pct.concat(food.poverty_pct));
  new Chart(foodCanvas, {
    type: "bar",
    data: {
      /* a long name goes on two lines, also at its hyphen ("Croton-" over "Harmon"), which leaves the bars more room */
      labels: food.places.map(function (place) {
        return wrap(place.replace(/-/g, "- "), 9).map(function (line) { return line.replace(/- /g, "-"); });
      }),
      datasets: foodSeries.map(function (s) { return { label: s.label, data: s.values, backgroundColor: s.color }; }),
    },
    options: {
      indexAxis: "y",
      datasets: { bar: { barPercentage: 0.96, categoryPercentage: 0.84, borderRadius: 3 } },
      layout: { padding: { right: 4 } },
      scales: {
        /* the scale ends just past the longest bar, with a line every 4%, as in the Bulletin */
        x: { beginAtZero: true, max: Math.ceil(highest * 1.03 * 2) / 2, ticks: { stepSize: 4, includeBounds: false, callback: pctTick } },
        y: { grid: { display: false }, ticks: { color: WCA.colors.ink, font: { size: 13, weight: "600" } } },
      },
      plugins: {
        valuesInBars: { format: WCA.fmt.pct, names: true, onNames: function (fit) { if (foodKey.hidden !== fit) foodKey.hidden = fit; } },
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
    plugins: [valuesInBars],
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
        y: { beginAtZero: true, grace: "12%", ticks: { callback: compactCount, maxTicksLimit: 6 } },
      },
      plugins: {
        pointWords: { size: 12, weight: "600", notes: [{ index: 0, lines: [WCA.fmt.count(snap.values[0])] }, { index: snapEnd, lines: [WCA.fmt.count(snap.values[snapEnd])] }] },
        tooltip: { callbacks: {
          title: function (items) { return "July " + items[0].label; },
          label: function (item) { return WCA.fmt.count(item.parsed.y) + " people receiving SNAP"; },
        } },
      },
    },
    plugins: [pointWords, hoverLine],
  });
  describe(snapCanvas, "SNAP recipients in Westchester each July: " + WCA.fmt.count(snap.first.value) + " in " + snap.first.year +
    ", a high of " + WCA.fmt.count(snap.peak.value) + " in " + snap.peak.year + ", " + WCA.fmt.count(snap.last.value) + " in " + snap.last.year + ".");

  /* c. The benchmark premium: New York State in the Bulletin's magenta, the United States in its blue.
        Each line carries its name near its end (and its latest value past its end), so there is no key. */
  var premiumColors = { ny: WCA.cssVar("--db-premium-ny"), us: WCA.cssVar("--db-premium-us") };
  var premiumCanvas = document.getElementById("chart-premiums");
  var premiumEnd = premiums.years.length - 1;
  new Chart(premiumCanvas, {
    type: "line",
    data: {
      labels: premiums.years,
      datasets: premiums.series.map(function (s) {
        var line = lineSeries(s.label, s.values, premiumColors[s.key]);
        line.borderWidth = 4;
        line.pointRadius = 0;                                        /* a plain thick line, as in the Bulletin; a dot appears under the mouse */
        line.pointHoverRadius = 5;
        return line;
      }),
    },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 50 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(3) } },
        y: { beginAtZero: true, ticks: { callback: function (v) { return WCA.fmt.dollars(v); }, maxTicksLimit: 6 } },
      },
      plugins: {
        endLabels: { last: true, format: WCA.fmt.dollars },
        lineNames: { names: premiums.series.map(function (s) { return PREMIUM_LINE_NAMES[s.key] || s.label; }), size: 15 },
        tooltip: { callbacks: { label: function (item) { return item.dataset.label + ": " + WCA.fmt.dollars(item.parsed.y) + " a month"; } } },
      },
    },
    plugins: [WCA.plugins.endLabels, lineNames, hoverLine],
  });
  describe(premiumCanvas, "Monthly benchmark premium. " + premiums.series.map(function (s) {
    return s.label + ": " + WCA.fmt.dollars(s.values[0]) + " in " + premiums.years[0] + ", " +
           WCA.fmt.dollars(s.values[premiumEnd]) + " in " + premiums.years[premiumEnd];
  }).join("; ") + ".");
}


/* Page 1.14: two lines that count different things. Each line carries its full name, written just above
   it at the left (the words are in index.html), so there is no key. Each line's first, lowest and latest
   value is labelled; hover for the other years, and for the years to read with care. The small orange box
   sits on the chart, in the empty space between the two lines at the right. */
function drawHomelessChildren(data) {
  var chart = data.charts.s1_14_homeless_children;
  var canvas = document.getElementById("chart-homeless");
  var frame = canvas.parentNode;                                     /* the chart's box: the names and the orange box are placed inside it */
  var colors = { nysed: WCA.colors.blue, hud: WCA.db.teal.full };
  var textColors = { nysed: WCA.colors.blue, hud: WCA.db.tealText };  /* teal as text is one step darker, so it reads on white */
  var note = document.getElementById("note-homeless");

  /* The first value goes under its point (the line's name is above it); the lowest goes under too; the latest above */
  var notes = [];
  chart.series.forEach(function (s, d) {
    var known = s.values.map(function (v, i) { return v === null ? null : i; }).filter(function (i) { return i !== null; });
    var first = known[0], latest = known[known.length - 1];
    var lowest = known.reduce(function (a, b) { return s.values[b] < s.values[a] ? b : a; });
    notes.push({ dataset: d, index: first, lines: [WCA.fmt.count(s.values[first])], place: "below" });
    notes.push({ dataset: d, index: latest, lines: [WCA.fmt.count(s.values[latest])] });
    if (lowest !== first && lowest !== latest) notes.push({ dataset: d, index: lowest, lines: [WCA.fmt.count(s.values[lowest])], place: "below" });
  });

  /* The empty part kept above the highest value, as a share of it: more on a narrow chart */
  function headroom(width) { return width < 480 ? "32%" : "8%"; }

  /* How high a line is on the screen at x, and the highest and lowest it gets between two x's (in pixels
     from the top of the chart, so "highest" is the smallest number) */
  function heightAt(points, x) {
    for (var i = 1; i < points.length; i++) {
      if (x <= points[i].x) {
        var a = points[i - 1], b = points[i];
        return a.y + (b.y - a.y) * Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x || 1)));
      }
    }
    return points[points.length - 1].y;
  }
  function reach(points, from, to) {
    var ys = [heightAt(points, from), heightAt(points, to)];
    points.forEach(function (point) { if (point.x >= from && point.x <= to) ys.push(point.y); });
    return { highest: Math.min.apply(null, ys), lowest: Math.max.apply(null, ys) };
  }

  /* Put the words in place. Runs whenever the chart has been laid out again (first draw, a new window size). */
  function placeWords(drawn) {
    var area = drawn.chartArea;
    var lines = chart.series.map(function (s, d) {
      return drawn.getDatasetMeta(d).data.filter(function (point) { return !point.skip; });
    });

    /* each line's name: at the left of the chart, just above the highest point the line reaches under it.
       A name stops short of the chart's right end (where the latest values are written); a long name
       then takes two lines. */
    var names = [];
    chart.series.forEach(function (s, d) {
      var name = frame.querySelector('.line-name[data-series="' + s.key + '"]');
      if (!name) return;
      name.style.color = textColors[s.key];
      name.style.maxWidth = Math.max(120, area.right - area.left - 78) + "px";
      var left = area.left + 8;
      var top = Math.max(reach(lines[d], left, left + name.offsetWidth).highest - name.offsetHeight - 9, 0);
      name.style.left = left + "px";
      name.style.top = top + "px";
      name.classList.add("placed");
      names[d] = { left: left, right: left + name.offsetWidth, top: top };
    });

    /* the orange box: at the right, halfway between the two lines (clear of the numbers written at their
       points, and of the lower line's name where the two overlap). If the space there is too small, it
       goes above the chart instead. */
    if (!note) return;
    if (note.parentNode !== frame) frame.appendChild(note);            /* back on the chart to be measured */
    note.classList.remove("above");
    var right = area.right - 6, left = right - note.offsetWidth, CLEAR = 30;
    var from = reach(lines[0], left, right).lowest + CLEAR;            /* under the upper line... */
    var to = reach(lines[1], left, right).highest - CLEAR;             /* ...and over the lower one */
    if (names[1] && names[1].right > left) to = Math.min(to, names[1].top - 8);
    if (left >= area.left + 8 && to - from >= note.offsetHeight) {
      note.style.left = left + "px";
      note.style.top = (from + (to - from - note.offsetHeight) / 2) + "px";
      note.classList.add("placed");
    } else {
      note.classList.remove("placed");
      note.classList.add("above");
      note.style.left = note.style.top = "";
      frame.parentNode.insertBefore(note, frame);
    }
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: chart.series.map(function (s) { return lineSeries(s.label, s.values, colors[s.key]); }) },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 20, right: 12 } },
      /* On a narrow chart the names take two lines each, so the scale leaves more room above the upper line */
      onResize: function (resized, size) { resized.options.scales.y.grace = headroom(size.width); },
      scales: {
        x: { ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1) } },      /* a gray line up from every year, as in the Bulletin */
        y: { beginAtZero: true, grace: headroom(frame.clientWidth), ticks: { callback: WCA.fmt.count, maxTicksLimit: 7 } },
      },
      plugins: {
        pointWords: { size: 12, weight: "600", notes: notes },
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
    plugins: [pointWords, hoverLine, { id: "placeWords", afterUpdate: placeWords }],
  });

  describe(canvas, chart.title + ". " + chart.series.map(function (s) {
    return s.label + ": " + chart.years.map(function (year, i) { return year + " " + WCA.fmt.count(s.values[i]); }).join(", ");
  }).join(". ") + ".");
}


/* Page 1.16: credit card debt per person, one bar a year. The first and the latest bar are labelled; the
   axis and hover carry the rest. The Bulletin's box and up arrow (their words are in index.html) sit on the
   lower half of the bars: under the top of the shortest bar, so no bar's height is hidden. */
function drawCreditCardDebt(data) {
  var chart = data.charts.s1_16_credit_card_debt;
  var canvas = document.getElementById("chart-credit-card");
  var frame = canvas.parentNode;
  var note = document.getElementById("note-credit-card");
  var end = chart.values.length - 1;
  var shortest = Math.min.apply(null, chart.values);

  /* Put the box and arrow in place: in the middle of the chart, between the top of the shortest bar and
     the foot of the bars. If the chart is too small to hold them, they go above the chart instead. */
  function placeNote(drawn) {
    if (!note) return;
    var area = drawn.chartArea;
    if (note.parentNode !== frame) frame.appendChild(note);            /* back on the chart to be measured */
    note.classList.remove("above");
    var from = drawn.scales.y.getPixelForValue(shortest) + 14, to = area.bottom - 14;
    var width = note.offsetWidth, height = note.offsetHeight;
    if (area.right - area.left >= width + 16 && to - from >= height) {
      note.style.left = (area.left + (area.right - area.left - width) / 2) + "px";
      note.style.top = (from + (to - from - height) / 2) + "px";
      note.classList.add("placed");
    } else {
      note.classList.remove("placed");
      note.classList.add("above");
      note.style.left = note.style.top = "";
      frame.parentNode.insertBefore(note, frame);
    }
  }

  new Chart(canvas, {
    type: "bar",
    data: { labels: chart.years, datasets: [{ label: "Credit card debt per person", data: chart.values, backgroundColor: WCA.colors.blue }] },
    options: {
      datasets: { bar: { barPercentage: 0.9, categoryPercentage: 0.92 } },      /* wide bars with a thin gap, as in the Bulletin */
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
    plugins: [barNotes, { id: "placeNote", afterUpdate: placeNote }],
  });

  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) { return year + ": " + WCA.fmt.dollars(chart.values[i]); }).join(", ") + ".");
}


/* --------------------------------------------------------------------------
   5. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* The page's own background color, for the thin gaps between touching marks (read from styles.css) */
var SURFACE = WCA.cssVar("--white");

/* True when the reader has asked their device for less movement on screen. The charts that slide or turn
   when a button is pressed (pages 1.8, 1.9, 1.10) then change at once instead. */
var STILL = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);

/* The gray of the lines behind a chart's bars and lines (read from styles.css) */
var GRID = WCA.cssVar("--db-grid");

/* The Bulletin's charts have gray lines behind them that a reader can see. The template draws its lines
   much fainter; called once at start-up, this gives every chart on the page the Bulletin's gray. */
function useChartLines() {
  Chart.defaults.scale.grid.color = GRID;
}

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

/* Run fn again whenever the layout may have moved: the window changed size, or the web font arrived.
   Given an element as well, also whenever that element changes size (its tab is shown again, or its
   text wraps differently). */
function whenLayoutChanges(fn, element) {
  var waiting = false;
  window.addEventListener("resize", function () {
    if (waiting) return;
    waiting = true;
    requestAnimationFrame(function () { waiting = false; fn(); });
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fn);
  if (element && window.ResizeObserver) new ResizeObserver(function () { fn(); }).observe(element);
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

/* How wide a piece of text will be on the screen, in pixels, in the page's font:
     textWidth("76.6%", "600 12px")     ("600" is how bold, "12px" how large)
   Lets a chart decide whether a label fits before it is drawn. */
function textWidth(text, weightAndSize) {
  var pen = textWidth.pen || (textWidth.pen = document.createElement("canvas").getContext("2d"));
  pen.font = weightAndSize + " " + WCA.font;
  return pen.measureText(text).width;
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
      if (!chart.isDatasetVisible(d)) return;                        /* nothing above a bar that is not on show */
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

/* pointWords (a Chart.js add-on): write one or more lines of text above chosen points of a line, the
   Bulletin way ("59,333 / Children / Under 5"). Each note sits on a patch of the page's background, so the
   chart's gray lines never run through the words, and is pulled in if it would leave the chart sideways.
     plugins: { pointWords: { size: 14, notes: [{ index: 0, lines: ["59,333", "Children", "Under 5"] }] } }
   `dataset` picks the line (the first if left out); place: "below" writes under the point instead;
   `weight` is how bold the words are ("700" if left out). */
var pointWords = {
  id: "pointWords",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.notes) return;
    var ctx = chart.ctx, size = o.size || 13, lineHeight = Math.round(size * 1.25), area = chart.chartArea;
    ctx.save();
    ctx.font = (o.weight || "700") + " " + size + "px " + WCA.font;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    o.notes.forEach(function (note) {
      var point = chart.getDatasetMeta(note.dataset || 0).data[note.index];
      if (!point) return;
      var width = Math.max.apply(null, note.lines.map(function (line) { return ctx.measureText(line).width; }));
      var height = note.lines.length * lineHeight;
      var x = Math.min(Math.max(point.x, area.left + width / 2 + 2), area.right - width / 2 - 2);
      var top = note.place === "below" ? point.y + 12 : point.y - 12 - height;
      ctx.fillStyle = SURFACE;
      ctx.fillRect(x - width / 2 - 3, top - 1, width + 6, height + 2);
      ctx.fillStyle = WCA.colors.ink;
      note.lines.forEach(function (line, k) { ctx.fillText(line, x, top + lineHeight * (k + 0.5)); });
    });
    ctx.restore();
  },
};

/* valuesInBars (a Chart.js add-on, for bars that run sideways): write each bar's value inside its end, the
   Bulletin way, in white or dark text (whichever reads on the bar's color). A bar too short to hold its
   value has it just past its end instead.
     plugins: { valuesInBars: { format: WCA.fmt.pct } }
   With `names: true`, each series' name is also written at the start of its bar in the LAST row, where the
   Bulletin puts the names instead of a key. `onNames(fit)` then tells the chart whether every name
   fitted, so that it can show a key when one did not. */
var valuesInBars = {
  id: "valuesInBars",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.format) return;
    var ctx = chart.ctx, size = o.size || 13, names = [];
    ctx.save();
    ctx.textBaseline = "middle";
    chart.data.datasets.forEach(function (dataset, d) {
      if (!chart.isDatasetVisible(d)) return;
      var bars = chart.getDatasetMeta(d).data;
      bars.forEach(function (bar, i) {
        var value = dataset.data[i];
        if (value === null || value === undefined) return;
        var at = bar.getProps(["x", "y", "base"], true);
        var length = at.x - at.base, text = o.format(value);
        var fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
        ctx.font = "600 " + size + "px " + WCA.font;
        var width = ctx.measureText(text).width;
        var inside = length >= width + 12;
        ctx.fillStyle = inside ? textOn(fill) : WCA.colors.ink;
        ctx.textAlign = inside ? "right" : "left";
        ctx.fillText(text, inside ? at.x - 7 : at.x + 5, at.y + 1);
        /* the series' name belongs in the last row's bar: note where, and how much room that bar has for it */
        if (o.names && i === bars.length - 1) names.push({ text: dataset.label, x: at.base + 9, y: at.y + 1, color: textOn(fill), room: inside ? length - width - 30 : 0 });
      });
    });
    /* the names are written only if every one of them fits: some in the bars and some in a key would be worse than either */
    if (o.names) {
      ctx.font = "700 " + size + "px " + WCA.font;
      ctx.textAlign = "left";
      var fit = names.length > 0 && names.every(function (name) { return ctx.measureText(name.text).width <= name.room; });
      if (fit) names.forEach(function (name) { ctx.fillStyle = name.color; ctx.fillText(name.text, name.x, name.y); });
      if (o.onNames) o.onNames(fit);
    }
    ctx.restore();
  },
};

/* lineNames (a Chart.js add-on): write each line's name on the chart, above the line and ending at its last
   point, in the line's own color, as the Bulletin does ("New York", "USA"). The names stand in for a key.
     plugins: { lineNames: { names: ["New York", "USA"], size: 15 } }      one name per line, in order
   Use it where the lines are far enough apart at their ends for the names not to touch. */
var lineNames = {
  id: "lineNames",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.names) return;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "700 " + (o.size || 14) + "px " + WCA.font;
    ctx.textAlign = "right"; ctx.textBaseline = "bottom";
    ctx.lineWidth = 4; ctx.lineJoin = "round"; ctx.strokeStyle = SURFACE;
    chart.data.datasets.forEach(function (dataset, d) {
      var points = chart.getDatasetMeta(d).data, name = o.names[d];
      if (!name || !points.length || !chart.isDatasetVisible(d)) return;
      /* the highest the line gets under the name, so the name clears it */
      var end = points[points.length - 1], width = ctx.measureText(name).width, top = end.y;
      points.forEach(function (point) { if (point.x >= end.x - width && !isNaN(point.y)) top = Math.min(top, point.y); });
      ctx.strokeText(name, end.x, top - 9);                          /* a white edge keeps the letters clear of the gray lines */
      ctx.fillStyle = dataset.borderColor;
      ctx.fillText(name, end.x, top - 9);
    });
    ctx.restore();
  },
};

/* ringPointers (a Chart.js add-on, for rings): under a ring, the name and the share of chosen parts, each
   joined by a thin line to its part of the ring, as in the Bulletin (page 1.10).
     plugins: { ringPointers: { parts: [{ index: 1, side: "left", lines: ["Rent", "13.7%"] }] } }
   `index` is the part's place in the data, `side` where its words go under the ring. The line goes
   straight up from the words when the part is above them, and to the nearest point of the part when it
   is not. The chart must leave room under the ring: layout.padding.bottom. */
var ringPointers = {
  id: "ringPointers",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.parts || !o.parts.length) return;
    var arcs = chart.getDatasetMeta(0).data, ctx = chart.ctx;
    if (!arcs.length) return;
    var ring = arcs[0].getProps(["x", "y", "outerRadius", "innerRadius"], true);
    var middle = (ring.outerRadius + ring.innerRadius) / 2;          /* halfway across the ring's band */
    var top = ring.y + ring.outerRadius + 16;                        /* where the words begin */
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    o.parts.forEach(function (part) {
      var arc = arcs[part.index] && arcs[part.index].getProps(["startAngle", "endAngle"], true);
      if (!arc || arc.endAngle - arc.startAngle < 0.03) return;      /* a part with nothing in it has nothing to point at */
      var side = part.side === "left" ? -1 : 1;
      var x = ring.x + side * ring.outerRadius * 0.5;                /* the words' middle: halfway out from the ring's center */

      /* Angles run clockwise from 3 o'clock, as Chart.js counts them. `wanted` is the point of the band
         straight above the words; if the part is not there, the nearest end of the part is used instead. */
      var wanted = Math.acos(side * ring.outerRadius * 0.5 / middle);
      var inset = Math.min(0.14, (arc.endAngle - arc.startAngle) / 4);
      var from = arc.startAngle + inset, to = arc.endAngle - inset, angle = null;
      [-1, 0, 1, 2].forEach(function (turn) {
        var candidate = wanted + turn * 2 * Math.PI;
        if (angle === null && candidate >= from && candidate <= to) angle = candidate;
      });
      if (angle === null) {
        function apart(a) { var d = Math.abs(a - wanted) % (2 * Math.PI); return Math.min(d, 2 * Math.PI - d); }
        angle = apart(from) < apart(to) ? from : to;
      }
      var px = ring.x + middle * Math.cos(angle), py = ring.y + middle * Math.sin(angle);

      ctx.strokeStyle = WCA.colors.ink; ctx.fillStyle = WCA.colors.ink; ctx.lineWidth = 1.25;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, top - 3); ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 2 * Math.PI); ctx.fill();
      part.lines.forEach(function (line, k) {
        ctx.font = (k === 0 ? "400" : "600") + " 13px " + WCA.font;
        ctx.fillStyle = k === 0 ? WCA.colors.fine : WCA.colors.ink;
        ctx.fillText(line, x, top + k * 16);
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
