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
     4. Chapter charts (added chapter by chapter)
     5. Small helpers
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
  "chapter-1": [],
  "chapter-2": [],
  "chapter-3": [],
  "chapter-4": [],
  "map": [],
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
  (CHAPTER_CHARTS[id] || []).forEach(function (draw) { draw(page.data); });
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
   4. CHAPTER CHARTS  ·  Chart.js, one function per chart
   --------------------------------------------------------------------------
   Added chapter by chapter. Each function reads one block of data.json "charts"
   and is listed in CHAPTER_CHARTS (Settings) under its chapter.
   -------------------------------------------------------------------------- */


/* --------------------------------------------------------------------------
   5. SMALL HELPERS
   -------------------------------------------------------------------------- */

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
