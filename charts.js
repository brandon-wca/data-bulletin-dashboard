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
     4. Chapter charts: one function per Bulletin page (all four chapters are in)
     5. Small helpers: tools the charts share (among them refill, labelCells, placeLineNames, spread,
        glide), and more Chart.js add-ons (barNotes, pointWords, valuesInBars, lineNames, ringPointers,
        seriesNamesInBars, hoverLine); for chapter 3, the map (drawCountyMap, linkPlaces), the HTML bars
        (makeBars), coversLine, putNote, pointAt, yearButtons, and the add-ons yearBand, yearsUnderBars,
        changeMarks, valuesInParts and districtNames; for chapter 4, the HTML bars whose rows come and go
        (makeSlotBars), moveChart and the add-ons columnValues and footWords
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
  "chapter-2": [drawInfantCareCost, drawInfantCareShare, drawTaxCredits, drawProgramComparison, drawIncomeLimits,
                drawThirdGrade, drawProgramsBeforeKindergarten, drawHeadStart, drawEarlyInterventionExits,
                drawTherapists, drawPreschoolExits, drawUniversalPreK],
  "chapter-3": [drawFourCommunities, drawHomelessRate, drawLivingSituations, drawHomelessByRace, drawGraduationAndCities,
                drawAbuseFindings, drawDomesticViolence, drawFosterCare, drawSelfHarm, drawWeightAndDisadvantage,
                drawScoresByDistrict, drawTestGap, drawChronicAbsence, drawSuspensions],
  "chapter-4": [drawYouthUnemployment, drawUnemploymentByGender, drawMinimumWageAndRent, drawEducationalAttainment,
                drawCommunityCollege, drawYoungAdultsAndJustice, drawDisconnectedYouth],
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

/* Page 2.8: the names written on the chart in place of a key (the Bulletin's own words; the pointer
   bubble's words are in index.html), and the sentence written under the chart when a household size is
   pressed. The sentence is a first draft to be rewritten: keep the four {words in braces}, which are
   filled in for the row that was pressed. */
var INCOME_LIMIT_NAMES = { ccap: "CCAP income limit", works: "Upper limit for Westchester Works" };
var INCOME_LIMIT_SENTENCE = "[PLACEHOLDER] Household of {size}: CCAP up to {ccap} a year, Westchester Works up to {works}. " +
                            "The window between the two limits is {window}.";

/* Pages 2.14 and 2.16: both charts use the Bulletin's scale, 30% to 60% with a gray line every 5 points,
   so the two cards can be compared at a glance. (If a value ever falls outside it, the scale grows by
   whole steps to hold it.) */
var OUTCOME_SCALE = { min: 30, max: 60, step: 5 };

/* Page 2.3: the Bulletin prints the cost at eight points of the line and no more: the first year, the
   latest year (larger, in the line's color) and the years named here. Hover shows the other years. */
var INFANT_CARE_MIDDLE_YEARS = [2012, 2015, 2018, 2020, 2022, 2024];

/* Chapter 3. The maps on pages 3.3 and 3.7 are drawn from this file: the county's outlines, a light copy made by
   update_data_here/build_data.py. */
var GEOGRAPHY_FILE = "data/Geography.json";
/* Where each community's words sit on each map: x is a share of the map's width and y of its height (0 the left or
   top edge, 1 the right or bottom; more than 1 is under the map). `side` is the way the words go from that spot:
   "right", "left", "below", or "center" (the words centered on the spot). A thin line joins the spot to the
   community's dot. On both maps the names are on the same sides of their communities, and no line crosses another
   highlighted community. Page 3.7's words are two lines (the name and its count), so the two written under its map
   are set further apart, one lower than the other. */
var MAP_NAME_SPOTS = {
  "map-four-places": {
    white_plains: { x: 0.68, y: 0.745, side: "right" },
    new_rochelle: { x: 0.60, y: 0.965, side: "right" },
    yonkers:      { x: 0.13, y: 1.03, side: "below" },
    mount_vernon: { x: 0.43, y: 1.085, side: "below" },
  },
  "map-homeless-cities": {
    white_plains: { x: 0.68, y: 0.745, side: "right" },
    new_rochelle: { x: 0.60, y: 0.965, side: "right" },
    yonkers:      { x: 0.10, y: 1.02, side: "below" },
    mount_vernon: { x: 0.45, y: 1.12, side: "below" },
  },
};
/* The room kept under each map for the words written there, as a share of the map's height (0.17 if a map is not
   named here). Page 3.7's words are two lines (the name and its count), so its map keeps more. */
var MAP_ROOM_UNDER = { "map-four-places": 0.17, "map-homeless-cities": 0.25 };

/* Page 3.4: the years the shaded band covers (the COVID-19 pandemic, March 11, 2020 to May 5, 2023, falls in the school
   years that end in 2020 to 2023) and the year the orange box points at (January 15, 2022 is in the school year that
   ends in 2022). The dates written on the chart are in index.html. */
var PANDEMIC_YEARS = [2020, 2023];
var MORATORIUM_YEAR = 2022;

/* Page 3.7: the two bars stand on a scale of 0 to 100%, with a gray line at each of these steps. */
var GRADUATION_SCALE_STEPS = [0, 25, 50, 75, 100];

/* Page 3.9: the circle on the chart is as large as fits in the empty space left of the shaded years, between these two
   sizes (pixels across). Under `least` its words would be smaller than 12 pixels, so it then goes above the chart. */
var ABUSE_CIRCLE = { most: 196, least: 188 };

/* Page 3.12: a gray line every this many visits; the scale ends on the first line past the longest bar. */
var SELF_HARM_STEP = 50;

/* Page 3.13: the key is on the chart where the chart is at least this many pixels wide (it is 748 on a desktop
   screen); on a narrower chart the key is above it, which leaves the chart to the dots and their names. */
var SCATTER_KEY_ON_CHART_FROM = 720;

/* Page 3.13: the side of its dot each district's name is written on, as in the Bulletin. A district not named here, or
   whose side is taken, gets the side with room. */
var SCATTER_NAME_SIDES = {
  "Hendrick Hudson": "left", "Greenburgh": "left", "New Rochelle": "left", "Bedford": "left", "Valhalla": "left",
  "Mount Pleasant": "left", "North Salem": "left", "Somers": "left", "Ardsley": "left", "Pleasantville": "left",
  "Hastings-on-Hudson": "left", "Croton-Harmon": "right", "Harrison": "right", "Dobbs Ferry": "right",
  "Byram Hills": "right", "Rye Neck": "right", "Pelham": "right", "Irvington": "right", "Bronxville": "right",
};
/* Page 3.13: where the dots crowd together (two groups at the lower left), the place of a district's name is set here,
   so that the names around it stay readable. `side` is where the name goes from its dot: "left", "right", "above" or
   "below" (above and below: centered on the dot); `dx` moves it that many pixels to the right and `dy` that many
   down (a minus sign: left, up); `lines` writes a long name on more than one line. Where a place set here is taken
   (the chart is narrower and the dots are closer), the code finds the name another place, as it does for every
   district not named here. (On a narrow chart only the lowest and the highest district are named.) */
var SCATTER_NAME_SPOTS = {
  "Somers":             { side: "above" },
  "Croton-Harmon":      { side: "right", dy: -17 },
  "Pleasantville":      { side: "left", dy: 3 },
  "Dobbs Ferry":        { side: "below", dx: 8 },
  "Byram Hills":        { side: "above" },
  "Hastings-on-Hudson": { side: "below", lines: ["Hastings-", "on-Hudson"] },
  "Pelham":             { side: "above" },
  "Irvington":          { side: "below", dx: 16 },
};

/* Page 3.16: the words under each measure, the Bulletin's (each measure's year comes from data.json, under its words). */
var GAP_MEASURE_NAMES = { math: ["Grades 3 to 8", "Math"], regents: ["Regents", "Exams"], ap: ["AP Exams", "Scoring 3 or higher"] };

/* Page 3.17: a gray line every this many percent. Both charts keep one scale for every school year: it ends on the
   first line at or past the highest rate of any year, so the years can be compared and a button never changes it. */
var ABSENCE_STEP = 10;

/* Page 3.18: the chart by race and ethnicity has a gray line every SUSPENSION_RACE_STEP percent, on one scale for
   every school year. The districts' chart is on the Bulletin's scale: a bar's length is its rate out of
   SUSPENSION_DISTRICT_SCALE percent, with a gray line every SUSPENSION_DISTRICT_STEP. */
var SUSPENSION_RACE_STEP = 2;
var SUSPENSION_DISTRICT_SCALE = 15;
var SUSPENSION_DISTRICT_STEP = 5;

/* Chapter 4. */
/* Page 4.4: a gray line every this many percent; the scale ends on the first line at or past the highest rate. */
var JOBLESS_STEP = 5;

/* Page 4.5: the words on the two buttons over the earnings chart (the first says how many age groups the Bulletin
   shows; which ones they are is EARNINGS_AGE_GROUPS in build_data.py Settings). The dollar scale has a gray line
   every EARNINGS_STEP and ends on the first line at or past the highest earnings of ANY age group, so the buttons
   never change it. The words over the dashed line are in index.html (the chart's "data-ref-words"). */
var EARNINGS_VIEW_NAMES = ["The Bulletin's three age groups", "Every age group"];
var EARNINGS_STEP = 2000;

/* Page 4.8: the Bulletin's scale, 0 to 15,000 students with a gray line every 5,000 (if a count ever passes it, the
   scale grows by whole steps to hold it), and the word on the two buttons: "Since 2015" (the Bulletin's first
   year) and "Since 2010" (the first fall in the table). Both years come from data.json. */
var COLLEGE_SCALE = { max: 15000, step: 5000 };
var COLLEGE_VIEW_WORD = "Since";

/* Page 4.9: the bars' names, the Bulletin's own words, and each chart's scale. The first ends on the first gray
   line at or past its longer bar; the second is 0 to 100%. */
var JUSTICE_BAR_NAMES = {
  adults: "Percentage of Westchester Population in the 18-24 Age Group",
  arrests: "Percentage of Westchester Arrestees in the Ages 18-24 Age Group",
  young_people: "Percentage of Westchester Population, Ages 18-24 who are Black or Hispanic",
  custody: "Percentage of incarcerated 18- to 24-year-olds from Westchester Cases who are Black or Hispanic",
};
var JUSTICE_SCALES = { adults: { step: 5 }, custody: { max: 100, step: 25 } };

/* Page 4.10: the two buttons (`name`) and what the card's title says for each (`title`), and the scale: a gray
   line every DISCONNECTED_STEP percent, ending on the first line at or past the highest rate of EITHER view, so
   the buttons never change it. */
var DISCONNECTED_VIEWS = [
  { name: "By race and ethnicity", title: "by race and ethnicity" },
  { name: "By age", title: "by age" },
];
var DISCONNECTED_STEP = 5;
/* Page 4.10 on a phone: six pairs of bars leave each name very little room, so these names are broken into lines
   here (a name not listed is broken at its spaces). */
var DISCONNECTED_NARROW_NAMES = { "Multiracial": ["Multi-", "racial"], "White Non-Hispanic": ["White", "Non-", "Hispanic"] };


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

   Some cards answer to buttons (1.8 the family types, 1.9 the two years,
   1.10, 2.4, 2.17, 3.17 and 3.18 the year, 2.8 the household size, 2.14 and
   2.16 one outcome, 3.15 a district to add, 4.5 the age groups, 4.8 the
   years, 4.10 race and ethnicity or age): the buttons change what is
   shown, never the numbers. On 3.3 and 3.7 pointing at a community lights it
   up on the map (and in 3.3's table); on 3.13, pointing at a dot. Words
   that sit ON a chart (a line's name, a small callout, a circle, a key) are
   HTML laid over the chart and put in place by the chart's function (1.14,
   1.16, 2.3, 2.13, 2.14, 2.16, 2.17).
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

  /* b. SNAP recipients by year: a filled area running from blue to green, as in the Bulletin, on the
        Bulletin's scale, which does NOT start at zero: a gray line every 20,000 from the 10,000 step under
        the lowest count (30,000, 50,000 ...), and the foot of the chart 10,000 below the first line
        (20,000). The user chose the Bulletin's scale for filled shapes and bars (2026-11-19). */
  var snapCanvas = document.getElementById("chart-snap");
  var snapEnd = snap.values.length - 1;
  var snapLines = [], snapFirst = Math.floor(Math.min.apply(null, snap.values) / 10000) * 10000;
  for (var snapLine = snapFirst; snapLine - 20000 < Math.max.apply(null, snap.values); snapLine += 20000) snapLines.push(snapLine);
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
        y: { min: snapFirst - 10000, max: snapLines[snapLines.length - 1],
             afterBuildTicks: function (axis) { axis.ticks = snapLines.map(function (value) { return { value: value }; }); },
             ticks: { callback: compactCount } },
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


/* ---- CHAPTER 2 ---------------------------------------------------------- */

/* Page 2.3: what a month of infant care at a center costs, one line. As in the Bulletin: a dot for every
   year, the cost printed at eight of them (INFANT_CARE_MIDDLE_YEARS in Settings, plus the first and the
   latest year), a dotted stretch across the year the Council published nothing, and the red circle whose
   arrow points up. The circle and the note about the missing year are words in index.html; this puts the
   circle under the line at the right, as large as fits there, and the note at the foot of the dotted
   stretch, clear of the circle. */
function drawInfantCareCost(data) {
  var chart = data.charts.s2_3_infant_care_cost;
  var canvas = document.getElementById("chart-infant-care");
  var frame = canvas.parentNode;                                     /* the chart's box: the circle and the note are placed inside it */
  var circle = document.getElementById("circle-infant-care"), gapNote = document.getElementById("note-infant-care-gap");
  var color = WCA.colors.blue, pale = WCA.colors.blue100;
  var end = chart.years.length - 1;

  /* The Bulletin's scale: from the $250 step below the lowest cost to the $250 step above the highest ($1,250 to $2,250) */
  var STEP = 250;
  var known = chart.values.filter(function (value) { return value !== null; });
  var low = Math.floor(Math.min.apply(null, known) / STEP) * STEP, high = Math.ceil(Math.max.apply(null, known) / STEP) * STEP;

  /* The costs that are printed: each just above its point and to its left, the first one to its right.
     A phone has room for fewer: the first, the latest and every other one of the years in between. */
  var notes = [], fewer = [];
  chart.years.forEach(function (year, i) {
    if (chart.values[i] === null) return;
    var words = [WCA.fmt.dollars(chart.values[i])], middle = INFANT_CARE_MIDDLE_YEARS.indexOf(year);
    var note = i === end ? { index: i, lines: words, side: "left", size: 18, color: color }
             : i === 0 ? { index: i, lines: words, side: "right" }
             : middle >= 0 ? { index: i, lines: words, side: "left" } : null;
    if (!note) return;
    notes.push(note);
    if (i === 0 || i === end || middle % 2 === 0) fewer.push(note);
  });

  /* A stretch of the line that crosses a year with no figure is drawn as pale dots */
  var series = dotsAcrossGaps(lineSeries("Infant care at a center", chart.values, color), pale);

  /* How far a point is from the stretch of line between two others (for keeping the circle clear of the line) */
  function distance(px, py, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / (dx * dx + dy * dy || 1)));
    return Math.sqrt(Math.pow(px - a.x - t * dx, 2) + Math.pow(py - a.y - t * dy, 2));
  }

  /* Put the circle and the note in place. Runs whenever the chart has been laid out again. */
  var LARGEST = 208, SMALLEST = 150, CLEAR = 12;                     /* the circle's size in pixels, and the room kept between it and the line */
  function placeGraphic(drawn) {
    var area = drawn.chartArea;
    var points = drawn.getDatasetMeta(0).data.filter(function (point) { return !point.skip; });
    var placed = null;
    if (circle) {
      if (circle.parentNode !== frame) frame.appendChild(circle);      /* back on the chart to be measured */
      circle.classList.remove("above");
      /* the largest circle that sits in the chart's lower right corner without coming near the line */
      for (var size = LARGEST; size >= SMALLEST && !placed; size -= 2) {
        var r = size / 2, cx = frame.clientWidth - r - 1, cy = area.bottom - r - 3, near = Infinity;
        for (var i = 1; i < points.length; i++) near = Math.min(near, distance(cx, cy, points[i - 1], points[i]));
        if (near >= r + CLEAR) placed = { size: size, r: r, cx: cx, cy: cy };
      }
      if (placed) {
        circle.style.setProperty("--circle", placed.size + "px");
        circle.style.left = (placed.cx - placed.r) + "px";
        circle.style.top = (placed.cy - placed.r) + "px";
        circle.classList.add("placed");
      } else {
        circle.classList.remove("placed");
        circle.classList.add("above");
        circle.style.left = circle.style.top = "";
        circle.style.removeProperty("--circle");
        frame.parentNode.insertBefore(circle, frame);
      }
    }
    /* the note: at the foot of the chart under the year that is missing, moved left where the circle is in the way */
    if (gapNote) {
      var missing = chart.values.indexOf(null);
      if (missing < 0) { gapNote.hidden = true; return; }
      var width = gapNote.offsetWidth, height = gapNote.offsetHeight;
      var top = area.bottom - height - 8;
      var left = drawn.scales.x.getPixelForValue(missing) - width / 2;
      if (placed) {
        var dy = Math.max(Math.abs(top - placed.cy), Math.abs(top + height - placed.cy));           /* the note's far edge from the circle's middle */
        var edge = dy < placed.r ? placed.cx - Math.sqrt(placed.r * placed.r - Math.pow(Math.min(Math.abs(top - placed.cy), Math.abs(top + height - placed.cy)), 2)) : Infinity;
        left = Math.min(left, edge - width - 10);
      }
      gapNote.style.left = Math.max(left, area.left + 4) + "px";
      gapNote.style.top = top + "px";
      gapNote.classList.add("placed");
    }
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: [series] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 16 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(2) } },
        y: { min: low, max: high, ticks: { stepSize: STEP, callback: function (value) { return WCA.fmt.dollars(value); } } },
      },
      plugins: {
        pointWords: { size: 13, notes: notes, narrow: 520, narrowNotes: fewer },
        tooltip: { callbacks: {
          title: function (items) { return String(items[0].label); },
          label: function (item) { return WCA.fmt.dollars(item.parsed.y) + " a month"; },
        } },
      },
    },
    plugins: [pointWords, hoverLine, { id: "placeGraphic", afterUpdate: placeGraphic }],
  });

  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) {
    return year + ": " + (chart.values[i] === null ? "no figure" : WCA.fmt.dollars(chart.values[i]));
  }).join(", ") + ".");
}


/* Page 2.4: the share of a family's median income that a year of infant care takes, for three family
   types. Plain HTML bars (index.html holds the rows and their words): each bar is 100% of the income,
   split into what infant care takes and what is left, with the federal benchmark as a dashed line through
   all three. The year buttons show an earlier year the same way: the bars slide to that year's shares, and
   every number on the card that index.html fills from the block's "latest" is written again for the year
   chosen (the title's year, the sentence under the title, the text box). */
function drawInfantCareShare(data) {
  var chart = data.charts.s2_4_infant_care_share;
  var card = document.getElementById("card-2-4");
  var box = document.getElementById("chart-care-share");
  var status = document.getElementById("care-share-status");
  var shown = chart.years.length - 1;                                /* the year on show: its place in chart.years */
  box.style.setProperty("--at", chart.benchmark_pct / 100);

  /* One year's numbers, in the same shape as the block's "latest", so the same words can show any year */
  function numbersOf(y) {
    var numbers = { year: chart.years[y], all_income: chart.all_families.income[y], all_spent_pct: chart.all_families.spent_pct[y] };
    chart.families.forEach(function (family) {
      numbers[family.key] = { income: family.income[y], spent_pct: family.spent_pct[y], remaining_pct: family.remaining_pct[y],
                              spent_whole: family.spent_whole[y], cents_per_dollar: family.cents_per_dollar[y] };
    });
    return numbers;
  }

  /* A share is written large in its part where it fits, small where the part is narrow, and (the share
     spent only) just past the part's end where the part is narrower still; it then takes some of the
     room of the share that is left. Worked out from the widths the parts are going to have (not the ones
     they have while they are still sliding), and again when the window changes size. */
  function fitValues() {
    chart.families.forEach(function (family) {
      var row = box.querySelector('.shb-row[data-family="' + family.key + '"]');
      var spent = row.querySelector(".shb-part.spent"), rest = row.querySelector(".shb-part.rest");
      spent.classList.remove("small", "outside");
      rest.classList.remove("small");
      var large = parseFloat(getComputedStyle(rest.querySelector(".shb-value")).fontSize) || 27;
      function big(text) { return textWidth(text, "700 " + large + "px") + 24; }
      function little(text) { return textWidth(text, "700 13px") + 10; }
      var track = row.querySelector(".shb-bar").clientWidth;
      var spentWidth = track * family.spent_pct[shown] / 100, restWidth = track - spentWidth;
      var spentText = spent.querySelector(".shb-value").textContent, restText = rest.querySelector(".shb-value").textContent;
      var taken = 0;                                                 /* the room the share spent takes in the other part, when it is written there */
      if (spentWidth < big(spentText)) {
        if (spentWidth < little(spentText)) { spent.classList.add("outside"); taken = little(spentText); }
        else spent.classList.add("small");
      }
      if (restWidth - taken < big(restText)) rest.classList.add("small");
    });
  }

  /* Show one year (y is its place in chart.years) */
  function show(y) {
    shown = y;
    chart.families.forEach(function (family) {
      var row = box.querySelector('.shb-row[data-family="' + family.key + '"]');
      var spent = row.querySelector(".shb-part.spent"), rest = row.querySelector(".shb-part.rest");
      spent.style.width = family.spent_pct[y] + "%";
      spent.querySelector(".shb-value").textContent = WCA.fmt.pct(family.spent_pct[y]);
      rest.querySelector(".shb-value").textContent = WCA.fmt.pct(family.remaining_pct[y]);
      row.querySelector(".js-income").textContent = WCA.fmt.dollars(family.income[y]);
      var who = "<strong>" + plainText(family.label) + ", " + chart.years[y] + "</strong><br>";
      spent.tip = who + WCA.fmt.pct(family.spent_pct[y]) + " of the median income (" + WCA.fmt.dollars(family.income[y]) +
                  ") pays for a year of infant care (" + WCA.fmt.dollars(chart.annual_cost[y]) + ")";
      rest.tip = who + WCA.fmt.pct(family.remaining_pct[y]) + " of the median income is left after a year of infant care";
    });
    refill(card, "charts.s2_4_infant_care_share.latest.", numbersOf(y));
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
    fitValues();
    describe(box.querySelector(".shb-rows"), "Share of median family income spent on a year of infant care, " + chart.years[y] + ". " + chart.families.map(function (family) {
      return family.label + ": " + WCA.fmt.pct(family.spent_pct[y]) + " of " + WCA.fmt.dollars(family.income[y]);
    }).join("; ") + ". The federal affordability benchmark is " + WCA.fmt.pct(chart.benchmark_pct, 0) + ".");
  }

  /* One button per year; the latest year shows first */
  var switcher = document.getElementById("care-share-years");
  var buttons = chart.years.map(function (year, y) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = year;
    button.addEventListener("click", function () { show(y); status.textContent = "Showing " + year + "."; });
    switcher.appendChild(button);
    return button;
  });
  show(shown);
  hoverTips(box);
  whenLayoutChanges(fitValues, box);
}


/* Page 2.8: how much a household may earn and still get help, by household size. Plain HTML: one row per
   size with a green bar from the start of the scale to the CCAP limit, a pale band on to the Westchester
   Works limit, a dot there, and both amounts. The scale is the Bulletin's: it starts at the $10,000 step
   below the lowest limit ($70,000), not at $0.
   The names are written on the chart instead of a key: the CCAP limit's in the longest bar, the upper
   limit's beside the first row's amount, and the band's in the Bulletin's bubble above the first row.
   Each row is a button (the numbered tag is the button itself; a click anywhere on the row counts): the
   row pressed stays in color, the others turn pale, and the line under the chart states that household's
   two limits and the window between them. Pressing it again brings every row back.
   Where the chart is too narrow for the amounts to fit in the bars, each row has its names and amounts
   written under it instead ("compact"). */
function drawIncomeLimits(data) {
  var chart = data.charts.s2_8_income_limits;
  var box = document.getElementById("chart-income-limits");
  var rowsBox = box.querySelector(".rb-rows"), top = box.querySelector(".rb-top"), bubble = box.querySelector(".rb-bubble");
  var status = document.getElementById("income-limits-status");
  var hint = status.textContent;                                     /* what the line under the chart says while no row is pressed */
  var homes = chart.households, first = homes[0], last = homes[homes.length - 1];

  /* The scale: from the $10,000 step below the lowest limit to two steps above the highest, which leaves
     room for the last amount beside its dot ($70,000 to $170,000) */
  var STEP = 10000;
  var low = Math.floor(Math.min.apply(null, homes.map(function (h) { return h.ccap_limit; })) / STEP) * STEP;
  var high = Math.ceil(Math.max.apply(null, homes.map(function (h) { return h.works_limit; })) / STEP) * STEP + STEP;
  function share(amount) { return (amount - low) / (high - low); }
  function place(amount) { return (share(amount) * 100).toFixed(3) + "%"; }
  function thousands(amount) { return "$" + (amount / 1000) + "k"; }       /* the Bulletin's scale reads $80k, $100k ... */

  /* The rows */
  var html = '<div class="rb-grid" aria-hidden="true">';
  for (var line = low + STEP; line <= high - STEP; line += STEP) html += '<span style="left:' + place(line) + '"></span>';
  html += "</div>";
  homes.forEach(function (h, i) {
    var ccap = WCA.fmt.dollars(h.ccap_limit), works = WCA.fmt.dollars(h.works_limit);
    html += '<div class="rb-row" data-size="' + h.size + '">' +
      '<button type="button" class="rb-tag" aria-pressed="false" aria-label="Household of ' + h.size + ": " + INCOME_LIMIT_NAMES.ccap + " " + ccap + ", " +
        INCOME_LIMIT_NAMES.works + " " + works + '">' + h.size + "</button>" +
      '<div class="rb-track">' +
        '<div class="rb-band" style="left:calc(' + place(h.ccap_limit) + ' - var(--half));width:calc(' + ((share(h.works_limit) - share(h.ccap_limit)) * 100).toFixed(3) + '% + var(--half))"></div>' +
        '<div class="rb-bar" style="width:' + place(h.ccap_limit) + '">' + (h === last ? '<span class="rb-name">' + plainText(INCOME_LIMIT_NAMES.ccap) + "</span>" : "") +
          '<span class="rb-value">' + ccap + "</span></div>" +
        '<div class="rb-dot" style="left:' + place(h.works_limit) + '"></div>' +
        '<div class="rb-limit" style="left:' + place(h.works_limit) + '"><span class="rb-value">' + works + "</span>" +
          (h === first ? '<span class="rb-name">' + plainText(INCOME_LIMIT_NAMES.works) + "</span>" : "") + "</div>" +
      "</div>" +
      '<p class="rb-caption"><span class="ccap">' + plainText(INCOME_LIMIT_NAMES.ccap) + " <b>" + ccap + '</b></span> · <span class="works">' +
        plainText(INCOME_LIMIT_NAMES.works) + " <b>" + works + "</b></span></p>" +
    "</div>";
  });
  rowsBox.innerHTML = html;
  var rows = Array.prototype.slice.call(rowsBox.querySelectorAll(".rb-row"));
  rows.forEach(function (row, i) {
    var h = homes[i];
    row.tip = "<strong>Household of " + h.size + "</strong><br>" + plainText(INCOME_LIMIT_NAMES.ccap) + ": " + WCA.fmt.dollars(h.ccap_limit) + "<br>" +
              plainText(INCOME_LIMIT_NAMES.works) + ": " + WCA.fmt.dollars(h.works_limit) + "<br>Window between them: " + WCA.fmt.dollars(h.window);
  });

  /* The scale under the rows: an amount at every other gray line ($80k, $100k ...) */
  var axis = "";
  for (var mark = low + STEP; mark <= high - STEP; mark += 2 * STEP) axis += '<span style="left:' + place(mark) + '">' + thousands(mark) + "</span>";
  box.querySelector(".rb-axis").innerHTML = axis;

  /* Decide whether the amounts and names fit on the bars, and put the bubble over the first row's band.
     Measured from the widths the pieces will have, and again whenever the window changes size. */
  function fit() {
    box.classList.remove("compact", "tight");
    var track = rows[0].querySelector(".rb-track").clientWidth;
    if (!track) return;
    var half = parseFloat(getComputedStyle(box).getPropertyValue("--bar")) / 2 || 23;
    var firstBar = track * share(first.ccap_limit), firstValue = WCA.fmt.dollars(first.ccap_limit);
    var afterFirst = track - (track * share(first.works_limit) + half + 7 + textWidth(WCA.fmt.dollars(first.works_limit), "700 13px") + 14 + 10);
    var inLast = track * share(last.ccap_limit) - (textWidth(WCA.fmt.dollars(last.ccap_limit), "700 13px") + 12) - 14 - 12;
    var afterLast = track - (track * share(last.works_limit) + half + 7 + textWidth(WCA.fmt.dollars(last.works_limit), "700 13px") + 14);
    var full = firstBar >= textWidth(firstValue, "700 12px") + 8 && afterLast >= 0 &&
               afterFirst >= textWidth("← " + INCOME_LIMIT_NAMES.works, "600 13px") + 8 && inLast >= textWidth(INCOME_LIMIT_NAMES.ccap, "700 13px");
    box.classList.toggle("compact", !full);
    box.classList.toggle("tight", full && firstBar < textWidth(firstValue, "700 13px") + 12);
    bubble.classList.toggle("placed", full);
    if (!full) return;
    /* the bubble: centered over the middle of the first row's band, without leaving the chart or covering "Household size" */
    var start = top.clientWidth - track;                               /* where the bars begin, from the chart's left edge */
    var middle = start + track * (share(first.ccap_limit) + share(first.works_limit)) / 2;
    var left = Math.min(Math.max(middle - bubble.offsetWidth / 2, start), top.clientWidth - bubble.offsetWidth);
    bubble.style.left = left + "px";
    bubble.style.setProperty("--tip", (middle - left - 2) + "px");
  }

  /* Press a household size (again: let go of it) */
  var pressed = null;
  function press(size) {
    pressed = (pressed === size) ? null : size;
    box.classList.toggle("one-on", pressed !== null);
    rows.forEach(function (row, i) {
      var on = homes[i].size === pressed;
      row.classList.toggle("on", on);
      row.querySelector(".rb-tag").setAttribute("aria-pressed", on ? "true" : "false");
      if (on) status.textContent = INCOME_LIMIT_SENTENCE.replace("{size}", homes[i].size).replace("{ccap}", WCA.fmt.dollars(homes[i].ccap_limit))
                                     .replace("{works}", WCA.fmt.dollars(homes[i].works_limit)).replace("{window}", WCA.fmt.dollars(homes[i].window));
    });
    if (pressed === null) status.textContent = hint;
  }
  rowsBox.addEventListener("click", function (event) {
    var el = event.target;
    while (el && el !== rowsBox && !(el.classList && el.classList.contains("rb-row"))) el = el.parentNode;
    if (el && el !== rowsBox) press(Number(el.getAttribute("data-size")));
  });

  fit();
  whenLayoutChanges(fit, box);
  hoverTips(rowsBox);
}


/* Pages 2.5, 2.6 and 2.12 are tables of words: everything they say is in index.html (their few numbers
   are data-fill tags). All that is done here is to copy each column's heading onto its cells, for the
   phone layout, where each row becomes a card and each cell shows its heading above it. */
function drawTaxCredits() { labelCells(document.getElementById("table-credits")); }
function drawProgramComparison() { labelCells(document.getElementById("table-programs")); }
function drawProgramsBeforeKindergarten() { labelCells(document.getElementById("table-before-k")); }


/* Page 2.11: the share of third graders who are proficient, in the two districts the Bulletin compares.
   Plain HTML bars: for each subject, one thick bar per district with the district's name in it and the
   share inside its end. A bar's length is its share of 100%. The student figures behind the bars and
   the two boxed statements under them (which carry the colors, so they are the key) are in index.html. */
function drawThirdGrade(data) {
  var chart = data.charts.s2_11_third_grade;
  var box = document.getElementById("chart-third-grade");
  var groups = box.querySelector(".dsb-groups");

  var html = "";
  chart.subjects.forEach(function (subject, s) {
    html += '<div class="dsb-group"><div class="dsb-subject">' + plainText(subject.label) + '</div><div class="dsb-pair">';
    chart.districts.forEach(function (district) {
      html += '<div class="dsb-bar ' + district.key + '" data-district="' + district.key + '" data-subject="' + s + '" style="width:' + district.rates[s] + '%">' +
              '<span class="dsb-name">' + plainText(district.name) + '</span><span class="dsb-value">' + WCA.fmt.pct(district.rates[s]) + "</span></div>";
    });
    html += "</div></div>";
  });
  groups.innerHTML = html;

  groups.querySelectorAll(".dsb-bar").forEach(function (bar) {
    var s = Number(bar.getAttribute("data-subject"));
    var district = chart.districts.filter(function (d) { return d.key === bar.getAttribute("data-district"); })[0];
    bar.tip = "<strong>" + plainText(district.full_name) + "</strong><br>" + plainText(chart.subjects[s].label) + ", " + plainText(chart.school_year) + ": " +
              WCA.fmt.pct(district.rates[s]) + " proficient<br>" + WCA.fmt.count(district.proficient[s]) + " of " + WCA.fmt.count(district.tested[s]) + " third graders tested";
  });
  hoverTips(groups);

  /* The names are written in the bars only if every bar has room for its name and its share (checked again
     whenever the window changes size). Otherwise no bar carries a name: the boxed statements name the colors. */
  function fitNames() {
    box.classList.remove("no-names");
    var fits = true;
    groups.querySelectorAll(".dsb-bar").forEach(function (bar) {
      var name = bar.querySelector(".dsb-name"), value = bar.querySelector(".dsb-value");
      if (bar.clientWidth < name.offsetWidth + value.offsetWidth + 34) fits = false;
    });
    box.classList.toggle("no-names", !fits);
  }
  fitNames();
  whenLayoutChanges(fitNames, box);

  describe(groups, chart.title + ". " + chart.subjects.map(function (subject, s) {
    return subject.label + ": " + chart.districts.map(function (district) { return district.name + " " + WCA.fmt.pct(district.rates[s]); }).join(", ");
  }).join("; ") + ".");
}


/* Page 2.13: children enrolled in Head Start and in Early Head Start, statewide, two lines. As in the
   Bulletin: each line's name is written just above it at the left (the words are in index.html), so there
   is no key; Head Start's first and latest value and the two on either side of the missing year are
   printed under their points, Early Head Start's first and latest; the year the federal report was not
   collected is a dotted stretch with a note at its foot. */
function drawHeadStart(data) {
  var chart = data.charts.s2_13_head_start;
  var canvas = document.getElementById("chart-head-start");
  var frame = canvas.parentNode;
  var gapNote = document.getElementById("note-head-start-gap");
  var colors = { hs: WCA.cssVar("--db-head-start"), ehs: WCA.cssVar("--db-early-head-start") };
  var pale = { hs: WCA.colors.blue100, ehs: WCA.db.family.father.light };
  var missing = chart.missing_years.length ? chart.years.indexOf(chart.missing_years[0]) : -1;   /* where the year with no figure is (-1: none) */

  /* The Bulletin's scale: 0 to the 15,000 step at or above the highest value (60,000) */
  var STEP = 15000;
  var highest = Math.max.apply(null, chart.series.map(function (s) { return Math.max.apply(null, s.values.filter(function (v) { return v !== null; })); }));
  var top = Math.ceil(highest / STEP) * STEP;

  /* The values that are printed, each under its point in its line's color: the first and the latest of
     each line and, for the first line (Head Start), the years just before and just after the gap */
  var notes = [];
  chart.series.forEach(function (s, d) {
    var known = s.values.map(function (v, i) { return v === null ? null : i; }).filter(function (i) { return i !== null; });
    var wanted = [known[0], known[known.length - 1]];
    if (d === 0 && missing > 0) wanted.push(missing - 1, missing + 1);
    known.forEach(function (i) {
      if (wanted.indexOf(i) >= 0) notes.push({ dataset: d, index: i, lines: [WCA.fmt.count(s.values[i])], place: "below", color: colors[s.key] });
    });
  });

  /* Put the names and the note in place. The note sits at the foot of the chart under the missing year;
     on a chart too narrow for that (a phone) it is a line of text under the chart instead. */
  function placeWords(drawn) {
    placeLineNames(drawn, frame, chart.series, colors, 5);
    if (!gapNote) return;
    if (missing < 0) { gapNote.hidden = true; return; }
    var area = drawn.chartArea;
    if (gapNote.parentNode !== frame) frame.appendChild(gapNote);      /* back on the chart to be measured */
    gapNote.classList.remove("under");
    if (area.right - area.left < 400) {
      gapNote.classList.remove("placed");
      gapNote.classList.add("under");
      gapNote.style.left = gapNote.style.top = "";
      frame.parentNode.insertBefore(gapNote, frame.nextSibling);
      return;
    }
    var left = drawn.scales.x.getPixelForValue(missing) - gapNote.offsetWidth / 2;
    gapNote.style.left = Math.min(Math.max(left, area.left + 4), area.right - gapNote.offsetWidth - 4) + "px";
    gapNote.style.top = (area.bottom - gapNote.offsetHeight - 6) + "px";
    gapNote.classList.add("placed");
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: chart.series.map(function (s) { return dotsAcrossGaps(lineSeries(s.label, s.values, colors[s.key]), pale[s.key]); }) },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 8, right: 22 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1) } },
        y: { min: 0, max: top, ticks: { stepSize: STEP, callback: WCA.fmt.count } },
      },
      plugins: {
        pointWords: { size: 13, notes: notes },
        tooltip: { callbacks: { label: function (item) { return item.dataset.label + ": " + WCA.fmt.count(item.parsed.y) + " children"; } } },
      },
    },
    plugins: [pointWords, hoverLine, { id: "placeWords", afterUpdate: placeWords }],
  });

  describe(canvas, chart.title + ". " + chart.series.map(function (s) {
    return s.label + ": " + chart.years.map(function (year, i) { return year + " " + (s.values[i] === null ? "no figure" : WCA.fmt.count(s.values[i])); }).join(", ");
  }).join(". ") + ".");
}


/* Page 2.15: Early Intervention therapists statewide, one bar a year in the Bulletin's purple, every bar
   with its count above it. The scale is the Bulletin's and does NOT start at zero: it runs from 1,000
   below the 500 step under the shortest bar to one step above the tallest (11,500 to 15,500), so the
   bars show the change from year to year. The user chose the Bulletin's scale (2026-11-19). */
function drawTherapists(data) {
  var chart = data.charts.s2_15_therapists;
  var canvas = document.getElementById("chart-therapists");
  var STEP = 500;
  var low = Math.floor(Math.min.apply(null, chart.values) / STEP) * STEP - 2 * STEP;
  var high = Math.ceil(Math.max.apply(null, chart.values) / STEP) * STEP + STEP;

  new Chart(canvas, {
    type: "bar",
    data: { labels: chart.years, datasets: [{ label: "Therapists", data: chart.values, backgroundColor: WCA.cssVar("--db-therapists") }] },
    options: {
      datasets: { bar: { barPercentage: 0.62, categoryPercentage: 0.96, borderRadius: 0 } },      /* square bars with wide gaps, as in the Bulletin */
      layout: { padding: { top: 6 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1) } },
        y: { min: low, max: high, ticks: { stepSize: STEP, callback: WCA.fmt.count } },
      },
      plugins: {
        /* every bar's count on a wide screen; on a narrow one the first and the latest (the rest on hover) */
        barNotes: { size: 13, text: function (d, i) { return WCA.fmt.count(chart.values[i]); },
                    narrow: 440, narrowText: function (d, i) { return (i === 0 || i === chart.values.length - 1) ? WCA.fmt.count(chart.values[i]) : null; } },
        tooltip: { callbacks: {
          title: function (items) { return String(items[0].label); },
          label: function (item) { return WCA.fmt.count(item.parsed.y) + " therapists"; },
        } },
      },
    },
    plugins: [barNotes],
  });

  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) { return year + ": " + WCA.fmt.count(chart.values[i]); }).join(", ") + ".");
}


/* Pages 2.14 and 2.16: the share of children who leave a program at age-typical levels, one line per
   outcome. The two pages are the same picture, so one function draws both: */
function drawEarlyInterventionExits(data) {
  drawOutcomeLines(data.charts.s2_14_early_intervention_exits, document.getElementById("chart-ei-exits"), document.getElementById("key-ei-exits"));
}
function drawPreschoolExits(data) {
  drawOutcomeLines(data.charts.s2_16_preschool_exits, document.getElementById("chart-preschool-exits"), document.getElementById("key-preschool-exits"));
}

/* Three lines, one per outcome, in the same three colors on both cards. Each line's first value is written
   to the left of its first point and its latest value to the right of its last point, in the line's
   color; values that would touch are moved apart. The key is a small box on the chart, top right, as in
   the Bulletin, and its entries are buttons: pressing one singles that outcome out (its line stays in
   color and carries every year's value; the other two turn gray and lose their values), pressing it
   again brings all three back. The change is animated unless the reader asked for less movement. */
function drawOutcomeLines(chart, canvas, key) {
  var frame = canvas.parentNode;
  var names = ["social", "knowledge", "behavior"];
  var colors = {}, textColors = {};
  names.forEach(function (name) { colors[name] = textColors[name] = WCA.cssVar("--db-outcome-" + name); });
  textColors.behavior = WCA.db.calloutText;                          /* rust as text is one step darker, so it reads on white */
  var quiet = WCA.cssVar("--db-quiet");
  var years = chart.years, span = years[years.length - 1] - years[0], end = years.length - 1;
  var only = null;                                                   /* the one outcome on show (its place in chart.outcomes); null = all three */

  /* The scale: the Bulletin's (OUTCOME_SCALE in Settings), grown by whole steps if a value falls outside it */
  var all = [];
  chart.outcomes.forEach(function (o) { o.values.forEach(function (v) { if (v !== null) all.push(v); }); });
  var step = OUTCOME_SCALE.step;
  var low = Math.min(OUTCOME_SCALE.min, Math.floor(Math.min.apply(null, all) / step) * step);
  var high = Math.max(OUTCOME_SCALE.max, Math.ceil(Math.max.apply(null, all) / step) * step);

  /* Room is kept inside the chart, left of the first year and right of the last, for the values written
     there: `room` pixels on each side, turned into years for the width the chart has */
  var ROOM = 56;
  function sides(width) { return Math.min(Math.max(ROOM * span / Math.max(width - 60 - 2 * ROOM, 120), 0.3), 4); }

  /* The key: one button per outcome */
  var buttons = chart.outcomes.map(function (o, d) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "key-button";
    button.setAttribute("aria-pressed", "false");
    button.style.setProperty("--hue", colors[o.key]);
    button.innerHTML = '<span class="dot"></span>';
    button.appendChild(document.createTextNode(o.label));
    button.addEventListener("click", function () { show(d); });
    key.appendChild(button);
    return button;
  });

  /* The values written on the chart (an add-on that runs after the lines are drawn) */
  var valueLabels = {
    id: "outcomeValues",
    afterDatasetsDraw: function (drawn) {
      var ctx = drawn.ctx, area = drawn.chartArea;
      ctx.save();
      ctx.font = "700 13px " + WCA.font;
      ctx.textBaseline = "middle";
      function write(text, x, y, align, color) {
        var width = ctx.measureText(text).width;
        var left = align === "right" ? x - width : (align === "center" ? x - width / 2 : x);
        ctx.fillStyle = SURFACE;
        ctx.fillRect(left - 3, y - 9, width + 6, 18);
        ctx.fillStyle = color;
        ctx.textAlign = "left";
        ctx.fillText(text, left, y + 1);
      }
      if (only === null) {
        /* all three lines: the first value left of the first point, the latest right of the last */
        [0, end].forEach(function (i) {
          var items = [];
          chart.outcomes.forEach(function (o, d) {
            var point = drawn.getDatasetMeta(d).data[i];
            if (point && o.values[i] !== null) items.push({ x: point.x, y: point.y, text: WCA.fmt.pct(o.values[i]), color: textColors[o.key] });
          });
          spread(items, 17, area.top + 9, area.bottom - 9);
          items.forEach(function (item) { write(item.text, i === 0 ? item.x - 11 : item.x + 11, item.y, i === 0 ? "right" : "left", item.color); });
        });
      } else {
        /* one line: every year's value above its point (every other one where the points are close together) */
        var o = chart.outcomes[only], points = drawn.getDatasetMeta(only).data;
        var apart = points.length > 1 ? Math.abs(points[1].x - points[0].x) : 100;
        var every = apart >= 44 ? 1 : (apart >= 22 ? 2 : 3);
        points.forEach(function (point, i) {
          if (o.values[i] === null || ((end - i) % every !== 0 && i !== 0)) return;
          write(WCA.fmt.pct(o.values[i]), point.x, point.y - 17, "center", textColors[o.key]);
        });
      }
      ctx.restore();
    },
  };

  /* Put the key in the chart's upper right corner, half above the chart's top line as in the Bulletin, if
     the lines leave that corner free; above the chart if they do not (a phone). The chart keeps room
     above its top line only while the key sits there (ON_CHART pixels; ABOVE when the key is above).
     Changing that room means laying the chart out once more, which is asked for after this run. */
  var ON_CHART = 46, ABOVE = 8, waiting = false;
  function placeKey(drawn) {
    var area = drawn.chartArea, padding = drawn.options.layout.padding;
    if (key.parentNode !== frame) frame.appendChild(key);              /* back on the chart to be measured */
    key.classList.remove("above");
    var width = key.offsetWidth, height = key.offsetHeight;
    var right = area.right - 2, left = right - width, highest = Infinity;   /* the highest any line gets under the key */
    chart.outcomes.forEach(function (o, d) {
      drawn.getDatasetMeta(d).data.forEach(function (point) { if (point.x >= left - 30 && !isNaN(point.y)) highest = Math.min(highest, point.y); });
    });
    /* where that highest point would be with the room for the key kept above the chart */
    var tall = area.bottom - area.top, moved = ON_CHART - padding.top;
    var wouldBe = ON_CHART + (highest - area.top) * (tall - moved) / (tall || 1);
    var fits = left >= area.left + 40 && wouldBe - 15 >= height;
    if (fits) {
      key.style.left = left + "px";
      key.style.top = "0px";
      key.classList.add("placed");
    } else {
      key.classList.remove("placed");
      key.classList.add("above");
      key.style.left = key.style.top = "";
      frame.parentNode.insertBefore(key, frame);
    }
    var wanted = fits ? ON_CHART : ABOVE;
    if (padding.top !== wanted && !waiting) {
      waiting = true;
      requestAnimationFrame(function () { waiting = false; padding.top = wanted; drawn.update("none"); });
    }
  }

  var lines = new Chart(canvas, {
    type: "line",
    data: {
      datasets: chart.outcomes.map(function (o) {
        return lineSeries(o.label, o.values.map(function (value, i) { return { x: years[i], y: value }; }), colors[o.key]);
      }),
    },
    options: {
      interaction: { mode: "index", intersect: false },              /* the hover box lists all three outcomes for the year nearest the mouse */
      layout: { padding: { top: ON_CHART, right: 4 } },              /* the top: room for the key (see placeKey) */
      onResize: function (resized, size) {
        var x = resized.options.scales.x;
        x.min = years[0] - sides(size.width); x.max = years[end] + sides(size.width);
      },
      scales: {
        x: { type: "linear", min: years[0] - sides(frame.clientWidth), max: years[end] + sides(frame.clientWidth), grid: { display: false },
             afterBuildTicks: function (axis) { axis.ticks = years.map(function (year) { return { value: year }; }); },
             ticks: { maxRotation: 0, autoSkip: false,
                      /* every year where there is room, every other one (counted back from the latest) where there is not */
                      callback: function (value) {
                        var room = (this.maxWidth || this.width || 0) / years.length;
                        return (room >= 38 || (years[end] - value) % 2 === 0) ? String(value) : null;
                      } } },
        y: { min: low, max: high, ticks: { stepSize: step, callback: pctTick } },
      },
      plugins: {
        tooltip: { callbacks: {
          title: function (items) { return String(items[0].parsed.x); },
          label: function (item) { return item.dataset.label + ": " + WCA.fmt.pct(item.parsed.y); },
        } },
      },
    },
    plugins: [valueLabels, hoverLine, { id: "placeKey", afterUpdate: placeKey }],
  });

  /* Single one outcome out (d is its place in chart.outcomes); the one already singled out goes back to all three */
  function show(d) {
    only = (only === d) ? null : d;
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === only ? "true" : "false"); });
    key.classList.toggle("one-on", only !== null);
    chart.outcomes.forEach(function (o, i) {
      var series = lines.data.datasets[i], color = (only === null || i === only) ? colors[o.key] : quiet;
      series.borderColor = series.backgroundColor = series.pointBackgroundColor = color;
      series.order = (i === only) ? 0 : 1;                           /* the line singled out is drawn over the other two */
    });
    if (!STILL) lines.options.animation = { duration: 450 };         /* this change is allowed to move, so the eye can follow it */
    lines.update();
  }

  describe(canvas, chart.title + ". " + chart.outcomes.map(function (o) {
    return o.label + ": " + years.map(function (year, i) { return year + " " + WCA.fmt.pct(o.values[i]); }).join(", ");
  }).join(". ") + ".");
}


/* Page 2.17: state-funded pre-K in Westchester's public school districts. Three pieces:
     a. the pie: of the four-year-olds the state estimates were eligible, the share enrolled and the share
        not enrolled, drawn as plain SVG with the words on the slices (the words are in index.html);
     b. the circle: how many districts had a program (words and numbers in index.html);
     c. the trend: all children served, school year by school year, as a filled shape running from green
        to blue, with each value above its point and the Bulletin's words written on the shape. Its
        scale is the Bulletin's: it starts 100 below the 100 step under the lowest value (3,700), not at 0.
   The year buttons show an earlier school year the same way: the pie turns to that year's shares, the
   trend marks that year, and every number index.html fills from the block's "latest" is written again
   for the year chosen. A click on a year of the trend does the same as its button. */
function drawUniversalPreK(data) {
  var chart = data.charts.s2_17_universal_pre_k;
  var card = document.getElementById("card-2-17");
  var pie = document.getElementById("pie-prek");
  var canvas = document.getElementById("chart-prek-trend"), frame = canvas.parentNode;
  var words = document.getElementById("note-prek-trend");
  var status = document.getElementById("prek-status");
  var years = chart.years, end = years.length - 1;
  var shown = end;                                                   /* the school year on show: its place in chart.years */

  /* a. The pie. Angles are in degrees, clockwise from 12 o'clock: "not enrolled" is the slice on the right,
        from 12 o'clock down; "enrolled" is the rest, on the left, as in the Bulletin. */
  function point(angle, r) {
    var a = angle * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + " " + (-r * Math.cos(a)).toFixed(2);
  }
  function slice(a0, a1) {
    return "M0 0L" + point(a0, 100) + "A100 100 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + point(a1, 100) + "Z";
  }
  pie.insertAdjacentHTML("afterbegin", '<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">' +
    '<path class="pie-slice not"/><path class="pie-slice enrolled"/></svg>');
  var slices = { not: pie.querySelector(".pie-slice.not"), enrolled: pie.querySelector(".pie-slice.enrolled") };
  var labels = { not: pie.querySelector('.pie-label[data-slice="not"]'), enrolled: pie.querySelector('.pie-label[data-slice="enrolled"]') };
  /* white words where white reads on the slice's color, dark words where it does not */
  labels.not.style.color = textOn(WCA.cssVar("--db-prek-not"));
  labels.enrolled.style.color = textOn(WCA.cssVar("--db-prek-enrolled"));
  function drawPie(notShare) {                                       /* notShare: the share not enrolled, 0 to 100 */
    var turn = notShare / 100 * 360;
    slices.not.setAttribute("d", slice(0, turn));
    slices.enrolled.setAttribute("d", slice(turn, 360));
    /* each slice's words sit in the middle of the slice, a little more than halfway out */
    [["not", turn / 2], ["enrolled", turn + (360 - turn) / 2]].forEach(function (pair) {
      var a = pair[1] * Math.PI / 180;
      labels[pair[0]].style.left = (50 + 27 * Math.sin(a)) + "%";
      labels[pair[0]].style.top = (50 - 27 * Math.cos(a)) + "%";
    });
  }
  var pieAt = 100 - years[shown].served_pct, stopPie = null;

  /* c. The trend */
  var values = years.map(function (year) { return year.children_served; });
  var STEP = 100;
  var base = Math.floor(Math.min.apply(null, values) / STEP) * STEP - STEP;
  var peak = Math.max.apply(null, values);
  var area = lineSeries("Children served", values, WCA.colors.blue);
  area.borderWidth = 0;
  area.fill = "start";
  area.backgroundColor = function (context) {                        /* a solid fill, green at the left to blue at the right */
    var plot = context.chart.chartArea;
    if (!plot) return WCA.colors.green;
    var blend = context.chart.ctx.createLinearGradient(plot.left, 0, plot.right, 0);
    blend.addColorStop(0, WCA.colors.green);
    blend.addColorStop(1, WCA.colors.blue);
    return blend;
  };
  /* only the year on show has a dot: white, ringed in dark */
  area.pointRadius = function (context) { return context.dataIndex === shown ? 6 : 0; };
  area.pointHoverRadius = 6;
  area.pointBackgroundColor = SURFACE;
  area.pointBorderColor = WCA.colors.ink;
  area.pointBorderWidth = 2.5;

  /* The Bulletin's words on the shape: in the middle of the chart, halfway up the shape under them. Smaller
     where the chart is narrow; above the chart where even that does not fit. */
  function placeWords(drawn) {
    if (!words) return;
    var plot = drawn.chartArea, points = drawn.getDatasetMeta(0).data;
    if (words.parentNode !== frame) frame.appendChild(words);          /* back on the chart to be measured */
    words.classList.remove("above", "small");
    if (words.offsetWidth > plot.right - plot.left - 60) words.classList.add("small");
    var width = words.offsetWidth, height = words.offsetHeight;
    var left = plot.left + (plot.right - plot.left - width) / 2, top = plot.top;
    points.forEach(function (p) { if (p.x >= left - 20 && p.x <= left + width + 20) top = Math.max(top, p.y); });   /* the shape's lowest edge above the words */
    if (width <= plot.right - plot.left - 24 && plot.bottom - top >= height + 16) {
      words.style.left = left + "px";
      words.style.top = (top + (plot.bottom - top - height) / 2) + "px";
      words.classList.add("placed");
    } else {
      words.classList.remove("placed");
      words.classList.add("above");
      words.style.left = words.style.top = "";
      frame.parentNode.insertBefore(words, frame);
    }
  }

  var trend = new Chart(canvas, {
    type: "line",
    data: { labels: chart.school_years, datasets: [area] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 4, left: 42, right: 26 } },         /* room at the sides for the first and the last value and school year */
      onClick: function (event, items) { if (items.length) show(items[0].index, true); },
      onHover: function (event, items) { event.native.target.style.cursor = items.length ? "pointer" : "default"; },
      scales: {
        /* under the shape: the first and the last school year, and the one on show (in bold). A label's
           place in the data is its tick's value: Chart.js drops the labels left out and renumbers the rest. */
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, padding: 4,
             color: function (context) { return context.tick && context.tick.value === shown ? WCA.colors.ink : WCA.colors.fine; },
             font: function (context) { return { size: 13, weight: context.tick && context.tick.value === shown ? "700" : "400" }; },
             callback: function (value, index) { return (index === 0 || index === end || index === shown) ? this.getLabelForValue(value) : null; } } },
        y: { display: false, min: base, max: peak + (peak - base) * 0.3 },
      },
      plugins: {
        /* every value above its point; the first one to the left of its point, clear of the shape's rising edge */
        pointWords: { size: 14, reach: "canvas", notes: values.map(function (value, i) {
          return { index: i, lines: [WCA.fmt.count(value)], side: i === 0 ? "left" : null };
        }) },
        tooltip: { callbacks: {
          title: function (items) { return "School year " + items[0].label; },
          label: function (item) { return [WCA.fmt.count(item.parsed.y) + " children in state-funded pre-K", "(three- and four-year-olds)"]; },
        } },
      },
    },
    plugins: [pointWords, { id: "placeWords", afterUpdate: placeWords }],
  });
  describe(canvas, "Children served in state-funded pre-K in Westchester's public school districts: " + years.map(function (year) {
    return WCA.fmt.count(year.children_served) + " in " + year.school_year;
  }).join(", ") + ".");

  /* Show one school year (y is its place in chart.years). `moving` lets the pie turn to its new shape
     instead of jumping there (not when the page first draws it). */
  function show(y, moving) {
    var year = years[y], to = 100 - year.served_pct;
    shown = y;
    refill(card, "charts.s2_17_universal_pre_k.latest.", year);
    if (stopPie) stopPie();
    stopPie = glide(moving ? pieAt : to, to, 500, function (at) { pieAt = at; drawPie(at); });
    trend.update("none");
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
    describe(pie, "School year " + year.school_year + ": of " + WCA.fmt.count(year.eligible_four_year_olds) + " four-year-olds the state estimates were eligible, " +
      WCA.fmt.count(year.four_year_olds_served) + " (" + WCA.fmt.pct(year.served_pct) + ") were enrolled in state-funded pre-K.");
    slices.enrolled.tip = "<strong>Enrolled, " + plainText(year.school_year) + "</strong><br>" + WCA.fmt.count(year.four_year_olds_served) + " four-year-olds, " +
      WCA.fmt.pct(year.served_pct) + " of the " + WCA.fmt.count(year.eligible_four_year_olds) + " the state estimates were eligible";
    slices.not.tip = "<strong>Not enrolled, " + plainText(year.school_year) + "</strong><br>" + WCA.fmt.count(year.eligible_four_year_olds - year.four_year_olds_served) +
      " four-year-olds, " + WCA.fmt.pct(Math.round((100 - year.served_pct) * 10) / 10) + " of those eligible";
    if (moving) status.textContent = "Showing school year " + year.school_year + ".";
  }

  /* The lead sentence can wrap differently from year to year ("about half", "about 4 in 10"). So that a
     change of year never moves what is under it, the lead is given the height of its tallest year. */
  var lead = card.querySelector(".prek-lead");
  function reserveLead() {
    lead.style.minHeight = "";
    var tallest = 0;
    years.forEach(function (year) {
      refill(lead, "charts.s2_17_universal_pre_k.latest.", year);
      tallest = Math.max(tallest, lead.offsetHeight);
    });
    refill(lead, "charts.s2_17_universal_pre_k.latest.", years[shown]);
    lead.style.minHeight = tallest + "px";
  }

  /* One button per school year; the latest shows first */
  var switcher = document.getElementById("prek-years");
  var buttons = years.map(function (year, y) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = year.school_year;
    button.addEventListener("click", function () { show(y, true); });
    switcher.appendChild(button);
    return button;
  });
  hoverTips(pie);
  show(shown, false);
  reserveLead();
  whenLayoutChanges(reserveLead, card);
}


/* ---- CHAPTER 3 ---------------------------------------------------------- */

/* Chapter 3 was redrawn on 2026-11-20 to the habits of chapters 1 and 2: numbers and names on a chart are 12 to 15
   pixels (big type is kept for a card's featured number), a value sits inside the end of its bar, words placed on
   a chart sit on the color behind them, and a button sits right above the chart it changes, without ever changing
   the card's size or the chart's scale. The Bulletin's content and its message graphics (circles with arrows,
   pointer boxes, shaded years, triangles, the maps) are kept. */

/* Pages 3.3 and 3.7 share a map, drawn by drawCountyMap (part 5) from data/Geography.json. */

/* Page 3.3: the four communities on the map and in the table. The table's rows are written here from data.json;
   pointing at a community (its place, its name or its row) lights up all three. */
function drawFourCommunities(data) {
  var chart = data.charts.s3_3_four_communities;
  var body = document.querySelector("#table-four-places tbody");
  var rows = chart.communities.map(function (c) {
    var row = document.createElement("tr");
    row.setAttribute("data-key", c.key);
    row.tabIndex = 0;
    row.innerHTML = '<th scope="row"></th><td></td><td></td><td class="rate"></td>';
    row.children[0].textContent = c.name;
    row.children[1].textContent = WCA.fmt.count(c.children);
    row.children[2].textContent = WCA.fmt.count(c.in_poverty);
    row.children[3].textContent = WCA.fmt.pct(c.rate);
    body.appendChild(row);
    return row;
  });
  var box = document.getElementById("map-four-places");
  loadGeography().then(function (outlines) {
    var map = drawCountyMap(box, outlines, chart.communities.map(function (c) {
      return { key: c.key, cousub: c.cousub, html: plainText(c.name),
               tip: "<strong>" + plainText(c.name) + "</strong><br>" + WCA.fmt.count(c.in_poverty) + " of " + WCA.fmt.count(c.children) +
                    " children 5-17 in poverty (" + WCA.fmt.pct(c.rate) + ")" };
    }));
    linkPlaces(box, map.items.concat(rows));
    describe(box, "Map of Westchester County with " + chart.communities.map(function (c) { return c.name; }).join(", ") + " highlighted.");
  }).catch(function (error) { console.error("Could not draw the map on page 3.3:", error); });
}


/* Page 3.4: homeless students per 1,000 enrolled. The pandemic years are a solid band (their dates written in it);
   three points are orange, each with a word above it and its rate under it, both centered on the point; the small
   table sits in the empty part of the chart; the orange box right under the years points up at the year the
   eviction moratorium ended. */
function drawHomelessRate(data) {
  var chart = data.charts.s3_4_homeless_rate;
  var canvas = document.getElementById("chart-homeless-rate"), frame = canvas.parentNode;
  var marked = { before: chart.before, low: chart.low, last: chart.last };
  var markedYears = [chart.before.year, chart.low.year, chart.last.year];
  var bandWords = document.getElementById("note-pandemic"), table = document.getElementById("table-homeless-counts");
  var box = document.getElementById("note-moratorium");
  var color = WCA.cssVar("--db-homeless-line"), orange = WCA.db.callout;
  var series = lineSeries("Homeless students per 1,000 enrolled", chart.rates, color);
  series.pointBackgroundColor = chart.years.map(function (year) { return markedYears.indexOf(year) >= 0 ? orange : color; });
  series.pointRadius = chart.years.map(function (year) { return markedYears.indexOf(year) >= 0 ? 7 : 5; });
  series.pointHoverRadius = 8;
  var top = Math.ceil(Math.max.apply(null, chart.rates) / 5) * 5;
  function narrow(c) { return c.width < 560; }

  function place(drawn) {
    var area = drawn.chartArea, x = drawn.scales.x;
    var points = drawn.getDatasetMeta(0).data;
    var line = points.map(function (point) { return { x: point.x, y: point.y }; });
    frame.classList.toggle("narrow", narrow(drawn));                   /* a narrow chart: the rates without "per 1,000 students" */
    /* the band's dates: at the middle of the band, just above the years */
    var from = x.getPixelForValue(chart.years.indexOf(PANDEMIC_YEARS[0])), to = x.getPixelForValue(chart.years.indexOf(PANDEMIC_YEARS[1]));
    bandWords.style.maxWidth = Math.max(80, to - from - 8) + "px";
    putNote(bandWords, (from + to) / 2 - bandWords.offsetWidth / 2, area.bottom - bandWords.offsetHeight - 8);
    /* each marked point: its word above it and its rate under it, both centered on the point (the chart keeps room
       at its right end for the last point's). Where the line runs through the place under the point (a narrow
       chart), the rate goes above the point and its word above the rate; a word the line runs through moves to
       the point's left or right side. Words that sit on the shaded years take the band's color behind them. */
    Object.keys(marked).forEach(function (key) {
      var point = points[chart.years.indexOf(marked[key].year)];
      var word = frame.querySelector('.point-word[data-point="' + key + '"]');
      var label = frame.querySelector('.point-label[data-point="' + key + '"]');
      var ww = word.offsetWidth, wh = word.offsetHeight, lw = label.offsetWidth, lh = label.offsetHeight;
      function inside(left, width) { return Math.min(Math.max(left, area.left + 2), frame.clientWidth - width); }   /* never over the scale's numbers, never past the right edge */
      var lLeft = inside(point.x - lw / 2, lw), lTop = point.y + 12;
      var wLeft = inside(point.x - ww / 2, ww), wTop = point.y - 12 - wh;
      function crosses(left, top, width, height) { return coversLine(left + 1, top + 1, width - 2, height - 2, line); }
      if (crosses(lLeft, lTop, lw, lh)) { lTop = point.y - 12 - lh; wTop = lTop - 2 - wh; }
      if (crosses(wLeft, wTop, ww, wh)) {
        var moved = [point.x - 10 - ww, point.x + 10].some(function (left) {
          left = inside(left, ww);
          if (crosses(left, wTop, ww, wh)) return false;
          wLeft = left; return true;
        });
        if (!moved && lTop > point.y) { wLeft = inside(point.x - ww / 2, ww); wTop = lTop + lh + 2; }   /* the low point: its word under its rate */
      }
      putNote(word, wLeft, Math.max(0, wTop));
      putNote(label, lLeft, lTop);
      [[word, wLeft, ww], [label, lLeft, lw]].forEach(function (w) { w[0].classList.toggle("on-band", w[1] >= from - 1 && w[1] + w[2] <= to + 1); });
    });
    /* the small table: bottom left, under the line; under the chart (below the orange box) if it would touch the
       line, a rate or the band's dates there */
    table.classList.remove("under");
    if (table.parentNode !== frame) frame.appendChild(table);
    var tLeft = area.left + 10, tTop = area.bottom - table.offsetHeight - 10, clear = true;
    points.forEach(function (point) {
      if (point.x >= tLeft - 10 && point.x <= tLeft + table.offsetWidth + 10 && point.y + 44 > tTop) clear = false;
    });
    frame.querySelectorAll(".point-label.placed, .band-words.placed").forEach(function (label) {
      if (label.offsetLeft < tLeft + table.offsetWidth + 6 && label.offsetLeft + label.offsetWidth > tLeft - 6 &&
          label.offsetTop + label.offsetHeight > tTop) clear = false;
    });
    if (clear && tTop > area.top) putNote(table, tLeft, tTop);
    else { table.classList.remove("placed"); table.classList.add("under"); table.style.left = table.style.top = ""; frame.parentNode.appendChild(table); }
    /* the orange box: its point right under the moratorium's year */
    var at = x.getPixelForValue(chart.years.indexOf(MORATORIUM_YEAR));
    pointAt(box, at, canvas);
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: [series] },
    options: {
      interaction: { mode: "index", intersect: false },
      /* room above the line for the points' words, and at the right for the last point's words to be centered on it */
      layout: { padding: function (c) { return { top: narrow(c.chart) ? 64 : 40, right: narrow(c.chart) ? 34 : 68, left: 4 }; } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, font: function (context) {
               return { size: context.chart.width < 420 ? 11 : 13, weight: markedYears.indexOf(chart.years[context.index]) >= 0 ? "700" : "400" }; },
               color: function (context) { return markedYears.indexOf(chart.years[context.index]) >= 0 ? WCA.colors.ink : WCA.colors.fine; } } },
        y: { min: 0, max: top, ticks: { stepSize: 5 } },
      },
      plugins: {
        yearBand: { from: PANDEMIC_YEARS[0], to: PANDEMIC_YEARS[1], color: WCA.cssVar("--db-pandemic"), over: true },
        tooltip: { callbacks: {
          title: function (items) { return "School year " + chart.school_years[items[0].dataIndex]; },
          label: function (item) { var i = item.dataIndex;
            return [chart.rates[i].toFixed(1) + " homeless students per 1,000 enrolled",
                    WCA.fmt.count(chart.counts[i]) + " students identified as homeless"]; },
        } },
      },
    },
    plugins: [yearBand, hoverLine, { id: "placeWords", afterUpdate: function (drawn) { requestAnimationFrame(function () { place(drawn); }); } }],
  });
  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) { return year + ": " + chart.rates[i].toFixed(1); }).join(", ") + ".");
}


/* Page 3.5: the change columns and the arrows of the Bulletin's table. A row whose count rose is cream with rust words
   and an arrow up; a row whose count fell has a gray arrow down. */
function drawLivingSituations(data) {
  var chart = data.charts.s3_5_living_situations;
  chart.situations.forEach(function (s) {
    var row = document.querySelector('#table-living tr[data-key="' + s.key + '"]');
    if (!row) return;
    row.classList.toggle("rising", s.rising);
    row.classList.toggle("falling", !s.rising);
    row.querySelector(".js-change").textContent = (s.change > 0 ? "+" : "") + WCA.fmt.count(s.change).replace("-", "−");
    row.querySelector(".js-change-pct").innerHTML = '<span class="pct-cell"><span class="arrow" aria-hidden="true"></span><span>' +
      (s.change_pct > 0 ? "+" : "") + s.change_pct.toFixed(1).replace("-", "−") + "%</span></span>";
  });
  labelCells(document.getElementById("table-living"));
}


/* Page 3.6: homeless students per 1,000 enrolled by race and ethnicity, drawn like page 1.4's pairs: the earlier year
   pale and the latest in full color, the value over each bar. Three of the five pairs are too short to hold their
   years, so the years are written under every pair (yearsUnderBars) and the group's name under them. Over each pair,
   the change with a small solid triangle (rust and pointing up for a rise, gray and pointing down for a fall); the
   number sits on a white patch, so that no gray line runs through it. */
function drawHomelessByRace(data) {
  var chart = data.charts.s3_6_homeless_by_race;
  var canvas = document.getElementById("chart-homeless-race");
  var top = Math.ceil(Math.max.apply(null, chart.groups.map(function (g) { return Math.max(g.first, g.last); })) / 20) * 20;   /* 77.0 -> 80, as printed */
  var NARROW = 420;                                                    /* a chart narrower than this (a phone) */
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: chart.groups.map(function (g) { return g.label; }),
      datasets: chart.years.map(function (year, y) {
        return {
          label: String(year),
          data: chart.groups.map(function (g) { return y === 0 ? g.first : g.last; }),
          backgroundColor: chart.groups.map(function (g) { return y === 0 ? WCA.db.race[g.key].light : WCA.db.race[g.key].full; }),
        };
      }),
    },
    options: {
      datasets: { bar: { barPercentage: 0.94, categoryPercentage: 0.74, maxBarThickness: 50 } },      /* the same bars as page 1.4 (wider on a narrow chart: see "narrowBars" below) */
      layout: { padding: { top: 56 } },                                                               /* room over the tallest pair for its change */
      scales: {
        /* each group's name under its bars and their years, level: on shorter lines, in smaller type, on a narrow chart */
        x: { grid: { display: false }, ticks: { color: WCA.colors.ink, maxRotation: 0, autoSkip: false, padding: 22,
             font: function (context) { var w = context.chart.width; return { size: w < NARROW ? 10.5 : (w < 600 ? 12 : 13), weight: "600" }; },
             callback: function (value) { var label = this.getLabelForValue(value); return wrap(label, this.chart.width < 600 ? 9 : 16); } } },
        y: { beginAtZero: true, max: top, ticks: { stepSize: 20 } },
      },
      plugins: {
        yearsUnderBars: { on: true },
        barNotes: { size: 12, narrow: NARROW, narrowSize: 11, text: function (d, i) { return (d === 0 ? chart.groups[i].first : chart.groups[i].last).toFixed(1); } },
        changeMarks: { changes: chart.groups.map(function (g) { return g.change; }),
                       up: WCA.cssVar("--db-change-up"), down: WCA.cssVar("--db-change-down"),
                       upText: WCA.db.calloutText, downText: WCA.colors.fine },
        tooltip: { callbacks: {
          title: function (items) { return chart.groups[items[0].dataIndex].label + ", " + chart.years[items[0].datasetIndex]; },
          label: function (item) { var g = chart.groups[item.dataIndex], y = item.datasetIndex;
            return [(y === 0 ? g.first : g.last).toFixed(1) + " homeless students per 1,000 enrolled",
                    WCA.fmt.count(g.counts[y]) + " students identified as homeless"]; },
        } },
      },
    },
    /* on a narrow chart the pairs take more of their share of the width, so the two values over a pair don't touch */
    plugins: [{ id: "narrowBars", beforeUpdate: function (c) { c.options.datasets.bar.categoryPercentage = c.width < NARROW ? 0.92 : 0.74; } },
              yearsUnderBars, barNotes, changeMarks],
  });
  describe(canvas, chart.title + ". " + chart.groups.map(function (g) {
    return g.label + ": " + g.first.toFixed(1) + " in " + chart.years[0] + ", " + g.last.toFixed(1) + " in " + chart.years[1];
  }).join("; ") + ".");
}


/* Page 3.7: two upright bars on a scale of 0 to 100% (graduation), and the map with each community's count of
   homeless students. */
function drawGraduationAndCities(data) {
  var chart = data.charts.s3_7_graduation_and_cities;
  var bars = document.getElementById("bars-graduation");
  /* the gray lines behind the bars, one at each step of the scale, with the scale's numbers at their left */
  bars.querySelector(".tb-grid").innerHTML = GRADUATION_SCALE_STEPS.map(function (v) {
    return '<span style="bottom:' + v + '%"></span><b style="bottom:' + v + '%">' + v + "%</b>";
  }).join("");
  [["all", chart.graduation.all, "All students"], ["homeless", chart.graduation.homeless, "Students experiencing homelessness"]].forEach(function (b) {
    var col = bars.querySelector('.tb-col[data-key="' + b[0] + '"]');
    col.style.setProperty("--v", b[1]);
    col.querySelector(".tb-bar").tip = "<strong>" + b[2] + "</strong><br>" + WCA.fmt.pct(b[1]) + " graduated in 4 years (class of " + chart.graduation.class_year + ")";
  });
  hoverTips(bars);
  describe(bars, "Graduation in four years, class of " + chart.graduation.class_year + ": all students " + WCA.fmt.pct(chart.graduation.all, 0) +
    ", students experiencing homelessness " + WCA.fmt.pct(chart.graduation.homeless, 0) + ".");
  var box = document.getElementById("map-homeless-cities");
  loadGeography().then(function (outlines) {
    var map = drawCountyMap(box, outlines, chart.cities.map(function (c) {
      return { key: c.key, cousub: c.cousub, html: plainText(c.name) + "<strong>" + WCA.fmt.count(c.count) + "</strong>",
               tip: "<strong>" + plainText(c.name) + "</strong><br>" + WCA.fmt.count(c.count) + " students identified as homeless, " + chart.cities_school_year };
    }));
    linkPlaces(box, map.items);
    describe(box, "Map of Westchester County. Students experiencing homelessness, " + chart.cities_school_year + ": " +
      chart.cities.map(function (c) { return c.name + " " + WCA.fmt.count(c.count); }).join(", ") + ".");
  }).catch(function (error) { console.error("Could not draw the map on page 3.7:", error); });
}


/* Page 3.9: the share of child abuse reports substantiated. Pale before the year the evidence standard changed, full
   color after it, with those years shaded; dots and values at the first year, that year and the latest (the latest
   larger, in the line's color). The circle sits in the empty space just left of the shaded years, as large as fits
   there over the line (above the chart where there is no room), and the gray box points at the change. */
function drawAbuseFindings(data) {
  var chart = data.charts.s3_9_abuse_findings;
  var canvas = document.getElementById("chart-abuse"), frame = canvas.parentNode;
  var circle = document.getElementById("circle-abuse"), note = document.getElementById("note-standard");
  var dark = WCA.cssVar("--db-abuse"), pale = WCA.cssVar("--db-abuse-before"), band = WCA.cssVar("--db-abuse-band");
  var s = chart.years.indexOf(chart.standard.year), end = chart.years.length - 1;
  var series = lineSeries("Share of reports substantiated", chart.rates, dark);
  series.borderWidth = 4;
  series.segment = { borderColor: function (part) { return part.p1DataIndex <= s ? pale : dark; } };
  series.pointRadius = chart.years.map(function (y, i) { return i === 0 || i === s || i === end ? 6 : 0; });
  series.pointBackgroundColor = chart.years.map(function (y, i) { return i < s ? pale : dark; });
  series.pointHoverRadius = 6;
  var top = Math.ceil(Math.max.apply(null, chart.rates) / 5) * 5;
  var LOW_SIZE = 13, LAST_SIZE = 17;                                   /* the low point's value and the latest one's, in pixels */
  var LOW_SHIFT = -10;                                                 /* the low point's value ends this far left of where it would, so its white patch stays off the shaded years */
  var aboveAt = null;                                                  /* the chart's width when the circle was last put above the chart */

  function place(drawn) {
    var area = drawn.chartArea, x = drawn.scales.x, y = drawn.scales.y;
    var points = drawn.getDatasetMeta(0).data;
    /* Above the chart the circle takes height from the chart, so the chart is lower there than with the circle on it.
       When the chart's width has changed since the circle went above, the circle is first put back on the chart:
       the chart takes its full height, is drawn again, and the circle's place is worked out from that. The result
       is then the same as on a fresh page of that width, whatever the window's width was before. */
    if (circle.classList.contains("above") && aboveAt !== drawn.width) {
      aboveAt = drawn.width;
      circle.classList.remove("above", "placed");
      frame.insertBefore(circle, note);
      requestAnimationFrame(function () { drawn.resize(); drawn.update("none"); });
      return;
    }
    if (circle.parentNode !== frame) frame.insertBefore(circle, note);
    circle.classList.remove("above");
    /* the circle: its right edge a little left of the shaded years, its top at the top of the chart; as large as
       fits there above the line, from ABUSE_CIRCLE.most down to ABUSE_CIRCLE.least (Settings). Where even the
       smallest does not fit, it goes above the chart instead. */
    var right = x.getPixelForValue(s) - 12, topEdge = 2, size = 0;
    for (var tryout = ABUSE_CIRCLE.most; tryout >= ABUSE_CIRCLE.least; tryout -= 2) {
      var left = right - tryout, bottom = topEdge + tryout, clear = left >= area.left + 40;
      points.forEach(function (point) {                                  /* no part of the line under the circle comes within 12 pixels of it */
        if (point.x < left - 12 || point.x > right + 12) return;
        var dx = Math.max(left + tryout / 2 - point.x, point.x - (left + tryout / 2), 0);
        if (point.y - 12 < bottom - (tryout / 2 - Math.sqrt(Math.max(tryout * tryout / 4 - Math.min(dx, tryout / 2) * Math.min(dx, tryout / 2), 0)))) clear = false;
      });
      if (clear) { size = tryout; break; }
    }
    if (size) {
      circle.style.setProperty("--circle", size + "px");
      putNote(circle, right - size, topEdge);
    } else {
      aboveAt = drawn.width;
      circle.classList.remove("placed"); circle.classList.add("above"); circle.style.removeProperty("--circle");
      circle.style.left = circle.style.top = ""; frame.parentNode.insertBefore(circle, frame);
    }
    /* the gray box: its arrow ends at the start of the shaded years, a little above the bottom; lower (or, with no
       room under it, further left) where it would touch the low point's value written under-left of that point */
    var low = points[s], ctx = drawn.ctx;
    ctx.save(); ctx.font = "700 " + LOW_SIZE + "px " + WCA.font;
    var valueWidth = ctx.measureText(WCA.fmt.pct(chart.standard.rate)).width;
    ctx.restore();
    var valueBottom = low.y + 12 + LOW_SIZE * 1.25 + 2, valueLeft = low.x + 6 + LOW_SHIFT - valueWidth - 3;
    var noteLeft = Math.max(area.left + 4, x.getPixelForValue(s) - note.offsetWidth - 2);
    var noteTop = y.getPixelForValue(top * 0.14) - note.offsetHeight / 2;
    if (noteTop < valueBottom + 4 && noteLeft + note.offsetWidth > valueLeft) {
      if (valueBottom + 4 + note.offsetHeight <= area.bottom - 2) noteTop = valueBottom + 4;
      else noteLeft = Math.max(area.left + 4, valueLeft - 4 - note.offsetWidth);
    }
    putNote(note, noteLeft, noteTop);
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: [series] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 30, right: 26 } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false,
             callback: function (value) { var year = chart.years[value]; return year % 5 === 0 ? String(year) : null; } } },
        y: { min: 0, max: top, afterBuildTicks: function (axis) { axis.ticks = axis.ticks.filter(function (t) { return t.value % 10 === 0; }); },
             ticks: { stepSize: 10, callback: pctTick } },
      },
      plugins: {
        yearBand: { from: chart.standard.year, to: chart.last.year, color: band, over: false, pad: 14 },
        /* the low point's value sits under-left of its point, on white, clear of the shaded years' edge; the latest
           one sits on the shaded years, on a patch of their color */
        pointWords: { notes: [
          { index: 0, lines: [WCA.fmt.pct(chart.first.rate_whole, 0)], size: 13 },
          { index: s, lines: [WCA.fmt.pct(chart.standard.rate)], size: LOW_SIZE, place: "below", side: "left", dx: LOW_SHIFT },
          { index: end, lines: [WCA.fmt.pct(chart.last.rate)], size: LAST_SIZE, side: "left", color: dark, patch: band },
        ] },
        tooltip: { callbacks: {
          title: function (items) { return String(items[0].label); },
          label: function (item) { return WCA.fmt.pct(item.parsed.y) + " of reports substantiated"; },
        } },
      },
    },
    plugins: [yearBand, pointWords, hoverLine, { id: "placeWords", afterUpdate: function (drawn) { requestAnimationFrame(function () { place(drawn); }); } }],
  });
  describe(canvas, chart.title + ". " + chart.years.map(function (year, i) { return year + ": " + chart.rates[i].toFixed(1) + "%"; }).join(", ") + ".");
}


/* Page 3.10: domestic violence reports by relationship, two lines named on the chart, the years since the rise began
   shaded, the latest value at the end of each line (on a patch of the shaded years' color). */
function drawDomesticViolence(data) {
  var chart = data.charts.s3_10_domestic_violence;
  var canvas = document.getElementById("chart-dv"), frame = canvas.parentNode;
  var colors = { partner: WCA.cssVar("--db-partner"), family: WCA.cssVar("--db-family") };
  var text = { partner: colors.partner, family: WCA.cssVar("--db-family-text") };
  var band = WCA.cssVar("--db-dv-band");
  var series = [lineSeries("Intimate partner", chart.partner, colors.partner), lineSeries("Other family", chart.family, colors.family)];
  var end = chart.years.length - 1;
  var top = Math.ceil(Math.max.apply(null, chart.partner) / 500) * 500;
  var END_SIZE = 16;                                                    /* the two latest values, in pixels */
  new Chart(canvas, {
    type: "line",
    data: { labels: chart.years, datasets: series },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 26, right: 10 } },
      scales: {
        /* every year where there is room; every other one, counted back from the latest, where there is not */
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: yearTicks(1), font: function (context) {
               return { size: 13, weight: chart.years[context.index] >= chart.from_year ? "700" : "400" }; } } },
        y: { min: 0, max: top, ticks: { stepSize: 500, callback: function (v) { return WCA.fmt.count(v); } } },
      },
      plugins: {
        yearBand: { from: chart.from_year, to: chart.last.year, color: band, over: false, pad: 14 },
        pointWords: { notes: [
          { dataset: 0, index: end, lines: [WCA.fmt.count(chart.last.partner)], size: END_SIZE, side: "left", color: text.partner, patch: band },
          { dataset: 1, index: end, lines: [WCA.fmt.count(chart.last.family)], size: END_SIZE, side: "left", color: text.family, patch: band },
        ] },
        tooltip: { callbacks: {
          title: function (items) { return String(items[0].label); },
          label: function (item) { return item.dataset.label + ": " + WCA.fmt.count(item.parsed.y) + " victims"; },
        } },
      },
    },
    plugins: [yearBand, pointWords, hoverLine, { id: "placeNames", afterUpdate: function (drawn) {
      requestAnimationFrame(function () { placeNames(drawn); }); } }],
  });

  /* Each line's name just above it, as in the Bulletin. Where the chart is too narrow for that (a name would
     cover a line or a line's last value), the names leave the chart and the key above it shows instead. */
  var key = document.getElementById("legend-dv");
  WCA.legend(key, ["partner", "family"].map(function (k) {
    var parts = frame.querySelectorAll('.line-name[data-series="' + k + '"] > span');
    return { label: Array.prototype.map.call(parts, function (p) { return p.textContent; }).join(" "), color: colors[k] };
  }));
  function placeNames(drawn) {
    placeLineNames(drawn, frame, [{ key: "partner" }, { key: "family" }], text, 16);
    var lines = [0, 1].map(function (d) { return drawn.getDatasetMeta(d).data.map(function (p) { return { x: p.x, y: p.y }; }); });
    var ctx = drawn.ctx;
    ctx.save();
    ctx.font = "700 " + END_SIZE + "px " + WCA.font;
    var ends = [chart.last.partner, chart.last.family].map(function (value, d) {     /* where pointWords writes each last value */
      var point = lines[d][end], width = ctx.measureText(WCA.fmt.count(value)).width;
      return { left: point.x + 3 - width, top: point.y - 12 - END_SIZE * 1.25 - 1, right: point.x + 9, bottom: point.y - 11 };
    });
    ctx.restore();
    var names = frame.querySelectorAll(".line-name");
    var crowded = Array.prototype.some.call(names, function (name) {
      var left = name.offsetLeft + 3, top = name.offsetTop + 3, width = name.offsetWidth - 6, height = name.offsetHeight - 6;
      return lines.some(function (line) { return coversLine(left, top, width, height, line); }) ||
        ends.some(function (e) { return left < e.right && left + width > e.left && top < e.bottom && top + height > e.top; });
    });
    names.forEach(function (name) { name.classList.toggle("placed", !crowded); });
    if (key.hidden !== !crowded) key.hidden = !crowded;
  }
  describe(canvas, chart.title + ". Intimate partner: " + chart.years.map(function (year, i) { return year + " " + chart.partner[i]; }).join(", ") +
    ". Other family: " + chart.years.map(function (year, i) { return year + " " + chart.family[i]; }).join(", ") + ".");
}


/* Page 3.11: the share of foster care days in each setting, three bars of 100% with a thin white gap between their
   parts. The three names stand in for a key: each sits right above its part of the first bar (the chart keeps room
   for them above that bar). The two orange boxes under the bars, kept inside the bars' width, point up at the parts
   of the latest bar they are about. */
function drawFosterCare(data) {
  var chart = data.charts.s3_11_foster_care;
  var canvas = document.getElementById("chart-foster"), frame = canvas.parentNode;
  var notes = document.getElementById("notes-foster");
  var hues = { relative: WCA.cssVar("--db-relative"), foster: WCA.cssVar("--db-foster"), congregate: WCA.cssVar("--db-congregate") };
  var names = {}, heads = {};
  frame.querySelectorAll(".seg-head").forEach(function (span) {
    var key = span.getAttribute("data-key");
    heads[key] = span;
    names[key] = span.textContent.replace(/\s+/g, " ").replace("- ", "-").trim();
  });
  var HEADS_ROOM = 58;                                                 /* the room kept above the first bar for the names (three lines of them) */

  function place(drawn) {
    var last = chart.years.length - 1, area = drawn.chartArea;
    notes.style.marginLeft = area.left + "px";                         /* the boxes start where the bars start */
    chart.settings.forEach(function (s, d) {
      var first = drawn.getDatasetMeta(d).data[0].getProps(["x", "base", "y", "height"], true);
      var head = heads[s.key];
      if (head) {
        var half = head.offsetWidth / 2, middle = (first.x + first.base) / 2;
        putNote(head, Math.min(Math.max(middle, area.left + half), drawn.width - half) - half, first.y - first.height / 2 - 6 - head.offsetHeight);
      }
      var box = notes.querySelector('.pointer-box[data-key="' + s.key + '"]');
      if (box) {
        var latest = drawn.getDatasetMeta(d).data[last].getProps(["x", "base"], true);
        pointAt(box, (latest.x + latest.base) / 2, canvas, true);
      }
    });
  }

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: chart.years.map(String),
      datasets: chart.settings.map(function (s, d) {
        return { label: names[s.key] || s.key, data: s.shares, backgroundColor: hues[s.key], borderRadius: 0, borderSkipped: false,
                 /* a thin gap of the page's own color between two parts that touch */
                 borderColor: SURFACE, borderWidth: { top: 0, bottom: 0, left: 0, right: d < chart.settings.length - 1 ? 2 : 0 } };
      }),
    },
    options: {
      indexAxis: "y",
      datasets: { bar: { barPercentage: 0.84, categoryPercentage: 1 } },
      layout: { padding: { top: HEADS_ROOM, bottom: 2 } },
      scales: {
        x: { stacked: true, min: 0, max: 100, display: false },
        y: { stacked: true, grid: { display: false }, ticks: { font: { size: 13, weight: "700" }, color: WCA.colors.ink } },
      },
      plugins: {
        valuesInParts: { format: function (v) { return v.toFixed(1) + "%"; }, size: 15 },
        tooltip: { callbacks: {
          title: function (items) { return items[0].label; },
          label: function (item) { var s = chart.settings[item.datasetIndex];
            return item.dataset.label + ": " + s.shares[item.dataIndex].toFixed(1) + "% (" + WCA.fmt.count(s.days[item.dataIndex]) + " days)"; },
        } },
      },
    },
    plugins: [valuesInParts, { id: "placeHeads", afterUpdate: function (drawn) { requestAnimationFrame(function () { place(drawn); }); } }],
  });
  describe(canvas, chart.title + ". " + chart.years.map(function (year, k) {
    return year + ": " + chart.settings.map(function (s) { return (names[s.key] || s.key) + " " + s.shares[k].toFixed(1) + "%"; }).join(", ");
  }).join("; ") + ".");
}


/* Page 3.12: self-harm visits by age group, sideways bars as plain HTML on gray lines, each value inside its bar's
   end; the age group the card is about in rust, with the outlined circle joined to its bar by a line, and the solid
   circle with the 988 line beside it. */
function drawSelfHarm(data) {
  var chart = data.charts.s3_12_self_harm;
  var box = document.getElementById("bars-self-harm");
  var largest = Math.max.apply(null, chart.groups.map(function (g) { return g.visits; }));
  var scaleTop = Math.ceil(largest * 1.02 / SELF_HARM_STEP) * SELF_HARM_STEP;              /* 208 -> 250: the scale ends on a line */
  var bars = makeBars(box, chart.groups.map(function (g) {
    return { key: g.label, label: g.label, value: g.visits, text: WCA.fmt.count(g.visits), focus: g.label === chart.focus.label,
             tip: "<strong>Ages " + plainText(g.label) + "</strong><br>" + WCA.fmt.count(g.visits) + " visits, " +
                  WCA.fmt.pct(g.visits / chart.total * 100) + " of " + WCA.fmt.count(chart.total) };
  }), { max: scaleTop, step: SELF_HARM_STEP, axis: true, tick: function (v) { return WCA.fmt.count(v); } });
  var circle = document.getElementById("circle-self-harm"), help = document.getElementById("circle-988");
  var line = document.createElement("span");
  line.className = "hb-pointer";
  box.appendChild(line);
  var BIG = 176, SMALL = 150;                                          /* the two circles' sizes, in pixels */
  var OVERLAP = 12, CLEAR = 8, APART = 8;                              /* how far the second laps over the first one's edge; how far it stays from the first one's words; the gap between them when they sit side by side */

  /* The circles go in the empty part of the chart under the long bar: the first under that bar, joined to it by a
     line, the second at the chart's right edge. Three arrangements are tried, in this order:
       1. the Bulletin's: the second circle laps over the first one's lower right edge, as low as it must be to stay
          clear of the first one's words;
       2. side by side, where the chart is not tall enough for that;
       3. under the bars, where it is not wide enough for either.
     The choice is worked out from the chart as it is WITH the circles on it (where they take no room), so it is the
     same however the circles were arranged before: nothing can start to flicker. */
  function place() {
    box.classList.remove("circles-under");
    circle.style.setProperty("--circle", BIG + "px");
    help.style.setProperty("--circle", SMALL + "px");
    var track = bars.rows[chart.focus.label].querySelector(".hb-track");
    var boxRect = box.getBoundingClientRect(), trackRect = track.getBoundingClientRect();
    var rowsBottom = bars.list.getBoundingClientRect().bottom - boxRect.top;
    var others = chart.groups.filter(function (g) { return g.label !== chart.focus.label; });
    var longest = Math.max.apply(null, others.map(function (g) { return g.visits; })) / bars.max * trackRect.width;
    var free = trackRect.width - longest - 28;                         /* the width the circles may use, right of the other bars */
    var barMiddle = trackRect.top - boxRect.top + track.offsetHeight / 2;
    var cTop = trackRect.bottom - boxRect.top + 18, cy = cTop + BIG / 2;
    var hx = box.clientWidth - 2 - SMALL / 2;                          /* the second circle's middle: at the right edge */
    /* the first circle's words, measured from its middle */
    var c = circle.getBoundingClientRect(), w = circle.querySelector("span").getBoundingClientRect();
    var words = { l: w.left - (c.left + c.width / 2), r: w.right - (c.left + c.width / 2), t: w.top - (c.top + c.height / 2), b: w.bottom - (c.top + c.height / 2) };
    var between = BIG / 2 + SMALL / 2 - OVERLAP, spot = null;
    for (var angle = 20; angle <= 80 && !spot; angle += 2) {            /* 1: swing the second circle down around the first until it is clear of the words */
      var dx = between * Math.cos(angle * Math.PI / 180), dy = between * Math.sin(angle * Math.PI / 180);
      var nearX = Math.max(words.l, Math.min(dx, words.r)), nearY = Math.max(words.t, Math.min(dy, words.b));
      if (Math.hypot(dx - nearX, dy - nearY) - SMALL / 2 < CLEAR) continue;
      if (BIG / 2 + dx + SMALL / 2 + 4 <= free && cy + dy + SMALL / 2 <= rowsBottom - 2) spot = { dx: dx, dy: dy };
      break;                                                           /* a steeper angle would only be lower */
    }
    if (!spot && BIG + APART + SMALL + 4 <= free && cy + BIG / 2 <= rowsBottom - 2) {          /* 2: side by side, the second a little lower */
      spot = { dx: BIG / 2 + APART + SMALL / 2, dy: Math.max(0, Math.min(30, rowsBottom - 2 - SMALL / 2 - cy)) };
    }
    box.classList.toggle("circles-under", !spot);                      /* 3 */
    [circle, help].forEach(function (el) { el.classList.toggle("placed", !!spot); });
    line.hidden = !spot;
    if (!spot) { circle.style.cssText = help.style.cssText = ""; return; }
    var cx = hx - spot.dx;
    circle.style.left = (cx - BIG / 2) + "px"; circle.style.top = cTop + "px";
    help.style.left = (hx - SMALL / 2) + "px"; help.style.top = (cy + spot.dy - SMALL / 2) + "px";
    line.style.left = (cx - 1) + "px";
    line.style.top = barMiddle + "px";
    line.style.height = (cTop - barMiddle) + "px";
  }
  place();
  whenLayoutChanges(place, box);
  describe(box, chart.title + ". " + chart.groups.map(function (g) { return "Ages " + g.label + ": " + g.visits; }).join(", ") + ".");
}


/* Page 3.13: a scatter of school districts in the dashboard's blue, each named on a white patch, the lowest and
   highest in magenta, with the line of best fit. Pointing at a dot makes it larger and shows its district's two
   numbers; the other dots step back to gray. */
function drawWeightAndDisadvantage(data) {
  var chart = data.charts.s3_13_weight_and_disadvantage;
  var canvas = document.getElementById("chart-weight"), frame = canvas.parentNode;
  var key = document.getElementById("key-weight");
  var dot = WCA.cssVar("--db-district-dot"), ends = WCA.cssVar("--db-district-ends"), quiet = WCA.cssVar("--db-quiet");
  var focus = null;
  var points = chart.districts.map(function (d) { return { x: d.econ, y: d.weight }; });
  function isEnd(i) { var c = chart.districts[i].code; return c === chart.lowest.code || c === chart.highest.code; }
  var lowX = Math.min.apply(null, points.map(function (p) { return p.x; })), highX = Math.max.apply(null, points.map(function (p) { return p.x; }));
  var xMax = Math.ceil(highX + 2), yMin = Math.min(15, Math.floor(Math.min.apply(null, points.map(function (p) { return p.y; })) - 1));
  var yMax = Math.max(40, Math.ceil(Math.max.apply(null, points.map(function (p) { return p.y; })) / 5) * 5);
  var fit = [{ x: lowX - 2, y: chart.fit.intercept + chart.fit.slope * (lowX - 2) }, { x: highX - 2, y: chart.fit.intercept + chart.fit.slope * (highX - 2) }];

  /* The key sits on the chart, at the right, in a part the dots leave empty. A chart too narrow to hold both the key
     and the names of the dots beside it (decided by its width alone) has the key above it instead. */
  function placeKey(drawn) {
    var area = drawn.chartArea, x = drawn.scales.x, y = drawn.scales.y;
    if (key.parentNode !== frame) frame.appendChild(key);
    key.classList.remove("above");
    var tries = drawn.width < SCATTER_KEY_ON_CHART_FROM ? [] : [20.5, 19, 27, 24.5], placed = false;
    var dots = points.map(function (p) { return { x: x.getPixelForValue(p.x), y: y.getPixelForValue(p.y) }; });   /* from the scales: the dots themselves are not yet moved */
    for (var t = 0; t < tries.length && !placed; t++) {
      var left = area.right - key.offsetWidth - 10, top = y.getPixelForValue(tries[t]);
      var clash = dots.some(function (p) {
        return p.x > left - 10 && p.x < left + key.offsetWidth + 10 && p.y > top - 10 && p.y < top + key.offsetHeight + 10;
      });
      if (!clash && top + key.offsetHeight < area.bottom && left > area.left) { putNote(key, left, top); placed = true; }
    }
    if (!placed) { key.classList.remove("placed"); key.classList.add("above"); key.style.left = key.style.top = ""; frame.parentNode.insertBefore(key, frame); }
    drawn.$keyBox = placed ? { left: key.offsetLeft, top: key.offsetTop, right: key.offsetLeft + key.offsetWidth, bottom: key.offsetTop + key.offsetHeight } : null;
  }

  var scatter = new Chart(canvas, {
    type: "scatter",
    data: { datasets: [
      { label: "Districts", data: points,
        pointRadius: function (c) { return focus === c.dataIndex ? 10 : 7; },
        pointHoverRadius: function (c) { return focus === c.dataIndex ? 10 : 7; },
        pointBackgroundColor: function (c) { return focus !== null && focus !== c.dataIndex ? quiet : (isEnd(c.dataIndex) ? ends : dot); },
        pointBorderColor: SURFACE, pointBorderWidth: 1.5 },
      { type: "line", label: "Line of best fit", data: fit, borderColor: quiet, borderWidth: 4, borderDash: [0.1, 7],
        borderCapStyle: "round", pointRadius: 0, pointHoverRadius: 0, order: 2 },
    ] },
    options: {
      layout: { padding: { top: 8, right: 14 } },
      interaction: { mode: "nearest", intersect: true },
      onHover: function (event, active) {
        var hit = active.filter(function (a) { return a.datasetIndex === 0; });
        var next = hit.length ? hit[0].index : null;
        event.native.target.style.cursor = next === null ? "default" : "pointer";
        if (next !== focus) { focus = next; scatter.update("none"); }
      },
      scales: {
        x: { type: "linear", min: 0, max: xMax, title: { display: true, text: frame.getAttribute("data-x-title") || "", font: { size: 13, weight: "700" }, color: WCA.colors.ink },
             afterBuildTicks: function (axis) { axis.ticks = axis.ticks.filter(function (t) { return t.value > 0 && t.value % 10 === 0; }); },
             ticks: { stepSize: 10, callback: function (v) { return v + "%"; } }, grid: { color: GRID } },
        y: { min: yMin - 0.6, max: yMax, title: { display: true, text: wrap(frame.getAttribute("data-y-title") || "", 34), font: { size: 13, weight: "700" }, color: WCA.colors.ink },
             afterBuildTicks: function (axis) { var t = []; for (var v = Math.ceil(yMin / 5) * 5; v <= yMax; v += 5) t.push({ value: v }); axis.ticks = t; },
             ticks: { callback: pctTick } },
      },
      plugins: {
        districtNames: { names: chart.districts.map(function (d) { return d.name; }), sides: SCATTER_NAME_SIDES, spots: SCATTER_NAME_SPOTS,
                         ends: chart.districts.map(function (d, i) { return isEnd(i) ? i : -1; }).filter(function (i) { return i >= 0; }),
                         focus: function () { return focus; } },
        tooltip: { filter: function (item) { return item.datasetIndex === 0; }, callbacks: {
          title: function (items) { return chart.districts[items[0].dataIndex].name; },
          label: function (item) { var d = chart.districts[item.dataIndex];
            return [WCA.fmt.pct(d.weight) + " of students overweight or obese", WCA.fmt.pct(d.econ) + " economically disadvantaged"]; },
        } },
      },
    },
    plugins: [{ id: "placeKey", afterLayout: function (drawn) { placeKey(drawn); } }, districtNames,
              { id: "xTitleLines", beforeUpdate: function (c) {                  /* the scale's name on two lines where one would be squeezed */
                  var words = frame.getAttribute("data-x-title") || "";
                  c.options.scales.x.title.text = c.width < 560 ? wrap(words, 30) : words; } }],
  });
  canvas.addEventListener("mouseleave", function () { if (focus !== null) { focus = null; scatter.update("none"); } });
  describe(canvas, chart.title + ". " + chart.districts.map(function (d) { return d.name + ": " + d.weight + "% overweight or obese, " + d.econ + "% disadvantaged"; }).join("; ") + ".");
}


/* Page 3.15: the Bulletin's five districts, each with two bars on a gray 100% track, and a menu that adds one more
   district (in its place by economic disadvantage, on a pale row, with a button to take it away again). The chart
   keeps its height when a district is added: the rows tighten to make room, and the reader sees them move. */
function drawScoresByDistrict(data) {
  var chart = data.charts.s3_15_scores_by_district;
  var rowsBox = document.getElementById("score-rows"), menu = document.getElementById("score-add");
  var status = document.getElementById("score-status");
  var keys = {};
  document.querySelectorAll("#chart-scores .sc-key").forEach(function (k) { keys[k.getAttribute("data-measure")] = k; });
  var added = null;

  function makeRow(d, isAdded) {
    var row = document.createElement("div");
    row.className = "sc-row" + (isAdded ? " added" : "");
    row.setAttribute("data-code", d.code);
    row.innerHTML = '<div class="sc-who"><strong></strong><span></span></div><div class="sc-bars">' +
      '<div class="sc-track ela"><span class="sc-bar"><b></b></span></div><div class="sc-track ap"><span class="sc-bar"><b></b></span></div></div>';
    row.querySelector(".sc-who strong").textContent = d.label || d.name;
    row.querySelector(".sc-who span").textContent = d.econ_whole + "% Disadvantaged";
    [["ela", d.ela, "English, grades 3-8 proficient"], ["ap", d.ap, "AP exams scored 3 or higher"]].forEach(function (m) {
      var track = row.querySelector(".sc-track." + m[0]);
      track.style.setProperty("--v", m[1]);
      track.querySelector("b").textContent = m[1].toFixed(1) + "%";
      track.tip = "<strong>" + plainText(d.label || d.name) + "</strong><br>" + m[2] + ": " + WCA.fmt.pct(m[1]);
    });
    if (isAdded) {
      var remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", "Remove " + (d.label || d.name) + " from the chart");
      remove.addEventListener("click", function () { menu.value = ""; addDistrict(null); });
      row.querySelector(".sc-who").appendChild(remove);
    }
    return row;
  }
  chart.districts.forEach(function (d, i) {
    var row = makeRow(d, false);
    if (i === 0) {                                                     /* the first district's tracks carry the two measures' names: the Bulletin's key */
      row.classList.add("keyed");
      ["ela", "ap"].forEach(function (m) { var k = keys[m]; if (k) { k.hidden = false; row.querySelector(".sc-track." + m).appendChild(k); } });
    }
    rowsBox.appendChild(row);
  });
  hoverTips(rowsBox);

  /* Open or close a row over a moment, so the rows around it are seen to tighten or loosen rather than jump. The
     rows share one fixed height (styles.css), so while this row's height goes from nothing to its share, or back,
     the others give up or take back the room. */
  function grow(row, opening, done) {
    if (STILL) { if (done) done(); return; }
    var full = row.getBoundingClientRect().height;
    row.style.minHeight = "0px";
    row.style.maxHeight = (opening ? 0 : full) + "px";
    row.style.transition = "max-height 0.45s ease";
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { row.style.maxHeight = (opening ? full : 0) + "px"; });
    });
    setTimeout(function () { row.style.maxHeight = row.style.minHeight = row.style.transition = ""; if (done) done(); }, 480);
  }

  function addDistrict(code) {
    if (added) { var old = added; added = null; grow(old, false, function () { old.remove(); }); }
    if (!code) { status.textContent = "Showing the Bulletin's five districts."; return; }
    var d = chart.all.filter(function (x) { return x.code === code; })[0];
    var already = rowsBox.querySelector('.sc-row[data-code="' + code + '"]:not(.added)');
    if (already) { already.classList.add("flash"); setTimeout(function () { already.classList.remove("flash"); }, 1200);
                   status.textContent = d.name + " is already on the chart."; return; }
    var row = makeRow(d, true);
    var next = Array.prototype.filter.call(rowsBox.querySelectorAll(".sc-row:not(.added)"), function (r) {
      var other = chart.all.filter(function (x) { return x.code === r.getAttribute("data-code"); })[0];
      return other && other.econ < d.econ;
    })[0];
    rowsBox.insertBefore(row, next || null);
    added = row;
    grow(row, true);
    status.textContent = "Added " + d.name + ": " + d.econ_whole + "% disadvantaged, English " + WCA.fmt.pct(d.ela) + ", AP " + WCA.fmt.pct(d.ap) + ".";
  }
  chart.all.forEach(function (d) {
    var option = document.createElement("option");
    option.value = d.code;
    option.textContent = d.name + " (" + d.econ_whole + "% disadvantaged)";
    menu.appendChild(option);
  });
  menu.addEventListener("change", function () { addDistrict(menu.value || null); });
  describe(rowsBox, chart.title + ". " + chart.districts.map(function (d) {
    return d.label + ", " + d.econ_whole + "% disadvantaged: English " + WCA.fmt.pct(d.ela) + ", AP " + WCA.fmt.pct(d.ap);
  }).join("; ") + ".");
}


/* Page 3.16: two lines across three measures, the space between them filled (behind both lines), the value at each
   point, each group's name beside its line's first point and an orange box in the gap at each measure. */
function drawTestGap(data) {
  var chart = data.charts.s3_16_test_gap;
  var canvas = document.getElementById("chart-gap"), frame = canvas.parentNode;
  var secure = WCA.db.econ.secure, poor = WCA.db.econ.disadvantaged;
  var text = { secure: secure, disadvantaged: WCA.db.tealText };
  var labels = chart.measures.map(function (m) { return (GAP_MEASURE_NAMES[m.key] || [m.key]).concat([m.period]); });
  var top = series("Economically secure", "secure", secure), bottom = series("Economically disadvantaged", "disadvantaged", poor);
  function series(label, key, color) {
    var s = lineSeries(label, chart.measures.map(function (m) { return m[key]; }), color);
    s.borderWidth = 4; s.pointRadius = 6; s.pointHoverRadius = 7; s.pointBorderWidth = 0;
    return s;
  }
  top.fill = "+1";
  top.backgroundColor = WCA.db.gapBand;
  var values = chart.measures.map(function (m) { return m.secure; }).concat(chart.measures.map(function (m) { return m.disadvantaged; }));
  /* the scale (not shown) leaves room under the lowest point and over the highest for their values */
  var low = Math.floor((Math.min.apply(null, values) - 11) / 5) * 5, high = Math.ceil((Math.max.apply(null, values) + 8) / 5) * 5;
  var VALUE_SIZE = 14;

  /* Each group's name sits left of its line's first point, level with it and clear of the value written at that
     point; the chart keeps room for the names at its left. Where the chart is too narrow for them, they make way for
     the key above the chart. */
  var key = document.getElementById("legend-gap");
  WCA.legend(key, [{ label: top.label, color: secure }, { label: bottom.label, color: poor }]);
  function narrow(c) { return c.width < 600; }
  var NAME_GAP = 32;                                                  /* from a first point's middle to the end of its line's name: past half of the value written there */

  function place(drawn) {
    var a = drawn.getDatasetMeta(0).data, b = drawn.getDatasetMeta(1).data;
    var names = [["secure", a[0]], ["disadvantaged", b[0]]].map(function (pair) {
      return { el: frame.querySelector('.gap-name[data-series="' + pair[0] + '"]'), key: pair[0], point: pair[1] };
    });
    var fits = !narrow(drawn) && names.every(function (n) { return n.point.x - NAME_GAP - n.el.offsetWidth >= 0; });
    if (key.hidden !== fits) key.hidden = fits;
    names.forEach(function (n) {
      n.el.style.color = text[n.key];
      n.el.style.left = Math.max(n.point.x - NAME_GAP - n.el.offsetWidth, 0) + "px";
      n.el.style.top = (n.point.y - n.el.offsetHeight / 2) + "px";
      n.el.classList.toggle("placed", fits);
    });
    /* each box: in the middle of the gap at its measure */
    chart.measures.forEach(function (m, i) {
      var gapBox = frame.querySelector('.gap-box[data-index="' + i + '"]');
      putNote(gapBox, a[i].x - gapBox.offsetWidth / 2, (a[i].y + b[i].y) / 2 - gapBox.offsetHeight / 2);
    });
  }

  new Chart(canvas, {
    type: "line",
    data: { labels: labels, datasets: [top, bottom] },
    options: {
      interaction: { mode: "index", intersect: false },
      layout: { padding: function (c) { return { left: narrow(c.chart) ? 6 : 56, right: narrow(c.chart) ? 16 : 24, top: 10, bottom: 4 }; } },   /* at the left: room for the two names */
      scales: {
        /* each measure's name under it; on shorter lines, in smaller type, on a narrow chart */
        x: { offset: true, grid: { display: true, drawOnChartArea: false, drawTicks: true, tickLength: 8, color: WCA.colors.muted },
             border: { display: true, color: WCA.colors.muted },
             ticks: { color: WCA.colors.ink, maxRotation: 0, autoSkip: false,
                      font: function (c) { return { size: narrow(c.chart) ? 12 : 13, weight: "600" }; },
                      callback: function (value) {
                        var lines = labels[value];
                        return narrow(this.chart) ? [].concat.apply([], lines.map(function (line) { return wrap(line, 10); })) : lines;
                      } } },
        y: { display: false, min: low, max: high },
      },
      plugins: {
        filler: { drawTime: "beforeDatasetsDraw" },                     /* the fill goes behind BOTH lines; drawn later it would cover half of the lower one */
        pointWords: { size: VALUE_SIZE, notes: chart.measures.map(function (m, i) {
          return { dataset: 0, index: i, lines: [WCA.fmt.pct(m.secure)], color: text.secure };
        }).concat(chart.measures.map(function (m, i) {
          return { dataset: 1, index: i, lines: [WCA.fmt.pct(m.disadvantaged)], color: text.disadvantaged, place: "below" };
        })) },
        tooltip: { callbacks: {
          title: function (items) { return labels[items[0].dataIndex].join(" "); },
          label: function (item) { return item.dataset.label + ": " + WCA.fmt.pct(item.parsed.y) + " proficient"; },
          afterBody: function (items) { return "Difference: " + chart.measures[items[0].dataIndex].gap_text + " points"; },
        } },
      },
    },
    plugins: [pointWords, { id: "placeWords", afterUpdate: function (drawn) { requestAnimationFrame(function () { place(drawn); }); } }],
  });
  describe(canvas, chart.title + ". " + chart.measures.map(function (m, i) {
    return labels[i].join(" ") + ": economically secure " + WCA.fmt.pct(m.secure) + ", economically disadvantaged " + WCA.fmt.pct(m.disadvantaged);
  }).join("; ") + ".");
}


/* Page 3.17: chronic absence by student group, two sets of sideways bars with the dashed "All students" line. The year
   buttons show another school year: the bars grow or shrink and change places when their order changes. Both charts
   keep ONE scale for every year (the round number above the highest rate of any year), so the years can be compared
   and pressing a button never changes the scale. */
function drawChronicAbsence(data) {
  var chart = data.charts.s3_17_chronic_absence;
  var card = document.getElementById("card-3-17");
  var status = document.getElementById("absence-status");
  var sets = { status: document.getElementById("bars-absence-status"), race: document.getElementById("bars-absence-race") };
  var shown = chart.years.length - 1;
  var highest = 0;
  chart.years.forEach(function (year) { year.status.concat(year.race).forEach(function (g) { highest = Math.max(highest, g.rate); }); });
  var max = ABSENCE_STEP * Math.ceil(highest / ABSENCE_STEP);
  function items(list, year) {
    return list.map(function (g) {
      return { key: g.key, label: g.label, value: g.rate, text: WCA.fmt.pct(g.rate),
               tip: "<strong>" + plainText(g.label) + ", " + year.school_year + "</strong><br>" + WCA.fmt.pct(g.rate) + " chronically absent" };
    });
  }
  var latest = chart.years[shown];
  var bars = {
    status: makeBars(sets.status, items(latest.status, latest), { max: max, step: ABSENCE_STEP, ref: latest.all }),
    race: makeBars(sets.race, items(latest.race, latest), { max: max, step: ABSENCE_STEP, ref: latest.all, axis: true }),
  };
  function show(y, moving) {
    var year = chart.years[y];
    shown = y;
    bars.status.update(items(year.status, year), { ref: year.all });
    bars.race.update(items(year.race, year), { ref: year.all });
    card.querySelectorAll(".js-year").forEach(function (el) { el.textContent = year.school_year.slice(0, 4) + "-" + (Number(year.school_year.slice(0, 4)) + 1); });
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
    if (moving) status.textContent = "Showing school year " + year.school_year + ": all students " + WCA.fmt.pct(year.all) + " chronically absent.";
  }
  var buttons = yearButtons(document.getElementById("absence-years"), chart.years.map(function (y) { return y.school_year; }), function (y) { show(y, true); });
  show(shown, false);
}


/* Page 3.18: suspensions, two charts of thick bars whose rows line up. Left, by race and ethnicity with the dashed
   countywide line, with year buttons right under its title (the bars grow or shrink; one scale for every year, so
   the years compare). Right, the five districts the Bulletin shows, on the Bulletin's scale. */
function drawSuspensions(data) {
  var chart = data.charts.s3_18_suspensions;
  var card = document.getElementById("card-3-18");
  var status = document.getElementById("suspension-status");
  var years = chart.race.years, shown = years.length - 1;
  var everyRate = [];
  years.forEach(function (y) { y.groups.forEach(function (g) { everyRate.push(g.rate); }); });
  var max = roundStep(Math.max.apply(null, everyRate));
  function items(year) {
    return year.groups.map(function (g) {
      return { key: g.key, label: g.label, value: g.rate, text: WCA.fmt.pct(g.rate),
               tip: "<strong>" + plainText(g.label) + ", " + year.school_year + "</strong><br>" + WCA.fmt.pct(g.rate) + " suspended at least once (" +
                    WCA.fmt.count(g.suspended) + " of " + WCA.fmt.count(g.enrolled) + ")" };
    });
  }
  var race = makeBars(document.getElementById("bars-suspension-race"), items(years[shown]),
                      { max: max, step: SUSPENSION_RACE_STEP, axis: true, ref: years[shown].all });
  makeBars(document.getElementById("bars-suspension-districts"), chart.districts.rows.map(function (d) {
    return { key: d.code, label: d.label, value: d.rate, text: WCA.fmt.pct(d.rate), className: "district" + (d.gray ? " gray" : ""),
             tip: "<strong>" + plainText(d.label) + "</strong><br>" + WCA.fmt.pct(d.rate) + " of students suspended out of school, " + chart.districts.school_year };
  }), { max: SUSPENSION_DISTRICT_SCALE, step: SUSPENSION_DISTRICT_STEP, axis: true });
  function show(y, moving) {
    var year = years[y];
    shown = y;
    race.update(items(year), { ref: year.all });
    card.querySelectorAll(".js-year").forEach(function (el) { el.textContent = year.school_year; });
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === y ? "true" : "false"); });
    if (moving) status.textContent = "Showing school year " + year.school_year + ": countywide " + WCA.fmt.pct(year.all) + " suspended.";
  }
  var buttons = yearButtons(document.getElementById("suspension-years"), years.map(function (y) { return y.school_year; }), function (y) { show(y, true); });
  show(shown, false);
}


/* ---- CHAPTER 4 ---------------------------------------------------------- */

/* Chapter 4 (built 2026-11-20) keeps the Bulletin's content and the graphics that carry its message (the tiles one
   inside the other, the three rent tiles, the words on the pies, the periods written in the bars) and is drawn with
   the habits chapters 1 and 2 share: numbers and names on a chart are 12 to 15 pixels (large type is kept for a
   card's featured numbers), a value sits inside its bar, words on a color are white or dark (whichever reads), and
   a button sits at the left, right above the chart it changes, without ever changing the card's size or the
   chart's scale. */

/* Page 4.3: three tiles, one inside the other. The words and the numbers are in index.html; this gives each tile
   its hover box (the people behind its rate). */
function drawYouthUnemployment(data) {
  var chart = data.charts.s4_3_youth_unemployment;
  var box = document.getElementById("tiles-unemployment");
  var who = { youth: "Westchester County, ages 20 to 24", state: "New York State, ages 20 to 24", older: "Westchester County, ages 25 and over" };
  Object.keys(who).forEach(function (key) {
    var part = chart[key];
    box.querySelector('.nt-tile[data-key="' + key + '"]').tip = "<strong>" + who[key] + ", " + chart.year + "</strong><br>" +
      WCA.fmt.pct(part.rate) + " unemployed<br>" + WCA.fmt.count(part.unemployed) + " of " + WCA.fmt.count(part.labor_force) + " people in the labor force";
  });
  hoverTips(box);
}


/* Page 4.4: unemployment of men, women and all 20- to 24-year-olds, the earlier period (lighter) beside the latest
   (full color). Each bar has its period in its foot and its rate inside its top, as in the Bulletin, so there is no
   key; the key above the chart shows only where the bars are too narrow to hold their period (a phone). */
function drawUnemploymentByGender(data) {
  var chart = data.charts.s4_4_unemployment_by_gender;
  var canvas = document.getElementById("chart-jobless-gender");
  var key = document.getElementById("legend-jobless");
  var gray = WCA.db.race.all.steps;
  var colors = {
    men: [WCA.cssVar("--db-young-adults-light"), WCA.cssVar("--db-young-adults")],
    women: [WCA.cssVar("--db-women-light"), WCA.cssVar("--db-women")],
    all: gray,
  };
  var highest = Math.max.apply(null, chart.groups.map(function (g) { return Math.max.apply(null, g.rates); }));
  var top = Math.ceil(highest / JOBLESS_STEP) * JOBLESS_STEP;        /* 19.6 -> 20 */
  /* the key's swatches are gray (the "All" pair) so that they stand for every group, as on page 1.9 */
  WCA.legend(key, chart.periods.map(function (period, p) { return { label: period, color: gray[p] }; }));

  /* on a narrow chart the bars take more of their group's width, and the rates sit above them in smaller type */
  function narrow(width) { return width < 520; }
  function groupShare(width) { return narrow(width) ? 0.9 : 0.72; }

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: chart.groups.map(function (g) { return [g.label, chart.ages]; }),
      datasets: chart.periods.map(function (period, p) {
        return {
          label: period,
          data: chart.groups.map(function (g) { return g.rates[p]; }),
          backgroundColor: chart.groups.map(function (g) { return colors[g.key][p]; }),
        };
      }),
    },
    options: {
      datasets: { bar: { barPercentage: 0.96, categoryPercentage: groupShare(canvas.parentNode.clientWidth), maxBarThickness: 104 } },
      onResize: function (drawn, size) { drawn.options.datasets.bar.categoryPercentage = groupShare(size.width); },
      layout: { padding: { top: 20 } },
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0,
             font: function (context) { return { size: narrow(context.chart.width) ? 12 : 13 }; } } },
        y: { beginAtZero: true, max: top, ticks: { stepSize: JOBLESS_STEP, callback: pctTick } },
      },
      plugins: {
        columnValues: { place: "inside", size: 14, keep: 20, narrow: 520, narrowSize: 12,
                        text: function (d, i) { return WCA.fmt.pct(chart.groups[i].rates[d]); } },
        footWords: { keep: 26, lines: function (d) { return [chart.periods[d]]; },
                     onFit: function (fit) { if (key.hidden !== fit) key.hidden = fit; } },
        tooltip: { callbacks: {
          title: function (items) { return chart.groups[items[0].dataIndex].label + ", " + chart.ages.toLowerCase(); },
          label: function (item) {
            var group = chart.groups[item.dataIndex], p = item.datasetIndex;
            return [chart.periods[p] + ": " + WCA.fmt.pct(group.rates[p]) + " unemployed",
                    WCA.fmt.count(group.unemployed[p]) + " of " + WCA.fmt.count(group.labor_force[p]) + " people in the labor force"];
          },
        } },
      },
    },
    plugins: [columnValues, footWords],
  });

  describe(canvas, chart.title + ". " + chart.groups.map(function (g) {
    return g.label + ": " + chart.periods.map(function (period, p) { return WCA.fmt.pct(g.rates[p]) + " in " + period; }).join(", ");
  }).join("; ") + ".");
}


/* Page 4.5: the three tiles are words and numbers in index.html; this gives each its hover box. Under them, average
   monthly earnings by age group: sideways bars with each amount inside its bar's end, on a dollar scale with gray
   lines, and a dashed line at the studio's rent. The two buttons show the Bulletin's three age groups or every
   age group the Census Bureau reports: the rows slide to their places and the others fold in between them. The
   scale is the same for both (it ends past the highest earnings of any age group), and so is the chart's size. */
function drawMinimumWageAndRent(data) {
  var chart = data.charts.s4_5_minimum_wage_and_rent;
  var wage = chart.wage, rents = chart.rents, earnings = chart.earnings;
  var status = document.getElementById("earnings-status");

  var tiles = document.getElementById("tiles-rent");
  var hud = "U.S. Department of Housing and Urban Development, fiscal year " + plainText(rents.fiscal_year);
  tiles.querySelector('[data-key="studio"]').tip = "<strong>Fair market rent, studio apartment</strong><br>" + WCA.fmt.dollars(rents.studio) + " a month<br>" + hud;
  tiles.querySelector('[data-key="one_bedroom"]').tip = "<strong>Fair market rent, one-bedroom apartment</strong><br>" + WCA.fmt.dollars(rents.one_bedroom) + " a month<br>" + hud;
  tiles.querySelector('[data-key="affordable"]').tip = "<strong>What a full-time minimum-wage worker can afford</strong><br>" +
    WCA.fmt.dollars(wage.affordable_rent) + " a month: " + wage.affordable_share_pct + "% of " + WCA.fmt.dollars(wage.annual_pay) + " a year<br>" +
    plainText(wage.hourly_text) + " an hour, " + WCA.fmt.count(wage.hours) + " hours a year";
  hoverTips(tiles);

  var box = document.getElementById("chart-earnings");
  var highest = Math.max.apply(null, earnings.groups.map(function (g) { return g.monthly; }));
  var items = earnings.groups.map(function (g) {
    return { key: g.key, label: g.label, value: g.monthly, text: WCA.fmt.dollars(g.monthly), className: g.young ? "young-adults" : "other-ages",
             tip: "<strong>" + plainText(g.label) + ", " + earnings.year + "</strong><br>" + WCA.fmt.dollars(g.monthly) + " a month on average" +
                  (g.jobs === null ? "" : "<br>" + WCA.fmt.count(g.jobs) + " jobs held for a full quarter") };
  });
  var bars = makeSlotBars(box, items, { max: Math.ceil(highest / EARNINGS_STEP) * EARNINGS_STEP, step: EARNINGS_STEP,
                                         tick: WCA.fmt.dollars, ref: rents.studio, refText: WCA.fmt.dollars });
  var views = [earnings.groups.filter(function (g) { return g.bulletin; }), earnings.groups];
  function show(v, moving) {
    var groups = views[v];
    bars.show(groups.map(function (g) { return g.key; }));
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === v ? "true" : "false"); });
    describe(bars.list, "Average monthly earnings by age group in Westchester County, " + earnings.year + ". " + groups.map(function (g) {
      return g.label + ": " + WCA.fmt.dollars(g.monthly);
    }).join("; ") + ". Fair market rent for a studio apartment: " + WCA.fmt.dollars(rents.studio) + " a month.");
    if (moving) status.textContent = "Showing " + groups.length + " age groups.";
  }
  var buttons = yearButtons(document.getElementById("earnings-views"), EARNINGS_VIEW_NAMES, function (v) { show(v, true); });
  show(0, false);
}


/* Page 4.7: two pies as plain SVG, with the words on their slices (the words are in index.html). Each pie is turned
   so that its thin slice is at the bottom, as in the Bulletin: that slice carries its share only, near the rim,
   and its name is written under the pie, joined to the slice by the short line styles.css draws. */
function drawEducationalAttainment(data) {
  var chart = data.charts.s4_7_educational_attainment;
  var diploma = chart.diploma, degrees = chart.degrees;

  /* Angles are in degrees, clockwise from 12 o'clock; the pie's radius is 100 */
  function point(angle, r) {
    var a = angle * Math.PI / 180;
    return (r * Math.sin(a)).toFixed(2) + " " + (-r * Math.cos(a)).toFixed(2);
  }
  function slice(a0, a1) {
    return "M0 0L" + point(a0, 100) + "A100 100 0 " + (a1 - a0 > 180 ? 1 : 0) + " 1 " + point(a1, 100) + "Z";
  }

  /* One pie. `parts` are its slices clockwise, the thin one first: it is centered at the bottom (6 o'clock).
     Each part: key (its words in index.html have data-slice = key), share, color (a name in styles.css), out (how
     far from the middle its words sit, 0 to 1) and tip (its hover box). */
  function drawPie(pie, parts, words) {
    var whole = parts.reduce(function (sum, part) { return sum + part.share; }, 0);
    var from = 180 - parts[0].share / whole * 180, html = "";
    parts.forEach(function (part) {
      var to = from + part.share / whole * 360, middle = (from + to) / 2 * Math.PI / 180;
      var fill = WCA.cssVar(part.color);
      html += '<path class="pie-slice" data-slice="' + part.key + '" fill="' + fill + '" d="' + slice(from, to) + '"/>';
      var label = pie.querySelector('.pie-label[data-slice="' + part.key + '"]');
      label.style.left = (50 + 50 * part.out * Math.sin(middle)) + "%";
      label.style.top = (50 - 50 * part.out * Math.cos(middle)) + "%";
      label.style.color = textOn(fill);                              /* white where white reads on the slice, dark where it does not */
      from = to;
    });
    pie.insertAdjacentHTML("afterbegin", '<svg viewBox="-100 -100 200 200" aria-hidden="true" focusable="false">' + html + "</svg>");
    parts.forEach(function (part) { pie.querySelector('.pie-slice[data-slice="' + part.key + '"]').tip = part.tip; });
    hoverTips(pie);
    describe(pie, words);
  }

  var young = "Westchester's " + diploma.ages.replace(" to ", "- to ") + "-year-olds, " + plainText(chart.period);
  var older = "Westchester's " + degrees.ages.replace(" to ", "- to ") + "-year-olds, " + plainText(chart.period);
  drawPie(document.getElementById("pie-diploma"), [
    { key: "without", share: diploma.without_whole, color: "--db-no-credential", out: 0.78,
      tip: "<strong>Do not have a high school diploma</strong><br>" + WCA.fmt.pct(diploma.without_whole, 0) + " of " + young + "<br>" +
           WCA.fmt.count(diploma.people - diploma.with) + " of " + WCA.fmt.count(diploma.people) + " young people" },
    { key: "with", share: diploma.with_whole, color: "--db-has-diploma", out: 0.44,
      tip: "<strong>Have a high school diploma or GED</strong><br>" + WCA.fmt.pct(diploma.with_whole, 0) + " of " + young + "<br>" +
           WCA.fmt.count(diploma.with) + " of " + WCA.fmt.count(diploma.people) + " young people" },
  ], "Westchester County youth ages " + diploma.ages + ", " + chart.period + ": of " + WCA.fmt.count(diploma.people) + " young people, " +
     WCA.fmt.pct(diploma.with_whole, 0) + " have a high school diploma or GED and " + WCA.fmt.pct(diploma.without_whole, 0) + " do not.");

  drawPie(document.getElementById("pie-degrees"), [
    { key: "associate", share: degrees.associate.share, color: "--db-associate", out: 0.8,
      tip: "<strong>Have an associate degree</strong><br>" + WCA.fmt.pct(degrees.associate.share) + " of " + older },
    { key: "bachelors", share: degrees.bachelors.share, color: "--db-bachelors", out: 0.5,
      tip: "<strong>Have a bachelor's degree or higher</strong><br>" + WCA.fmt.pct(degrees.bachelors.share) + " of " + older + "<br>" +
           WCA.fmt.count(degrees.bachelors.people) + " of " + WCA.fmt.count(degrees.people) + " young people<br>New York State: " + WCA.fmt.pct(degrees.state_bachelors) },
    { key: "none", share: degrees.none.share, color: "--db-no-credential", out: 0.52,
      tip: "<strong>Do not have a college degree</strong><br>" + WCA.fmt.pct(degrees.none.share) + " of " + older },
  ], "Westchester County youth ages " + degrees.ages + ", " + chart.period + ": of " + WCA.fmt.count(degrees.people) + " young people, " +
     WCA.fmt.pct(degrees.bachelors.share) + " have a bachelor's degree or higher, " + WCA.fmt.pct(degrees.none.share) + " do not have a college degree and " +
     WCA.fmt.pct(degrees.associate.share) + " have an associate degree.");
}


/* Page 4.8: fall enrollment at Westchester Community College, one line on the Bulletin's scale, the years set where
   they fall in time. It opens on the Bulletin's seven years, each with its enrollment at its point (under the point
   where the line rises after it, as in the Bulletin; the latest larger and in the line's color, as on page 2.3).
   The second button shows every fall the table holds: the chart pulls back to the earlier years, and the years the
   Bulletin leaves out get their points (each leaves the Bulletin's straight line for its own count). The scale of
   students does not change. */
function drawCommunityCollege(data) {
  var chart = data.charts.s4_8_community_college;
  var canvas = document.getElementById("chart-college");
  var titleYear = document.getElementById("college-from"), status = document.getElementById("college-status");
  var color = WCA.cssVar("--db-college");
  var every = chart.every_year;
  var first = chart.years[0], last = chart.years[chart.years.length - 1];
  var EDGE = 0.4;                                                    /* the room kept past the first and the last year, in years */
  var top = Math.max(COLLEGE_SCALE.max, Math.ceil(Math.max.apply(null, every.values) / COLLEGE_SCALE.step) * COLLEGE_SCALE.step);

  function inBulletin(year) { return chart.years.indexOf(year) >= 0; }
  /* where a year the Bulletin leaves out sits on the Bulletin's line: on the straight stretch between the years around it */
  function onBulletinLine(year) {
    for (var i = 1; i < chart.years.length; i++) {
      var a = chart.years[i - 1], b = chart.years[i];
      if (year > a && year < b) return chart.values[i - 1] + (chart.values[i] - chart.values[i - 1]) * (year - a) / (b - a);
    }
    return null;                                                     /* a year before the Bulletin's first: it has no place on that line */
  }
  var bulletinPoints = chart.years.map(function (year, i) { return { x: year, y: chart.values[i] }; });
  var everyPoints = every.years.map(function (year, i) { return { x: year, y: every.values[i] }; });
  var at = 0;                                                        /* 0: the Bulletin's years. 1: every year. In between while the chart moves. */

  /* The enrollment written at a point: over it, or under it where the line rises after it. The latest is larger and
     in the line's color. `points` are the points on show; `years` the ones that get their number. */
  function notesFor(points, years) {
    var notes = [];
    points.forEach(function (p, i) {
      if (years.indexOf(p.x) < 0) return;
      var next = points[i + 1];
      var note = { index: i, lines: [WCA.fmt.count(p.y)] };
      if (p.x === last) { note.side = "left"; note.size = 18; note.color = color; }
      else if (next && next.y > p.y) note.place = "below";
      notes.push(note);
    });
    return notes;
  }
  /* a phone has room for fewer: the first year, the lowest and the latest */
  function fewerNotes(points, years) {
    var lowest = Math.min.apply(null, points.filter(function (p) { return years.indexOf(p.x) >= 0; }).map(function (p) { return p.y; }));
    return notesFor(points, years).filter(function (note) {
      var p = points[note.index];
      return p.x === years[0] || p.x === last || p.y === lowest;
    });
  }

  var series = lineSeries("Fall enrollment", bulletinPoints, color);
  series.borderWidth = 4;                                            /* the Bulletin's thick line */
  series.pointRadius = function (context) {
    var p = context.raw;
    return (!p || inBulletin(p.x) || p.x < first) ? 5 : 5 * at;      /* a year the Bulletin leaves out grows its point as it leaves the Bulletin's line */
  };
  series.pointHoverRadius = function (context) { var p = context.raw; return (!p || inBulletin(p.x) || p.x < first) ? 6 : 6 * at; };

  var line = new Chart(canvas, {
    type: "line",
    data: { datasets: [series] },
    options: {
      interaction: { mode: "nearest", axis: "x", intersect: false },
      layout: { padding: { top: 6, right: 8 } },
      scales: {
        x: { type: "linear", min: first - EDGE, max: last + EDGE, grid: { display: false },
             /* a number under every year on show; where they would touch, the nearer of two gives way, counting back from the latest year */
             afterBuildTicks: function (axis) {
               var years = at > 0 ? every.years : chart.years, room = (axis.maxWidth || axis.width || 600) / (axis.max - axis.min);
               var kept = [], after = Infinity;
               for (var i = years.length - 1; i >= 0; i--) {
                 if (years[i] < axis.min) break;
                 if ((after - years[i]) * room < 38) continue;
                 kept.unshift({ value: years[i] });
                 after = years[i];
               }
               axis.ticks = kept;
             },
             ticks: { maxRotation: 0, autoSkip: false, callback: function (value) { return String(value); } } },
        y: { min: 0, max: top, ticks: { stepSize: COLLEGE_SCALE.step, callback: function (value) { return WCA.fmt.count(value); } } },
      },
      plugins: {
        pointWords: { size: 13, notes: notesFor(bulletinPoints, chart.years), narrow: 520, narrowNotes: fewerNotes(bulletinPoints, chart.years) },
        tooltip: { callbacks: {
          title: function (items) { return "Fall " + items[0].parsed.x; },
          label: function (item) { return WCA.fmt.count(item.parsed.y) + " students"; },
        } },
      },
    },
    plugins: [pointWords, hoverLine],
  });

  /* Put the chart at `t` of the way from the Bulletin's years (0) to every year (1) */
  function place(t) {
    at = t = t < 0.001 ? 0 : (t > 0.999 ? 1 : t);
    var words = line.options.plugins.pointWords;
    if (t === 0) {
      series.data = bulletinPoints;
      words.notes = notesFor(bulletinPoints, chart.years);
      words.narrowNotes = fewerNotes(bulletinPoints, chart.years);
    } else {
      var points = everyPoints.map(function (p) {
        var onLine = inBulletin(p.x) ? null : onBulletinLine(p.x);
        return onLine === null ? p : { x: p.x, y: onLine + (p.y - onLine) * t };
      });
      /* the Bulletin's years keep their numbers all the way; the first of all the years gets its number once the chart has
         arrived, under its point (over it, the number would sit right beside the top number of the scale) */
      var labelled = t === 1 ? [every.years[0]].concat(chart.years) : chart.years;
      series.data = points;
      words.notes = notesFor(points, labelled);
      words.narrowNotes = fewerNotes(points, labelled);
      [words.notes, words.narrowNotes].forEach(function (notes) {
        notes.forEach(function (note) { if (points[note.index].x === every.years[0] && !inBulletin(every.years[0])) note.place = "below"; });
      });
    }
    line.options.scales.x.min = first - EDGE + (every.years[0] - first) * t;
    line.update("none");
  }

  var stop = null;
  function show(v) {
    if (stop) stop();
    stop = glide(at, v, 650, place);
    titleYear.textContent = v ? every.years[0] : first;
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === v ? "true" : "false"); });
    status.textContent = "Showing fall " + (v ? every.years[0] : first) + " to fall " + last + (v ? ", every year." : ", the Bulletin's years.");
    describe(canvas, "Fall enrollment at Westchester Community College. " + (v ? everyPoints : bulletinPoints).map(function (p) {
      return p.x + ": " + WCA.fmt.count(p.y);
    }).join(", ") + ".");
  }
  var buttons = yearButtons(document.getElementById("college-views"), [COLLEGE_VIEW_WORD + " " + first, COLLEGE_VIEW_WORD + " " + every.years[0]], show);
  buttons[0].setAttribute("aria-pressed", "true");
  describe(canvas, chart.title + ". " + bulletinPoints.map(function (p) { return p.x + ": " + WCA.fmt.count(p.y); }).join(", ") + ".");
}


/* Page 4.9: the Bulletin's two small charts, each two thick sideways bars with the value inside the bar's end. The
   lighter bar is the share of the population, the full-color bar the share of arrests or of those in custody. Each
   chart has its own scale with gray lines, so a bar is as long as its number. */
function drawYoungAdultsAndJustice(data) {
  var chart = data.charts.s4_9_young_adults_and_justice;
  var adults = chart.adults, arrests = chart.arrests, young = chart.young_people, custody = chart.custody;
  var steps = JUSTICE_SCALES;

  makeBars(document.getElementById("chart-adult-shares"), [
    { key: "adults", className: "adults", label: JUSTICE_BAR_NAMES.adults, value: adults.share, text: WCA.fmt.pct(adults.share),
      tip: "<strong>Ages 18 to 24 among all adults, " + adults.year + "</strong><br>" + WCA.fmt.pct(adults.share) + ": " +
           WCA.fmt.count(adults.young) + " of " + WCA.fmt.count(adults.adults) + " residents 18 and over" },
    { key: "arrests", className: "arrests", label: JUSTICE_BAR_NAMES.arrests, value: arrests.share, text: WCA.fmt.pct(arrests.share),
      tip: "<strong>Ages 18 to 24 among adult arrests, " + arrests.year + "</strong><br>" + WCA.fmt.pct(arrests.share) + ": " +
           WCA.fmt.count(arrests.young) + " of " + WCA.fmt.count(arrests.adults) + " arrests of people 18 and older" },
  ], { max: Math.ceil(Math.max(adults.share, arrests.share) / steps.adults.step) * steps.adults.step, step: steps.adults.step, axis: true });

  makeBars(document.getElementById("chart-custody-shares"), [
    { key: "young-people", className: "young-people", label: JUSTICE_BAR_NAMES.young_people, value: young.share, text: WCA.fmt.pct(young.share_whole, 0),
      tip: "<strong>Black or Hispanic, among all 18- to 24-year-olds, " + plainText(young.period) + "</strong><br>" + WCA.fmt.pct(young.share) + ": " +
           WCA.fmt.count(young.black_or_hispanic) + " of " + WCA.fmt.count(young.people) + " young people" },
    { key: "custody", className: "custody", label: JUSTICE_BAR_NAMES.custody, value: custody.share_whole, text: WCA.fmt.pct(custody.share_whole, 0),
      tip: "<strong>Black or Hispanic, among 18- to 24-year-olds in state custody, " + custody.year + "</strong><br>" + WCA.fmt.pct(custody.share_whole, 0) + ": " +
           WCA.fmt.count(custody.black_or_hispanic) + " of " + WCA.fmt.count(custody.people) + " people from Westchester cases" },
  ], { max: steps.custody.max, step: steps.custody.step, axis: true });

  /* in a bar's name, a range of ages ("18-24", "18- to 24-year-olds") is never split across two lines */
  document.querySelectorAll("#chart-adult-shares .hb-label, #chart-custody-shares .hb-label").forEach(function (name) {
    name.innerHTML = plainText(name.textContent).replace(/\d+-(?: to )?\d+(?:-year-olds)?/g, function (range) {
      return '<span class="keep-together">' + range + "</span>";
    });
  });
}


/* Page 4.10: the share of 16- to 24-year-olds who are neither in school nor working, the earlier period (lighter)
   beside the latest (full color), each rate above its bar and the two periods written in the feet of the first
   pair, as in the Bulletin. Two views, one scale: by race and ethnicity (the Bulletin's chart) and by age (the two
   age groups the text box quotes). When a button is pressed the bars of the groups that leave sink, "All" (which
   both views share) slides to its new place, and the new groups' bars rise, so the eye can follow the change. */
function drawDisconnectedYouth(data) {
  var chart = data.charts.s4_10_disconnected_youth;
  var canvas = document.getElementById("chart-disconnected");
  var key = document.getElementById("legend-disconnected");
  var status = document.getElementById("disconnected-status"), titleWords = document.getElementById("disconnected-by");
  var race = WCA.db.race, last = chart.periods.length - 1;
  var youngSteps = [WCA.cssVar("--db-young-adults-light"), WCA.cssVar("--db-young-adults")];
  var views = [
    { groups: chart.groups, steps: function (g) { return race[g.key].steps; } },
    { groups: chart.ages, steps: function (g) { return g.key === "all" ? race.all.steps : youngSteps; } },
  ];
  var shown = 0;                                                     /* the view on show: its place in `views` */
  var everyRate = [];
  views.forEach(function (view) { view.groups.forEach(function (g) { everyRate = everyRate.concat(g.rates); }); });
  var top = Math.ceil(Math.max.apply(null, everyRate) / DISCONNECTED_STEP) * DISCONNECTED_STEP;      /* 17.1 -> 20: one scale for both views */
  var most = Math.max.apply(null, views.map(function (view) { return view.groups.length; }));
  WCA.legend(key, chart.periods.map(function (period, p) { return { label: period, color: race.all.steps[p] }; }));

  /* "2015-2019" in a bar's foot, as the Bulletin stacks it: 2015 / to / 2019 */
  function periodLines(p) { var years = chart.periods[p].split("-"); return [years[0], "to", years[1]]; }
  /* the bars keep their thickness in both views: a view with fewer groups gives each pair a smaller part of its group's room */
  function groupShare(view) { return 0.74 * view.groups.length / most; }
  /* A view's bars, one set per period. `flat` leaves only the first group ("All") standing, the others at zero.
     `into` are the chart's own sets, changed in place: Chart.js moves a bar from where it was only if its set is
     still the same object. */
  function datasets(view, flat, into) {
    return chart.periods.map(function (period, p) {
      var set = into ? into[p] : { label: period };
      set.data = view.groups.map(function (g, i) { return flat && i > 0 ? 0 : g.rates[p]; });
      set.backgroundColor = view.groups.map(function (g) { return view.steps(g)[p]; });
      return set;
    });
  }
  function rate(d, i) { var g = views[shown].groups[i]; return g ? WCA.fmt.pct(g.rates[d]) : null; }

  var bars = new Chart(canvas, {
    type: "bar",
    data: { labels: views[0].groups.map(function (g) { return g.label; }), datasets: datasets(views[0], false) },
    options: {
      datasets: { bar: { barPercentage: 0.94, categoryPercentage: groupShare(views[0]), maxBarThickness: 50 } },
      layout: { padding: { top: 20 } },
      scales: {
        /* each group's name under its bars, broken into shorter lines on a narrow screen, as on page 1.4. Every name is
           given as many lines as the longest name of EITHER view takes, so the foot of the chart stays where it is when a
           button changes the groups. */
        x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0,
             font: function (context) { return { size: context.chart.width < 520 ? 11 : 13 }; },
             callback: function (value) {
               var slim = this.chart.width < 520;
               function linesOf(label) { return (slim && DISCONNECTED_NARROW_NAMES[label]) || wrap(label, slim ? 9 : 16); }
               var lines = linesOf(this.getLabelForValue(value)).slice(), most = 1;
               views.forEach(function (view) { view.groups.forEach(function (g) { most = Math.max(most, linesOf(g.label).length); }); });
               while (lines.length < most) lines.push("");
               return lines;
             } } },
        y: { beginAtZero: true, max: top, ticks: { stepSize: DISCONNECTED_STEP, callback: pctTick } },
      },
      plugins: {
        /* every bar's rate on a wide chart (in smaller type where six pairs leave less room); on a narrow one only the
           latest period's (the rest on hover), as on page 1.4 */
        columnValues: { place: "above", weight: "600", text: rate, size: function (width) { return width < 720 ? 12 : 13; },
                        narrow: 640, narrowSize: 12, narrowText: function (d, i) { return d === last ? rate(d, i) : null; } },
        footWords: { lines: function (d, i) { return i === 0 ? periodLines(d) : null; },
                     onFit: function (fit) { if (key.hidden !== fit) key.hidden = fit; } },
        tooltip: { callbacks: {
          title: function (items) { var g = views[shown].groups[items[0].dataIndex]; return g ? g.label + ", ages 16 to 24" : ""; },
          label: function (item) {
            var g = views[shown].groups[item.dataIndex], p = item.datasetIndex;
            if (!g) return "";
            var lines = [chart.periods[p] + ": " + WCA.fmt.pct(g.rates[p]) + (g.margins ? " (± " + g.margins[p].toFixed(1) + " points)" : "")];
            if (g.people) lines.push(WCA.fmt.count(g.people[p]) + " of " + WCA.fmt.count(g.of[p]) + " young people");
            if (g.small_sample && g.small_sample[p]) lines.push("Small sample: read with care");
            return lines;
          },
        } },
      },
    },
    plugins: [columnValues, footWords],
  });

  function describeView(v) {
    describe(canvas, chart.title.replace("by race and ethnicity", DISCONNECTED_VIEWS[v].title) + ". " + views[v].groups.map(function (g) {
      return g.label + ": " + chart.periods.map(function (period, p) { return WCA.fmt.pct(g.rates[p]) + " in " + period; }).join(", ");
    }).join("; ") + ".");
  }

  /* Change the view in three steps. After each change the bars move from where they are to where they now belong. */
  var waiting = [];
  function step(ms, easing, change) {
    change();
    moveChart(bars, ms, easing);
  }
  function show(v) {
    if (v === shown && !waiting.length) return;
    waiting.forEach(clearTimeout);
    waiting = [];
    var from = views[shown], to = views[v];
    buttons.forEach(function (button, i) { button.setAttribute("aria-pressed", i === v ? "true" : "false"); });
    titleWords.textContent = DISCONNECTED_VIEWS[v].title;
    status.textContent = "Showing the rates " + DISCONNECTED_VIEWS[v].title + ".";
    function arrive() {                                              /* the new view, in place */
      shown = v;
      bars.data.labels = to.groups.map(function (g) { return g.label; });
      bars.options.datasets.bar.categoryPercentage = groupShare(to);
    }
    if (STILL) {
      step(0, null, function () { arrive(); datasets(to, false, bars.data.datasets); });
    } else {
      /* 1. every group but "All" sinks to the floor */
      step(260, "easeInQuad", function () { datasets(from, true, bars.data.datasets); });
      /* 2. the groups change; "All" slides to its new place (the others are flat, so their swap is not seen) */
      waiting.push(setTimeout(function () {
        step(320, "easeInOutQuad", function () { arrive(); datasets(to, true, bars.data.datasets); });
      }, 270));
      /* 3. the new groups' bars rise */
      waiting.push(setTimeout(function () {
        waiting = [];
        step(380, "easeOutQuad", function () { datasets(to, false, bars.data.datasets); });
      }, 600));
    }
    describeView(v);
  }
  var buttons = yearButtons(document.getElementById("disconnected-views"), DISCONNECTED_VIEWS.map(function (view) { return view.name; }), show);
  buttons[0].setAttribute("aria-pressed", "true");
  describeView(0);
}


/* --------------------------------------------------------------------------
   5. SMALL HELPERS
   -------------------------------------------------------------------------- */

/* The page's own background color, for the thin gaps between touching marks (read from styles.css) */
var SURFACE = WCA.cssVar("--white");

/* True when the reader has asked their device for less movement on screen. The charts that slide or turn
   when a button is pressed (pages 1.8, 1.9, 1.10, 2.4, 2.8, 2.14, 2.16, 2.17) then change at once instead. */
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

/* Make a line cross a year that has no figure as a row of pale dots, the Bulletin way (pages 2.3, 2.13).
   `pale` is the dots' color: a light step of the line's own. Returns the series it was given. */
function dotsAcrossGaps(series, pale) {
  function crossesGap(part) { return part.p0.skip || part.p1.skip; }
  series.segment = {
    borderColor: function (part) { return crossesGap(part) ? pale : undefined; },
    borderDash: function (part) { return crossesGap(part) ? [0.1, 8] : undefined; },
    borderCapStyle: function (part) { return crossesGap(part) ? "round" : undefined; },
  };
  return series;
}

/* Put each line's name on the chart: at the left, just above the highest point the line reaches under the
   name (page 2.13; page 1.14 does the same for its own two lines). The names are HTML elements in the
   chart's box (`frame`): <span class="line-name" data-series="hs"><span>Head Start</span></span>, one for
   each entry of `series` that has that key. `colors` gives each key its text color and `gap` is the room
   left between a name and its line, in pixels. Call it from an add-on that runs after each chart update. */
function placeLineNames(drawn, frame, series, colors, gap) {
  var area = drawn.chartArea;
  series.forEach(function (s, d) {
    var name = frame.querySelector('.line-name[data-series="' + s.key + '"]');
    if (!name) return;
    var points = drawn.getDatasetMeta(d).data.filter(function (point) { return !point.skip; });
    name.style.color = colors[s.key];
    name.style.maxWidth = Math.max(120, area.right - area.left - 16) + "px";
    var left = area.left + 8, right = left + name.offsetWidth, highest = Infinity;
    points.forEach(function (point, i) {
      if (point.x >= left - 1 && point.x <= right) highest = Math.min(highest, point.y);
      /* where the name ends between two points, the line's height there counts too */
      if (i > 0 && points[i - 1].x < right && point.x > right) {
        var before = points[i - 1];
        highest = Math.min(highest, before.y + (point.y - before.y) * (right - before.x) / (point.x - before.x));
      }
    });
    if (highest === Infinity && points.length) highest = points[0].y;
    name.style.left = left + "px";
    name.style.top = Math.max(highest - name.offsetHeight - (gap === undefined ? 9 : gap), 0) + "px";
    name.classList.add("placed");
  });
}

/* Move labels that would touch apart, up and down by the same amount, so that each stays as near its own
   point as it can: `items` have a y (pixels); `gap` is the least distance between two of them; none is
   moved above `top` or below `bottom`. Changes the items' y in place. */
function spread(items, gap, top, bottom) {
  items.sort(function (a, b) { return a.y - b.y; });
  for (var pass = 0; pass < 12; pass++) {
    for (var i = 1; i < items.length; i++) {
      var short = gap - (items[i].y - items[i - 1].y);
      if (short > 0) { items[i - 1].y -= short / 2; items[i].y += short / 2; }
    }
  }
  items.forEach(function (item, i) { item.y = Math.max(item.y, top + i * gap); });
  for (var k = items.length - 1; k >= 0; k--) items[k].y = Math.min(items[k].y, bottom - (items.length - 1 - k) * gap);
}

/* Take a number smoothly from `from` to `to` in `ms` milliseconds, calling draw(value) at every step on
   the way (slow at both ends, quicker in the middle). For readers who asked their device for less
   movement, and when the two numbers are the same, it goes there at once. Returns a function that stops
   it early. Used for shapes drawn by this file's own code (the pie of page 2.17). */
function glide(from, to, ms, draw) {
  if (STILL || from === to) { draw(to); return function () {}; }
  var started = null, stopped = false;
  function step(now) {
    if (stopped) return;
    if (started === null) started = now;
    var t = Math.min((now - started) / ms, 1);
    var eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    draw(from + (to - from) * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
  return function () { stopped = true; };
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

/* Write again, from `numbers`, every number inside `box` whose data-fill path starts with `prefix`; the
   rest of the path is looked up in `numbers`. For a card with year buttons (pages 2.4, 2.17): index.html
   fills its words from the block's "latest", and this fills the same words for the year chosen.
     refill(card, "charts.s2_4_infant_care_share.latest.", numbersOfThatYear) */
function refill(box, prefix, numbers) {
  box.querySelectorAll('[data-fill^="' + prefix + '"]').forEach(function (el) {
    var value = WCA.get(numbers, el.getAttribute("data-fill").slice(prefix.length));
    if (value === undefined || value === null) return;
    var format = el.getAttribute("data-format") || "count";
    el.textContent = format === "raw" ? value : format === "pct" ? WCA.fmt.pct(value) : format === "pct0" ? WCA.fmt.pct(value, 0)
                   : format === "dollars" ? WCA.fmt.dollars(value) : WCA.fmt.count(value);
  });
}

/* For the phone layout of a table of words (pages 2.5, 2.6, 2.12): write each column's heading onto the
   cells under it (as data-label; styles.css shows it above the cell). The headings are the table's top
   row or, in a table made of blocks, each block's own heading row (marked "heads"). A heading that holds
   more than its name (a second line) has the name alone marked "col-name". */
function labelCells(table) {
  if (!table) return;
  table.querySelectorAll("tbody").forEach(function (block) {
    var heads = block.querySelector("tr.heads") || table.querySelector("thead tr");
    if (!heads) return;
    var names = Array.prototype.map.call(heads.children, function (cell) {
      return (cell.querySelector(".col-name") || cell).textContent.replace(/\s+/g, " ").trim();
    });
    block.querySelectorAll("tr:not(.heads)").forEach(function (row) {
      Array.prototype.forEach.call(row.children, function (cell, i) {
        if (cell.tagName === "TD") cell.setAttribute("data-label", names[i] || "");
      });
    });
  });
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
   narrowText instead, to label fewer bars on a phone; with `narrow` and `narrowSize`, it uses that font
   size instead (page 3.6). */
var barNotes = {
  id: "barNotes",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.text) return;
    var write = (o.narrow && o.narrowText && chart.width < o.narrow) ? o.narrowText : o.text;
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = "600 " + ((o.narrow && o.narrowSize && chart.width < o.narrow) ? o.narrowSize : (o.size || 13)) + "px " + WCA.font;
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
   `weight` is how bold the words are ("700" if left out).
   A note can also say where it sits beside its point and how it looks, for a chart that follows the
   Bulletin point by point (page 2.3): side: "left" (the words end at the point) or "right" (they start
   there); and its own `color`, `size` and `weight`. A note that sits on a shaded part of its chart names
   that part's color as its `patch` (pages 3.9, 3.10), so the words sit on the color that is behind them;
   `dx` moves a note sideways by that many pixels (a minus sign: to the left), to keep it off such a part.
   A note on a line that is not on show is not written.
   With `narrow` (pixels) and `narrowNotes`, a chart narrower than that writes narrowNotes instead, to
   label fewer points on a phone. reach: "canvas" lets the words use the room beside the chart as well
   (for a chart with no scale written at its side); otherwise they stay between the chart's own edges. */
var pointWords = {
  id: "pointWords",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.notes) return;
    var ctx = chart.ctx, area = chart.chartArea;
    var notes = (o.narrow && o.narrowNotes && chart.width < o.narrow) ? o.narrowNotes : o.notes;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    notes.forEach(function (note) {
      var d = note.dataset || 0;
      var point = chart.getDatasetMeta(d).data[note.index];
      if (!point || point.skip || !chart.isDatasetVisible(d)) return;
      var size = note.size || o.size || 13, lineHeight = Math.round(size * 1.25);
      ctx.font = (note.weight || o.weight || "700") + " " + size + "px " + WCA.font;
      var width = Math.max.apply(null, note.lines.map(function (line) { return ctx.measureText(line).width; }));
      var height = note.lines.length * lineHeight;
      var middle = (note.side === "left" ? point.x + 6 - width / 2 : (note.side === "right" ? point.x - 6 + width / 2 : point.x)) + (note.dx || 0);
      var from = o.reach === "canvas" ? 0 : area.left, to = o.reach === "canvas" ? chart.width : area.right;
      var x = Math.min(Math.max(middle, from + width / 2 + 2), to - width / 2 - 2);
      var top = note.place === "below" ? point.y + 12 : point.y - 12 - height;
      ctx.fillStyle = note.patch || SURFACE;
      ctx.fillRect(x - width / 2 - 3, top - 1, width + 6, height + 2);
      ctx.fillStyle = note.color || WCA.colors.ink;
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

/* ---- Tools the chapter 3 cards share ---------------------------------------------------------------- */

/* Does a box (left, top, width, height, in the chart's pixels) cover part of the line through these points?
   Used to keep words off a line. */
function coversLine(left, top, width, height, line) {
  for (var i = 0; i < line.length; i++) {
    var a = line[i], b = line[i + 1] || a;
    var steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2));
    for (var s = 0; s <= steps; s++) {
      var x = a.x + (b.x - a.x) * s / steps, y = a.y + (b.y - a.y) * s / steps;
      if (x >= left && x <= left + width && y >= top && y <= top + height) return true;
    }
  }
  return false;
}

/* Put a word or a box that sits on a chart (a .chart-note) at a place in its chart's box, in pixels from the box's
   top left corner, and show it. */
function putNote(el, left, top) {
  el.style.left = left + "px";
  el.style.top = top + "px";
  el.classList.add("placed");
}

/* Aim a box with a point on top (.pointer-box, under a chart) at a place on the chart: `x` is in the chart's own
   pixels, counted from the left of its canvas. A box alone in its row (3.4) moves so that its point can sit right
   under the place; a box that keeps its place (3.11, `stay`) only moves its point. */
function pointAt(box, x, canvas, stay) {
  var row = box.parentNode;
  var target = canvas.getBoundingClientRect().left + x;
  if (!stay) {
    box.style.marginLeft = "0px";
    var rowLeft = row.getBoundingClientRect().left;
    var left = Math.min(Math.max(target - rowLeft - box.offsetWidth / 2, 0), Math.max(row.clientWidth - box.offsetWidth, 0));
    box.style.marginLeft = left + "px";
  }
  var at = target - box.getBoundingClientRect().left;
  box.style.setProperty("--at", Math.min(Math.max(at, 16), box.offsetWidth - 16) + "px");
}

/* One button per year, in a .year-switch (as on pages 1.10, 2.4 and 2.17). Returns the buttons. */
function yearButtons(box, labels, onPress) {
  return labels.map(function (label, i) {
    var button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", function () { onPress(i); });
    box.appendChild(button);
    return button;
  });
}

/* Bars that run sideways, as plain HTML (pages 3.12, 3.17, 3.18): one row per item, the item's name, then its bar
   with its value inside the bar's end, in white or dark words (whichever reads on the bar's color), as on pages 1.7
   and 2.11. A bar too short to hold its value has it just past its end instead, on a white patch; where the dashed
   line would then run through the value, the value sits just past the line, so the line stays whole.
   `items`: [{ key, label, value, text, tip, focus, className }].
   `opts`: max (the top of the scale; it stays the same whatever is shown), step (a gray line at each step of the
   scale), axis (true: the scale's numbers under the bars, written by `tick`; percentages if `tick` is left out),
   ref (a value marked with a dashed line, named by the box's data-ref-words, "{value}" being the value).
   Returns { rows, list, max, update(items, { ref }) }: update grows or shrinks the bars to new values, and rows
   that change places slide to them, so the reader can follow the change. */
function makeBars(box, items, opts) {
  var state = { rows: {}, max: opts.max };
  var words = box.getAttribute("data-ref-words") || "{value}";
  var tick = opts.tick || function (v) { return v + "%"; };
  function part(tag, className) { var el = document.createElement(tag); el.className = className; return el; }
  var list = box.appendChild(part("div", "hb-rows"));                 /* the rows, with the gray lines and the dashed line laid over the same space */
  var grid = opts.step ? list.appendChild(part("div", "hb-grid")) : null;
  var ref = opts.ref !== undefined ? list.appendChild(part("div", "hb-ref")) : null;
  if (ref) ref.innerHTML = "<i></i><b></b>";
  var axis = opts.axis ? box.appendChild(part("div", "hb-axis")) : null;
  state.list = list;
  var shown = [], refValue = null;

  /* the gray lines and, under them, the scale's numbers */
  box.style.setProperty("--max", state.max);
  if (grid) {
    var lines = "", numbers = "";
    for (var v = 0; v <= state.max + 1e-9; v += opts.step) {
      var at = (v / state.max * 100) + "%";
      lines += '<span style="left:' + at + '"></span>';
      numbers += '<span style="left:' + at + '">' + tick(v) + "</span>";
    }
    grid.innerHTML = lines;
    if (axis) axis.innerHTML = numbers;
  }

  function makeRow(item) {
    var row = part("div", "hb-row" + (item.className ? " " + item.className : ""));
    row.setAttribute("data-key", item.key);
    row.innerHTML = '<span class="hb-label"></span><span class="hb-track"><span class="hb-bar"><span class="hb-value"></span></span></span>';
    row.querySelector(".hb-label").textContent = item.label;
    state.rows[item.key] = row;
    return row;
  }

  /* Where each value goes, worked out from the widths the bars are growing TO (not the widths they have at this
     moment): inside its bar's end when the bar can hold it, just past the end when it cannot. An outside value
     that would sit on the dashed line moves just past the line. The dashed line's words are centered over the line,
     but never leave the bars' space. */
  function fit() {
    var anyTrack = list.querySelector(".hb-track");
    var width = anyTrack ? anyTrack.clientWidth : 0;
    if (!width) return;
    var refAt = refValue === null ? null : refValue / state.max * width;
    shown.forEach(function (item) {
      var row = state.rows[item.key], value = row.querySelector(".hb-value");
      var look = getComputedStyle(value), size = look.fontSize;
      var text = textWidth(item.text, "700 " + size) + 2;                 /* + 2: the digits are set at one width each, a little wider than measured */
      var bar = Math.max(item.value, 0) / state.max * width;
      var out = bar < text + 14;                                          /* 7 pixels of room on each side of the words */
      row.classList.toggle("out", out);
      value.style.color = out ? "" : textOn(getComputedStyle(row).getPropertyValue("--hue").trim());
      var shift = 4;                                                      /* from the bar's end to an outside value */
      if (out && refAt !== null && refAt > bar + shift - 5 && refAt < bar + shift + text + 8 + 5) shift = refAt - bar + 6;
      value.style.setProperty("--shift", shift + "px");
    });
    if (ref && refValue !== null) {
      var label = ref.querySelector("b"), half = label.offsetWidth / 2;
      label.style.left = Math.min(Math.max(refAt, half), Math.max(width - half, half)) + "px";
    }
  }
  function setRef(value) {
    if (!ref) return;
    refValue = value;
    ref.querySelector("i").style.left = (value / state.max * 100) + "%";
    ref.querySelector("b").textContent = words.replace("{value}", WCA.fmt.pct(value));
  }

  state.update = function (next, o) {
    o = o || {};
    if (o.ref !== undefined) setRef(o.ref);
    var before = {};
    Object.keys(state.rows).forEach(function (key) { before[key] = state.rows[key].getBoundingClientRect().top; });
    next.forEach(function (item) {
      var row = state.rows[item.key] || makeRow(item);
      row.classList.toggle("focus", !!item.focus);
      row.style.setProperty("--v", Math.max(item.value, 0));
      row.querySelector(".hb-value").textContent = item.text;
      row.querySelector(".hb-track").tip = item.tip || null;
      list.appendChild(row);                                        /* appended in the new order */
    });
    shown = next;
    fit();
    if (STILL) return;
    next.forEach(function (item) {
      var row = state.rows[item.key], moved = before[item.key] === undefined ? 0 : before[item.key] - row.getBoundingClientRect().top;
      if (!moved) return;
      row.style.transition = "none";
      row.style.transform = "translateY(" + moved + "px)";
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { row.style.transition = "transform 0.55s ease"; row.style.transform = ""; });
      });
    });
  };
  state.update(items, { ref: opts.ref });
  whenLayoutChanges(fit, box);
  if (box.classList.contains("fills")) box.style.flexGrow = items.length;   /* two sets in one card share the height by their rows */
  hoverTips(box);
  return state;
}

/* The county's map outlines, loaded once (data/Geography.json, made by build_data.py) */
var geographyLoad = null;
function loadGeography() {
  if (!geographyLoad) {
    geographyLoad = fetch(GEOGRAPHY_FILE).then(function (r) {
      if (!r.ok) throw new Error(GEOGRAPHY_FILE + " not found");
      return r.json();
    });
  }
  return geographyLoad;
}

/* Draw Westchester's map in `box` as plain SVG: every city, town and village in gray, and the places in `named` in
   teal, each with a white dot, a thin line and its words (MAP_NAME_SPOTS in Settings says where the words go).
   named: [{ key, cousub, html, tip }], cousub being the Census code that ties a place to its outline. The map and
   its words are put in one inner box (.map-fit) that always has the map's own shape, so the words stay on their
   places whatever room the map is given; the box's shape is handed to styles.css as --ratio (width / height).
   Returns the named places' shapes and words (for linkPlaces). */
function drawCountyMap(box, outlines, named) {
  var W = 400, latMiddle = 41.13, squeeze = Math.cos(latMiddle * Math.PI / 180);
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  function rings(geometry) { return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates; }
  outlines.features.forEach(function (f) {
    rings(f.geometry).forEach(function (polygon) {
      polygon.forEach(function (ring) {
        ring.forEach(function (c) {
          var x = c[0] * squeeze, y = -c[1];
          if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
        });
      });
    });
  });
  var scale = W / (maxX - minX), H = (maxY - minY) * scale;
  var below = H * (MAP_ROOM_UNDER[box.id] || 0.17);                     /* room under the map for the words written there */
  function at(c) { return [(c[0] * squeeze - minX) * scale, (-c[1] - minY) * scale]; }
  function path(geometry) {
    return rings(geometry).map(function (polygon) {
      return polygon.map(function (ring) {
        return "M" + ring.map(function (c) { var p = at(c); return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L") + "Z";
      }).join("");
    }).join("");
  }
  function middle(geometry) {                                         /* the center of the place's largest piece */
    var best = null, bestArea = 0;
    rings(geometry).forEach(function (polygon) {
      var ring = polygon[0].map(at), area = 0, cx = 0, cy = 0;
      for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        var cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
        area += cross; cx += (ring[j][0] + ring[i][0]) * cross; cy += (ring[j][1] + ring[i][1]) * cross;
      }
      if (Math.abs(area) > bestArea) { bestArea = Math.abs(area); best = [cx / (3 * area), cy / (3 * area)]; }
    });
    return best;
  }
  var byCousub = {}, spots = MAP_NAME_SPOTS[box.id] || {};
  named.forEach(function (item) { byCousub[item.cousub] = item; });
  var shapes = "", marks = "";
  outlines.features.forEach(function (f) {
    var item = byCousub[f.properties.cousub_geoid];
    if (item && f.properties.municipality_type === "city") {
      shapes += '<path class="map-place on" data-key="' + item.key + '" tabindex="0" role="button" aria-label="' +
        plainText(f.properties.municipality) + '" d="' + path(f.geometry) + '"></path>';
      var c = middle(f.geometry), spot = spots[item.key] || { x: 0.5, y: 1.05, side: "below" };
      item.dot = c;
      item.spot = [spot.x * W, spot.y * H];
      item.side = spot.side;
      /* the line ends where the words begin; words centered on their spot get a line that stops short of them */
      var end = item.spot.slice(), dx = end[0] - c[0], dy = end[1] - c[1], length = Math.sqrt(dx * dx + dy * dy) || 1;
      if (spot.side === "center") { var cut = Math.min(30, length * 0.6); end = [end[0] - dx / length * cut, end[1] - dy / length * cut]; }
      marks += '<line class="map-pointer" x1="' + c[0].toFixed(1) + '" y1="' + c[1].toFixed(1) + '" x2="' + end[0].toFixed(1) +
        '" y2="' + end[1].toFixed(1) + '"></line><circle class="map-dot" cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="4.5"></circle>';
    } else {
      shapes += '<path class="map-place" d="' + path(f.geometry) + '"></path>';
    }
  });
  box.style.setProperty("--ratio", (W / (H + below)).toFixed(4));
  box.innerHTML = '<div class="map-fit"><svg viewBox="0 0 ' + W + " " + (H + below).toFixed(1) + '" aria-hidden="true" focusable="false">' + shapes + marks + "</svg></div>";
  var inner = box.firstChild;
  var items = Array.prototype.slice.call(box.querySelectorAll(".map-place.on"));
  named.forEach(function (item) {
    if (!item.spot) return;
    var label = document.createElement("p");
    label.className = "map-label " + (item.side || "below");
    label.setAttribute("data-key", item.key);
    label.innerHTML = item.html;
    label.style.left = (item.spot[0] / W * 100) + "%";
    label.style.top = (item.spot[1] / (H + below) * 100) + "%";
    label.tip = item.tip;
    inner.appendChild(label);
    items.push(label);
    var shape = box.querySelector('.map-place.on[data-key="' + item.key + '"]');
    if (shape) shape.tip = item.tip;
  });
  hoverTips(box);
  return { items: items };
}

/* Light up a place everywhere it appears (its shape, its words, its row in a table) while it is pointed at or has the
   keyboard's focus; a click or Enter keeps it lit until pressed again. */
function linkPlaces(mapBox, elements) {
  var pinned = null;
  function light(key) {
    mapBox.classList.toggle("one-lit", !!key);
    elements.forEach(function (el) { el.classList.toggle("lit", !!key && el.getAttribute("data-key") === key); });
  }
  elements.forEach(function (el) {
    var key = el.getAttribute("data-key");
    function press() { pinned = pinned === key ? null : key; light(pinned || key); }
    el.addEventListener("mouseenter", function () { light(key); });
    el.addEventListener("mouseleave", function () { light(pinned); });
    el.addEventListener("focus", function () { light(key); });
    el.addEventListener("blur", function () { light(pinned); });
    el.addEventListener("click", press);
    el.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(); } });
  });
}

/* yearBand (a Chart.js add-on): shade a stretch of years on a line chart with a solid color, the Bulletin way
   (3.4 the pandemic, 3.9 and 3.10 the years since a change). `over` lays it over the gray lines (3.4); otherwise
   the lines show through it. `pad` carries it that many pixels past the last year.
     plugins: { yearBand: { from: 2020, to: 2023, color: "#E4E9F1", over: true } } */
function shadeYears(chart, o) {
  var labels = chart.data.labels, a = labels.indexOf(o.from), b = labels.indexOf(o.to);
  if (a < 0 || b < 0) return;
  var x = chart.scales.x, area = chart.chartArea, ctx = chart.ctx;
  var left = x.getPixelForValue(a), right = Math.min(x.getPixelForValue(b) + (o.pad || 0), chart.width);
  ctx.save();
  ctx.fillStyle = o.color;
  ctx.fillRect(left, area.top - (o.rise || 0), right - left, area.bottom - area.top + (o.rise || 0));
  ctx.restore();
}
var yearBand = {
  id: "yearBand",
  beforeDraw: function (chart, args, o) { if (o && o.from && !o.over) shadeYears(chart, o); },
  beforeDatasetsDraw: function (chart, args, o) { if (o && o.from && o.over) shadeYears(chart, o); },
};

/* yearsUnderBars (a Chart.js add-on, for pairs of upright bars, 3.6): each bar's series name (its year) right under
   the bar, above its group's name. Page 1.4 writes the years inside the feet of its bars; here most bars are too
   short to hold them. The chart must leave the room: scales.x.ticks.padding. Under a bar too narrow for the whole
   year, its last two digits ("’24").
     plugins: { yearsUnderBars: { on: true } } */
var yearsUnderBars = {
  id: "yearsUnderBars",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.on) return;
    var ctx = chart.ctx, base = chart.chartArea.bottom, short = false;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillStyle = WCA.colors.fine;
    ctx.font = "600 12px " + WCA.font;
    chart.data.datasets.forEach(function (dataset, d) {                /* whole years, or every year short: never a mix */
      chart.getDatasetMeta(d).data.forEach(function (bar) {
        if (ctx.measureText(String(dataset.label)).width > bar.getProps(["width"], true).width - 4) short = true;   /* two whole years side by side would touch */
      });
    });
    if (short) ctx.font = "600 11px " + WCA.font;
    chart.data.datasets.forEach(function (dataset, d) {
      var text = short ? "’" + String(dataset.label).slice(-2) : String(dataset.label);
      chart.getDatasetMeta(d).data.forEach(function (bar) { ctx.fillText(text, bar.getProps(["x"], true).x, base + 6); });
    });
    ctx.restore();
  },
};

/* changeMarks (a Chart.js add-on, for pairs of upright bars, 3.6): over each pair, the change between its two bars
   with the Bulletin's wide solid triangle (at two thirds of the Bulletin's size): over the number and pointing up
   for a rise, under it and pointing down for a fall. The number sits on a patch of the page's background, so no
   gray line runs through it.
     plugins: { changeMarks: { changes: [1.6, 10.3, -0.1], up: color, down: color, upText: color, downText: color } } */
var changeMarks = {
  id: "changeMarks",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.changes) return;
    var ctx = chart.ctx, size = 15, tall = 15;                        /* the number's size and the triangle's height, in pixels */
    ctx.save();
    ctx.font = "700 " + size + "px " + WCA.font;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    o.changes.forEach(function (change, i) {
      var bars = chart.data.datasets.map(function (d, k) { return chart.getDatasetMeta(k).data[i]; }).filter(Boolean);
      if (!bars.length) return;
      var x = bars.reduce(function (sum, bar) { return sum + bar.x; }, 0) / bars.length;
      var foot = Math.min.apply(null, bars.map(function (bar) { return bar.y; })) - 22;     /* above the values written over the bars */
      var half = Math.min(32, bars.reduce(function (sum, bar) { return sum + bar.width; }, 0) * 0.3);      /* half the triangle's width: no wider than six tenths of its pair */
      var text = (change > 0 ? "+" : change < 0 ? "−" : "") + Math.abs(change).toFixed(1);
      var width = ctx.measureText(text).width, rise = change >= 0;
      /* from the bars up: for a rise the number, then the triangle; for a fall the triangle, then the number */
      var numberY = rise ? foot - size * 0.62 : foot - tall - 4 - size * 0.62;
      var base = rise ? foot - size * 1.24 - 3 : foot - tall, tip = rise ? base - tall : foot;
      ctx.fillStyle = SURFACE;
      ctx.fillRect(x - width / 2 - 3, numberY - size * 0.62, width + 6, size * 1.24);
      ctx.fillStyle = rise ? o.upText : o.downText;
      ctx.fillText(text, x, numberY + 1);
      ctx.fillStyle = rise ? o.up : o.down;
      ctx.beginPath(); ctx.moveTo(x - half, base); ctx.lineTo(x + half, base); ctx.lineTo(x, tip); ctx.closePath(); ctx.fill();
    });
    ctx.restore();
  },
};

/* valuesInParts (a Chart.js add-on, for bars of 100% split in parts, 3.11): each part's value in its middle, in white
   or dark words (whichever reads on the part's color), where the part is wide enough for them.
     plugins: { valuesInParts: { format: function (v) { return v.toFixed(1) + "%"; }, size: 15 } } */
var valuesInParts = {
  id: "valuesInParts",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.format) return;
    var ctx = chart.ctx, full = "700 " + (o.size || 15) + "px " + WCA.font, small = "700 12px " + WCA.font;
    ctx.save();
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    chart.data.datasets.forEach(function (dataset, d) {
      chart.getDatasetMeta(d).data.forEach(function (bar, i) {
        var value = dataset.data[i];
        if (value === null || value === undefined) return;
        var at = bar.getProps(["x", "y", "base"], true), text = o.format(value), room = Math.abs(at.x - at.base);
        ctx.font = full;                                            /* in smaller type where the part is narrow; left out where even that does not fit (it shows on hover) */
        if (room < ctx.measureText(text).width + 10) { ctx.font = small; if (room < ctx.measureText(text).width + 6) return; }
        var fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
        ctx.fillStyle = textOn(fill);
        ctx.fillText(text, (at.x + at.base) / 2, at.y + 1);
      });
    });
    ctx.restore();
  },
};

/* districtNames (a Chart.js add-on, for the scatter of 3.13): each dot's name right beside it, on a patch of the
   page's background (so neither a gray line nor the line of best fit runs through a name), on the side the Bulletin
   used (`sides`) or, when that one is taken, the side with room. A name that has to sit away from its dot, to keep
   clear of another name, a dot or the key, is joined to it by a thin line; a name beside its dot needs none.
   `spots` (Settings) names the place to try first for a district: { side, dx, dy, lines }.
   On a narrow chart only the lowest and highest are named (`ends`); the rest show on hover. While one dot is
   pointed at (`focus`), the other names step back to gray. */
var districtNames = {
  id: "districtNames",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.names) return;
    var ctx = chart.ctx, area = chart.chartArea, dots = chart.getDatasetMeta(0).data;
    var focus = o.focus ? o.focus() : null, narrow = chart.width < 560, size = narrow ? 12 : 13, tall = size + 3;
    var NEAR = 12;                                                    /* from a dot's middle to the start of a name beside it */
    ctx.save();
    ctx.textBaseline = "middle";
    var taken = [];
    if (chart.$keyBox) taken.push({ l: chart.$keyBox.left - 6, t: chart.$keyBox.top - 6, r: chart.$keyBox.right + 6, b: chart.$keyBox.bottom + 6 });
    dots.forEach(function (dot, i) { taken.push({ l: dot.x - 9, t: dot.y - 9, r: dot.x + 9, b: dot.y + 9, dot: i }); });
    function clear(box, self) {
      return !taken.some(function (t) { return t.dot !== self && t.l < box.r && t.r > box.l && t.t < box.b && t.b > box.t; });
    }
    function inside(box) { return box.l >= area.left + 2 && box.r <= chart.width - 2 && box.t >= area.top - 8 && box.b <= area.bottom + 4; }
    /* a place for a name: beside its dot (left or right, `dx` from the dot's middle, `dy` lower) or centered above or below it */
    function spotAt(dot, side, dx, dy, width, height) {
      var left, top, upright = side === "above" || side === "below";
      if (upright) { left = dot.x - width / 2 + dx; top = side === "below" ? dot.y + 10 + dy : dot.y - 10 - height + dy; }
      else { left = side === "left" ? dot.x - dx - width : dot.x + dx; top = dot.y + dy - height / 2; }
      return { left: left, top: top, side: side, width: width, height: height,
               away: upright ? Math.abs(dy) > 6 : (Math.abs(dy) > height / 2 || dx > NEAR + 2),
               box: { l: left - 3, t: top, r: left + width + 3, b: top + height } };
    }
    /* the districts whose place is set in Settings first, so that the names placed by search keep clear of them */
    var order = dots.map(function (dot, i) { return i; }).sort(function (a, b) {
      var setA = o.spots && o.spots[o.names[a]] ? 0 : 1, setB = o.spots && o.spots[o.names[b]] ? 0 : 1;
      return setA - setB || dots[a].y - dots[b].y;
    });
    var placed = [];
    order.forEach(function (i) {
      if (narrow && (!o.ends || o.ends.indexOf(i) < 0) && focus !== i) return;
      var dot = dots[i], name = o.names[i], set = !narrow && o.spots && o.spots[name];
      ctx.font = (focus === i ? "700 " : "600 ") + size + "px " + WCA.font;
      function widthOf(lines) { return Math.max.apply(null, lines.map(function (line) { return ctx.measureText(line).width; })); }
      var first = (o.sides && o.sides[name]) || (dot.x > (area.left + area.right) / 2 ? "left" : "right");
      var sides = first === "left" ? ["left", "right"] : ["right", "left"];
      var spot = null, lines = [name];
      if (set) {
        var setLines = set.lines || [name];
        var tryout = spotAt(dot, set.side || first, set.dx === undefined ? (set.side === "above" || set.side === "below" ? 0 : NEAR) : set.dx,
                            set.dy || 0, widthOf(setLines), setLines.length * tall + 2);
        if (inside(tryout.box) && clear(tryout.box, i)) { spot = tryout; lines = setLines; }
      }
      var width = widthOf([name]), height = tall + 2;
      /* otherwise: the nearest clear place, beside the dot first, then a little higher or lower, then further away */
      function search(downs, aways) {
        return downs.some(function (dy) {
          return aways.some(function (dx) {
            return sides.some(function (side) {
              var tryout = spotAt(dot, side, dx, dy, width, height);
              if (!inside(tryout.box) || !clear(tryout.box, i)) return false;
              spot = tryout;
              return true;
            });
          });
        });
      }
      if (!spot) search([0, -15, 15, -30, 30, -45, 45], [NEAR, 28, 48]);
      if (!spot) search([-60, 60, -75, 75, -90, 90, 0, -30, 30], [NEAR, 28, 48, 72, 96]);
      if (!spot) {                                                    /* nowhere clear: beside the dot, on the side that stays on the chart */
        spot = spotAt(dot, first, NEAR, 0, width, height);
        if (!inside(spot.box)) spot = spotAt(dot, first === "left" ? "right" : "left", NEAR, 0, width, height);
      }
      taken.push(spot.box);
      placed.push({ i: i, dot: dot, lines: lines, spot: spot });
    });
    /* the thin lines first, then the patches and the names over their ends */
    placed.forEach(function (p) {
      var s = p.spot;
      if (!s.away) return;
      var faded = focus !== null && focus !== p.i;
      var toX = s.side === "left" ? s.left + s.width + 2 : (s.side === "right" ? s.left - 2 : s.left + s.width / 2);
      var toY = s.side === "above" ? s.top + s.height : (s.side === "below" ? s.top : s.top + s.height / 2);
      var dx = toX - p.dot.x, dy = toY - p.dot.y, length = Math.hypot(dx, dy) || 1;
      ctx.strokeStyle = faded ? WCA.cssVar("--db-quiet") : WCA.colors.muted; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p.dot.x + dx / length * 8, p.dot.y + dy / length * 8); ctx.lineTo(toX, toY); ctx.stroke();
    });
    placed.forEach(function (p) {
      var s = p.spot, faded = focus !== null && focus !== p.i;
      ctx.fillStyle = SURFACE;
      ctx.fillRect(s.left - 2, s.top + 1, s.width + 4, s.height - 2);
      ctx.font = (focus === p.i ? "700 " : "600 ") + size + "px " + WCA.font;
      ctx.fillStyle = faded ? WCA.colors.muted : WCA.colors.ink;
      ctx.textAlign = s.side === "left" ? "right" : (s.side === "right" ? "left" : "center");
      var x = s.side === "left" ? s.left + s.width : (s.side === "right" ? s.left : s.left + s.width / 2);
      p.lines.forEach(function (line, k) { ctx.fillText(line, x, s.top + 1 + tall * (k + 0.5) + 0.5); });
    });
    ctx.restore();
  },
};


/* ---- Tools the chapter 4 cards share ---------------------------------------------------------------- */

/* Sideways bars whose rows come and go (page 4.5). They are built from the same pieces as makeBars' bars (a name,
   then a bar with its value inside its end, gray lines behind, the scale's numbers under them, a dashed line for a
   reference value), so the two look alike; styles.css gives them their own layout (".hbars.slots"). Every row is
   in the chart all the time. `show` names the rows on show: those share the chart's height in order, and the
   others fold away between them, so the browser can slide every row to its place.
   `items`: [{ key, label, value, text, tip, className }], every row the chart can show, in order.
   `opts`: max (the top of the scale; it never changes), step (a gray line at each step), tick (how the scale's
   numbers are written), ref (a value marked with a dashed line, named by the box's data-ref-words, "{value}" being
   the value as `refText` writes it).
   Returns { list, show(keys) }. */
function makeSlotBars(box, items, opts) {
  function part(tag, className) { var el = document.createElement(tag); el.className = className; return el; }
  var words = box.getAttribute("data-ref-words") || "{value}";
  var tick = opts.tick || function (v) { return v + "%"; };
  var list = box.appendChild(part("div", "hb-rows"));                 /* the rows, with the gray lines and the dashed line laid over the same space */
  var grid = list.appendChild(part("div", "hb-grid"));
  var ref = opts.ref !== undefined ? list.appendChild(part("div", "hb-ref")) : null;
  var axis = box.appendChild(part("div", "hb-axis"));
  var rows = {}, shown = [];

  box.style.setProperty("--max", opts.max);
  var lines = "", numbers = "";
  for (var v = 0; v <= opts.max + 1e-9; v += opts.step) {
    var at = (v / opts.max * 100) + "%";
    lines += '<span style="left:' + at + '"></span>';
    numbers += '<span style="left:' + at + '">' + tick(v) + "</span>";
  }
  grid.innerHTML = lines;
  axis.innerHTML = numbers;
  if (ref) {
    ref.innerHTML = "<i></i><b></b>";
    ref.querySelector("i").style.left = (opts.ref / opts.max * 100) + "%";
    ref.querySelector("b").textContent = words.replace("{value}", (opts.refText || tick)(opts.ref));
  }

  items.forEach(function (item) {
    var row = part("div", "hb-row" + (item.className ? " " + item.className : ""));
    row.setAttribute("data-key", item.key);
    row.innerHTML = '<span class="hb-label"></span><span class="hb-track"><span class="hb-bar"><span class="hb-value"></span></span></span>';
    row.querySelector(".hb-label").textContent = item.label;
    row.querySelector(".hb-value").textContent = item.text;
    row.querySelector(".hb-track").tip = item.tip || null;
    row.style.setProperty("--v", Math.max(item.value, 0));
    list.appendChild(row);
    rows[item.key] = row;
  });

  /* Where each value goes: inside its bar's end when the bar can hold it, just past the end when it cannot (and past
     the dashed line, where the line would run through it). Worked out from the size the values are going to have
     (styles.css: --value-size), not the size they have while they are still changing. The dashed line's words are
     centered over the line, but never leave the bars' space. */
  function fit() {
    var anyTrack = list.querySelector(".hb-track");
    var width = anyTrack ? anyTrack.clientWidth : 0;
    if (!width) return;
    var size = getComputedStyle(box).getPropertyValue("--value-size").trim() || "13px";
    var refAt = ref ? opts.ref / opts.max * width : null;
    shown.forEach(function (item) {
      var row = rows[item.key], value = row.querySelector(".hb-value");
      var text = textWidth(item.text, "700 " + size) + 2;
      var bar = Math.max(item.value, 0) / opts.max * width;
      var out = bar < text + 14;                                          /* 7 pixels of room on each side of the words */
      row.classList.toggle("out", out);
      value.style.color = out ? "" : textOn(getComputedStyle(row).getPropertyValue("--hue").trim());
      var shift = 4;                                                      /* from the bar's end to an outside value */
      if (out && refAt !== null && refAt > bar + shift - 5 && refAt < bar + shift + text + 8 + 5) shift = refAt - bar + 6;
      value.style.setProperty("--shift", shift + "px");
    });
    if (ref) {
      var label = ref.querySelector("b"), half = label.offsetWidth / 2;
      label.style.left = Math.min(Math.max(refAt, half), Math.max(width - half, half)) + "px";
    }
  }

  function show(keys) {
    shown = items.filter(function (item) { return keys.indexOf(item.key) >= 0; });
    box.classList.toggle("many", shown.length > (opts.few || 4));      /* many rows: thinner bars and smaller values (styles.css) */
    list.style.setProperty("--shown", shown.length);
    var slot = 0;
    items.forEach(function (item) {
      var on = keys.indexOf(item.key) >= 0, row = rows[item.key];
      row.style.setProperty("--slot", slot);                             /* a row that is away waits where it will come in: between its neighbors */
      row.classList.toggle("away", !on);
      if (on) slot++;
    });
    fit();
  }

  whenLayoutChanges(fit, box);
  hoverTips(box);
  return { list: list, show: show };
}

/* Update a Chart.js chart so that its marks MOVE to their new places and sizes, over `ms` milliseconds, instead of
   jumping there (page 4.10). The template switches Chart.js's own animation off for the whole page by setting its
   default to `false`. That also takes away the list of settings an animation is built from, so that asking one
   chart to animate does nothing by itself. This puts the list back for the moment of the update only and then
   takes it away again, so no other chart starts to move. Readers who asked their device for less movement get the
   change at once. */
var ANIMATION_SETTINGS = { delay: undefined, duration: 0, easing: "linear", fn: undefined, from: undefined, loop: undefined, to: undefined, type: undefined };
function moveChart(chart, ms, easing) {
  if (STILL || !ms) { chart.options.animation = false; chart.update(); return; }
  var off = Chart.defaults.animation;
  Chart.defaults.animation = ANIMATION_SETTINGS;
  chart.options.animation = { duration: ms, easing: easing || "easeInOutQuad" };
  try { chart.update(); } finally { Chart.defaults.animation = off; }
}

/* columnValues (a Chart.js add-on, for upright bars): each bar's value, written inside the top of the bar in white
   or dark words, whichever reads on the bar's color (place: "inside", page 4.4), or just above the bar (place:
   "above", page 4.10, as barNotes does). Unlike barNotes, a value stays with its bar while the bar grows, sinks or
   slides, and a bar that has sunk away carries none. A bar too narrow or too short to hold its value has it above
   the bar. `keep` is the height to leave free in the bar under the value (for the words in its foot).
     plugins: { columnValues: { place: "inside", size: 14, text: function (datasetIndex, index) { return "12.6%"; } } }
   null = no value on that bar. `weight` is how bold ("700" if left out); `size` can be a function of the chart's
   width. With `narrow` (pixels), a chart narrower than that writes `narrowText` instead of `text` (fewer values on a
   phone) and uses `narrowSize` as its size. */
var columnValues = {
  id: "columnValues",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.text) return;
    var slim = o.narrow && chart.width < o.narrow;
    var write = (slim && o.narrowText) ? o.narrowText : o.text;
    var size = (slim && o.narrowSize) ? o.narrowSize : (typeof o.size === "function" ? o.size(chart.width) : (o.size || 13));
    var ctx = chart.ctx;
    ctx.save();
    ctx.font = (o.weight || "700") + " " + size + "px " + WCA.font;
    ctx.textAlign = "center";
    ctx.strokeStyle = SURFACE; ctx.lineWidth = 3; ctx.lineJoin = "round";
    chart.data.datasets.forEach(function (dataset, d) {
      if (!chart.isDatasetVisible(d)) return;
      chart.getDatasetMeta(d).data.forEach(function (bar, i) {
        var text = write(d, i);
        if (text === null || text === undefined) return;
        var at = bar.getProps(["x", "y", "base", "width"], false);       /* where the bar is at this moment */
        var tall = at.base - at.y;
        if (!(tall > 2)) return;                                         /* sunk away, or not risen yet */
        var fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
        var inside = o.place === "inside" && at.width >= ctx.measureText(text).width + 8 && tall >= size + 12 + (o.keep || 0);
        if (inside) {
          ctx.textBaseline = "top";
          ctx.fillStyle = textOn(fill);
          ctx.fillText(text, at.x, at.y + 7);
        } else {
          ctx.textBaseline = "bottom";
          ctx.strokeText(text, at.x, at.y - 4);                          /* a thin white edge, in case the words touch a neighbouring bar */
          ctx.fillStyle = WCA.colors.ink;
          ctx.fillText(text, at.x, at.y - 4);
        }
      });
    });
    ctx.restore();
  },
};

/* footWords (a Chart.js add-on, for upright bars): words in the foot of chosen bars (the period a bar stands for),
   on one to three short lines, in white or dark words, whichever reads on the bar's color, as the Bulletin writes
   them. They are written only in a bar wide and tall enough to hold them, and they stay with their bar while it
   moves. `keep` is the height to leave free in the bar above them (for a value inside the bar's top).
     plugins: { footWords: { lines: function (datasetIndex, index) { return ["2015", "to", "2019"]; } } }
   null = no words in that bar. `onFit(fit)` tells the chart whether every bar that was given words can hold them,
   so that it can show a key when one cannot. */
var footWords = {
  id: "footWords",
  afterDatasetsDraw: function (chart, args, o) {
    if (!o || !o.lines) return;
    var ctx = chart.ctx, size = o.size || 12, tall = size + 2, asked = 0, fit = true;
    ctx.save();
    ctx.font = "600 " + size + "px " + WCA.font;
    ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    chart.data.datasets.forEach(function (dataset, d) {
      if (!chart.isDatasetVisible(d)) return;
      chart.getDatasetMeta(d).data.forEach(function (bar, i) {
        var lines = o.lines(d, i);
        if (!lines) return;
        asked++;
        var now = bar.getProps(["x", "y", "base", "width"], false);      /* where the bar is at this moment */
        var end = bar.getProps(["y", "base", "width"], true);            /* and the size it is going to have */
        var wide = Math.max.apply(null, lines.map(function (line) { return ctx.measureText(line).width; }));
        var need = lines.length * tall + 6 + (o.keep || 0);
        if (end.width < wide + 6 || end.base - end.y < need) { fit = false; return; }
        if (now.base - now.y < need) return;                             /* still rising: its words come when it can hold them */
        var fill = Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[i] : dataset.backgroundColor;
        ctx.fillStyle = textOn(fill);
        lines.forEach(function (line, k) { ctx.fillText(line, now.x, now.base - 4 - (lines.length - 1 - k) * tall); });
      });
    });
    ctx.restore();
    if (o.onFit && asked) o.onFit(fit);
  },
};
