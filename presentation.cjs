const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");

const { FaDatabase, FaCode, FaRobot, FaClipboardList, FaUsers, FaCalendarAlt, FaExclamationTriangle, FaRocket, FaCogs, FaChartBar, FaColumns, FaFilter, FaSort, FaLayerGroup, FaSave, FaUndo, FaHandsHelping, FaRulerCombined } = require("react-icons/fa");

function renderIconSvg(IconComponent, color, size = 256) {
  return ReactDOMServer.renderToStaticMarkup(
    React.createElement(IconComponent, { color, size: String(size) })
  );
}

async function iconToBase64Png(IconComponent, color, size = 256) {
  const svg = renderIconSvg(IconComponent, color, size);
  const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + pngBuffer.toString("base64");
}

const NAVY = "1B2A4A";
const DARK_NAVY = "0F1B33";
const SLATE = "334155";
const LIGHT_BG = "F1F5F9";
const WHITE = "FFFFFF";
const ACCENT_BLUE = "3B82F6";
const ACCENT_TEAL = "0EA5E9";
const MUTED = "94A3B8";
const BODY_TEXT = "475569";

const makeShadow = () => ({ type: "outer", blur: 8, offset: 2, angle: 135, color: "000000", opacity: 0.1 });

async function buildPresentation() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "Duke AIPI Capstone Team";
  pres.title = "Rebuilding the Query Designer";

  const iconDb = await iconToBase64Png(FaDatabase, "#" + ACCENT_BLUE);
  const iconCode = await iconToBase64Png(FaCode, "#" + ACCENT_TEAL);
  const iconRobot = await iconToBase64Png(FaRobot, "#" + ACCENT_BLUE);
  const iconClipboard = await iconToBase64Png(FaClipboardList, "#" + ACCENT_TEAL);
  const iconUsers = await iconToBase64Png(FaUsers, "#" + ACCENT_BLUE);
  const iconWarning = await iconToBase64Png(FaExclamationTriangle, "#F59E0B");
  const iconRocket = await iconToBase64Png(FaRocket, "#" + ACCENT_BLUE);
  const iconCogs = await iconToBase64Png(FaCogs, "#" + ACCENT_TEAL);
  const iconChart = await iconToBase64Png(FaChartBar, "#" + ACCENT_BLUE);
  const iconColumns = await iconToBase64Png(FaColumns, "#" + WHITE);
  const iconFilter = await iconToBase64Png(FaFilter, "#" + WHITE);
  const iconSort = await iconToBase64Png(FaSort, "#" + WHITE);
  const iconLayers = await iconToBase64Png(FaLayerGroup, "#" + WHITE);
  const iconSave = await iconToBase64Png(FaSave, "#" + WHITE);
  const iconUndo = await iconToBase64Png(FaUndo, "#" + WHITE);
  const iconHands = await iconToBase64Png(FaHandsHelping, "#" + ACCENT_BLUE);
  const iconRuler = await iconToBase64Png(FaRulerCombined, "#" + ACCENT_TEAL);

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 1: Title
  // ═══════════════════════════════════════════════════════════════════════
  let slide = pres.addSlide();
  slide.background = { color: DARK_NAVY };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: ACCENT_BLUE } });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 4.2, w: 10, h: 0.008, fill: { color: ACCENT_BLUE, transparency: 40 } });

  slide.addText("REBUILDING THE", {
    x: 0.8, y: 1.2, w: 8, h: 0.6,
    fontSize: 16, fontFace: "Calibri", color: ACCENT_TEAL, charSpacing: 6, bold: true, margin: 0,
  });
  slide.addText("Query Designer", {
    x: 0.8, y: 1.7, w: 8, h: 1.2,
    fontSize: 44, fontFace: "Georgia", color: WHITE, bold: true, margin: 0,
  });
  slide.addText("Entrinsik Informer  |  Duke AIPI Capstone", {
    x: 0.8, y: 3.0, w: 8, h: 0.5,
    fontSize: 16, fontFace: "Calibri", color: MUTED, margin: 0,
  });
  slide.addText("Mid-Semester Progress Update", {
    x: 0.8, y: 3.5, w: 8, h: 0.5,
    fontSize: 14, fontFace: "Calibri", color: MUTED, italic: true, margin: 0,
  });
  slide.addText("Spring 2026", {
    x: 0.8, y: 4.5, w: 4, h: 0.4,
    fontSize: 12, fontFace: "Calibri", color: MUTED, margin: 0,
  });

  slide.addNotes(
    "Welcome everyone. Today we're presenting our mid-semester update on the Entrinsik capstone project. " +
    "We're working with Entrinsik, the company behind the Informer platform, to rebuild one of their core components — the Query Designer. " +
    "I'll walk through what we've built, the technical decisions, and where we're headed."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 2: Project Overview + Progress
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: LIGHT_BG };

  slide.addText("Project Overview", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  // Phase 1 card
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.3, w: 4.0, h: 3.0, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.3, w: 4.0, h: 0.45, fill: { color: SLATE } });
  slide.addText("Phase 1: Chatbots", {
    x: 0.7, y: 1.3, w: 4.0, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: WHITE, bold: true, align: "center", valign: "middle",
  });
  slide.addText([
    { text: "Built chatbots for Informer Go", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "CSV data readers for students", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "Interactive data exploration", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "", options: { breakLine: true, fontSize: 6 } },
    { text: "Pivoted after first check-in", options: { fontSize: 12, color: MUTED, italic: true } },
  ], { x: 1.0, y: 1.95, w: 3.4, h: 2.1, valign: "top" });

  // Phase 2 card
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 1.3, w: 4.0, h: 3.0, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 1.3, w: 4.0, h: 0.45, fill: { color: ACCENT_BLUE } });
  slide.addText("Phase 2: Query Designer", {
    x: 5.3, y: 1.3, w: 4.0, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: WHITE, bold: true, align: "center", valign: "middle",
  });
  slide.addText([
    { text: "Rebuilding a core Informer component", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "Visual SQL query builder", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "Works with real datasources", options: { bullet: true, breakLine: true, fontSize: 13, color: BODY_TEXT } },
    { text: "", options: { breakLine: true, fontSize: 6 } },
    { text: "Current focus", options: { fontSize: 12, color: ACCENT_BLUE, bold: true } },
  ], { x: 5.6, y: 1.95, w: 3.4, h: 2.1, valign: "top" });

  slide.addText("\u2192", {
    x: 4.55, y: 2.2, w: 0.9, h: 0.6,
    fontSize: 28, fontFace: "Calibri", color: ACCENT_BLUE, align: "center", valign: "middle",
  });

  slide.addText("Informer is an enterprise data platform used by universities and organizations to access, visualize, and report on data from multiple database systems.", {
    x: 0.7, y: 4.6, w: 8.6, h: 0.5,
    fontSize: 11, fontFace: "Calibri", color: MUTED, italic: true, margin: 0,
  });

  slide.addNotes(
    "We started the semester building chatbots for Informer Go — AI tools that could read CSV files and let students interact with data conversationally. " +
    "After our first check-in, we pivoted to a bigger opportunity: rebuilding the Query Designer. " +
    "Informer is an enterprise data platform used by Duke and other universities. " +
    "The Query Designer lets users build SQL queries visually — they pick tables, columns, filters, joins — without writing raw SQL. " +
    "Datasources can be any type of database: PostgreSQL, Oracle, MySQL, and others. " +
    "The current version works but is dated and needs a modern redesign. That's our job."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 3: What is the Query Designer?
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: WHITE };

  slide.addText("What is the Query Designer?", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  const cards = [
    { icon: iconDb, title: "Datasources", desc: "Connect to any database — PostgreSQL, Oracle, MySQL, and more" },
    { icon: iconCode, title: "Visual Builder", desc: "Pick tables, columns, filters, and joins without writing SQL" },
    { icon: iconChart, title: "Live Preview", desc: "See results instantly as you build your query" },
  ];

  cards.forEach((card, i) => {
    const x = 0.7 + i * 3.1;
    slide.addShape(pres.shapes.RECTANGLE, { x, y: 1.4, w: 2.8, h: 2.6, fill: { color: LIGHT_BG }, shadow: makeShadow() });
    slide.addImage({ data: card.icon, x: x + 1.05, y: 1.65, w: 0.7, h: 0.7 });
    slide.addText(card.title, {
      x, y: 2.5, w: 2.8, h: 0.4,
      fontSize: 15, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
    });
    slide.addText(card.desc, {
      x: x + 0.2, y: 2.95, w: 2.4, h: 0.8,
      fontSize: 12, fontFace: "Calibri", color: BODY_TEXT, align: "center",
    });
  });

  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.3, w: 8.6, h: 0.8, fill: { color: NAVY } });
  slide.addText("The old Query Designer works, but the interface is dated. Our job: make it modern, intuitive, and faster.", {
    x: 1.0, y: 4.3, w: 8.0, h: 0.8,
    fontSize: 13, fontFace: "Calibri", color: WHITE, align: "center", valign: "middle",
  });

  slide.addNotes(
    "The Query Designer sits between a user and a database. " +
    "Datasources can be PostgreSQL, Oracle, MySQL, even multivalue databases. " +
    "The visual builder lets you pick tables, select columns, add filters, create joins — all point-and-click. No SQL needed. " +
    "You get a live preview of results as you build. " +
    "The current version works fine but feels outdated. Our goal is to make it modern, intuitive, and faster."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 4: Our Approach — The Ribbon
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: LIGHT_BG };

  slide.addText("Our Approach: The Microsoft Ribbon", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });
  slide.addText("We iterated through multiple interface designs before settling on the Office-style ribbon UI.", {
    x: 0.7, y: 1.05, w: 8.6, h: 0.4,
    fontSize: 13, fontFace: "Calibri", color: BODY_TEXT, margin: 0,
  });

  // Ribbon tab mockup
  const tabs = ["Home", "Columns", "Filters", "Joins", "Sort & Limit", "Sub-selects"];
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.7, w: 8.6, h: 0.45, fill: { color: "E8EDF3" } });
  tabs.forEach((tab, i) => {
    const tx = 0.85 + i * 1.4;
    const isActive = i === 0;
    if (isActive) {
      slide.addShape(pres.shapes.RECTANGLE, { x: tx - 0.1, y: 1.7, w: 1.2, h: 0.45, fill: { color: WHITE } });
    }
    slide.addText(tab, {
      x: tx - 0.1, y: 1.7, w: 1.2, h: 0.45,
      fontSize: 10, fontFace: "Calibri", color: isActive ? ACCENT_BLUE : SLATE,
      bold: isActive, align: "center", valign: "middle",
    });
  });

  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 2.15, w: 8.6, h: 1.2, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addText("Source  |  Query Summary  |  Quick Add  |  Run  |  Export", {
    x: 1.0, y: 2.15, w: 8.0, h: 1.2,
    fontSize: 12, fontFace: "Calibri", color: MUTED, align: "center", valign: "middle",
  });

  const reasons = [
    { title: "Familiar", desc: "Users already know this pattern" },
    { title: "Organized", desc: "Related actions grouped logically" },
    { title: "Scalable", desc: "Easy to add new feature tabs" },
    { title: "Glanceable", desc: "Everything visible, no hidden menus" },
  ];

  reasons.forEach((r, i) => {
    const x = 0.7 + i * 2.3;
    slide.addShape(pres.shapes.RECTANGLE, { x, y: 3.7, w: 2.0, h: 1.4, fill: { color: WHITE }, shadow: makeShadow() });
    slide.addText(r.title, {
      x, y: 3.85, w: 2.0, h: 0.35,
      fontSize: 14, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
    });
    slide.addText(r.desc, {
      x: x + 0.15, y: 4.2, w: 1.7, h: 0.7,
      fontSize: 11, fontFace: "Calibri", color: BODY_TEXT, align: "center",
    });
  });

  slide.addNotes(
    "We went through several rounds of design iteration before landing on the Office-style ribbon. " +
    "Six tabs: Home, Columns, Filters, Joins, Sort and Limit, and Sub-selects. " +
    "Home gives a bird's-eye view with summary tiles and quick-add buttons. " +
    "We chose the ribbon because it's familiar, organized, scalable, and everything is visible at a glance."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 5: Key Features Built
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: NAVY };

  slide.addText("Key Features Built", {
    x: 0.7, y: 0.35, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: WHITE, bold: true, margin: 0,
  });

  const features = [
    { icon: iconColumns, title: "Column Picker", desc: "Drag-and-drop with search" },
    { icon: iconFilter, title: "Filter Builder", desc: "\"is exactly\", \"contains\", \"is blank\"" },
    { icon: iconLayers, title: "Join Builder", desc: "Auto-suggested from schema" },
    { icon: iconSort, title: "Sort & Limit", desc: "Multi-column sort + row limits" },
    { icon: iconSave, title: "Auto-Save", desc: "Debounced save + Ctrl+S" },
    { icon: iconUndo, title: "Undo / Redo", desc: "80-step history stack" },
  ];

  features.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.7 + col * 3.1;
    const y = 1.2 + row * 1.9;

    slide.addShape(pres.shapes.RECTANGLE, { x, y, w: 2.8, h: 1.6, fill: { color: SLATE } });
    slide.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55, fill: { color: ACCENT_BLUE } });
    slide.addImage({ data: f.icon, x: x + 0.37, y: y + 0.37, w: 0.31, h: 0.31 });
    slide.addText(f.title, {
      x: x + 0.95, y: y + 0.2, w: 1.6, h: 0.35,
      fontSize: 14, fontFace: "Calibri", color: WHITE, bold: true, margin: 0,
    });
    slide.addText(f.desc, {
      x: x + 0.95, y: y + 0.55, w: 1.6, h: 0.35,
      fontSize: 11, fontFace: "Calibri", color: MUTED, margin: 0,
    });
  });

  slide.addText("Also: multi-tab queries, SQL export, sub-query stages, dialect-aware SQL compiler", {
    x: 0.7, y: 5.0, w: 8.6, h: 0.35,
    fontSize: 11, fontFace: "Calibri", color: MUTED, italic: true, margin: 0,
  });

  slide.addNotes(
    "The Column Picker lets you search and select columns with drag-and-drop reordering. " +
    "The Filter Builder uses friendly language — 'is exactly', 'contains', 'is blank' instead of SQL operators. " +
    "The Join Builder auto-suggests joins by reading schema relationships. " +
    "Multi-column sorting with row limits. Auto-save with debouncing plus Ctrl+S. Full undo/redo with 80-step history. " +
    "We also built multi-tab support, SQL export, sub-query stages, and a SQL compiler that handles PostgreSQL, Oracle, and MySQL syntax."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 6: Data Collection & Preparation
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: WHITE };

  slide.addText("Data Collection & Preparation", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  // Main message card
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.5, y: 1.4, w: 7.0, h: 1.6, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  slide.addText("This is primarily a UI/UX design project", {
    x: 1.5, y: 1.55, w: 7.0, h: 0.45,
    fontSize: 16, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
  });
  slide.addText("We are not training models or analyzing datasets. Our \"data\" is user interaction patterns and usability feedback.", {
    x: 1.8, y: 2.1, w: 6.4, h: 0.7,
    fontSize: 13, fontFace: "Calibri", color: BODY_TEXT, align: "center",
  });

  // What we DO work with
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 3.4, w: 4.2, h: 1.8, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  slide.addText("What We Work With", {
    x: 0.7, y: 3.5, w: 4.2, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
  });
  slide.addText([
    { text: "Database schema metadata (tables, columns, types)", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Real datasources for testing (Northwind, Banner)", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Query definitions (JSON structures)", options: { bullet: true, fontSize: 12, color: BODY_TEXT } },
  ], { x: 1.0, y: 3.95, w: 3.6, h: 1.1, valign: "top" });

  // What we WILL collect
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 3.4, w: 4.2, h: 1.8, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  slide.addText("What We Will Collect", {
    x: 5.1, y: 3.5, w: 4.2, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: ACCENT_BLUE, bold: true, align: "center", margin: 0,
  });
  slide.addText([
    { text: "Usability survey responses (Likert + text)", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Task completion observations", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Old vs. new QD comparison ratings", options: { bullet: true, fontSize: 12, color: BODY_TEXT } },
  ], { x: 5.4, y: 3.95, w: 3.6, h: 1.1, valign: "top" });

  slide.addNotes(
    "This is primarily a UI/UX design project, not a data science or model training project. " +
    "We haven't collected traditional datasets because there's nothing to train on at this stage. " +
    "What we do work with is database schema metadata — tables, columns, data types — from real datasources like Northwind and Banner. " +
    "And the query definitions themselves, which are JSON structures. " +
    "The data we will collect is usability feedback: survey responses with Likert scale ratings and open-ended text, " +
    "task completion observations, and direct comparisons between the old and new Query Designer. " +
    "We've built a testing framework specifically for this — more on that in a later slide."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 7: Model Development / AI Integration
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: LIGHT_BG };

  slide.addText("AI & Model Development", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  // Status callout
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.15, w: 8.6, h: 0.55, fill: { color: "FEF3C7" } });
  slide.addText("Our project is primarily UX/UI design. AI integration is a secondary, exploratory feature.", {
    x: 1.0, y: 1.15, w: 8.0, h: 0.55,
    fontSize: 13, fontFace: "Calibri", color: "92400E", align: "center", valign: "middle",
  });

  // Two cards
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 2.0, w: 4.2, h: 2.9, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 2.0, w: 4.2, h: 0.45, fill: { color: "7C3AED" } });
  slide.addText("Natural Language Bar", {
    x: 0.7, y: 2.0, w: 4.2, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: WHITE, bold: true, align: "center", valign: "middle",
  });
  slide.addText([
    { text: "Describe a query in plain English", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "AI searches schema metadata first", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Generates SQL and inserts it directly", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Uses Informer's built-in LLM models", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "", options: { breakLine: true, fontSize: 4 } },
    { text: "\"Show me all customers from Germany\"", options: { fontSize: 11, color: "7C3AED", italic: true } },
  ], { x: 1.0, y: 2.6, w: 3.6, h: 2.1, valign: "top" });

  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 2.0, w: 4.2, h: 2.9, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 2.0, w: 4.2, h: 0.45, fill: { color: ACCENT_BLUE } });
  slide.addText("AI Chat Sidebar", {
    x: 5.1, y: 2.0, w: 4.2, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: WHITE, bold: true, align: "center", valign: "middle",
  });
  slide.addText([
    { text: "Conversational query builder", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Modifies the visual builder state", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Understands current query context", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "No custom model — uses platform AI", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "", options: { breakLine: true, fontSize: 4 } },
    { text: "\"Add city and company columns\"", options: { fontSize: 11, color: ACCENT_BLUE, italic: true } },
  ], { x: 5.4, y: 2.6, w: 3.6, h: 2.1, valign: "top" });

  slide.addNotes(
    "Our project has been mostly UX/UI design work. We haven't trained any custom AI models or algorithms. " +
    "However, we have integrated AI as an exploratory feature using Informer's built-in language models. " +
    "The Natural Language Bar lets you type something like 'Show me all customers from Germany' " +
    "and the AI searches the database schema, finds the right tables and columns, and generates SQL. " +
    "The Chat Sidebar is conversational — you can ask it to modify your query, like 'Add the city column', " +
    "and it updates the visual builder. " +
    "We're not training custom models. We're using Informer's platform AI through their completion API. " +
    "The AI pre-fetches schema metadata to ground its responses in actual table and column names."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 8: Evaluation Metrics
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: WHITE };

  slide.addText("Evaluation Metrics", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  slide.addImage({ data: iconRuler, x: 0.7, y: 1.15, w: 0.45, h: 0.45 });
  slide.addText("How we measure whether the new Query Designer is actually better", {
    x: 1.3, y: 1.15, w: 7.5, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: BODY_TEXT, valign: "middle", margin: 0,
  });

  const metrics = [
    { title: "Usability Ratings", desc: "Likert scale (1-5) on ease of use, clarity, and intuitiveness for each feature area", color: ACCENT_BLUE },
    { title: "Task Completion", desc: "Can users complete common query tasks (select columns, add filters, create joins) without help?", color: ACCENT_TEAL },
    { title: "Comparison Scores", desc: "Direct old vs. new ratings: which is easier, more professional, has better features?", color: "7C3AED" },
    { title: "Qualitative Feedback", desc: "Open-ended responses on what works, what's confusing, and what to improve", color: "F59E0B" },
  ];

  metrics.forEach((m, i) => {
    const y = 1.9 + i * 0.85;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 0.7, fill: { color: LIGHT_BG }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 0.07, h: 0.7, fill: { color: m.color } });
    slide.addText(m.title, {
      x: 1.1, y, w: 2.2, h: 0.7,
      fontSize: 13, fontFace: "Calibri", color: NAVY, bold: true, valign: "middle", margin: 0,
    });
    slide.addText(m.desc, {
      x: 3.3, y, w: 5.7, h: 0.7,
      fontSize: 12, fontFace: "Calibri", color: BODY_TEXT, valign: "middle", margin: 0,
    });
  });

  slide.addText("These metrics align with our core objective: build a query designer that's measurably easier to use than the current version.", {
    x: 0.7, y: 5.0, w: 8.6, h: 0.4,
    fontSize: 11, fontFace: "Calibri", color: MUTED, italic: true, margin: 0,
  });

  slide.addNotes(
    "Since this is a UX project, our evaluation metrics are centered on usability, not model accuracy. " +
    "First, Likert scale ratings from 1 to 5 on ease of use, clarity, and intuitiveness for each feature area — " +
    "columns, filters, joins, sorting, sub-selects, and the AI features. " +
    "Second, task completion — can users actually complete common query-building tasks without getting stuck? " +
    "Third, direct comparison scores — we ask testers to rate the old Query Designer versus the new one " +
    "on dimensions like ease of use, professional appearance, and feature quality. " +
    "And fourth, qualitative feedback — open-ended text responses about what works, what's confusing, and what to improve. " +
    "All of these align with our core objective: build something measurably better than what exists today."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 9: User Testing Framework
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: LIGHT_BG };

  slide.addText("User Testing Framework", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  slide.addImage({ data: iconClipboard, x: 0.7, y: 1.1, w: 0.45, h: 0.45 });
  slide.addText("Built a structured survey app to evaluate the new Query Designer with real users", {
    x: 1.3, y: 1.1, w: 7.5, h: 0.45,
    fontSize: 13, fontFace: "Calibri", color: BODY_TEXT, valign: "middle", margin: 0,
  });

  const surveyItems = [
    "Standard Query Tasks", "Natural Language Query", "Sub-selects",
    "Joins", "Sort / Filter / Limit", "Save & Export",
    "Comparison with Old QD", "Open-Ended Feedback",
  ];

  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.8, w: 5.0, h: 3.2, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addText("10 Survey Sections", {
    x: 0.7, y: 1.9, w: 5.0, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
  });

  surveyItems.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 1.0 + col * 2.3;
    const y = 2.4 + row * 0.6;
    slide.addShape(pres.shapes.OVAL, { x, y: y + 0.08, w: 0.18, h: 0.18, fill: { color: ACCENT_BLUE } });
    slide.addText(item, {
      x: x + 0.3, y, w: 1.9, h: 0.35,
      fontSize: 11, fontFace: "Calibri", color: BODY_TEXT, valign: "middle", margin: 0,
    });
  });

  slide.addShape(pres.shapes.RECTANGLE, { x: 5.9, y: 1.8, w: 3.4, h: 3.2, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addText("How It Works", {
    x: 5.9, y: 1.9, w: 3.4, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
  });
  slide.addText([
    { text: "Step-by-step task instructions", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Likert scale ratings (1-5)", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Open-ended text feedback", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Old vs. new comparison", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "", options: { breakLine: true, fontSize: 4 } },
    { text: "Results stored in database", options: { fontSize: 12, color: NAVY, bold: true, breakLine: true } },
    { text: "Admin dashboard for analysis", options: { fontSize: 12, color: NAVY, bold: true, breakLine: true } },
    { text: "CSV export for reporting", options: { fontSize: 12, color: NAVY, bold: true } },
  ], { x: 6.2, y: 2.4, w: 2.8, h: 2.4, valign: "top" });

  slide.addNotes(
    "We built a dedicated survey application for structured user testing. " +
    "It has 10 sections that walk testers through specific tasks — standard queries, natural language, sub-selects, joins, filtering, save/export, " +
    "and a direct comparison with the old Query Designer. " +
    "Each section has step-by-step instructions, Likert scale ratings, and open-ended feedback. " +
    "Responses are stored in a database with an admin dashboard where we can see all submissions and export to CSV."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 10: Software & Tools + Collaboration
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: WHITE };

  slide.addText("Software, Tools & Collaboration", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  // Left: tools
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 1.2, w: 4.2, h: 3.8, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  slide.addImage({ data: iconCogs, x: 1.0, y: 1.4, w: 0.4, h: 0.4 });
  slide.addText("Tech Stack", {
    x: 1.5, y: 1.4, w: 3.0, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: NAVY, bold: true, valign: "middle", margin: 0,
  });

  const stackItems = [
    ["React 19", "UI framework"],
    ["TypeScript", "Type safety"],
    ["Vite 7", "Build tool"],
    ["Tailwind CSS v4", "Styling"],
    ["Radix UI", "Accessible components"],
    ["SQLite / PostgreSQL", "Data persistence"],
  ];
  stackItems.forEach((item, i) => {
    const y = 1.95 + i * 0.5;
    slide.addText(item[0], { x: 1.0, y, w: 1.8, h: 0.4, fontSize: 12, fontFace: "Calibri", color: NAVY, bold: true, margin: 0 });
    slide.addText(item[1], { x: 2.9, y, w: 1.8, h: 0.4, fontSize: 12, fontFace: "Calibri", color: BODY_TEXT, margin: 0 });
  });

  slide.addText("Informer has their own SSR system comparable to Next.js — you slot in React on the client and write server route handlers in JavaScript.", {
    x: 1.0, y: 4.4, w: 3.6, h: 0.45,
    fontSize: 10, fontFace: "Calibri", color: MUTED, italic: true,
  });

  // Right: collaboration
  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 1.2, w: 4.2, h: 3.8, fill: { color: LIGHT_BG }, shadow: makeShadow() });
  slide.addImage({ data: iconUsers, x: 5.4, y: 1.4, w: 0.4, h: 0.4 });
  slide.addText("Team & Communication", {
    x: 5.9, y: 1.4, w: 3.0, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: NAVY, bold: true, valign: "middle", margin: 0,
  });
  slide.addText([
    { text: "Sponsor: Entrinsik", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Contact: Jacob Friend", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "(Engineering at Entrinsik)", options: { fontSize: 11, color: MUTED, breakLine: true, indentLevel: 1 } },
    { text: "", options: { breakLine: true, fontSize: 4 } },
    { text: "Discord for daily communication", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Email for formal updates", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Zoom for design reviews", options: { bullet: true, fontSize: 12, color: BODY_TEXT } },
  ], { x: 5.4, y: 2.0, w: 3.6, h: 2.5, valign: "top" });

  slide.addNotes(
    "Tech stack: React 19 with TypeScript, Vite 7, Tailwind CSS v4, and Radix UI for accessible components. " +
    "Informer has their own SSR system — comparable to Next.js — where you slot in React on the client side " +
    "and write server route handlers in plain JavaScript files. " +
    "SQLite in development, PostgreSQL in production through the Informer platform. " +
    "Our main contact at Entrinsik is Jacob Friend, who oversees engineering. " +
    "We use Discord for daily communication, email for formal updates, and Zoom for design reviews."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 11: Timeline & Next Steps
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: LIGHT_BG };

  slide.addText("Timeline & Next Steps", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  // Timeline bar
  slide.addShape(pres.shapes.RECTANGLE, { x: 1.0, y: 1.4, w: 8.0, h: 0.06, fill: { color: "CBD5E1" } });

  const timelineSteps = [
    { label: "Chatbot\nPrototype", pos: 0, done: true },
    { label: "QD Design\nIteration", pos: 1, done: true },
    { label: "Ribbon UI\n+ Features", pos: 2, done: true },
    { label: "AI\nIntegration", pos: 3, done: true },
    { label: "User\nTesting", pos: 4, done: false },
    { label: "Iterate &\nDeploy", pos: 5, done: false },
  ];

  timelineSteps.forEach((step) => {
    const x = 1.0 + step.pos * 1.5;
    slide.addShape(pres.shapes.OVAL, { x: x + 0.1, y: 1.27, w: 0.3, h: 0.3, fill: { color: step.done ? ACCENT_BLUE : "CBD5E1" } });
    slide.addText(step.label, {
      x: x - 0.35, y: 1.7, w: 1.2, h: 0.7,
      fontSize: 10, fontFace: "Calibri", color: step.done ? NAVY : MUTED,
      bold: step.done, align: "center", valign: "top",
    });
  });

  // Completed vs upcoming
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 2.7, w: 4.2, h: 2.4, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addText("Completed", {
    x: 0.7, y: 2.8, w: 4.2, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: NAVY, bold: true, align: "center", margin: 0,
  });
  slide.addText([
    { text: "Multiple interface design iterations", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Full ribbon UI with 6 tab groups", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Core query building features", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "AI natural language + chat sidebar", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "10-section user testing survey", options: { bullet: true, fontSize: 12, color: BODY_TEXT } },
  ], { x: 1.0, y: 3.2, w: 3.6, h: 1.7, valign: "top" });

  slide.addShape(pres.shapes.RECTANGLE, { x: 5.1, y: 2.7, w: 4.2, h: 2.4, fill: { color: WHITE }, shadow: makeShadow() });
  slide.addText("Upcoming", {
    x: 5.1, y: 2.8, w: 4.2, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: ACCENT_BLUE, bold: true, align: "center", margin: 0,
  });
  slide.addText([
    { text: "Test with real Informer users", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Analyze feedback and iterate", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Deploy to Informer platform", options: { bullet: true, breakLine: true, fontSize: 12, color: BODY_TEXT } },
    { text: "Compare old vs. new QD results", options: { bullet: true, fontSize: 12, color: BODY_TEXT } },
  ], { x: 5.4, y: 3.2, w: 3.6, h: 1.7, valign: "top" });

  slide.addNotes(
    "Here's our timeline. We started with chatbot prototypes, pivoted to the Query Designer, " +
    "went through design iteration, built the ribbon UI and features, and integrated AI. " +
    "Next up: get real Informer users to test the new version using our survey framework. " +
    "We'll analyze the feedback, iterate on the design, and aim to deploy to the Informer platform. " +
    "The goal for the rest of the semester is to have concrete comparison data between old and new."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 12: Challenges & Risks
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: WHITE };

  slide.addText("Challenges, Risks & Support", {
    x: 0.7, y: 0.4, w: 8, h: 0.6,
    fontSize: 28, fontFace: "Georgia", color: NAVY, bold: true, margin: 0,
  });

  const challenges = [
    { title: "UX Design is Iterative", desc: "Good interfaces take many rounds of feedback. We're aiming for measurably better, not perfect.", color: "F59E0B" },
    { title: "Platform Integration", desc: "Deploying as a Magic Report App requires a feature flag on the Duke Informer instance.", color: "EF4444" },
    { title: "Limited Testing Window", desc: "Need to recruit testers, collect feedback, and iterate — all in the remaining weeks.", color: "F59E0B" },
  ];

  challenges.forEach((c, i) => {
    const y = 1.15 + i * 1.0;
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 8.6, h: 0.8, fill: { color: LIGHT_BG }, shadow: makeShadow() });
    slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y, w: 0.07, h: 0.8, fill: { color: c.color } });
    slide.addText(c.title, { x: 1.1, y, w: 2.4, h: 0.8, fontSize: 13, fontFace: "Calibri", color: NAVY, bold: true, valign: "middle", margin: 0 });
    slide.addText(c.desc, { x: 3.5, y, w: 5.5, h: 0.8, fontSize: 12, fontFace: "Calibri", color: BODY_TEXT, valign: "middle", margin: 0 });
  });

  // Resources & support section
  slide.addShape(pres.shapes.RECTANGLE, { x: 0.7, y: 4.2, w: 8.6, h: 1.1, fill: { color: NAVY } });
  slide.addText("Resources & Support Needed", {
    x: 1.0, y: 4.25, w: 4.0, h: 0.35,
    fontSize: 14, fontFace: "Calibri", color: WHITE, bold: true, margin: 0,
  });
  slide.addText([
    { text: "Access to real Informer users for testing sessions", options: { bullet: true, breakLine: true, fontSize: 12, color: "CBD5E1" } },
    { text: "Magic Reports feature enabled on Duke Informer instance", options: { bullet: true, breakLine: true, fontSize: 12, color: "CBD5E1" } },
    { text: "Continued collaboration with Entrinsik engineering team", options: { bullet: true, fontSize: 12, color: "CBD5E1" } },
  ], { x: 1.0, y: 4.6, w: 8.0, h: 0.65, valign: "top" });

  slide.addNotes(
    "Challenges: UX design is iterative and takes time. We're not aiming for perfection in the remaining weeks — " +
    "we're aiming for something measurably better than the current version. " +
    "Platform deployment requires the Magic Reports feature to be enabled on the Duke Informer instance — we're working with Entrinsik on that. " +
    "And we have a limited testing window to recruit users, collect feedback, and iterate. " +
    "In terms of support, we need access to real Informer users for testing, " +
    "the Magic Reports feature enabled, and continued collaboration with the Entrinsik team."
  );

  // ═══════════════════════════════════════════════════════════════════════
  // SLIDE 13: Conclusion + Q&A
  // ═══════════════════════════════════════════════════════════════════════
  slide = pres.addSlide();
  slide.background = { color: DARK_NAVY };
  slide.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.06, h: 5.625, fill: { color: ACCENT_BLUE } });

  slide.addText("WHAT WE'VE BUILT", {
    x: 0.8, y: 0.6, w: 8, h: 0.5,
    fontSize: 14, fontFace: "Calibri", color: ACCENT_TEAL, charSpacing: 4, bold: true, margin: 0,
  });

  slide.addText([
    { text: "A modern, ribbon-based query designer", options: { bullet: true, breakLine: true, fontSize: 16, color: WHITE } },
    { text: "with AI-powered natural language features,", options: { bullet: true, breakLine: true, fontSize: 16, color: WHITE } },
    { text: "connected to real enterprise datasources,", options: { bullet: true, breakLine: true, fontSize: 16, color: WHITE } },
    { text: "with a structured testing framework,", options: { bullet: true, breakLine: true, fontSize: 16, color: WHITE } },
    { text: "ready for user evaluation.", options: { bullet: true, fontSize: 16, color: WHITE } },
  ], { x: 0.8, y: 1.2, w: 8, h: 2.2, valign: "top", paraSpaceAfter: 8 });

  slide.addShape(pres.shapes.RECTANGLE, { x: 0.8, y: 3.7, w: 8.4, h: 0.008, fill: { color: ACCENT_BLUE, transparency: 40 } });

  slide.addText("Questions?", {
    x: 0.8, y: 4.0, w: 8, h: 0.8,
    fontSize: 36, fontFace: "Georgia", color: WHITE, bold: true, margin: 0,
  });

  slide.addText("Entrinsik  |  Duke AIPI Capstone  |  Spring 2026", {
    x: 0.8, y: 4.9, w: 8, h: 0.4,
    fontSize: 12, fontFace: "Calibri", color: MUTED, margin: 0,
  });

  slide.addNotes(
    "To wrap up: we've rebuilt a major component of the Informer platform from scratch. " +
    "Modern ribbon interface, AI-powered features, connected to real databases, " +
    "and a structured testing framework ready to collect user feedback. " +
    "Our next milestone is getting real Informer users to test it and compare with the old version. " +
    "Thank you for your time. Happy to take questions."
  );

  const outputPath = process.cwd() + "/Capstone-Mid-Semester-Update.pptx";
  await pres.writeFile({ fileName: outputPath });
  console.log("Saved:", outputPath);
}

buildPresentation().catch(console.error);
