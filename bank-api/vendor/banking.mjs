// bank-api/vendor/upstream/src/types.ts
var MOVEMENT_SOURCE = {
  account: "account",
  credit_card_unbilled: "credit_card_unbilled",
  credit_card_billed: "credit_card_billed"
};
var CARD_OWNER = {
  titular: "titular",
  adicional: "adicional"
};

// bank-api/vendor/upstream/src/utils.ts
import * as fs from "fs";
import * as path from "path";
var DebugLog = class extends Array {
  _onDebug;
  constructor(onDebug) {
    super();
    this._onDebug = onDebug;
  }
  push(...items) {
    for (const item of items) {
      super.push(item);
      this._onDebug?.(item);
    }
    return this.length;
  }
};
function formatRut(rut) {
  const clean = rut.replace(/[.\-]/g, "");
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${formatted}-${dv}`;
}
function delay(ms) {
  return new Promise((resolve3) => setTimeout(resolve3, ms));
}
function findChrome(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const candidates = [
    // Linux
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/snap/bin/chromium",
    "/snap/bin/chromium-browser",
    // macOS
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    // Windows (WSL)
    "/mnt/c/Program Files/Google/Chrome/Application/chrome.exe",
    "/mnt/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}
async function saveScreenshot(page, name, enabled, debugLog) {
  if (!enabled) return;
  const safeName = name.replace(/[/\\:*?"<>|]/g, "_");
  const dir = path.resolve("screenshots");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({
    path: path.join(dir, `${safeName}.png`),
    fullPage: true
  });
  debugLog.push(`  Screenshot saved: screenshots/${safeName}.png`);
}
async function closePopups(page) {
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press("Escape");
    await delay(300);
  }
  await page.evaluate(() => {
    const closeButtons = Array.from(
      document.querySelectorAll(
        '[class*="close"], [aria-label*="close"], [aria-label*="cerrar"], button'
      )
    );
    for (const btn of closeButtons) {
      const text = btn.innerText?.trim();
      if (text === "X" || text === "\xD7" || text === "\u2715" || text === "Cerrar") {
        btn.click();
      }
    }
  });
  await delay(1e3);
}
var MONTHS_MAP = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dic: "12"
};
function parseChileanAmount(text) {
  const clean = text.replace(/[^0-9.,-]/g, "");
  if (!clean) return 0;
  const isNegative = clean.startsWith("-") || text.includes("-$");
  const normalized = clean.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
  const amount = parseInt(normalized, 10) || 0;
  return isNegative ? -amount : amount;
}
function normalizeDate(raw) {
  const value = raw.trim();
  const fullMatch = value.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/);
  if (fullMatch) {
    const day = fullMatch[1].padStart(2, "0");
    const month = fullMatch[2].padStart(2, "0");
    const year = fullMatch[3].length === 2 ? `20${fullMatch[3]}` : fullMatch[3];
    return `${day}-${month}-${year}`;
  }
  const shortMatch = value.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (shortMatch) {
    const day = shortMatch[1].padStart(2, "0");
    const month = shortMatch[2].padStart(2, "0");
    return `${day}-${month}-${(/* @__PURE__ */ new Date()).getFullYear()}`;
  }
  const parts = value.split(/\s+/);
  if (parts.length >= 2) {
    const monthKey = parts.length === 3 ? parts[1].toLowerCase() : parts[0].toLowerCase();
    if (MONTHS_MAP[monthKey]) {
      if (parts.length === 3) {
        return `${parts[0].padStart(2, "0")}-${MONTHS_MAP[monthKey]}-${parts[2]}`;
      }
      const dayPart = parts.find((p) => /^\d{1,2}$/.test(p));
      if (dayPart) {
        return `${dayPart.padStart(2, "0")}-${MONTHS_MAP[monthKey]}-${(/* @__PURE__ */ new Date()).getFullYear()}`;
      }
    }
  }
  return value;
}
function normalizeInstallments(raw) {
  if (!raw) return void 0;
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return raw.trim();
  return `${match[1].padStart(2, "0")}/${match[2].padStart(2, "0")}`;
}
function normalizeOwner(raw) {
  if (!raw) return void 0;
  const lower = raw.trim().toLowerCase();
  if (lower.includes("adicional")) return CARD_OWNER.adicional;
  if (lower.includes("titular")) return CARD_OWNER.titular;
  return CARD_OWNER.titular;
}
function deduplicateMovements(movements) {
  const seen = /* @__PURE__ */ new Set();
  return movements.filter((m) => {
    if (m.balance === 0) return true;
    const key = `${m.date}|${m.description}|${m.amount}|${m.balance ?? ""}|${m.source}|${m.owner ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function monthYearLabel(dateStr) {
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const parts = dateStr.split("-");
  if (parts.length < 3) return dateStr;
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (monthIdx < 0 || monthIdx > 11) return dateStr;
  return `${monthNames[monthIdx]} ${parts[2]}`;
}
function deduplicateAcrossSources(movements) {
  const billedKeys = /* @__PURE__ */ new Set();
  for (const m of movements) {
    if (m.source === "credit_card_billed") {
      billedKeys.add(`${m.date}|${m.description}|${m.amount}`);
    }
  }
  return movements.filter((m) => {
    if (m.source !== "credit_card_unbilled") return true;
    return !billedKeys.has(`${m.date}|${m.description}|${m.amount}`);
  });
}
async function logout(page, debugLog) {
  try {
    const clicked = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll("a, button, span, div, li"));
      for (const el of elements) {
        const text = el.innerText?.trim().toLowerCase();
        if (text === "cerrar sesi\xF3n" || text === "cerrar sesion" || text === "salir" || text === "logout" || text === "sign out") {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      debugLog.push("  Logged out successfully");
      await delay(2e3);
    }
  } catch {
  }
}

// bank-api/vendor/upstream/src/infrastructure/browser.ts
import puppeteer from "puppeteer-core";
var DEFAULT_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-gpu",
  "--window-size=1280,900",
  "--disable-blink-features=AutomationControlled"
];
var DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
async function launchBrowser(options, saveScreenshots) {
  const { chromePath, headful, forceHeadful, extraArgs, viewport, onDebug } = options;
  const debugLog = onDebug ? new DebugLog(onDebug) : [];
  if (forceHeadful && process.platform === "linux") {
    if (!process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
      throw new Error(
        "Este banco requiere modo headful (Chrome visible) pero no se detect\xF3 display.\n  Opciones: exporta DISPLAY=:0, usa una sesi\xF3n con GUI, o configura Xvfb:\n  Xvfb: Xvfb :99 -screen 0 1280x900x24 & export DISPLAY=:99"
      );
    }
  }
  const executablePath = findChrome(chromePath);
  if (!executablePath) {
    throw new Error(
      "No se encontr\xF3 Chrome/Chromium. Instala Google Chrome o pasa chromePath en las opciones.\n  Ubuntu/Debian: sudo apt install google-chrome-stable\n  macOS: brew install --cask google-chrome"
    );
  }
  const browser = await puppeteer.launch({
    executablePath,
    headless: forceHeadful ? false : !headful,
    args: [...DEFAULT_ARGS, ...extraArgs || []]
  });
  const page = await browser.newPage();
  const vp = viewport || { width: 1280, height: 900 };
  await page.setViewport(vp);
  await page.setUserAgent(DEFAULT_UA);
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  const doSave = async (p, name) => saveScreenshot(p, name, saveScreenshots, debugLog);
  return { browser, page, debugLog, screenshot: doSave };
}

// bank-api/vendor/upstream/src/infrastructure/scraper-runner.ts
async function runScraper(bankId, options, browserOptions, scrapeFn) {
  const { rut, password, chromePath, saveScreenshots, headful, onDebug } = options;
  if (!rut || !password) {
    return {
      success: false,
      bank: bankId,
      accounts: [],
      error: "Debes proveer RUT y clave."
    };
  }
  let session;
  try {
    session = await launchBrowser(
      { chromePath, headful, onDebug, ...browserOptions },
      !!saveScreenshots
    );
    return await scrapeFn(session, options);
  } catch (error) {
    return {
      success: false,
      bank: bankId,
      accounts: [],
      error: `Error del scraper: ${error instanceof Error ? error.message : String(error)}`,
      debug: session?.debugLog.join("\n")
    };
  } finally {
    if (session?.browser) {
      try {
        const pages = await session.browser.pages();
        if (pages.length > 0) await logout(pages[pages.length - 1], session.debugLog);
      } catch {
      }
      await session.browser.close().catch(() => {
      });
    }
  }
}

// bank-api/vendor/upstream/src/actions/login.ts
var GENERIC_RUT_SELECTORS = [
  'input[name*="rut"]',
  'input[id*="rut"]',
  'input[placeholder*="RUT"]',
  'input[placeholder*="Rut"]',
  'input[name*="user"]',
  'input[id*="user"]',
  'input[name*="document"]',
  'input[id*="document"]',
  'input[type="text"]'
];
var GENERIC_PASSWORD_SELECTORS = [
  'input[type="password"]',
  'input[name*="pass"]',
  'input[id*="pass"]',
  'input[name*="clave"]',
  'input[id*="clave"]',
  'input[placeholder*="Clave"]',
  'input[placeholder*="contrase\xF1a"]'
];
var GENERIC_SUBMIT_SELECTORS = [
  'button[type="submit"]',
  'input[type="submit"]',
  "#btn_login"
];
var DEFAULT_SUBMIT_TEXTS = ["ingresar", "entrar"];
function formatRutValue(rut, format) {
  const clean = rut.replace(/[.\-]/g, "");
  switch (format) {
    case "clean":
      return clean;
    case "dash":
      return clean.slice(0, -1) + "-" + clean.slice(-1);
    case "formatted":
    default:
      return formatRut(rut);
  }
}
async function fillRut(context, rut, selectors) {
  const formatted = formatRutValue(rut, selectors?.rutFormat);
  const clean = rut.replace(/[.\-]/g, "");
  const allSelectors = [...selectors?.rutSelectors || [], ...GENERIC_RUT_SELECTORS];
  for (const sel of allSelectors) {
    try {
      const el = await context.$(sel);
      if (el) {
        await el.click({ clickCount: 3 });
        await el.type(sel === "#rut" ? clean : formatted, { delay: 45 });
        return true;
      }
    } catch {
    }
  }
  try {
    return await context.evaluate((rutFormatted, rutClean) => {
      const candidates = Array.from(document.querySelectorAll("input"));
      for (const input of candidates) {
        const el = input;
        if (el.offsetParent === null || el.disabled || el.type === "password") continue;
        el.focus();
        el.value = el.maxLength > 0 && el.maxLength <= 10 ? rutClean : rutFormatted;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }, formatted, clean);
  } catch {
    return false;
  }
}
async function fillPassword(context, password, selectors) {
  const allSelectors = [...selectors?.passwordSelectors || [], ...GENERIC_PASSWORD_SELECTORS];
  for (const sel of allSelectors) {
    try {
      const el = await context.$(sel);
      if (el) {
        await el.click();
        await el.type(password, { delay: 45 });
        return true;
      }
    } catch {
    }
  }
  return false;
}
async function clickSubmit(context, page, selectors) {
  const allSelectors = [...selectors?.submitSelectors || [], ...GENERIC_SUBMIT_SELECTORS];
  const texts = selectors?.submitTexts || DEFAULT_SUBMIT_TEXTS;
  const clicked = await context.evaluate(
    (sels, txts) => {
      for (const sel of sels) {
        const el = document.querySelector(sel);
        if (!el) continue;
        const disabled = el.disabled || el.getAttribute("aria-disabled") === "true" || el.className.includes("disabled");
        if (disabled) continue;
        el.click();
        return true;
      }
      const candidates = Array.from(document.querySelectorAll("button, a"));
      for (const candidate of candidates) {
        const text = candidate.innerText?.trim().toLowerCase() || "";
        if (!txts.some((t) => text.includes(t))) continue;
        const disabled = candidate.disabled || candidate.getAttribute("aria-disabled") === "true" || candidate.className.includes("disabled");
        if (disabled) continue;
        candidate.click();
        return true;
      }
      return false;
    },
    allSelectors,
    texts
  );
  if (!clicked) {
    await page.keyboard.press("Enter");
  }
}
async function detectLoginError(page, frame, customKeywords) {
  const pattern = customKeywords || /(error|incorrect|inv[aá]lid|rechazad|bloquead|fall[oó]|intenta nuevamente|credencial|autentic|clave.*(err[oó]nea|incorrecta)|rut.*(err[oó]neo|incorrecto))/i;
  const extractMessages = async (ctx) => {
    return await ctx.evaluate(() => {
      const selectors = [
        '[class*="error"]',
        '[class*="alert"]',
        '[role="alert"]',
        '[class*="warning"]'
      ];
      const messages = [];
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const text = element.innerText?.trim();
          if (text) messages.push(text);
        }
      }
      return messages;
    });
  };
  const pickError = (candidates) => {
    for (const candidate of candidates) {
      const text = candidate.trim();
      if (!text || text.length < 4 || text.length > 250) continue;
      if (pattern.test(text)) return text;
    }
    return null;
  };
  const pageMessages = await extractMessages(page);
  const error = pickError(pageMessages);
  if (error) return error;
  if (frame) {
    try {
      const frameMessages = await extractMessages(frame);
      return pickError(frameMessages);
    } catch {
    }
  }
  return null;
}

// bank-api/vendor/upstream/src/actions/navigation.ts
async function clickByText(page, texts, elementTypes = "button, a, span, div") {
  for (const text of texts) {
    const clicked = await page.evaluate(
      (targetText, types) => {
        const candidates = Array.from(document.querySelectorAll(types));
        for (const candidate of candidates) {
          const innerText = candidate.innerText?.trim().toLowerCase();
          if (!innerText) continue;
          if (innerText === targetText || innerText.includes(targetText)) {
            candidate.click();
            return true;
          }
        }
        return false;
      },
      text.toLowerCase(),
      elementTypes
    );
    if (clicked) return true;
  }
  return false;
}
async function clickSidebarItem(page, selectorIds, textPatterns, maxX = 300) {
  const clicked = await page.evaluate(
    (ids, texts, mx) => {
      for (const id of ids) {
        const el = document.querySelector(id);
        if (el) {
          el.click();
          return true;
        }
      }
      const items = Array.from(document.querySelectorAll("button, a, span, li, div"));
      for (const item of items) {
        const text = item.innerText?.trim().toLowerCase() || "";
        const rect = item.getBoundingClientRect();
        if (rect.x > mx) continue;
        if (texts.some((t) => text === t || text.includes(t))) {
          item.click();
          return true;
        }
      }
      return false;
    },
    selectorIds,
    textPatterns,
    maxX
  );
  return clicked;
}
async function dismissBanners(page) {
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button, a"));
    for (const button of buttons) {
      const text = button.innerText?.trim().toLowerCase();
      if (text === "aceptar" || text === "entendido" || text === "continuar") {
        button.click();
      }
    }
  });
}
async function clickWidget(page, selectors, delayMs = 4e3) {
  const matched = await page.evaluate((sels) => {
    for (const sel of sels) {
      const el = document.querySelector(sel);
      if (!el) continue;
      el.click();
      return sel;
    }
    return null;
  }, selectors);
  if (matched) await delay(delayMs);
  return matched;
}

// bank-api/vendor/upstream/src/banks/bancosecurity.ts
var BANK_URL = "https://www.bancosecurity.cl";
var LOGIN_URL = "https://www.bancosecurity.cl/widgets/wPersonasLogin/index.asp";
var LOGIN_SELECTORS = {
  rutSelectors: ["#frut", 'input[name="frut"]'],
  passwordSelectors: ["#clave", 'input[name="clave"]'],
  // Portal expects formatted RUT: "12.345.678-9"
  rutFormat: "formatted"
};
async function waitForDashboard(page) {
  const start = Date.now();
  const keywords = ["cartola", "movimientos", "cuenta corriente", "mi cuenta", "saldo", "bienvenido"];
  while (Date.now() - start < 2e4) {
    const found = await page.evaluate((kws) => {
      const text = document.body?.innerText?.toLowerCase() || "";
      return kws.some((k) => text.includes(k));
    }, keywords);
    if (found) break;
    await delay(1500);
  }
}
async function nativeClick(page, texts, selectors = "a, button, li, span, [role='menuitem']") {
  const result = await page.evaluate((txts, sels) => {
    for (const el of Array.from(document.querySelectorAll(sels))) {
      const text = el.innerText?.trim().toLowerCase() || "";
      if (txts.some((t) => text === t || text.includes(t)) && text.length < 80 && el.offsetParent !== null) {
        const rect = el.getBoundingClientRect();
        const href = el.href || null;
        return { text: el.innerText.trim().slice(0, 40), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, href };
      }
    }
    return null;
  }, texts, selectors);
  if (!result) return null;
  if (result.href && !result.href.startsWith("javascript")) {
    await page.goto(result.href, { waitUntil: "networkidle2", timeout: 3e4 });
  } else {
    await page.mouse.click(result.x, result.y);
  }
  return result.text;
}
async function navigateToMovements(page, debugLog) {
  await waitForDashboard(page);
  const clickedProductos = await nativeClick(page, ["productos"]);
  if (clickedProductos) {
    debugLog.push(`  Clicked: ${clickedProductos}`);
    await delay(1500);
  }
  const clicked = await nativeClick(page, ["saldos y movimientos"]);
  if (clicked) {
    debugLog.push(`  Clicked: ${clicked}`);
    await delay(5e3);
    return;
  }
  const fallbacks = ["movimientos", "\xFAltimos movimientos", "ver movimientos", "cartola hist\xF3rica", "cartola"];
  for (const target of fallbacks) {
    const c = await nativeClick(page, [target]);
    if (c) {
      debugLog.push(`  Clicked fallback: ${c}`);
      await delay(5e3);
      return;
    }
  }
  debugLog.push("  (no movement link found)");
}
async function extractFromContext(ctx) {
  return ctx.evaluate(() => {
    const results = [];
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) continue;
      let dateIndex = -1, descIndex = -1, cargoIndex = -1, abonoIndex = -1, balanceIndex = -1;
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("th, td"));
        if (cells.length < 3) continue;
        const ht = cells.map((c) => c.innerText?.trim().toLowerCase() || "");
        if (!ht.some((h) => h === "fecha" || h.startsWith("fecha"))) continue;
        dateIndex = ht.findIndex((h) => h === "fecha" || h.startsWith("fecha"));
        descIndex = ht.findIndex((h) => h.includes("descrip") || h.includes("detalle") || h.includes("glosa"));
        cargoIndex = ht.findIndex((h) => h.includes("cargo") || h.includes("d\xE9bito") || h.includes("debito"));
        abonoIndex = ht.findIndex((h) => h.includes("abono") || h.includes("cr\xE9dito") || h.includes("credito"));
        balanceIndex = ht.findIndex((h) => h === "saldo" || h.includes("saldo"));
        break;
      }
      if (dateIndex === -1) continue;
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 3) continue;
        const values = cells.map((c) => c.innerText?.trim() || "");
        const rawDate = values[dateIndex] || "";
        if (!/\d{1,2}[\/.\-]\d{1,2}/.test(rawDate)) continue;
        const description = descIndex >= 0 ? values[descIndex] || "" : "";
        const cargo = cargoIndex >= 0 ? values[cargoIndex].replace(/[^\d.,]/g, "") : "";
        const abono = abonoIndex >= 0 ? values[abonoIndex].replace(/[^\d.,]/g, "") : "";
        const balance = balanceIndex >= 0 ? values[balanceIndex] || "" : "";
        let amount = "";
        if (cargo) amount = "-" + cargo;
        else if (abono) amount = abono;
        if (!amount) continue;
        results.push({ date: rawDate, description, amount, balance });
      }
    }
    return results;
  });
}
async function extractMovements(page) {
  const allRaw = [];
  const contexts = [page];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) contexts.push(frame);
  }
  for (const ctx of contexts) {
    try {
      allRaw.push(...await extractFromContext(ctx));
    } catch {
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return allRaw.map((m) => {
    const amount = parseChileanAmount(m.amount);
    if (amount === 0) return null;
    return {
      date: normalizeDate(m.date),
      description: m.description,
      amount,
      balance: m.balance ? parseChileanAmount(m.balance) : 0,
      source: MOVEMENT_SOURCE.account
    };
  }).filter((m) => {
    if (!m) return false;
    const key = `${m.date}|${m.description}|${m.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function paginate(page, debugLog) {
  const all = [];
  for (let i = 0; i < 20; i++) {
    all.push(...await extractMovements(page));
    const urlBefore = page.url();
    const nextClicked = await page.evaluate(() => {
      for (const btn of Array.from(document.querySelectorAll("button, a, [role='button']"))) {
        const text = btn.innerText?.trim().toLowerCase() || "";
        if (!text.includes("siguiente") && !text.includes("ver m\xE1s") && !text.includes("mostrar m\xE1s") && text !== "\u203A" && text !== ">") continue;
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("disabled")) return false;
        btn.click();
        return true;
      }
      return false;
    });
    if (!nextClicked) break;
    await delay(3e3);
    const urlAfter = page.url();
    if (urlBefore !== urlAfter) {
      debugLog.push("  Pagination stopped: URL changed");
      break;
    }
    debugLog.push(`  Pagination: page ${i + 2}`);
  }
  return deduplicateMovements(all);
}
var CARTOLA_URL = "https://www.bancosecurity.cl/Empresas/Cuentas/cartola_corriente.asp";
function parseTxtMovements(txt) {
  const movements = [];
  for (const rawLine of txt.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (!line.startsWith("2")) continue;
    const rawDate = line.slice(1, 11).trim();
    const rawDesc = line.slice(11, 61).trim();
    const typeChar = line.slice(70, 71);
    const rest = line.slice(72);
    if (!/\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDate)) continue;
    const parts = rest.trim().split(/\s+/);
    if (parts.length < 1) continue;
    const rawAmount = parts[0];
    const rawBalance = parts[1] ?? "";
    let amount = parseChileanAmount(rawAmount);
    if (amount === 0) continue;
    if (typeChar === "C") amount = -Math.abs(amount);
    else amount = Math.abs(amount);
    movements.push({
      date: normalizeDate(rawDate),
      description: rawDesc,
      amount,
      balance: rawBalance ? parseChileanAmount(rawBalance) : 0,
      source: MOVEMENT_SOURCE.account
    });
  }
  return movements;
}
async function fetchHistoricalMonths(page, months, debugLog) {
  debugLog.push(`  Fetching up to ${months} historical month(s)...`);
  const clickedProductos = await nativeClick(page, ["productos"]);
  if (clickedProductos) await delay(1500);
  const clickedCartola = await nativeClick(page, ["cartola hist\xF3rica", "cartola historica"]);
  if (clickedCartola) {
    debugLog.push(`  Clicked: ${clickedCartola}`);
    await delay(3e3);
  } else {
    await page.goto(CARTOLA_URL, { waitUntil: "networkidle2", timeout: 3e4 });
    await delay(2e3);
  }
  const allFrames = [page, ...page.frames().filter((f) => f !== page.mainFrame())];
  let cartolaFrame = null;
  for (const ctx of allFrames) {
    const found = await ctx.evaluate(() => !!document.querySelector("#fecha")).catch(() => false);
    if (found) {
      cartolaFrame = ctx;
      break;
    }
  }
  if (!cartolaFrame) {
    debugLog.push("  select#fecha not found in any frame \u2014 skipping historical");
    return [];
  }
  const options = await cartolaFrame.evaluate(() => {
    const sel = document.querySelector("#fecha");
    if (!sel) return [];
    return Array.from(sel.options).map((o) => ({ value: o.value, text: o.text.trim() }));
  });
  const realOptions = options.filter((o) => o.value && o.text.toLowerCase() !== "seleccionar");
  debugLog.push(`  Available months: ${realOptions.map((o) => o.text).join(", ")}`);
  const all = [];
  const take = Math.min(months, realOptions.length);
  for (let i = 0; i < take; i++) {
    const opt = realOptions[i];
    debugLog.push(`  Fetching month: ${opt.text}`);
    await cartolaFrame.evaluate((val) => {
      const sel = document.querySelector("#fecha");
      if (sel) sel.value = val;
    }, opt.value);
    await delay(300);
    const submitted = await cartolaFrame.evaluate(() => {
      const btn = document.querySelector("#buscar");
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });
    if (!submitted) {
      debugLog.push(`  Could not click Consultar for ${opt.text}`);
      continue;
    }
    let txtHref = null;
    const deadline = Date.now() + 8e3;
    while (!txtHref && Date.now() < deadline) {
      const searchContexts = [cartolaFrame, ...page.frames().filter((f) => f !== page.mainFrame())];
      for (const ctx of searchContexts) {
        txtHref = await ctx.evaluate(() => {
          for (const a of Array.from(document.querySelectorAll("a"))) {
            if (a.innerText?.trim().toUpperCase() === "TXT" && a.offsetParent !== null) return a.href;
          }
          return null;
        }).catch(() => null);
        if (txtHref) break;
      }
      if (!txtHref) await delay(500);
    }
    if (!txtHref) {
      debugLog.push(`  No TXT link found for ${opt.text}`);
      continue;
    }
    const content = await cartolaFrame.evaluate(async (url) => {
      const r = await fetch(url, { credentials: "include" });
      return r.text();
    }, txtHref);
    const parsed = parseTxtMovements(content);
    debugLog.push(`  Parsed ${parsed.length} movements from ${opt.text}`);
    all.push(...parsed);
  }
  return all;
}
async function scrapeBancoSecurity(session, options) {
  const { rut, password, onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const progress = onProgress || (() => {
  });
  const bank = "bancosecurity";
  debugLog.push("1. Navigating to Banco Security login...");
  progress("Abriendo sitio del banco...");
  await page.goto(BANK_URL, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(2e3);
  await dismissBanners(page);
  await doSave(page, "01-homepage");
  debugLog.push("2. Clicking Ingresar...");
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("a, button"))) {
      const text = el.innerText?.trim().toLowerCase() || "";
      if (text === "ingresar") {
        el.click();
        return;
      }
    }
  });
  await delay(4e3);
  await doSave(page, "02-login-form");
  if (!page.url().includes("wPersonasLogin")) {
    debugLog.push("  Fallback: navigating directly to login URL");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 2e4 });
    await delay(2e3);
  }
  debugLog.push("3. Filling RUT...");
  progress("Ingresando RUT...");
  if (!await fillRut(page, rut, LOGIN_SELECTORS)) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, movements: [], error: "No se encontr\xF3 campo de RUT", screenshot: ss, debug: debugLog.join("\n") };
  }
  await delay(800);
  debugLog.push("4. Filling password...");
  if (!await fillPassword(page, password, LOGIN_SELECTORS)) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, movements: [], error: "No se encontr\xF3 campo de clave", screenshot: ss, debug: debugLog.join("\n") };
  }
  await delay(800);
  debugLog.push("5. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  const submitted = await page.evaluate(() => {
    const btn = document.querySelector('input[type="submit"], button[type="submit"]');
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  if (!submitted) await page.keyboard.press("Enter");
  await waitForDashboard(page);
  await doSave(page, "03-after-login");
  const loginError = await detectLoginError(page);
  if (loginError) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, movements: [], error: `Error del banco: ${loginError}`, screenshot: ss, debug: debugLog.join("\n") };
  }
  const currentUrl = page.url();
  const stillOnLogin = currentUrl.includes("wPersonasLogin") || currentUrl.includes("login");
  if (stillOnLogin) {
    const visibleText = await page.evaluate(() => document.body?.innerText?.toLowerCase() || "");
    const is2FA = visibleText.includes("ingresa tu c\xF3digo") || visibleText.includes("ingrese su c\xF3digo") || visibleText.includes("segundo factor") || visibleText.includes("clave din\xE1mica");
    if (is2FA) {
      const ss = await page.screenshot({ encoding: "base64" });
      return { success: false, bank, movements: [], error: "El banco pide 2FA. No automatizable.", screenshot: ss, debug: debugLog.join("\n") };
    }
  }
  debugLog.push("6. Login OK!");
  progress("Sesi\xF3n iniciada");
  await closePopups(page);
  debugLog.push("7. Navigating to cartola...");
  progress("Buscando cartola...");
  await navigateToMovements(page, debugLog);
  await doSave(page, "04-movements");
  debugLog.push("8. Extracting movements...");
  progress("Extrayendo movimientos...");
  const currentMovements = await paginate(page, debugLog);
  debugLog.push(`9. Extracted ${currentMovements.length} current-period movements`);
  const historicalMonths = Math.min(Math.max(parseInt(process.env.BANCOSECURITY_MONTHS ?? "0", 10) || 0, 0), 24);
  let allMovements = currentMovements;
  if (historicalMonths > 0) {
    progress(`Obteniendo ${historicalMonths} mes(es) hist\xF3rico(s)...`);
    const historical = await fetchHistoricalMonths(page, historicalMonths, debugLog);
    allMovements = deduplicateMovements([...currentMovements, ...historical]);
    debugLog.push(`10. Total after merging historical: ${allMovements.length} movements`);
  }
  const movements = allMovements;
  progress(`Listo \u2014 ${movements.length} movimientos`);
  await doSave(page, "05-final");
  let balance;
  if (movements.length > 0 && movements[0].balance > 0) balance = movements[0].balance;
  return {
    success: true,
    bank,
    movements,
    balance,
    debug: debugLog.join("\n")
  };
}
var bancosecurity = {
  id: "bancosecurity",
  name: "Banco Security",
  url: BANK_URL,
  scrape: (options) => runScraper("bancosecurity", options, {}, scrapeBancoSecurity)
};
var bancosecurity_default = bancosecurity;

// bank-api/vendor/upstream/src/actions/two-factor.ts
var DEFAULT_2FA_KEYWORDS = [
  "clave din\xE1mica",
  "clave dinamica",
  "superclave",
  "segundo factor",
  "c\xF3digo de verificaci\xF3n",
  "codigo de verificacion",
  "ingresa tu token"
];
var REJECTION_KEYWORDS = ["rechazad", "denegad", "cancelad"];
async function readText(ctx) {
  return await ctx.evaluate(() => (document.body?.innerText || "").toLowerCase());
}
async function getCombinedText(page, frameFn) {
  let text = await readText(page);
  if (frameFn) {
    const frame = await frameFn(page);
    if (frame) {
      try {
        text += "\n" + await readText(frame);
      } catch {
      }
    }
  }
  return text;
}
function textHas2FA(text, keywords) {
  return keywords.some((kw) => text.includes(kw));
}
async function detect2FA(page, config) {
  const keywords = config?.keywords || DEFAULT_2FA_KEYWORDS;
  const text = await getCombinedText(page, config?.frameFn);
  return textHas2FA(text, keywords);
}
async function waitFor2FA(page, debugLog, config) {
  const keywords = config?.keywords || DEFAULT_2FA_KEYWORDS;
  const envVar = config?.timeoutEnvVar || "";
  const defaultTimeout = config?.defaultTimeoutSec || 180;
  const envValue = envVar ? process.env[envVar] : void 0;
  const timeoutSec = Math.min(600, Math.max(30, parseInt(envValue || String(defaultTimeout), 10) || defaultTimeout));
  debugLog.push(`  2FA detectado. Esperando aprobaci\xF3n manual (${timeoutSec}s m\xE1x)...`);
  const start = Date.now();
  while ((Date.now() - start) / 1e3 < timeoutSec) {
    const text = await getCombinedText(page, config?.frameFn);
    if (!textHas2FA(text, keywords)) {
      if (REJECTION_KEYWORDS.some((kw) => text.includes(kw))) {
        debugLog.push("  2FA rechazado por el usuario.");
        return false;
      }
      debugLog.push("  2FA completado, continuando flujo.");
      return true;
    }
    await delay(1500);
  }
  debugLog.push(`  Timeout esperando aprobaci\xF3n 2FA (${timeoutSec}s).`);
  return false;
}

// bank-api/vendor/upstream/src/banks/bchile.ts
var BANK_URL2 = "https://portalpersonas.bancochile.cl/persona/";
var API_BASE = "https://portalpersonas.bancochile.cl/mibancochile/rest/persona";
var TWO_FACTOR_CONFIG = {
  timeoutEnvVar: "BCHILE_2FA_TIMEOUT_SEC"
};
async function apiGet(page, path3) {
  return await page.evaluate(async (url) => {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    const xsrf = m ? decodeURIComponent(m[1]) : "";
    const headers = { Accept: "application/json" };
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
    const r = await fetch(url, { credentials: "include", headers });
    if (!r.ok) throw new Error(`API GET ${url} \u2192 ${r.status}`);
    return r.json();
  }, `${API_BASE}/${path3}`);
}
async function apiPost(page, path3, body = {}) {
  return await page.evaluate(async (url, bodyStr) => {
    const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    const xsrf = m ? decodeURIComponent(m[1]) : "";
    const headers = { "Content-Type": "application/json", Accept: "application/json" };
    if (xsrf) headers["X-XSRF-TOKEN"] = xsrf;
    const r = await fetch(url, { method: "POST", credentials: "include", headers, body: bodyStr });
    if (!r.ok) throw new Error(`API POST ${url} \u2192 ${r.status}`);
    return r.json();
  }, `${API_BASE}/${path3}`, JSON.stringify(body));
}
async function bchileLogin(page, rut, password, debugLog, doSave) {
  debugLog.push("1. Navigating to bank homepage...");
  await page.goto(BANK_URL2, { waitUntil: "networkidle2", timeout: 45e3 });
  await delay(3e3);
  await doSave(page, "01-homepage");
  try {
    await page.waitForSelector('input[name="userRut"], input[name="rut"], #rut, input[placeholder*="RUT"]', { timeout: 15e3 });
  } catch {
  }
  await delay(1e3);
  debugLog.push("2. Filling RUT...");
  const formattedRut = formatRut(rut);
  const cleanRut = rut.replace(/[.\-]/g, "");
  const selectors = ["#ppriv_per-login-click-input-rut", 'input[name="userRut"]', "#rut", 'input[name="rut"]', 'input[placeholder*="RUT"]'];
  let rutFilled = false;
  for (const sel of selectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        const maxLen = await page.evaluate((s) => document.querySelector(s)?.maxLength ?? -1, sel);
        await el.click({ clickCount: 3 });
        await el.type(maxLen > 0 && maxLen <= 10 ? cleanRut : formattedRut, { delay: 45 });
        rutFilled = true;
        break;
      }
    } catch {
    }
  }
  if (!rutFilled) {
    rutFilled = await page.evaluate((rf, rc) => {
      for (const input of Array.from(document.querySelectorAll("input"))) {
        const el = input;
        if (el.offsetParent === null || el.disabled || el.type === "password") continue;
        el.focus();
        el.value = el.maxLength > 0 && el.maxLength <= 10 ? rc : rf;
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    }, formattedRut, cleanRut);
  }
  if (!rutFilled) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 el campo de RUT", screenshot: ss };
  }
  await delay(500);
  debugLog.push("3. Filling password...");
  const passSelectors = ["#ppriv_per-login-click-input-password", 'input[name="userPassword"]', "#pass", "#password", 'input[type="password"]'];
  let passFilled = false;
  for (const sel of passSelectors) {
    try {
      const el = await page.$(sel);
      if (!el) continue;
      const isReadonly = await page.evaluate((s) => {
        const i = document.querySelector(s);
        return i?.readOnly || i?.disabled || false;
      }, sel);
      if (!isReadonly) {
        await el.click();
        await el.type(password, { delay: 45 });
        passFilled = true;
        break;
      }
      for (const kbSel of ['[class*="keyboard"]', '[class*="teclado"]', '[class*="virtual"]']) {
        const kb = await page.$(kbSel);
        if (!kb) continue;
        let allClicked = true;
        for (const char of password) {
          const clicked = await page.evaluate((ch, s) => {
            const kb2 = document.querySelector(s);
            if (!kb2) return false;
            for (const btn of Array.from(kb2.querySelectorAll("button, span, div, a"))) {
              if (btn.innerText?.trim() === ch) {
                btn.click();
                return true;
              }
            }
            return false;
          }, char, kbSel);
          if (!clicked) {
            allClicked = false;
            break;
          }
        }
        if (allClicked) {
          passFilled = true;
          break;
        }
      }
      if (passFilled) break;
    } catch {
    }
  }
  if (!passFilled) {
    const submitSelectors2 = ["#ppriv_per-login-click-ingresar-login", 'button[type="submit"]', "#btn-login"];
    for (const sel of submitSelectors2) {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        break;
      }
    }
    await delay(3e3);
    for (const sel of passSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          await el.type(password, { delay: 45 });
          passFilled = true;
          break;
        }
      } catch {
      }
    }
  }
  if (!passFilled) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 el campo de clave", screenshot: ss };
  }
  debugLog.push("4. Submitting login...");
  const submitSelectors = ["#ppriv_per-login-click-ingresar-login", 'button[type="submit"]', "#btn-login", "#btn_login"];
  let submitted = false;
  for (const sel of submitSelectors) {
    const el = await page.$(sel);
    if (el) {
      await el.click();
      submitted = true;
      break;
    }
  }
  if (!submitted) {
    await page.evaluate(() => {
      for (const btn of Array.from(document.querySelectorAll("button, a, input[type='submit']"))) {
        const text = btn.innerText?.trim().toLowerCase() || "";
        if (text.includes("ingresar") || text.includes("continuar")) {
          btn.click();
          return;
        }
      }
    });
  }
  try {
    await page.waitForNavigation({ timeout: 25e3 });
  } catch {
  }
  await delay(5e3);
  await doSave(page, "03-after-login");
  const loginError = await page.evaluate(() => {
    const keywords = ["clave incorrecta", "rut inv\xE1lido", "bloqueada", "bloqueado", "suspendida", "sesi\xF3n activa"];
    for (const sel of ['[class*="error"]', '[class*="alert"]', '[role="alert"]']) {
      for (const el of document.querySelectorAll(sel)) {
        const text = el.innerText?.trim();
        if (text && keywords.some((kw) => text.toLowerCase().includes(kw))) return text;
      }
    }
    return null;
  });
  if (loginError) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: `Error de login: ${loginError}`, screenshot: ss };
  }
  if (await detect2FA(page, TWO_FACTOR_CONFIG)) {
    const approved = await waitFor2FA(page, debugLog, TWO_FACTOR_CONFIG);
    if (!approved) {
      const ss = await page.screenshot({ encoding: "base64" });
      return { success: false, error: "Timeout esperando aprobaci\xF3n de 2FA", screenshot: ss };
    }
  }
  if (page.url().includes("/login")) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "Login failed \u2014 a\xFAn en p\xE1gina de login", screenshot: ss };
  }
  debugLog.push("4. Login OK!");
  return { success: true };
}
function cartolaMovToMovement(mov) {
  return { date: normalizeDate(mov.fechaContable), description: mov.descripcion.trim(), amount: mov.tipo === "cargo" ? -Math.abs(mov.monto) : Math.abs(mov.monto), balance: mov.saldo, source: MOVEMENT_SOURCE.account };
}
function facturadoToMovement(tx, source, cardMask) {
  return { date: normalizeDate(tx.fechaTransaccionString), description: tx.descripcion.trim(), amount: tx.grupo === "pagos" ? Math.abs(tx.montoTransaccion) : -Math.abs(tx.montoTransaccion), balance: 0, source, card: cardMask, installments: normalizeInstallments(tx.cuotas) };
}
async function fetchAccountMovements(page, products, fullName, rut, debugLog) {
  const accounts = products.filter((p) => p.tipo === "cuenta" || p.tipo === "cuentaCorrienteMonedaLocal");
  const seenNums = /* @__PURE__ */ new Set();
  const unique = accounts.filter((a) => {
    if (seenNums.has(a.numero)) return false;
    seenNums.add(a.numero);
    return true;
  });
  if (unique.length === 0) return { movements: [] };
  const baseUrl = page.url().split("#")[0];
  await page.goto(`${baseUrl}#/movimientos/cuenta/saldos-movimientos`, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(5e3);
  const movements = [];
  let balance;
  for (const acct of unique) {
    debugLog.push(`  Fetching ${acct.descripcionLogo} ${acct.mascara}`);
    const cuentaSeleccionada = { nombreCliente: fullName, rutCliente: rut, numero: acct.numero, mascara: acct.mascara, selected: true, codigoProducto: acct.codigo, claseCuenta: acct.claseCuenta, moneda: acct.codigoMoneda };
    try {
      await apiPost(page, "movimientos/getConfigConsultaMovimientos", { cuentasSeleccionadas: [cuentaSeleccionada] });
      const cartola = await apiPost(page, "bff-pper-prd-cta-movimientos/movimientos/getCartola", { cuentaSeleccionada, cabecera: { statusGenerico: true, paginacionDesde: 1 } });
      if (cartola.movimientos) {
        for (const mov of cartola.movimientos) movements.push(cartolaMovToMovement(mov));
        if (balance === void 0 && acct.codigoMoneda === "CLP" && cartola.movimientos.length > 0) balance = cartola.movimientos[0].saldo;
        let hasMore = cartola.movimientos.length > 0 && (cartola.pagina?.[0]?.masPaginas ?? false);
        let offset = 1 + cartola.movimientos.length;
        for (let p = 2; hasMore && p <= 25; p++) {
          try {
            const next = await apiPost(page, "bff-pper-prd-cta-movimientos/movimientos/getCartola", { cuentaSeleccionada, cabecera: { statusGenerico: true, paginacionDesde: offset } });
            if (!next.movimientos?.length) break;
            for (const mov of next.movimientos) movements.push(cartolaMovToMovement(mov));
            offset += next.movimientos.length;
            hasMore = next.pagina?.[0]?.masPaginas ?? false;
          } catch {
            hasMore = false;
          }
        }
      }
    } catch (err) {
      debugLog.push(`    \u2192 Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { movements, balance };
}
async function fetchCreditCardData(page, fullName, debugLog) {
  const movements = [];
  const creditCards = [];
  let cards;
  try {
    cards = await apiPost(page, "tarjetas/widget/informacion-tarjetas", {});
  } catch {
    return { movements, creditCards };
  }
  if (cards.length === 0) return { movements, creditCards };
  debugLog.push(`  Found ${cards.length} credit card(s)`);
  for (const card of cards) {
    const cardLabel = `${card.marca} ${card.tipo} ${card.numero.slice(-8)}`.trim();
    const mascara = card.numero.replace(/\*/g, "").length <= 4 ? `****${card.numero.slice(-4)}` : card.numero;
    const baseBody = { idTarjeta: card.idProducto, codigoProducto: "TNM", tipoTarjeta: `${card.marca} ${card.tipo}`.trim(), mascara, nombreTitular: fullName };
    const body = { ...baseBody, tipoCliente: "T" };
    const [saldoResult, noFactResult] = await Promise.allSettled([
      apiPost(page, "tarjeta-credito-digital/saldo/obtener-saldo", body),
      apiPost(page, "tarjeta-credito-digital/movimientos-no-facturados", body)
    ]);
    if (saldoResult.status === "fulfilled") {
      const s = saldoResult.value;
      creditCards.push({ label: cardLabel, national: { used: s.cupoUtilizadoNacional, available: s.cupoDisponibleNacional, total: s.cupoTotalNacional }, international: { used: s.cupoUtilizadoInternacional, available: s.cupoDisponibleInternacional, total: s.cupoTotalInternacional, currency: "USD" } });
    } else {
      creditCards.push({ label: cardLabel });
    }
    if (noFactResult.status === "fulfilled") {
      const nf = noFactResult.value;
      const ccEntry = creditCards[creditCards.length - 1];
      if (nf.fechaProximaFacturacionCalendario) ccEntry.nextBillingDate = normalizeDate(nf.fechaProximaFacturacionCalendario);
      const nextDue = nf.fechaProximoVencimiento ?? nf.fechaVencimiento;
      if (nextDue) ccEntry.nextDueDate = normalizeDate(nextDue);
      const unbilledMovs = [];
      for (const mov of nf.listaMovNoFactur) {
        const amount = mov.montoCompra < 0 ? Math.abs(mov.montoCompra) : -Math.abs(mov.montoCompra);
        unbilledMovs.push({ date: normalizeDate(mov.fechaTransaccionString), description: mov.glosaTransaccion.trim(), amount, balance: 0, source: MOVEMENT_SOURCE.credit_card_unbilled, card: mascara, installments: normalizeInstallments(mov.despliegueCuotas) });
      }
      const periodExpensesRaw = nf.gastosPeriodo ?? nf.montoGastosPeriodo;
      ccEntry.periodExpenses = periodExpensesRaw !== void 0 ? periodExpensesRaw : unbilledMovs.filter((m) => m.amount < 0).reduce((s, m) => s + Math.abs(m.amount), 0);
      movements.push(...unbilledMovs);
    }
    try {
      const fechas = await apiPost(page, "tarjetas/estadocuenta/fechas-facturacion", baseBody);
      if (fechas.existenEstadosDeCuenta) {
        const ccEntry = creditCards[creditCards.length - 1];
        const latestFecha = fechas.listaNacional?.[0]?.fechaFacturacion;
        const numeroCuenta = fechas.numeroCuenta;
        if (latestFecha && numeroCuenta) {
          const resumenBody = { ...baseBody, fechaFacturacion: latestFecha, numeroCuenta };
          const [nacR, intR] = await Promise.allSettled([
            apiPost(page, "tarjetas/estadocuenta/nacional/resumen-por-fecha", resumenBody),
            apiPost(page, "tarjetas/estadocuenta/internacional/resumen-por-fecha", resumenBody)
          ]);
          for (const r of [nacR, intR]) {
            if (r.status !== "fulfilled" || !r.value.existeEstadoCuenta) continue;
            const res = r.value;
            const allTx = [
              ...res.seccionOperaciones?.transaccionesTarjetas ?? [],
              ...res.seccionCargosImpuestosAbonos?.transaccionesTarjetas ?? []
            ];
            for (const tx of allTx) {
              const desc = tx.descripcion.trim().toUpperCase();
              if (desc.startsWith("TOTAL ") && desc.endsWith("A LA CUENTA")) continue;
              movements.push(facturadoToMovement(tx, MOVEMENT_SOURCE.credit_card_billed, mascara));
            }
            if (res.resumen?.fechaProximaFacturacion) ccEntry.nextBillingDate = normalizeDate(res.resumen.fechaProximaFacturacion);
            if (!ccEntry.nextDueDate && res.resumen?.fechaVencimientoFacturacion) ccEntry.nextDueDate = normalizeDate(res.resumen.fechaVencimientoFacturacion);
            if (!ccEntry.lastStatement) {
              const billedAmount = res.resumen?.montoFacturado ?? res.totalFacturado ?? res.montoTotalFacturado ?? res.montoTotal;
              const dueDateRaw = res.resumen?.fechaVencimientoFacturacion ?? res.fechaVencimiento ?? res.fechaPago;
              const minimumPayment = res.resumen?.pagoMinimo ?? res.pagoMinimo ?? res.montoMinimoPago ?? res.montoMinimoAPagar;
              const billingDateRaw = res.resumen?.fechaFacturacionActual ?? latestFecha;
              if (billedAmount && dueDateRaw) {
                const billingDate = normalizeDate(billingDateRaw);
                ccEntry.lastStatement = {
                  billingDate,
                  billedAmount,
                  dueDate: normalizeDate(dueDateRaw),
                  minimumPayment
                };
                ccEntry.billingPeriod = monthYearLabel(billingDate);
              }
            }
          }
        }
      }
    } catch {
    }
  }
  return { movements, creditCards };
}
async function scrapeBchile(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const { onProgress } = options;
  const bank = "bchile";
  const progress = onProgress || (() => {
  });
  progress("Abriendo sitio del banco...");
  const loginResult = await bchileLogin(page, rut, password, debugLog, doSave);
  if (!loginResult.success) {
    return { success: false, bank, accounts: [], error: loginResult.error, screenshot: loginResult.screenshot, debug: debugLog.join("\n") };
  }
  progress("Sesi\xF3n iniciada correctamente");
  try {
    await page.waitForSelector("#modal_emergente_close, .cdk-overlay-container .btn-no-mas", { timeout: 8e3 });
    await page.evaluate(() => {
      const closeBtn = document.querySelector("#modal_emergente_close");
      if (closeBtn) {
        closeBtn.click();
        return;
      }
      const noMasBtn = document.querySelector(".btn-no-mas");
      if (noMasBtn) noMasBtn.click();
    });
    await delay(1500);
  } catch {
  }
  await closePopups(page);
  debugLog.push("5. Fetching products and client data via API...");
  progress("Obteniendo productos y datos del cliente...");
  let products;
  let clientData;
  try {
    [products, clientData] = await Promise.all([
      apiGet(page, "selectorproductos/selectorProductos/obtenerProductos?incluirTarjetas=true"),
      apiGet(page, "bff-ppersonas-clientes/clientes/")
    ]);
    debugLog.push(`  Found ${products.productos.length} products`);
  } catch (err) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: `No se pudo obtener datos: ${err instanceof Error ? err.message : String(err)}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  let balance;
  try {
    const saldos = await apiGet(page, "bff-pp-prod-ctas-saldos/productos/cuentas/saldos");
    const clp = saldos.find((s) => s.moneda === "CLP" && s.tipo === "CUENTA_CORRIENTE");
    if (clp) {
      balance = clp.disponible;
      debugLog.push(`  Balance CLP: $${balance}`);
    }
  } catch {
  }
  const fullName = products.nombre || `${clientData.datosCliente.nombres} ${clientData.datosCliente.apellidoPaterno}`.trim();
  debugLog.push("6. Fetching account movements via API...");
  progress("Extrayendo movimientos de cuenta...");
  const acctResult = await fetchAccountMovements(page, products.productos, fullName, products.rut, debugLog);
  if (balance === void 0 && acctResult.balance !== void 0) balance = acctResult.balance;
  debugLog.push(`  Account movements: ${acctResult.movements.length}`);
  debugLog.push("7. Fetching credit card data via API...");
  progress("Extrayendo datos de tarjeta de cr\xE9dito...");
  const tcResult = await fetchCreditCardData(page, fullName, debugLog);
  debugLog.push(`  TC movements: ${tcResult.movements.length}`);
  for (const cc of tcResult.creditCards) {
    const mask = cc.label.match(/\*{4}\d{4}/)?.[0];
    const cardMovs = mask ? tcResult.movements.filter((m) => m.card === mask) : tcResult.movements;
    cc.movements = deduplicateMovements(deduplicateAcrossSources(cardMovs));
  }
  const totalTc = tcResult.creditCards.reduce((s, cc) => s + (cc.movements?.length ?? 0), 0);
  debugLog.push(`8. Total: ${acctResult.movements.length} account + ${totalTc} TC movements`);
  progress(`Listo \u2014 ${acctResult.movements.length + totalTc} movimientos totales`);
  await doSave(page, "06-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64" }) : void 0;
  return {
    success: true,
    bank,
    accounts: [{ balance, movements: deduplicateMovements(acctResult.movements) }],
    creditCards: tcResult.creditCards.length > 0 ? tcResult.creditCards : void 0,
    screenshot: ss,
    debug: debugLog.join("\n")
  };
}
var bchile = {
  id: "bchile",
  name: "Banco de Chile",
  url: "https://portalpersonas.bancochile.cl",
  scrape: (options) => runScraper("bchile", options, {}, scrapeBchile)
};
var bchile_default = bchile;

// bank-api/vendor/upstream/src/intercept.ts
async function createInterceptor(page, endpoints) {
  const captures = /* @__PURE__ */ new Map();
  await page.exposeFunction(
    "__obcCapture",
    (id, dataJson) => {
      try {
        const data = JSON.parse(dataJson);
        const existing = captures.get(id) ?? [];
        existing.push(data);
        captures.set(id, existing);
      } catch {
      }
    }
  );
  await page.evaluateOnNewDocument(
    (endpointsJson) => {
      const eps = JSON.parse(endpointsJson);
      function matchEndpoint(url) {
        return eps.find((e) => url.startsWith(e.urlPrefix));
      }
      function capture(id, data) {
        try {
          window.__obcCapture(id, JSON.stringify(data));
        } catch {
        }
      }
      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const url = typeof args[0] === "string" ? args[0] : args[0] instanceof Request ? args[0].url : String(args[0]);
        const ep = matchEndpoint(url);
        const response = await originalFetch.apply(window, args);
        if (ep) {
          response.clone().json().then((data) => capture(ep.id, data)).catch(() => {
          });
        }
        return response;
      };
      const origOpen = XMLHttpRequest.prototype.open;
      const origSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        this.__obcEp = matchEndpoint(String(url));
        return origOpen.apply(this, [method, url, ...rest]);
      };
      XMLHttpRequest.prototype.send = function(...args) {
        const ep = this.__obcEp;
        if (ep) {
          this.addEventListener("load", function() {
            try {
              const data = this.responseType === "json" ? this.response : JSON.parse(this.responseText);
              capture(ep.id, data);
            } catch {
            }
          });
        }
        return origSend.apply(this, args);
      };
    },
    JSON.stringify(endpoints)
  );
  function sleep(ms) {
    return new Promise((resolve3) => setTimeout(resolve3, ms));
  }
  return {
    getAll(id) {
      return captures.get(id) ?? [];
    },
    async waitFor(id, timeoutMs = 1e4) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const data = captures.get(id);
        if (data && data.length > 0) return data;
        await sleep(200);
      }
      return captures.get(id) ?? [];
    }
  };
}

// bank-api/vendor/upstream/src/banks/bci.ts
var LOGIN_URL2 = "https://www.bci.cl/corporativo/banco-en-linea/personas";
var BCI_CHECKING_API_PREFIX = "https://apilocal.bci.cl/bci-produccion/api-bci/bff-saldosyultimosmovimientoswebpersonas";
function normalizeBciApiMovements(captures) {
  const movements = [];
  for (const capture of captures) {
    const obj = capture;
    const list = obj?.movimientos;
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const raw = Math.round(parseFloat(m.monto));
      if (!raw || isNaN(raw)) continue;
      const amount = m.tipo === "C" ? -raw : raw;
      const dateStr = m.fechaMovimiento?.split("T")[0] ?? "";
      movements.push({
        date: normalizeDate(dateStr),
        description: m.glosa ?? "",
        amount,
        balance: 0,
        source: MOVEMENT_SOURCE.account
      });
    }
  }
  return movements;
}
var IFRAME_PATTERNS = {
  content: ["miBanco.jsf", "vistaSupercartola"],
  movements: "fe-saldosultimosmov",
  tcMovements: "fe-mismovimientos",
  tcCupo: "vistaSaldosTDC.jsf"
};
var TWO_FACTOR_CONFIG2 = {
  keywords: ["bci pass", "segundo factor", "aprobaci\xF3n en tu app", "autorizar en tu app", "confirmar en tu app"],
  timeoutEnvVar: "BCI_2FA_TIMEOUT_SEC"
};
var TC_COMBINATIONS = [
  { tab: "Nacional $", billingType: "No facturados", source: MOVEMENT_SOURCE.credit_card_unbilled },
  { tab: "Nacional $", billingType: "Facturados", source: MOVEMENT_SOURCE.credit_card_billed },
  { tab: "Internacional USD", billingType: "No facturados", source: MOVEMENT_SOURCE.credit_card_unbilled },
  { tab: "Internacional USD", billingType: "Facturados", source: MOVEMENT_SOURCE.credit_card_billed }
];
var NEXT_PAGE_TEXTS = ["navigate_next", "siguiente"];
var ACCOUNT_SELECT = "bci-wk-select#cuenta select, select";
async function clickByTitle(page, title) {
  return page.evaluate((t) => {
    const link = document.querySelector(`a[title="${t}"]`);
    if (link) {
      link.click();
      return true;
    }
    return false;
  }, title);
}
async function waitForFrame(page, urlPattern, timeoutMs = 1e4) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const frame = page.frames().find((f) => f.url().includes(urlPattern));
    if (frame) return frame;
    await delay(500);
  }
  return null;
}
async function bciLogin(page, rut, password, debugLog, doSave) {
  debugLog.push("1. Navigating to BCI login...");
  await page.goto(LOGIN_URL2, { waitUntil: "domcontentloaded", timeout: 3e4 });
  await delay(3e3);
  await doSave(page, "01-login-form");
  debugLog.push("2. Filling RUT...");
  const cleanRut = rut.replace(/[.\-\s]/g, "");
  const rutBody = cleanRut.slice(0, -1);
  const rutDv = cleanRut.slice(-1);
  const filled = await page.evaluate((formatted, body, dv) => {
    const rutAux = document.getElementById("rut_aux");
    const rutHidden = document.getElementById("rut");
    const digHidden = document.getElementById("dig");
    if (!rutAux) return false;
    rutAux.value = formatted;
    rutAux.dispatchEvent(new Event("input", { bubbles: true }));
    rutAux.dispatchEvent(new Event("change", { bubbles: true }));
    rutAux.dispatchEvent(new Event("blur", { bubbles: true }));
    if (rutHidden) rutHidden.value = body;
    if (digHidden) digHidden.value = dv;
    return true;
  }, formatRut(rut), rutBody, rutDv);
  if (!filled) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "Campo de RUT no encontrado.", screenshot: ss };
  }
  debugLog.push("  Filling password...");
  const passFilled = await page.evaluate((pass) => {
    const clave = document.getElementById("clave");
    if (!clave) return false;
    clave.value = pass;
    clave.dispatchEvent(new Event("input", { bubbles: true }));
    clave.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }, password);
  if (!passFilled) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "Campo de clave no encontrado.", screenshot: ss };
  }
  await delay(500);
  debugLog.push("3. Submitting login...");
  await page.evaluate(() => {
    const btn = document.querySelector('button[type="submit"]');
    if (btn) btn.disabled = false;
    const form = document.getElementById("frm");
    if (form) form.submit();
    else if (btn) btn.click();
  });
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 3e4 });
  } catch {
  }
  await delay(3e3);
  await doSave(page, "03-post-login");
  if (await detect2FA(page, TWO_FACTOR_CONFIG2)) {
    await doSave(page, "03b-2fa-challenge");
    const approved = await waitFor2FA(page, debugLog, TWO_FACTOR_CONFIG2);
    if (!approved) {
      const ss = await page.screenshot({ encoding: "base64" });
      return { success: false, error: "Timeout esperando BCI Pass.", screenshot: ss };
    }
    await delay(3e3);
  }
  const loginError = await detectLoginError(page);
  if (loginError) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: `Error del banco: ${loginError}`, screenshot: ss };
  }
  if (page.url().includes("banco-en-linea/personas")) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "Login no naveg\xF3 fuera de la p\xE1gina.", screenshot: ss };
  }
  debugLog.push("4. Login OK!");
  return { success: true };
}
async function extractMovementsFromFrame(frame, debugLog) {
  await frame.evaluate(() => {
    for (const opt of document.querySelectorAll("a, button, span, option")) {
      if (opt.innerText?.trim() === "50") {
        opt.click();
        return;
      }
    }
  });
  await delay(3e3);
  const all = [];
  for (let pageIndex = 0; pageIndex < 25; pageIndex++) {
    const raw = await frame.evaluate(() => {
      const results = [];
      for (const row of Array.from(document.querySelectorAll("table tbody tr"))) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length < 4) continue;
        const date = cells[0].textContent?.trim() || "";
        if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(date)) continue;
        results.push({ date, description: cells[1].textContent?.trim() || "", cargo: cells[2].textContent?.trim() || "", abono: cells[3].textContent?.trim() || "" });
      }
      return results;
    });
    for (const r of raw) {
      const cargoAmount = r.cargo ? parseChileanAmount(r.cargo) : 0;
      const abonoAmount = r.abono ? parseChileanAmount(r.abono) : 0;
      const amount = cargoAmount > 0 ? -cargoAmount : abonoAmount;
      if (amount === 0) continue;
      all.push({ date: normalizeDate(r.date), description: r.description, amount, balance: 0, source: MOVEMENT_SOURCE.account });
    }
    debugLog.push(`  Page ${pageIndex + 1}: ${raw.length} raw movements`);
    const hasNext = await frame.evaluate((nextTexts) => {
      for (const btn of document.querySelectorAll("button, a")) {
        const text = btn.innerText?.trim().toLowerCase() || "";
        if (nextTexts.some((t) => text === t || text.includes(t))) {
          if (btn.disabled || btn.getAttribute("aria-disabled") === "true") return false;
          btn.click();
          return true;
        }
      }
      return false;
    }, [...NEXT_PAGE_TEXTS]);
    if (!hasNext) break;
    await delay(3e3);
  }
  return all;
}
async function extractTCMovements(frame, tab, billingType, source, debugLog) {
  await frame.evaluate((tabName) => {
    for (const el of document.querySelectorAll(".listTab span, .bci-wk-tab span, .listTab a span")) {
      if (el.textContent?.trim() === tabName) {
        const anchor = el.closest("a");
        if (anchor) {
          anchor.click();
          return;
        }
      }
    }
  }, tab);
  await delay(2500);
  await frame.evaluate((btnText) => {
    for (const btn of document.querySelectorAll("button.btn_blue_border, button")) {
      if (btn.textContent?.trim() === btnText) {
        btn.click();
        return;
      }
    }
  }, billingType);
  await delay(2500);
  const hasNoMovements = await frame.evaluate(() => {
    const text = (document.body?.innerText || "").toLowerCase();
    return text.includes("no tienes movimientos") || text.includes("sin movimientos");
  });
  if (hasNoMovements) {
    debugLog.push(`    ${tab} / ${billingType}: sin movimientos`);
    return [];
  }
  const allMovements = [];
  for (let pageIndex = 0; pageIndex < 50; pageIndex++) {
    const rawRows = await frame.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll("table.custom-table tbody tr, .wrapper-table table tbody tr");
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 4) continue;
        const date = cells[0]?.textContent?.trim() ?? "";
        if (!date || !/\d/.test(date)) continue;
        const descP = cells[1]?.querySelector("p.customRow, p:first-child");
        const description = descP?.textContent?.trim() ?? cells[1]?.textContent?.trim() ?? "";
        const pendingConfirmation = !!cells[1]?.querySelector(".cont-circle");
        const montoCell = cells[3];
        const montoP = montoCell?.querySelector(".container_monto p, p");
        const rawAmount = montoP?.textContent?.trim() ?? "";
        const img = montoCell?.querySelector("img");
        const isCargo = (img?.getAttribute("alt") ?? "").toLowerCase() === "cargo";
        if (!rawAmount) continue;
        results.push({ date, description, rawAmount, isCargo, pendingConfirmation });
      }
      return results;
    });
    debugLog.push(`    ${tab}/${billingType} p\xE1gina ${pageIndex + 1}: ${rawRows.length} filas`);
    for (const r of rawRows) {
      const absAmount = parseChileanAmount(r.rawAmount);
      if (absAmount === 0) continue;
      allMovements.push({
        date: normalizeDate(r.date),
        description: r.description,
        amount: r.isCargo ? -absAmount : absAmount,
        balance: 0,
        source
      });
    }
    const canAdvance = await frame.evaluate(() => {
      const btn = document.getElementById("btn-next");
      if (!btn) return false;
      return !btn.classList.contains("disable") && btn.getAttribute("aria-disabled") !== "true" && !btn.disabled;
    });
    if (!canAdvance) break;
    try {
      await frame.click("#btn-next");
    } catch {
      break;
    }
    const lastRow = rawRows[rawRows.length - 1];
    const pageSignature = (rawRows[0]?.date ?? "") + (rawRows[0]?.rawAmount ?? "") + (lastRow?.date ?? "") + (lastRow?.rawAmount ?? "");
    const changed = await waitForTableChange(frame, pageSignature, 8e3);
    if (!changed) break;
  }
  debugLog.push(`    ${tab} / ${billingType}: ${allMovements.length} movimientos totales`);
  return allMovements;
}
async function waitForTableChange(frame, previousSignature, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const currentSignature = await frame.evaluate(() => {
      const rows = document.querySelectorAll("table.custom-table tbody tr, .wrapper-table table tbody tr");
      if (rows.length === 0) return "";
      const first = rows[0].querySelectorAll("td");
      const last = rows[rows.length - 1].querySelectorAll("td");
      return (first[0]?.textContent?.trim() ?? "") + (first[3]?.querySelector("p")?.textContent?.trim() ?? "") + (last[0]?.textContent?.trim() ?? "") + (last[3]?.querySelector("p")?.textContent?.trim() ?? "");
    });
    if (currentSignature && currentSignature !== previousSignature) return true;
    await delay(400);
  }
  return false;
}
async function scrapeBci(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const { onProgress } = options;
  const bank = "bci";
  const progress = onProgress || (() => {
  });
  const interceptor = await createInterceptor(page, [
    { id: "bci-checking", urlPrefix: BCI_CHECKING_API_PREFIX }
  ]);
  progress("Abriendo sitio del banco...");
  const loginResult = await bciLogin(page, rut, password, debugLog, doSave);
  if (!loginResult.success) {
    return { success: false, bank, accounts: [], error: loginResult.error, screenshot: loginResult.screenshot, debug: debugLog.join("\n") };
  }
  progress("Sesi\xF3n iniciada correctamente");
  await closePopups(page);
  await delay(2e3);
  progress("Extrayendo movimientos de cuenta...");
  debugLog.push("5. Fetching account movements...");
  const allMovements = [];
  let balance;
  if (await clickByTitle(page, "\xDAltimos Movimientos")) {
    const movFrame = await waitForFrame(page, IFRAME_PATTERNS.movements, 15e3);
    if (movFrame) {
      await delay(3e3);
      const captured = await interceptor.waitFor("bci-checking", 1e4);
      if (captured.length > 0) {
        debugLog.push(`  Checking API: ${captured.length} response(s) captured`);
        const apiMovements = normalizeBciApiMovements(captured);
        debugLog.push(`  Checking API movements: ${apiMovements.length}`);
        if (apiMovements.length > 0) {
          allMovements.push(...apiMovements);
          balance = await movFrame.evaluate(() => {
            const el = document.querySelector("#saldoDis + div, .bci-h2-w800");
            if (!el) return void 0;
            const match = el.textContent?.trim().match(/\$\s*([\d.]+)/);
            if (match) return parseInt(match[1].replace(/\./g, ""), 10);
            return void 0;
          });
        }
      }
      if (allMovements.length === 0) {
        debugLog.push("  Checking API: no data, falling back to HTML extraction");
        const accounts2 = await movFrame.evaluate((sel) => {
          const select = document.querySelector(sel);
          if (!select) return [];
          return Array.from(select.options).map((o) => ({ value: o.value, label: o.textContent?.trim() || "" }));
        }, ACCOUNT_SELECT);
        debugLog.push(`  Found ${accounts2.length} account(s)`);
        for (let i = 0; i < accounts2.length; i++) {
          if (i > 0) {
            await movFrame.evaluate((value, sel) => {
              const select = document.querySelector(sel);
              if (!select) return;
              select.value = value;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }, accounts2[i].value, ACCOUNT_SELECT);
            await delay(3e3);
          }
          if (balance === void 0) {
            balance = await movFrame.evaluate(() => {
              const el = document.querySelector("#saldoDis + div, .bci-h2-w800");
              if (!el) return void 0;
              const match = el.textContent?.trim().match(/\$\s*([\d.]+)/);
              if (match) return parseInt(match[1].replace(/\./g, ""), 10);
              return void 0;
            });
          }
          const movements = await extractMovementsFromFrame(movFrame, debugLog);
          const prefixed = accounts2.length > 1 ? movements.map((m) => ({ ...m, description: `[${accounts2[i].label}] ${m.description}`.trim() })) : movements;
          allMovements.push(...prefixed);
        }
      }
    }
  }
  progress("Extrayendo datos de tarjeta de cr\xE9dito...");
  debugLog.push("6. Navigating to credit cards...");
  const creditCards = [];
  if (await clickByTitle(page, "Tarjetas")) {
    await delay(3e3);
    const cardLabels = await page.evaluate(() => {
      const selects = document.querySelectorAll("select.tdc");
      if (selects.length === 0) return [];
      return Array.from(selects[0].options).map((o) => o.textContent?.trim() || "");
    });
    if (cardLabels.length > 0 && await clickByTitle(page, "Mis movimientos")) {
      const tcFrame = await waitForFrame(page, IFRAME_PATTERNS.tcMovements, 15e3);
      if (tcFrame) {
        await delay(3e3);
        for (const { tab, billingType, source } of TC_COMBINATIONS) {
          const movements = await extractTCMovements(tcFrame, tab, billingType, source, debugLog);
          allMovements.push(...movements);
        }
      }
      if (await clickByTitle(page, "Cupo disponible")) {
        const cupoFrame = await waitForFrame(page, IFRAME_PATTERNS.tcCupo, 15e3);
        if (cupoFrame) {
          await delay(3e3);
          const cupoData = await cupoFrame.evaluate(() => {
            const bodyText = document.body?.innerText || "";
            const parseAmt = (t) => parseInt(t.replace(/[^0-9]/g, ""), 10) || 0;
            const natUsed = bodyText.match(/utilizado\s*(?:nacional)?\s*\$?\s*([\d.]+)/i);
            const natAvail = bodyText.match(/disponible\s*(?:nacional)?\s*\$?\s*([\d.]+)/i);
            const natTotal = bodyText.match(/total\s*(?:nacional)?\s*\$?\s*([\d.]+)/i);
            const intUsed = bodyText.match(/utilizado\s*(?:internacional)?\s*USD?\s*\$?\s*([\d.,]+)/i);
            const intAvail = bodyText.match(/disponible\s*(?:internacional)?\s*USD?\s*\$?\s*([\d.,]+)/i);
            const intTotal = bodyText.match(/total\s*(?:internacional)?\s*USD?\s*\$?\s*([\d.,]+)/i);
            return { nationalUsed: natUsed ? parseAmt(natUsed[1]) : 0, nationalAvailable: natAvail ? parseAmt(natAvail[1]) : 0, nationalTotal: natTotal ? parseAmt(natTotal[1]) : 0, internationalUsed: intUsed ? parseAmt(intUsed[1]) : 0, internationalAvailable: intAvail ? parseAmt(intAvail[1]) : 0, internationalTotal: intTotal ? parseAmt(intTotal[1]) : 0 };
          });
          for (const label of cardLabels) {
            const card = { label, national: { used: cupoData.nationalUsed, available: cupoData.nationalAvailable, total: cupoData.nationalTotal }, movements: [] };
            if (cupoData.internationalTotal > 0) card.international = { used: cupoData.internationalUsed, available: cupoData.internationalAvailable, total: cupoData.internationalTotal, currency: "USD" };
            creditCards.push(card);
          }
        }
      }
    }
  }
  const deduplicated = deduplicateMovements(allMovements);
  debugLog.push(`  Total: ${deduplicated.length} unique movements`);
  progress(`Listo \u2014 ${deduplicated.length} movimientos totales`);
  await doSave(page, "06-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64" }) : void 0;
  const accounts = [{ balance, movements: deduplicated }];
  return { success: true, bank, accounts, creditCards: creditCards.length > 0 ? creditCards : void 0, screenshot: ss, debug: debugLog.join("\n") };
}
var bci = {
  id: "bci",
  name: "BCI",
  url: "https://www.bci.cl/personas",
  scrape: (options) => runScraper("bci", options, {}, scrapeBci)
};
var bci_default = bci;

// bank-api/vendor/upstream/src/banks/bestado.ts
var LOGIN_URL3 = "https://www.bancoestado.cl/content/bancoestado-public/cl/es/home/home.html#/login";
async function fillRut2(page, rut) {
  const rutInput = await page.$("#rut");
  if (!rutInput) return false;
  await rutInput.click();
  await delay(500);
  const isReadonly = await page.evaluate(() => {
    const input = document.querySelector("#rut");
    if (input?.hasAttribute("readonly")) {
      input.removeAttribute("readonly");
      input.focus();
      return true;
    }
    return false;
  });
  if (isReadonly) await delay(300);
  await rutInput.click({ clickCount: 3 });
  const cleanRut = rut.replace(/[.\-]/g, "");
  await rutInput.type(cleanRut, { delay: 80 });
  await page.evaluate(() => {
    const input = document.querySelector("#rut");
    if (input) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  return true;
}
async function fillPassword2(page, password) {
  const passInput = await page.$("#pass");
  if (!passInput) return false;
  await passInput.click({ clickCount: 3 });
  await passInput.type(password, { delay: 80 });
  await page.evaluate(() => {
    const input = document.querySelector("#pass");
    if (input) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  return true;
}
async function extractBalanceFromDashboard(page, debugLog) {
  const balance = await page.evaluate(() => {
    const productCards = document.querySelectorAll('[class*="product"], [class*="card"], [class*="cuenta"]');
    for (const card of productCards) {
      const text = card.innerText || "";
      if (text.toLowerCase().includes("cuentarut") || text.toLowerCase().includes("cuenta rut")) {
        const amountMatch = text.match(/\$\s*([\d.,]+)/);
        if (amountMatch) return amountMatch[1];
      }
    }
    const bodyText = document.body?.innerText || "";
    const patterns = [
      /cuentarut[^$]*\$\s*([\d.,]+)/i,
      /cuenta\s*rut[^$]*\$\s*([\d.,]+)/i,
      /saldo\s*disponible[:\s]*\$?\s*([\d.,]+)/i
    ];
    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) return match[1];
    }
    return null;
  });
  if (balance) {
    const parsed = parseChileanAmount(balance);
    debugLog.push(`  CuentaRUT balance: $${parsed.toLocaleString("es-CL")}`);
    return parsed;
  }
  return void 0;
}
async function extractMovements2(page) {
  const raw = await page.evaluate(() => {
    const results = [];
    const tables = document.querySelectorAll("table");
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) continue;
      let dateIdx = -1, descIdx = -1, amountIdx = -1, saldoIdx = -1;
      let cargoIdx = -1, abonoIdx = -1;
      for (const row of rows) {
        const ths = row.querySelectorAll("th");
        if (ths.length >= 3) {
          const headers = Array.from(ths).map((h) => h.innerText?.trim().toLowerCase());
          dateIdx = headers.findIndex((h) => h.includes("fecha"));
          descIdx = headers.findIndex((h) => h.includes("descripci") || h.includes("detalle") || h.includes("glosa"));
          saldoIdx = headers.findIndex((h) => h.includes("saldo"));
          amountIdx = headers.findIndex((h) => h.includes("abono") && h.includes("cargo") || h.includes("monto") || h.includes("importe"));
          if (amountIdx < 0) {
            cargoIdx = headers.findIndex((h) => h === "cargo" || h === "cargos" || h.includes("d\xE9bito"));
            abonoIdx = headers.findIndex((h) => h === "abono" || h === "abonos" || h.includes("cr\xE9dito") || h.includes("dep\xF3sito"));
          }
          if (dateIdx >= 0) break;
        }
      }
      if (dateIdx < 0) continue;
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;
        const texts = Array.from(cells).map((c) => c.innerText?.trim());
        const dateText = texts[dateIdx] || "";
        if (!/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(dateText)) continue;
        let amount = "";
        if (amountIdx >= 0) {
          amount = texts[amountIdx] || "";
        } else if (cargoIdx >= 0 || abonoIdx >= 0) {
          const cargo = cargoIdx >= 0 ? texts[cargoIdx] || "" : "";
          const abono = abonoIdx >= 0 ? texts[abonoIdx] || "" : "";
          if (cargo && cargo !== "$0" && cargo !== "0") amount = `-${cargo}`;
          else if (abono) amount = abono;
        }
        results.push({
          date: dateText,
          description: texts[descIdx >= 0 ? descIdx : 1] || "",
          amount,
          balance: saldoIdx >= 0 ? texts[saldoIdx] || "" : ""
        });
      }
    }
    if (results.length === 0) {
      const movRows = document.querySelectorAll('[class*="movimiento"], [class*="movement"], [class*="transaction"]');
      for (const el of movRows) {
        const text = el.innerText || "";
        const dateMatch = text.match(/(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4})/);
        const amountMatch = text.match(/[+\-]?\$[\d.,]+/g);
        if (dateMatch && amountMatch) {
          const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
          const descLine = lines.find((l) => !l.match(/^[+\-]?\$/) && !l.match(/^\d{1,2}[\/.\-]/) && l.length > 2);
          results.push({
            date: dateMatch[1],
            description: descLine || "",
            amount: amountMatch[0],
            balance: amountMatch.length > 1 ? amountMatch[amountMatch.length - 1] : ""
          });
        }
      }
    }
    return results;
  });
  return raw.map((r) => {
    const amount = parseChileanAmount(r.amount);
    if (amount === 0) return null;
    return {
      date: normalizeDate(r.date),
      description: r.description,
      amount,
      balance: r.balance ? parseChileanAmount(r.balance) : 0,
      source: MOVEMENT_SOURCE.account
    };
  }).filter(Boolean);
}
async function scrapeBestado(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const bank = "bestado";
  const progress = onProgress || (() => {
  });
  debugLog.push("1. Navigating to BancoEstado login...");
  progress("Abriendo sitio del banco...");
  await page.goto(LOGIN_URL3, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(3e3);
  await closePopups(page);
  await doSave(page, "01-homepage");
  debugLog.push("2. Waiting for login offcanvas...");
  try {
    await page.waitForSelector(".msd-custom-sidenav__container #rut", { visible: true, timeout: 15e3 });
  } catch {
    await clickByText(page, ["ingresar", "banca en l\xEDnea", "login"]);
    await delay(3e3);
    await page.waitForSelector("#rut", { visible: true, timeout: 1e4 });
  }
  await doSave(page, "02-login-form");
  debugLog.push("3. Filling RUT...");
  progress("Ingresando RUT...");
  if (!await fillRut2(page, rut)) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se pudo llenar el RUT", screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("4. Filling password...");
  progress("Ingresando clave...");
  if (!await fillPassword2(page, password)) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se pudo llenar la clave", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await doSave(page, "03-credentials");
  debugLog.push("5. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  const submitBtn = await page.$("#btnLogin");
  if (submitBtn) {
    await submitBtn.click();
  } else {
    await page.evaluate(() => {
      const form = document.querySelector("form");
      if (form) form.dispatchEvent(new Event("submit", { bubbles: true }));
    });
  }
  try {
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 3e4 });
  } catch {
    await delay(5e3);
  }
  await delay(3e3);
  await closePopups(page);
  await doSave(page, "04-post-login");
  const loginError = await page.evaluate(() => {
    const errorKeywords = ["contrase\xF1a", "clave incorrecta", "rut inv\xE1lido", "credenciales", "bloqueado", "intente nuevamente", "reintente"];
    const errorEls = document.querySelectorAll('[class*="error"], [class*="alert"], .input-messages');
    for (const el of errorEls) {
      const text = el.innerText?.trim().toLowerCase();
      if (text && errorKeywords.some((kw) => text.includes(kw))) return el.innerText?.trim();
    }
    return null;
  });
  if (loginError) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: `Login fallido: ${loginError}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  await page.evaluate(() => {
    const btns = document.querySelectorAll("button, a");
    for (const btn of btns) {
      const text = btn.innerText?.trim().toLowerCase();
      if (text === "no por ahora" || text === "cerrar" || text === "\xD7") {
        btn.click();
        break;
      }
    }
  });
  await delay(1e3);
  const postLoginUrl = new URL(page.url());
  debugLog.push(`  Login OK! URL: ${postLoginUrl.origin}${postLoginUrl.pathname}`);
  progress("Sesi\xF3n iniciada correctamente");
  debugLog.push("6. Extracting CuentaRUT balance...");
  progress("Extrayendo saldo CuentaRUT...");
  const balance = await extractBalanceFromDashboard(page, debugLog);
  await doSave(page, "05-dashboard");
  debugLog.push("7. Navigating to CuentaRUT movements...");
  progress("Navegando a movimientos CuentaRUT...");
  let navigated = await page.evaluate(() => {
    const links = document.querySelectorAll("a, button");
    for (const el of links) {
      const text = el.innerText?.trim().toLowerCase();
      if (text === "ir a movimientos" || text === "ver movimientos" || text === "ver m\xE1s movimientos") {
        el.click();
        return text;
      }
    }
    return null;
  });
  if (navigated) {
    debugLog.push(`  Clicked: "${navigated}"`);
    await delay(5e3);
    await closePopups(page);
  } else {
    const sidebarClicked = await clickByText(page, ["cuentas"]);
    if (sidebarClicked) {
      await delay(2e3);
      await clickByText(page, ["cuentarut", "cuenta rut", "movimientos", "cartola"]);
      await delay(5e3);
      await closePopups(page);
    }
  }
  await doSave(page, "06-movements-page");
  debugLog.push("8. Extracting movements...");
  progress("Extrayendo movimientos...");
  let movements = await extractMovements2(page);
  for (let i = 0; i < 10; i++) {
    const hasMore = await page.evaluate(() => {
      const btns = document.querySelectorAll("button, a");
      for (const btn of btns) {
        const text = btn.innerText?.trim().toLowerCase();
        const el = btn;
        if ((text === "siguiente" || text === "ver m\xE1s" || text === "cargar m\xE1s" || text.includes("\u203A")) && !el.disabled) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (!hasMore) break;
    debugLog.push(`  Pagination: page ${i + 2}`);
    await delay(3e3);
    const more = await extractMovements2(page);
    if (more.length === 0) break;
    movements.push(...more);
  }
  const deduplicated = deduplicateMovements(movements);
  debugLog.push(`  Total: ${deduplicated.length} unique movements`);
  progress(`Listo \u2014 ${deduplicated.length} movimientos totales`);
  await doSave(page, "07-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64" }) : void 0;
  return { success: true, bank, accounts: [{ balance, movements: deduplicated }], screenshot: ss, debug: debugLog.join("\n") };
}
var bestado = {
  id: "bestado",
  name: "Banco Estado",
  url: "https://www.bancoestado.cl",
  scrape: (options) => runScraper("bestado", options, { forceHeadful: true }, scrapeBestado)
};
var bestado_default = bestado;

// bank-api/vendor/upstream/src/banks/bice.ts
var BANK_URL3 = "https://banco.bice.cl/personas";
async function login(page, rut, password, debugLog, doSave) {
  debugLog.push("1. Navigating to bank homepage...");
  await page.goto(BANK_URL3, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(2e3);
  await doSave(page, "01-homepage");
  debugLog.push("2. Opening login dropdown...");
  const loginDropdown = await page.$("#login-dropdown");
  if (!loginDropdown) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 el bot\xF3n de login (#login-dropdown)", screenshot: ss };
  }
  await loginDropdown.click();
  await delay(1500);
  try {
    await page.waitForSelector(".dropdown-menu.show", { timeout: 5e3 });
  } catch {
    await loginDropdown.click();
    await delay(2e3);
  }
  debugLog.push("3. Clicking 'Personas'...");
  const personasLink = await page.$('a[data-click="Personas"]');
  if (!personasLink) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 el link 'Personas'", screenshot: ss };
  }
  await personasLink.click();
  debugLog.push("4. Waiting for login form...");
  const browser = page.browser();
  let loginPage = page;
  try {
    await new Promise((resolve3, reject) => {
      const timeout = setTimeout(() => reject(new Error("timeout")), 25e3);
      const interval = setInterval(async () => {
        const allPages = await browser.pages();
        for (const p of allPages) {
          if (p.url().includes("auth.bice.cl")) {
            loginPage = p;
            clearInterval(interval);
            clearTimeout(timeout);
            resolve3();
            return;
          }
        }
      }, 1e3);
    });
    await loginPage.waitForSelector("#username", { timeout: 15e3 });
  } catch {
    const ss = await loginPage.screenshot({ encoding: "base64" });
    return { success: false, error: "No se carg\xF3 la p\xE1gina de login (timeout)", screenshot: ss };
  }
  await doSave(loginPage, "02-login-form");
  debugLog.push("5. Filling RUT...");
  const rutField = await loginPage.$("#username");
  if (!rutField) {
    const ss = await loginPage.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 campo de RUT (#username)", screenshot: ss };
  }
  await rutField.click();
  await rutField.type(rut.replace(/[.\-]/g, ""), { delay: 50 });
  debugLog.push("6. Filling password...");
  const passField = await loginPage.$("#password");
  if (!passField) {
    const ss = await loginPage.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 campo de clave (#password)", screenshot: ss };
  }
  await passField.click();
  await passField.type(password, { delay: 50 });
  await delay(500);
  debugLog.push("7. Submitting login...");
  await doSave(loginPage, "03-pre-submit");
  const submitBtn = await loginPage.$("#kc-login");
  if (submitBtn) await submitBtn.click();
  else await loginPage.keyboard.press("Enter");
  try {
    await loginPage.waitForNavigation({ timeout: 2e4 });
  } catch {
  }
  await delay(3e3);
  await doSave(loginPage, "04-after-login");
  if (loginPage.url().includes("auth.bice.cl")) {
    const errorText = await loginPage.evaluate(() => {
      const el = document.querySelector('[class*="error"], [class*="alert"], [role="alert"]');
      return el ? el.innerText?.trim() : null;
    });
    const ss = await loginPage.screenshot({ encoding: "base64" });
    return { success: false, error: `Error de login: ${errorText || "Credenciales inv\xE1lidas"}`, screenshot: ss };
  }
  debugLog.push("8. Login OK!");
  return { success: true, activePage: loginPage };
}
async function dismissAdPopup(page, debugLog) {
  for (let i = 0; i < 8; i++) {
    const btn = await page.$("button.evg-btn-dismissal");
    if (btn) {
      await btn.click();
      debugLog.push("  Ad popup dismissed");
      await delay(1e3);
      return;
    }
    await delay(2e3);
  }
}
async function extractCurrentMonthMovements(page) {
  const raw = await page.evaluate(() => {
    const rows = document.querySelectorAll("div.transaction-table__container table tbody tr");
    const results = [];
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 4) continue;
      results.push({
        date: cells[0].innerText?.trim() || "",
        category: cells[1].innerText?.trim().toLowerCase() || "",
        description: cells[2].innerText?.trim() || "",
        amount: cells[3].innerText?.trim() || ""
      });
    }
    return results;
  });
  return raw.map((r) => {
    const amountVal = parseChileanAmount(r.amount);
    if (amountVal === 0) return null;
    const amount = r.category.includes("cargo") ? -amountVal : amountVal;
    return { date: normalizeDate(r.date), description: r.description, amount, balance: 0, source: MOVEMENT_SOURCE.account };
  }).filter(Boolean);
}
async function extractHistoricalMovements(page, debugLog) {
  const raw = await page.evaluate(() => {
    const table = document.querySelector('table[aria-describedby="Tabla resumen de cartolas"]') || document.querySelector("lib-credits-and-charges table") || document.querySelector("ds-table table");
    if (!table) return { rows: [], found: false };
    const rows = table.querySelectorAll("tbody tr");
    const results = [];
    for (const row of rows) {
      const cells = row.querySelectorAll("td");
      if (cells.length < 5) continue;
      results.push({
        date: cells[0].innerText?.trim() || "",
        category: cells[1].innerText?.trim().toLowerCase() || "",
        description: cells[3].innerText?.trim() || "",
        amount: cells[4].innerText?.trim() || ""
      });
    }
    return { rows: results, found: true };
  });
  if (!raw.found) {
    debugLog.push("  Historical table not found");
    return [];
  }
  return raw.rows.map((r) => {
    const amountVal = parseChileanAmount(r.amount);
    if (amountVal === 0) return null;
    const amount = r.category.includes("cargo") ? -amountVal : amountVal;
    return { date: normalizeDate(r.date), description: r.description, amount, balance: 0, source: MOVEMENT_SOURCE.account };
  }).filter(Boolean);
}
async function bicePaginate(page, extractFn) {
  const all = [];
  for (let i = 0; i < 50; i++) {
    all.push(...await extractFn(page));
    const isDisabled = await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const span = btn.querySelector("span");
        if (span?.textContent?.trim() === "Siguiente") return btn.classList.contains("is-disabled");
      }
      return true;
    });
    if (isDisabled) break;
    await page.evaluate(() => {
      const buttons = document.querySelectorAll("button");
      for (const btn of buttons) {
        const span = btn.querySelector("span");
        if (span?.textContent?.trim() === "Siguiente") {
          btn.click();
          return;
        }
      }
    });
    await delay(3e3);
  }
  return all;
}
async function selectPeriod(page, periodIndex, debugLog) {
  await page.evaluate(() => {
    const selector = document.querySelector("ds-dropdown div.ds-selector");
    if (selector) selector.click();
  });
  await delay(1e3);
  const periodLabel = await page.evaluate((idx) => {
    const items = document.querySelectorAll("ul.options.single li.li-single");
    if (idx >= items.length) return null;
    const span = items[idx].querySelector("span.label.header-ellipsis");
    const label = span?.textContent?.trim() || "";
    items[idx].click();
    return label;
  }, periodIndex);
  if (!periodLabel) {
    debugLog.push(`  Period index ${periodIndex} not available`);
    return false;
  }
  debugLog.push(`  Selected period: ${periodLabel}`);
  await page.evaluate(() => {
    const container = document.querySelector("div.button-search");
    const btn = container?.querySelector("button");
    if (btn) btn.click();
  });
  await delay(7e3);
  return true;
}
async function navigateToTcMovements(page, debugLog) {
  debugLog.push("TC: Navigating to credit card movements...");
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      debugLog.push(`TC: Direct URL attempt ${attempt}...`);
      await page.goto("https://portalpersonas.bice.cl/movimientos-tc", {
        waitUntil: "networkidle2",
        timeout: 2e4
      });
      try {
        await page.waitForSelector("app-progression-chart h4.chart-title, span.transaction-amount", {
          timeout: 15e3
        });
      } catch {
        debugLog.push(`TC: Data didn't render after 15s`);
        if (attempt < 3) {
          await delay(2e3);
          continue;
        }
      }
      await delay(2e3);
      const pageText = await page.evaluate(() => {
        const body = document.body.innerText || "";
        return {
          hasCard: /Visa|Mastercard|Amex|Tarjeta de Crédito/i.test(body),
          hasCupo: /cupo|disponible|utilizado/i.test(body),
          hasMovements: /movimientos|Fecha.*Monto/i.test(body)
        };
      });
      if (pageText.hasCard || pageText.hasCupo || pageText.hasMovements) {
        debugLog.push(`TC: Direct URL navigation OK (card=${pageText.hasCard}, cupo=${pageText.hasCupo}, mov=${pageText.hasMovements})`);
        return true;
      }
      debugLog.push(`TC: Page loaded but no TC content detected yet`);
    } catch (e) {
      debugLog.push(`TC: Direct URL attempt ${attempt} failed: ${e.message}`);
    }
    await delay(2e3);
  }
  debugLog.push("TC: Trying sidebar menu navigation...");
  const clickByText2 = async (text, exact = true) => {
    return await page.evaluate(
      ([searchText, isExact]) => {
        const items = document.querySelectorAll("div, span, a, li, button");
        for (const item of items) {
          const el = item;
          const directText = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent?.trim()).join("").trim();
          const fullText = el.innerText?.trim() || "";
          const text2 = isExact ? directText : fullText;
          if (isExact ? text2 === searchText : text2.includes(searchText)) {
            el.click();
            return true;
          }
        }
        return false;
      },
      [text, exact]
    );
  };
  try {
    await page.goto("https://portalpersonas.bice.cl/home", {
      waitUntil: "networkidle2",
      timeout: 15e3
    });
    await delay(3e3);
  } catch {
  }
  if (!await clickByText2("Tarjetas de Cr\xE9dito")) {
    debugLog.push("TC: 'Tarjetas de Cr\xE9dito' not found in sidebar");
    return false;
  }
  await delay(2e3);
  if (!await clickByText2("Consultas")) {
    debugLog.push("TC: 'Consultas' not found in submenu");
    return false;
  }
  await delay(1e3);
  if (!await clickByText2("Saldos y movimientos", false)) {
    debugLog.push("TC: 'Saldos y movimientos' link not found");
    return false;
  }
  await delay(5e3);
  debugLog.push("TC: Menu navigation OK");
  return true;
}
async function extractCreditCardInfo(page, debugLog) {
  const data = await page.evaluate(() => {
    const result = {};
    const brandEl = document.querySelector("p.subheading.semibold");
    const numberEl = document.querySelector("p.format-number");
    if (brandEl && numberEl) {
      const brand = brandEl.textContent?.trim() || "";
      const last4 = numberEl.textContent?.trim() || "";
      result.label = `${brand}${last4}`;
    } else {
      const allP = document.querySelectorAll("p");
      for (const p of allP) {
        const t = p.innerText?.trim() || "";
        if (/^(Visa|Mastercard|Amex)/i.test(t) && /\d{4}/.test(t) && t.length < 50) {
          result.label = t;
          break;
        }
      }
    }
    const parseAmount = (text) => {
      const clean = text.replace(/[^0-9,.-]/g, "").replace(/\./g, "").replace(",", ".");
      const num = parseFloat(clean);
      return isNaN(num) ? void 0 : Math.round(num);
    };
    const charts = document.querySelectorAll("app-progression-chart");
    for (const chart of charts) {
      const title = chart.querySelector("h4.chart-title")?.textContent?.trim() || "";
      const allText2 = chart.innerText || "";
      const totalMatch = allText2.match(/Cupo Total:\s*(?:\$|US\$)?([\d.,]+)/i);
      const usedMatch = allText2.match(/Cupo utilizado\s*(?:\$|US\$)?\s*([\d.,]+)/i);
      const availMatch = allText2.match(/Cupo disponible\s*(?:\$|US\$)?\s*([\d.,]+)/i);
      if (title === "Nacional") {
        if (usedMatch) result.nationalUsed = parseAmount(usedMatch[1]);
        if (availMatch) result.nationalAvailable = parseAmount(availMatch[1]);
        if (totalMatch) result.nationalTotal = parseAmount(totalMatch[1]);
      } else if (title === "Internacional") {
        if (usedMatch) result.internationalUsed = parseAmount(usedMatch[1]);
        if (availMatch) result.internationalAvailable = parseAmount(availMatch[1]);
        if (totalMatch) result.internationalTotal = parseAmount(totalMatch[1]);
      }
    }
    const allText = document.body.innerText || "";
    const billingMatch = allText.match(/Facturación:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    const dueMatch = allText.match(/Vencimiento:\s*(\d{1,2}\s+\w+\s+\d{4})/i);
    if (billingMatch) result.billingPeriod = billingMatch[1];
    if (dueMatch) result.nextBillingDate = dueMatch[1];
    return result;
  });
  const ccBalance = {
    label: data.label || "Tarjeta de Cr\xE9dito BICE"
  };
  if (data.nationalUsed !== void 0 || data.nationalAvailable !== void 0 || data.nationalTotal !== void 0) {
    ccBalance.national = {
      used: data.nationalUsed || 0,
      available: data.nationalAvailable || 0,
      total: data.nationalTotal || 0
    };
  }
  if (data.internationalUsed !== void 0 || data.internationalAvailable !== void 0 || data.internationalTotal !== void 0) {
    ccBalance.international = {
      used: data.internationalUsed || 0,
      available: data.internationalAvailable || 0,
      total: data.internationalTotal || 0,
      currency: "USD"
    };
  }
  if (data.billingPeriod) ccBalance.billingPeriod = data.billingPeriod;
  if (data.nextBillingDate) ccBalance.nextBillingDate = data.nextBillingDate;
  debugLog.push(`TC: Card=${ccBalance.label}, Nacional used=${ccBalance.national?.used}, Intl used=${ccBalance.international?.used}`);
  return { balance: ccBalance, movements: [] };
}
async function extractTcMovementsFromPage(page, source) {
  const raw = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll("app-transaction-row");
    for (const row of rows) {
      const dateEl = row.querySelector("div.date");
      const date = dateEl?.textContent?.trim() || "";
      if (!/^\d{1,2}\s/.test(date)) continue;
      const descEl = row.querySelector("div.transaction-detail, div.transaction-detail.transaction-state");
      const description = descEl?.textContent?.trim() || "";
      const instEl = row.querySelector("div.transaction-installments");
      const installments = instEl?.textContent?.trim() || "";
      const amtEl = row.querySelector("span.transaction-amount");
      const amount = amtEl?.textContent?.trim() || "";
      if (date && description && amount) {
        results.push({ date, description, amount, installments });
      }
    }
    return results;
  });
  return raw.map((r) => {
    const amountVal = parseChileanAmount(r.amount);
    if (amountVal === 0) return null;
    const descLower = r.description.toLowerCase();
    const isCredit = descLower.includes("abono") || /\bpago\b/.test(descLower) || descLower.includes("nota de credito") || descLower.includes("nota de cr\xE9dito") || descLower.includes("reverso") || descLower.includes("anulacion") || descLower.includes("anulaci\xF3n");
    const amount = isCredit ? amountVal : -amountVal;
    return {
      date: normalizeDate(r.date),
      description: r.description,
      amount,
      balance: 0,
      source,
      installments: r.installments && r.installments !== "1 de 1" ? r.installments : void 0
    };
  }).filter(Boolean);
}
async function clickTcTab(page, tabText) {
  const clicked = await page.evaluate((text) => {
    const items = document.querySelectorAll("div, button, span");
    for (const item of items) {
      const el = item;
      const directText = Array.from(el.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE || n.children?.length === 0).map((n) => n.textContent?.trim()).filter(Boolean).join(" ").trim();
      if (directText.includes(text)) {
        el.click();
        return true;
      }
    }
    return false;
  }, tabText);
  if (clicked) await delay(3e3);
  return clicked;
}
async function clickBilledPeriod(page, periodIndex) {
  const clicked = await page.evaluate((idx) => {
    const buttons = document.querySelectorAll('button[role="tab"], button');
    const periodButtons = Array.from(buttons).filter((btn) => {
      const text = btn.innerText?.trim() || "";
      return text.includes("Periodo de facturaci\xF3n");
    });
    if (idx >= periodButtons.length) return false;
    periodButtons[idx].click();
    return true;
  }, periodIndex);
  if (clicked) await delay(3e3);
  return clicked;
}
async function scrapeBice(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const bank = "bice";
  const progress = onProgress || (() => {
  });
  progress("Abriendo sitio del banco...");
  const loginResult = await login(page, rut, password, debugLog, doSave);
  if (!loginResult.success) {
    return { success: false, bank, accounts: [], error: loginResult.error, screenshot: loginResult.screenshot, debug: debugLog.join("\n") };
  }
  progress("Sesi\xF3n iniciada correctamente");
  const activePage = loginResult.activePage || page;
  await dismissAdPopup(activePage, debugLog);
  await closePopups(activePage);
  const balance = await activePage.evaluate(() => {
    const el = document.querySelector("h2.cabeceraCard2");
    if (!el) return void 0;
    const text = el.innerText?.trim();
    if (!text) return void 0;
    const val = parseInt(text.replace(/[^0-9]/g, ""), 10);
    return isNaN(val) ? void 0 : val;
  });
  debugLog.push(`  Balance: ${balance !== void 0 ? `$${balance.toLocaleString("es-CL")}` : "not found"}`);
  progress("Navegando a movimientos...");
  debugLog.push("9. Navigating to movements...");
  const link = await activePage.$("a.ultimosMov");
  if (!link) {
    const ss2 = await activePage.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se pudo navegar a movimientos", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await link.click();
  try {
    await activePage.waitForSelector("div.transaction-table__container", { timeout: 15e3 });
  } catch {
  }
  await delay(2e3);
  await doSave(activePage, "05-movements-page");
  progress("Extrayendo movimientos del mes actual...");
  const movements = await bicePaginate(activePage, extractCurrentMonthMovements);
  debugLog.push(`10. Current month: ${movements.length} movements`);
  progress(`Mes actual: ${movements.length} movimientos`);
  const months = Math.min(Math.max(parseInt(process.env.BICE_MONTHS || "0", 10) || 0, 0), 16);
  if (months > 0) {
    debugLog.push(`11. Fetching ${months} historical period(s)...`);
    progress(`Extrayendo ${months} periodo(s) hist\xF3rico(s)...`);
    const clicked = await activePage.evaluate(() => {
      const links = document.querySelectorAll("div.transactions-summary__link");
      for (const link2 of links) {
        if (link2.innerText?.includes("Revisar periodos anteriores")) {
          link2.click();
          return true;
        }
      }
      return false;
    });
    if (clicked) {
      try {
        await activePage.waitForSelector('ds-dropdown[toplabel="Elige un periodo"]', { timeout: 1e4 });
      } catch {
      }
      await delay(2e3);
      const firstMovements = await bicePaginate(activePage, (p) => extractHistoricalMovements(p, debugLog));
      debugLog.push(`  Period 1: ${firstMovements.length} movements`);
      movements.push(...firstMovements);
      for (let i = 1; i < months; i++) {
        if (!await selectPeriod(activePage, i, debugLog)) break;
        const hist = await bicePaginate(activePage, (p) => extractHistoricalMovements(p, debugLog));
        debugLog.push(`  Period ${i + 1}: ${hist.length} movements`);
        movements.push(...hist);
      }
    }
  }
  const deduplicated = deduplicateMovements(movements);
  debugLog.push(`  Total: ${deduplicated.length} unique movements`);
  progress(`Listo \u2014 ${deduplicated.length} movimientos totales`);
  let creditCards;
  debugLog.push("TC: Starting credit card extraction...");
  progress("Extrayendo movimientos de tarjeta de cr\xE9dito...");
  const tcNav = await navigateToTcMovements(activePage, debugLog);
  if (tcNav) {
    debugLog.push("TC: Waiting for transaction data to load...");
    try {
      await activePage.waitForSelector("app-transaction-row", { timeout: 2e4 });
      debugLog.push("TC: Transaction rows appeared");
    } catch {
      debugLog.push("TC: Transaction rows did not appear after 20s, trying anyway...");
    }
    await delay(2e3);
    await doSave(activePage, "06-tc-page");
    const ccInfo = await extractCreditCardInfo(activePage, debugLog);
    if (ccInfo.balance) {
      creditCards = [ccInfo.balance];
    }
    const unbilled = await extractTcMovementsFromPage(activePage, MOVEMENT_SOURCE.credit_card_unbilled);
    debugLog.push(`TC: Unbilled movements: ${unbilled.length}`);
    movements.push(...unbilled);
    const tcMonths = Math.min(Math.max(parseInt(process.env.BICE_MONTHS || "0", 10) || 0, 0), 11);
    if (tcMonths > 0) {
      debugLog.push(`TC: Fetching ${tcMonths} billed period(s)...`);
      progress(`Extrayendo ${tcMonths} periodo(s) facturado(s) de TC...`);
      if (await clickTcTab(activePage, "Movimientos facturados")) {
        await doSave(activePage, "06b-tc-billed");
        await delay(2e3);
        for (let i = 0; i < tcMonths; i++) {
          if (!await clickBilledPeriod(activePage, i)) {
            debugLog.push(`TC: Period ${i + 1} not available`);
            break;
          }
          await delay(2e3);
          const billed = await extractTcMovementsFromPage(activePage, MOVEMENT_SOURCE.credit_card_billed);
          debugLog.push(`TC: Billed period ${i + 1}: ${billed.length} movements`);
          movements.push(...billed);
        }
      }
    }
  } else {
    debugLog.push("TC: Could not navigate to credit card section");
  }
  const finalMovements = deduplicateMovements(movements);
  debugLog.push(`  Final total: ${finalMovements.length} movements (${deduplicated.length} account + ${finalMovements.length - deduplicated.length} TC)`);
  progress(`Listo \u2014 ${finalMovements.length} movimientos totales`);
  await doSave(activePage, "07-final");
  const ss = doScreenshots ? await activePage.screenshot({ encoding: "base64", fullPage: true }) : void 0;
  return { success: true, bank, accounts: [{ balance: balance || void 0, movements: finalMovements }], creditCards, screenshot: ss, debug: debugLog.join("\n") };
}
var bice = {
  id: "bice",
  name: "Banco BICE",
  url: BANK_URL3,
  scrape: (options) => runScraper("bice", options, {}, scrapeBice)
};
var bice_default = bice;

// bank-api/vendor/upstream/src/actions/extraction.ts
async function extractRawMovements(ctx) {
  return await ctx.evaluate(() => {
    const results = [];
    const tables = Array.from(document.querySelectorAll("table"));
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) continue;
      let dateIndex = 0;
      let descriptionIndex = 1;
      let cargoIndex = -1;
      let abonoIndex = -1;
      let amountIndex = -1;
      let balanceIndex = -1;
      let hasHeader = false;
      for (const row of rows) {
        const headers = row.querySelectorAll("th");
        if (headers.length < 2) continue;
        const headerTexts = Array.from(headers).map(
          (h) => h.innerText?.trim().toLowerCase() || ""
        );
        if (!headerTexts.some((h) => h.includes("fecha"))) continue;
        hasHeader = true;
        dateIndex = headerTexts.findIndex((h) => h.includes("fecha"));
        descriptionIndex = headerTexts.findIndex(
          (h) => h.includes("descrip") || h.includes("detalle") || h.includes("glosa")
        );
        cargoIndex = headerTexts.findIndex(
          (h) => h.includes("cargo") || h.includes("d\xE9bito") || h.includes("debito")
        );
        abonoIndex = headerTexts.findIndex(
          (h) => h.includes("abono") || h.includes("cr\xE9dito") || h.includes("credito")
        );
        amountIndex = headerTexts.findIndex((h) => h === "monto" || h.includes("importe"));
        balanceIndex = headerTexts.findIndex((h) => h.includes("saldo"));
        break;
      }
      if (!hasHeader) continue;
      let lastDate = "";
      for (const row of rows) {
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;
        const values = Array.from(cells).map((c) => c.innerText?.trim() || "");
        const rawDate = values[dateIndex] || "";
        const hasDate = /^\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?$/.test(rawDate);
        const date = hasDate ? rawDate : lastDate;
        if (!date) continue;
        if (hasDate) lastDate = rawDate;
        const description = descriptionIndex >= 0 ? values[descriptionIndex] || "" : "";
        let amount = "";
        if (cargoIndex >= 0 && values[cargoIndex]) {
          amount = `-${values[cargoIndex]}`;
        } else if (abonoIndex >= 0 && values[abonoIndex]) {
          amount = values[abonoIndex];
        } else if (amountIndex >= 0) {
          amount = values[amountIndex] || "";
        }
        const balance = balanceIndex >= 0 ? values[balanceIndex] || "" : "";
        if (!amount) continue;
        results.push({ date, description, amount, balance });
      }
    }
    if (results.length === 0) {
      const cards = document.querySelectorAll(
        "[class*='mov'], [class*='tran'], li, article, section"
      );
      for (const card of cards) {
        const text = card.innerText || "";
        const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.length < 3 || lines.length > 10) continue;
        const date = lines.find((l) => /\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/.test(l));
        const amount = lines.find((l) => /[$]\s*[\d.]+/.test(l));
        if (!date || !amount) continue;
        const description = lines.find((l) => l !== date && l !== amount && l.length > 3) || "";
        const balance = lines.find(
          (l) => l.toLowerCase().includes("saldo") && /[$]\s*[\d.]+/.test(l)
        ) || "";
        const normalizedAmount = text.toLowerCase().includes("cargo") || text.toLowerCase().includes("d\xE9bito") || text.toLowerCase().includes("debito") || amount.includes("-") ? `-${amount}` : amount;
        results.push({ date, description, amount: normalizedAmount, balance });
      }
    }
    return results;
  });
}
function parseRawMovements(raw, source) {
  const parsed = raw.map((m) => {
    const amount = parseChileanAmount(m.amount);
    if (amount === 0) return null;
    const balance = m.balance ? parseChileanAmount(m.balance) : 0;
    return {
      date: normalizeDate(m.date),
      description: m.description,
      amount,
      balance,
      source
    };
  }).filter(Boolean);
  return deduplicateMovements(parsed);
}
async function extractAccountMovements(ctx) {
  const raw = await extractRawMovements(ctx);
  return parseRawMovements(raw, MOVEMENT_SOURCE.account);
}

// bank-api/vendor/upstream/src/actions/balance.ts
var DEFAULT_PATTERNS = [
  /saldo disponible[^\d$-]*\$\s*([\d.]+)/i,
  /saldo actual[^\d$-]*\$\s*([\d.]+)/i,
  /saldo cuenta[^\d$-]*\$\s*([\d.]+)/i,
  /cuenta corriente[\s\S]{0,80}\$\s*([\d.]+)/i,
  /cuenta vista[\s\S]{0,80}\$\s*([\d.]+)/i
];
var DEFAULT_SELECTORS = [
  '[class*="amount"]',
  '[class*="saldo"]',
  "#cuentas strong",
  "#cuentas b"
];
async function extractBalance(page, customPatterns, customSelectors) {
  const patterns = (customPatterns || DEFAULT_PATTERNS).map((p) => ({
    source: p.source,
    flags: p.flags
  }));
  const selectors = customSelectors || DEFAULT_SELECTORS;
  return await page.evaluate(
    (pats, sels) => {
      const text = document.body?.innerText || "";
      for (const pat of pats) {
        const regex = new RegExp(pat.source, pat.flags);
        const match = text.match(regex);
        if (match && match[1]) {
          const value = parseInt(match[1].replace(/[^0-9]/g, ""), 10);
          if (!Number.isNaN(value)) return value;
        }
      }
      for (const selector of sels) {
        const elements = Array.from(document.querySelectorAll(selector));
        for (const element of elements) {
          const value = element.innerText?.trim() || "";
          if (!/^\$?\s*[\d.]+$/.test(value)) continue;
          const amount = parseInt(value.replace(/[^0-9]/g, ""), 10);
          if (!Number.isNaN(amount) && amount > 0) return amount;
        }
      }
      return void 0;
    },
    patterns,
    selectors
  );
}

// bank-api/vendor/upstream/src/actions/credit-card.ts
function isSaldoInicial(description) {
  return /saldo\s+inicial/i.test(description);
}
function isCreditCardCredit(description) {
  const text = description.toLowerCase();
  return text.includes("abono") || text.includes("cancelado") || text.includes("nota de credito") || text.includes("nota de cr\xE9dito") || text.includes("reverso") || /^pago\b/.test(text);
}
async function clickTcTab2(page, tabText, delayMs = 3e3) {
  const clicked = await page.evaluate((text) => {
    const items = Array.from(document.querySelectorAll("button, a, div, span"));
    for (const item of items) {
      const content = item.innerText?.trim().toLowerCase() || "";
      if (content !== text) continue;
      item.click();
      return true;
    }
    return false;
  }, tabText);
  if (!clicked) return false;
  await delay(delayMs);
  return true;
}
async function extractCreditCardMovements(page, tab) {
  const raw = await page.evaluate(() => {
    const table = Array.from(document.querySelectorAll("table")).find((t) => {
      const headerText = Array.from(t.querySelectorAll("th")).map((th) => th.innerText?.trim().toLowerCase() || "").join("|");
      return headerText.includes("fecha") && headerText.includes("detalle") && headerText.includes("monto");
    });
    if (!table) return [];
    const headers = Array.from(table.querySelectorAll("th")).map(
      (th) => th.innerText?.trim().toLowerCase() || ""
    );
    const dateIndex = headers.findIndex((h) => h.includes("fecha"));
    const detailIndex = headers.findIndex(
      (h) => h.includes("detalle") || h.includes("descrip") || h.includes("glosa")
    );
    const cargoIndex = headers.findIndex((h) => h.includes("cargo"));
    const abonoIndex = headers.findIndex((h) => h.includes("abono"));
    const amountIndex = headers.findIndex((h) => h === "monto" || h.includes("importe"));
    const rows = Array.from(table.querySelectorAll("tbody tr"));
    let lastDate = "";
    const out = [];
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td")).map(
        (td) => td.innerText?.trim() || ""
      );
      if (cells.length < 2) continue;
      const rawDate = dateIndex >= 0 ? cells[dateIndex] || "" : "";
      const hasDate = /^\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?$/.test(rawDate);
      const date = hasDate ? rawDate : lastDate;
      if (!date) continue;
      if (hasDate) lastDate = rawDate;
      const description = detailIndex >= 0 ? cells[detailIndex] || "" : "";
      if (isSaldoInicial(description)) continue;
      let amount = "";
      if (cargoIndex >= 0 && cells[cargoIndex]) {
        amount = `-${cells[cargoIndex]}`;
      } else if (abonoIndex >= 0 && cells[abonoIndex]) {
        amount = cells[abonoIndex];
      } else if (amountIndex >= 0 && cells[amountIndex]) {
        amount = cells[amountIndex];
      }
      if (!description || !amount) continue;
      out.push({ date, description, amount });
    }
    return out;
  });
  const source = tab === "unbilled" ? MOVEMENT_SOURCE.credit_card_unbilled : MOVEMENT_SOURCE.credit_card_billed;
  const movements = raw.map((row) => {
    const absAmount = Math.abs(parseChileanAmount(row.amount));
    if (absAmount === 0) return null;
    let amount = absAmount;
    if (row.amount.includes("-")) {
      amount = -absAmount;
    } else if (row.amount.includes("+")) {
      amount = absAmount;
    } else {
      amount = isCreditCardCredit(row.description) ? absAmount : -absAmount;
    }
    return {
      date: normalizeDate(row.date),
      description: row.description.trim(),
      amount,
      balance: 0,
      source
    };
  }).filter(Boolean);
  return deduplicateMovements(movements);
}

// bank-api/vendor/upstream/src/banks/edwards.ts
var BANK_URL4 = "https://portalpersonas.bancochile.cl/persona/";
var NAV_TARGETS = [
  { text: "saldos y mov. cuentas", exact: false },
  { text: "saldos y mov. tarjetas", exact: false },
  { text: "cartola", exact: false },
  { text: "\xFAltimos movimientos", exact: false },
  { text: "movimientos", exact: true },
  { text: "estado de cuenta", exact: false },
  { text: "historial", exact: false }
];
async function clickNavTarget(page, debugLog) {
  for (const target of NAV_TARGETS) {
    const result = await page.evaluate((t) => {
      const elements = Array.from(document.querySelectorAll("a, button, [role='tab'], [role='menuitem'], li, span"));
      for (const el of elements) {
        const text = el.innerText?.trim().toLowerCase() || "";
        const match = t.exact ? text === t.text : text.includes(t.text);
        if (match && text.length < 50) {
          el.click();
          return `Clicked: "${text}"`;
        }
      }
      return null;
    }, target);
    if (result) {
      debugLog.push(`  ${result}`);
      await delay(4e3);
      return true;
    }
  }
  return false;
}
async function tryExpandDateRange(page, debugLog) {
  try {
    const selectInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      return selects.map((sel, i) => ({
        index: i,
        name: sel.name || sel.id || `select-${i}`,
        options: Array.from(sel.querySelectorAll("option")).map((o) => ({ text: o.text.trim(), value: o.value }))
      }));
    });
    for (const sel of selectInfo) {
      for (const opt of sel.options) {
        const text = opt.text.toLowerCase();
        if (text.includes("todos") || text.includes("\xFAltimo mes") || text.includes("30 d\xEDa") || text.includes("60 d\xEDa") || text.includes("90 d\xEDa") || text.includes("6 mes") || text.includes("3 mes") || text.includes("mes anterior")) {
          await page.evaluate((selIdx, optValue) => {
            const selects = document.querySelectorAll("select");
            const select = selects[selIdx];
            if (select) {
              select.value = optValue;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, sel.index, opt.value);
          debugLog.push(`  Changed [${sel.name}] to "${opt.text}"`);
          await delay(3e3);
          break;
        }
      }
    }
  } catch {
  }
}
async function edwardsPaginate(page, extractFn, debugLog) {
  const all = [];
  for (let i = 0; i < 50; i++) {
    all.push(...await extractFn(page));
    const clicked = await page.evaluate(() => {
      const matNext = document.querySelector(".mat-paginator-navigation-next:not([disabled])");
      if (matNext) {
        matNext.click();
        return true;
      }
      const bchNext = document.querySelector("bch-paginator button[aria-label*='siguiente'], bch-paginator button[aria-label*='next']");
      if (bchNext && !bchNext.disabled) {
        bchNext.click();
        return true;
      }
      const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
      for (const btn of candidates) {
        const text = btn.innerText?.trim().toLowerCase();
        if (text === "siguiente" || text === "\u203A" || text === ">" || text?.includes("ver m\xE1s")) {
          if (btn.disabled || btn.classList.contains("disabled")) return false;
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) break;
    await delay(3e3);
  }
  return deduplicateMovements(all);
}
async function scrapeEdwards(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const { onProgress } = options;
  const bank = "edwards";
  const progress = onProgress || (() => {
  });
  debugLog.push("1. Navigating to Banco Edwards...");
  progress("Abriendo sitio del banco...");
  await page.goto(BANK_URL4, { waitUntil: "load", timeout: 3e4 });
  await delay(5e3);
  await dismissBanners(page);
  await doSave(page, "01-loaded");
  const frames = page.frames();
  const bodyLen = await page.evaluate(() => document.body?.innerText?.length ?? 0);
  let loginCtx = page;
  if (bodyLen === 0 && frames.length > 1) {
    const f = frames.find((fr) => fr !== page.mainFrame() && fr.url() && !fr.url().startsWith("about:"));
    if (f) {
      loginCtx = f;
      debugLog.push("  Formulario en iframe");
    }
  }
  debugLog.push("2. Filling RUT...");
  progress("Ingresando RUT...");
  if (!await fillRut(loginCtx, rut)) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de RUT", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(1500);
  debugLog.push("3. Filling password...");
  let passOk = await fillPassword(page, password);
  if (!passOk) {
    await page.keyboard.press("Enter");
    await delay(3e3);
    passOk = await fillPassword(page, password);
  }
  if (!passOk) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de clave", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(1e3);
  debugLog.push("4. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  await clickSubmit(page, page);
  await delay(8e3);
  await doSave(page, "02-after-login");
  const loginError = await detectLoginError(page);
  if (loginError) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: `Error del banco: ${loginError}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("5. Login OK!");
  progress("Sesi\xF3n iniciada correctamente");
  await closePopups(page);
  debugLog.push("6. Looking for Cartola/Movimientos...");
  progress("Buscando cartola de cuenta...");
  let navigated = await clickNavTarget(page, debugLog);
  if (!navigated) {
    const clickedAccount = await page.evaluate(() => {
      for (const el of Array.from(document.querySelectorAll("a, div, button, tr, li"))) {
        const text = el.innerText?.trim() || "";
        if ((text.toLowerCase().includes("cuenta corriente") || text.toLowerCase().includes("cuenta vista") || text.toLowerCase().includes("cuenta")) && text.length < 100) {
          el.click();
          return true;
        }
      }
      return false;
    });
    if (clickedAccount) {
      await delay(4e3);
      navigated = await clickNavTarget(page, debugLog);
    }
  }
  await tryExpandDateRange(page, debugLog);
  let movements = await edwardsPaginate(page, extractAccountMovements, debugLog);
  movements = deduplicateMovements(movements);
  debugLog.push("7b. Navigating to Tarjetas de Cr\xE9dito...");
  progress("Navegando a tarjeta de cr\xE9dito...");
  const baseUrl = page.url().split("#")[0];
  await page.goto(`${baseUrl}#/home`, { waitUntil: "load", timeout: 15e3 });
  await delay(3e3);
  const TC_TARGETS = ["saldos y mov. tarjetas", "tarjetas cr\xE9dito"];
  let tcClicked = false;
  for (const t of TC_TARGETS) {
    const result = await page.evaluate((text) => {
      for (const el of Array.from(document.querySelectorAll("a, button, [role='tab'], [role='menuitem'], li, span"))) {
        const t2 = el.innerText?.trim().toLowerCase() || "";
        if (t2.includes(text) && t2.length < 50) {
          el.click();
          return true;
        }
      }
      return false;
    }, t);
    if (result) {
      tcClicked = true;
      await delay(4e3);
      break;
    }
  }
  if (tcClicked) {
    if (await clickTcTab2(page, "movimientos por facturar")) {
      const tcPorFact = await edwardsPaginate(page, (p) => extractCreditCardMovements(p, "unbilled"), debugLog);
      movements.push(...tcPorFact);
      debugLog.push(`  TC por facturar: ${tcPorFact.length}`);
    }
    if (await clickTcTab2(page, "movimientos facturados")) {
      const tcFact = await edwardsPaginate(page, (p) => extractCreditCardMovements(p, "billed"), debugLog);
      movements.push(...tcFact);
      debugLog.push(`  TC facturados: ${tcFact.length}`);
    }
    movements = deduplicateMovements(movements);
  }
  debugLog.push(`8. Extracted ${movements.length} movements`);
  progress(`Listo \u2014 ${movements.length} movimientos totales`);
  let balance;
  const withBalance = movements.find((m) => m.balance > 0);
  if (withBalance) balance = withBalance.balance;
  if (balance === void 0 || balance === 0) balance = await extractBalance(page);
  await doSave(page, "04-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64", fullPage: true }) : void 0;
  return { success: true, bank, accounts: [{ balance: balance || void 0, movements }], screenshot: ss, debug: debugLog.join("\n") };
}
var edwards = {
  id: "edwards",
  name: "Banco Edwards",
  url: BANK_URL4,
  scrape: (options) => runScraper("edwards", options, {}, scrapeEdwards)
};
var edwards_default = edwards;

// bank-api/vendor/upstream/src/banks/falabella.ts
import * as fs2 from "fs";
import * as path2 from "path";
import { chromium } from "playwright-core";
var BANK_URL5 = "https://www.bancofalabella.cl";
var MAX_PAGES = 20;
var CMR_WAIT_MS = 3e4;
async function launchPlaywright(options) {
  const { chromePath, headful, onDebug } = options;
  const debugLog = onDebug ? new DebugLog(onDebug) : [];
  const execPath = findChrome(chromePath);
  if (!execPath) {
    throw new Error(
      "No se encontr\xF3 Chrome/Chromium. Instala Google Chrome o pasa chromePath.\n  Ubuntu/Debian: sudo apt install google-chrome-stable\n  macOS: brew install --cask google-chrome"
    );
  }
  const browser = await chromium.launch({
    executablePath: execPath,
    headless: !headful,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-notifications"
    ]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });
  const page = await context.newPage();
  return { browser, page, debugLog };
}
async function screenshotIfEnabled(page, name, enabled, debugLog) {
  if (!enabled) return void 0;
  const safeName = name.replace(/[/\\:*?"<>|]/g, "_");
  const dir = path2.resolve("screenshots");
  if (!fs2.existsSync(dir)) fs2.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path2.join(dir, `${safeName}.png`), fullPage: true });
  debugLog.push(`  Screenshot: ${safeName}.png`);
  return void 0;
}
async function login2(page, rut, password, debugLog, doScreenshots, progress) {
  debugLog.push("1. Navigating to bank homepage...");
  progress("Abriendo sitio del banco...");
  await page.goto(BANK_URL5, { waitUntil: "networkidle" });
  await delay(2e3);
  try {
    const acceptBtn = page.locator("button, a").filter({ hasText: /^(Aceptar|Entendido|Continuar)$/i }).first();
    if (await acceptBtn.isVisible({ timeout: 2e3 }).catch(() => false)) await acceptBtn.click();
  } catch {
  }
  await screenshotIfEnabled(page, "01-homepage", doScreenshots, debugLog);
  debugLog.push("2. Clicking 'Mi cuenta'...");
  progress("Ingresando a Mi cuenta...");
  try {
    let opened = false;
    for (const selector of ["#btn-auth-normal", "#btn-auth"]) {
      const entry = page.locator(selector).first();
      if (await entry.isVisible().catch(() => false)) {
        await entry.click({ timeout: 5e3 });
        opened = true;
        break;
      }
    }
    if (!opened) await page.getByRole("button", { name: /^mi cuenta$/i }).first().click({ timeout: 5e3 });
  } catch {
  }
  await page.waitForLoadState("networkidle").catch(() => {
  });
  await delay(3e3);
  await screenshotIfEnabled(page, "02-login-form", doScreenshots, debugLog);
  debugLog.push("3. Filling RUT...");
  progress("Ingresando RUT...");
  const rutInput = page.getByRole("textbox", { name: "RUT", exact: true }).or(page.locator('input[name*="rut"], input[id*="rut"], input[placeholder*="RUT"]').first());
  try {
    await rutInput.fill(rut, { timeout: 1e4 });
  } catch {
    const ss = (await page.screenshot()).toString("base64");
    return { success: false, error: "No se encontr\xF3 campo de RUT", screenshot: ss };
  }
  await delay(1e3);
  if (!await page.locator('input[type="password"]').first().isVisible().catch(() => false)) {
    await page.keyboard.press("Enter");
    await delay(2e3);
  }
  debugLog.push("4. Filling password...");
  progress("Ingresando clave...");
  const pwdInput = page.locator('input[type="password"]').first().or(page.getByRole("textbox", { name: /[Cc]lave/ }).first());
  try {
    await pwdInput.fill(password, { timeout: 1e4 });
  } catch {
    const ss = (await page.screenshot()).toString("base64");
    return { success: false, error: "No se encontr\xF3 campo de clave", screenshot: ss };
  }
  await delay(500);
  debugLog.push("5. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  const submitBtn = page.locator('button[type="submit"], input[type="submit"]').first().or(page.getByRole("button", { name: /ingresar|entrar|btn-md/i }).first());
  try {
    await submitBtn.click({ timeout: 3e3 });
  } catch {
    await page.keyboard.press("Enter");
  }
  await page.waitForLoadState("networkidle").catch(() => {
  });
  await delay(8e3);
  await screenshotIfEnabled(page, "03-after-login", doScreenshots, debugLog);
  try {
    const closeBtn = page.getByRole("button", { name: "cerrar", exact: true });
    if (await closeBtn.isVisible({ timeout: 2e3 }).catch(() => false)) await closeBtn.click();
  } catch {
  }
  try {
    const retryBtn = page.getByText("Reintentar");
    if (await retryBtn.isVisible({ timeout: 2e3 }).catch(() => false)) {
      await retryBtn.click();
      await delay(5e3);
    }
  } catch {
  }
  const content = await page.content();
  if (content.toLowerCase().includes("clave din\xE1mica") || content.toLowerCase().includes("segundo factor")) {
    const ss = (await page.screenshot()).toString("base64");
    return { success: false, error: "El banco pide clave din\xE1mica (2FA).", screenshot: ss };
  }
  const errorText = await page.locator('[class*="error"], [class*="alert"], [role="alert"]').first().textContent({ timeout: 2e3 }).catch(() => null);
  if (errorText && errorText.trim().length > 5 && errorText.trim().length < 200) {
    const ss = (await page.screenshot()).toString("base64");
    return { success: false, error: `Error del banco: ${errorText.trim()}`, screenshot: ss };
  }
  debugLog.push("6. Login OK!");
  progress("Sesi\xF3n iniciada correctamente");
  return { success: true };
}
async function scrapeAccountMovements(page, debugLog, doScreenshots, progress) {
  debugLog.push("7. [Cuenta] Looking for account...");
  progress("Buscando cartola de cuenta...");
  const ccLink = page.getByRole("link", { name: /Cuenta Corriente \d/ });
  let navigated = false;
  if (await ccLink.isVisible({ timeout: 5e3 }).catch(() => false)) {
    await ccLink.click();
    await page.waitForLoadState("networkidle").catch(() => {
    });
    await delay(3e3);
    navigated = true;
  }
  if (!navigated) {
    for (const text of ["cartola", "\xFAltimos movimientos", "movimientos", "estado de cuenta"]) {
      const link = page.locator("a, button, [role='tab']").filter({ hasText: new RegExp(text, "i") }).first();
      if (await link.isVisible({ timeout: 2e3 }).catch(() => false)) {
        try {
          await link.click();
          await delay(4e3);
          navigated = true;
          break;
        } catch {
        }
      }
    }
  }
  if (!navigated) {
    const acctEl = page.locator("a, div, button").filter({ hasText: /cuenta corriente|cuenta vista/i }).first();
    if (await acctEl.isVisible({ timeout: 3e3 }).catch(() => false)) {
      await acctEl.click();
      await delay(4e3);
    }
  }
  await screenshotIfEnabled(page, "05-account-movements", doScreenshots, debugLog);
  await tryExpandDateRange2(page, debugLog);
  progress("Extrayendo movimientos de cuenta...");
  const movements = await paginateAccountMovements(page, debugLog);
  debugLog.push(`8. [Cuenta] Extracted ${movements.length} movements`);
  progress(`Cuenta: ${movements.length} movimientos encontrados`);
  let balance;
  if (movements.length > 0 && movements[0].balance > 0) {
    balance = movements[0].balance;
  }
  if (balance === void 0) {
    const bodyText = await page.locator("body").textContent().catch(() => "");
    const match = bodyText?.match(/Saldo disponible[\s\S]{0,50}\$\s*([\d.]+)/i);
    if (match) balance = parseInt(match[1].replace(/[^0-9]/g, ""), 10);
  }
  return { movements, balance };
}
async function tryExpandDateRange2(page, debugLog) {
  try {
    const selects = page.locator("select");
    const count = await selects.count();
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const options = await sel.locator("option").allTextContents();
      for (const text of options) {
        const lower = text.toLowerCase();
        if (lower.includes("todos") || lower.includes("\xFAltimo mes") || lower.includes("30 d\xEDa") || lower.includes("mes anterior")) {
          await sel.selectOption({ label: text });
          debugLog.push(`  Changed select to "${text}"`);
          await delay(3e3);
          break;
        }
      }
    }
  } catch {
  }
}
async function extractMovementsFromPage(page) {
  return page.evaluate(() => {
    const results = [];
    const tables = Array.from(document.querySelectorAll("table"));
    for (const table of tables) {
      const rows = Array.from(table.querySelectorAll("tr"));
      if (rows.length < 2) continue;
      let dateIdx = 0, descIdx = 1, cargoIdx = -1, abonoIdx = -1, amountIdx = -1, balanceIdx = -1;
      let hasHeader = false;
      for (const row of rows) {
        const headers = row.querySelectorAll("th");
        if (headers.length < 2) continue;
        const hTexts = Array.from(headers).map((h) => h.innerText?.trim().toLowerCase() || "");
        if (!hTexts.some((h) => h.includes("fecha"))) continue;
        hasHeader = true;
        dateIdx = hTexts.findIndex((h) => h.includes("fecha"));
        descIdx = hTexts.findIndex((h) => h.includes("descrip") || h.includes("detalle") || h.includes("glosa"));
        cargoIdx = hTexts.findIndex((h) => h.includes("cargo") || h.includes("d\xE9bito"));
        abonoIdx = hTexts.findIndex((h) => h.includes("abono") || h.includes("cr\xE9dito"));
        amountIdx = hTexts.findIndex((h) => h === "monto" || h.includes("importe"));
        balanceIdx = hTexts.findIndex((h) => h.includes("saldo"));
        break;
      }
      if (!hasHeader) continue;
      let lastDate = "";
      for (const row of rows) {
        let parseCLP = function(text) {
          const clean = text.replace(/[^0-9.,-]/g, "");
          if (!clean) return 0;
          const isNeg = clean.startsWith("-") || text.includes("-$");
          const norm = clean.replace(/-/g, "").replace(/\./g, "").replace(",", ".");
          const val = parseInt(norm, 10) || 0;
          return isNeg ? -val : val;
        };
        const cells = row.querySelectorAll("td");
        if (cells.length < 3) continue;
        const vals = Array.from(cells).map((c) => c.innerText?.trim() || "");
        const rawDate = vals[dateIdx] || "";
        const hasDate = /^\d{1,2}[\/.\-]\d{1,2}([\/.\-]\d{2,4})?$/.test(rawDate);
        const date = hasDate ? rawDate : lastDate;
        if (!date) continue;
        if (hasDate) lastDate = rawDate;
        const description = descIdx >= 0 ? vals[descIdx] || "" : "";
        let amountStr = "";
        if (cargoIdx >= 0 && vals[cargoIdx]?.replace(/\s/g, "")) {
          amountStr = `-${vals[cargoIdx]}`;
        } else if (abonoIdx >= 0 && vals[abonoIdx]?.replace(/\s/g, "")) {
          amountStr = vals[abonoIdx];
        } else if (amountIdx >= 0) {
          amountStr = vals[amountIdx] || "";
        }
        if (!amountStr) continue;
        const balStr = balanceIdx >= 0 ? vals[balanceIdx] || "" : "";
        results.push({
          date,
          description,
          amount: parseCLP(amountStr),
          balance: parseCLP(balStr),
          source: "account"
        });
      }
    }
    return results;
  }).then(
    (raw) => raw.filter((m) => m.description || m.amount !== 0).map((m) => ({
      date: normalizeDate(m.date),
      description: m.description,
      amount: m.amount,
      balance: m.balance,
      source: MOVEMENT_SOURCE.account
    }))
  );
}
async function paginateAccountMovements(page, debugLog) {
  const all = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const movements = await extractMovementsFromPage(page);
    all.push(...movements);
    let clicked = false;
    for (const text of ["siguiente", "ver m\xE1s", "mostrar m\xE1s"]) {
      const btn = page.locator("button, a").filter({ hasText: new RegExp(text, "i") }).first();
      if (await btn.isVisible({ timeout: 1e3 }).catch(() => false)) {
        const disabled = await btn.isDisabled().catch(() => true);
        if (!disabled) {
          await btn.click();
          await delay(2500);
          clicked = true;
          debugLog.push(`  Pagination: loaded page ${i + 2}`);
          break;
        }
      }
    }
    if (!clicked) break;
  }
  return deduplicateMovements(all);
}
async function scrapeCreditCard(page, debugLog, doScreenshots, progress, ownerFilter) {
  const creditCard = { label: "CMR" };
  const allMovements = [];
  debugLog.push("9. [CMR] Looking for CMR card...");
  progress("Navegando a tarjeta de cr\xE9dito...");
  const cupoData = await extractCupos(page, debugLog);
  if (cupoData) Object.assign(creditCard, cupoData);
  const cmrLink = page.getByRole("link", { name: /CMR/ }).first().or(page.locator("#cardDetail0, [id^='cardDetail']").first()).or(page.locator("a, button, div").filter({ hasText: /CMR/i }).first());
  if (!await cmrLink.isVisible({ timeout: 5e3 }).catch(() => false)) {
    debugLog.push("  [CMR] No CMR card found on dashboard");
    return { movements: [], creditCard };
  }
  await cmrLink.click();
  await page.waitForLoadState("networkidle").catch(() => {
  });
  await delay(5e3);
  await screenshotIfEnabled(page, "06-cmr-card", doScreenshots, debugLog);
  await waitForCmrContent(page, CMR_WAIT_MS);
  if (ownerFilter !== "B") {
    await page.evaluate(({ host, value }) => {
      const shadowEl = document.querySelector(host);
      const root = shadowEl?.shadowRoot || document;
      const select = root.querySelector("select[name='searchownership']");
      if (select) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }, { host: "credit-card-movements", value: ownerFilter });
    await waitForCmrContent(page, CMR_WAIT_MS);
  }
  debugLog.push("10. [CMR] Extracting unbilled movements...");
  progress("Extrayendo movimientos TC por facturar...");
  const unbilledInfo = await extractUnbilledPeriodInfo(page);
  if (unbilledInfo.nextBillingDate) creditCard.nextBillingDate = normalizeDate(unbilledInfo.nextBillingDate);
  if (unbilledInfo.nextDueDate) creditCard.nextDueDate = normalizeDate(unbilledInfo.nextDueDate);
  if (unbilledInfo.periodExpenses !== void 0) creditCard.periodExpenses = unbilledInfo.periodExpenses;
  const unbilledMovements = await paginateCmrMovements(page, MOVEMENT_SOURCE.credit_card_unbilled, debugLog);
  debugLog.push(`  Unbilled: ${unbilledMovements.length} movements`);
  allMovements.push(...unbilledMovements);
  await screenshotIfEnabled(page, "07-cmr-no-facturados", doScreenshots, debugLog);
  debugLog.push("11. [CMR] Switching to facturados tab...");
  progress("Extrayendo movimientos TC facturados...");
  const tabClicked = await clickCmrTab(page, debugLog);
  if (tabClicked) {
    await delay(2e3);
    await waitForCmrContent(page, CMR_WAIT_MS);
    await delay(3e3);
    await screenshotIfEnabled(page, "07-cmr-facturados", doScreenshots, debugLog);
    const billedInfo = await extractBilledStatementInfo(page);
    if (billedInfo.billingDate && billedInfo.billedAmount && billedInfo.dueDate) {
      creditCard.lastStatement = {
        billingDate: normalizeDate(billedInfo.billingDate),
        billedAmount: billedInfo.billedAmount,
        dueDate: normalizeDate(billedInfo.dueDate),
        minimumPayment: billedInfo.minimumPayment
      };
      creditCard.billingPeriod = monthYearLabel(creditCard.lastStatement.billingDate);
    }
    const billedMovements = await paginateCmrMovements(page, MOVEMENT_SOURCE.credit_card_billed, debugLog);
    debugLog.push(`  Billed: ${billedMovements.length} movements`);
    allMovements.push(...billedMovements);
  }
  const cardMask = creditCard.label.match(/\*{4}\d{4}/)?.[0];
  const tagged = cardMask ? allMovements.map((m) => ({ ...m, card: cardMask })) : allMovements;
  creditCard.movements = deduplicateAcrossSources(deduplicateMovements(tagged));
  return { movements: creditCard.movements, creditCard };
}
async function waitForCmrContent(page, timeoutMs) {
  try {
    await page.waitForFunction((host) => {
      const el = document.querySelector(host);
      if (!el?.shadowRoot) return false;
      function collectAll(root) {
        const found = [root];
        for (const child of Array.from(root.querySelectorAll("*"))) {
          const sr = child.shadowRoot;
          if (sr) found.push(...collectAll(sr));
        }
        return found;
      }
      return collectAll(el.shadowRoot).some(
        (r) => r.querySelectorAll("table tbody tr td").length > 0
      );
    }, "credit-card-movements", { timeout: timeoutMs });
  } catch {
  }
  await delay(500);
}
async function extractCupos(page, debugLog) {
  try {
    const cupoData = await page.evaluate(() => {
      const text = document.body?.innerText || "";
      const labelMatch = text.match(/(CMR\s+\w+(?:\s+\w+)?)\s*\n?\s*[•·*\s]+\s*(\d{4})/i);
      const label = labelMatch ? `${labelMatch[1]} ****${labelMatch[2]}` : "";
      const cupoMatch = text.match(/\$([\d.,]+)\s*\n?\s*Cupo de compras/i);
      const usadoMatch = text.match(/\$([\d.,]+)\s*\n?\s*Cupo utilizado/i);
      const disponibleMatch = text.match(/\$([\d.,]+)\s*\n?\s*Cupo disponible/i);
      return { label, cupo: cupoMatch?.[1], usado: usadoMatch?.[1], disponible: disponibleMatch?.[1] };
    });
    if (!cupoData.cupo && !cupoData.disponible) return null;
    const total = cupoData.cupo ? parseChileanAmount(cupoData.cupo) : 0;
    const used = cupoData.usado ? parseChileanAmount(cupoData.usado) : 0;
    const available = cupoData.disponible ? parseChileanAmount(cupoData.disponible) : 0;
    debugLog.push(`  CMR cupos: total=$${total}, used=$${used}, available=$${available}`);
    return { label: cupoData.label || "CMR", national: { total, used, available } };
  } catch {
    return null;
  }
}
async function extractUnbilledPeriodInfo(page) {
  return page.evaluate((host) => {
    const shadowEl = document.querySelector(host);
    const topRoot = shadowEl?.shadowRoot || document;
    function collectAllRoots(root) {
      const found = [root];
      for (const el of Array.from(root.querySelectorAll("*"))) {
        const sr = el.shadowRoot;
        if (sr) found.push(...collectAllRoots(sr));
      }
      return found;
    }
    function extractFromSameDiv(root, label) {
      for (const div of Array.from(root.querySelectorAll("div"))) {
        const text = div.textContent?.trim() || "";
        if (text.toLowerCase().startsWith(label.toLowerCase())) {
          const rest = text.slice(label.length).trim();
          if (rest) return rest;
        }
      }
      return void 0;
    }
    function parseAmount(text) {
      if (!text) return void 0;
      const m = text.match(/\$([\d.,]+)/);
      if (!m) return void 0;
      return parseInt(m[1].replace(/\./g, "").replace(",", ""), 10) || void 0;
    }
    function extractDate(text) {
      if (!text) return void 0;
      const m = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      return m ? m[1] : void 0;
    }
    let billingRaw;
    let dueRaw;
    let expensesRaw;
    for (const root of collectAllRoots(topRoot)) {
      if (!billingRaw) billingRaw = extractFromSameDiv(root, "Pr\xF3xima facturaci\xF3n");
      if (!dueRaw) dueRaw = extractFromSameDiv(root, "Pr\xF3ximo vencimiento");
      if (!expensesRaw) expensesRaw = extractFromSameDiv(root, "Gastos del periodo");
    }
    return {
      nextBillingDate: extractDate(billingRaw),
      nextDueDate: extractDate(dueRaw),
      periodExpenses: parseAmount(expensesRaw)
    };
  }, "credit-card-movements");
}
async function extractBilledStatementInfo(page) {
  return page.evaluate((host) => {
    const shadowEl = document.querySelector(host);
    const topRoot = shadowEl?.shadowRoot || document;
    function collectAllRoots(root) {
      const found = [root];
      for (const el of Array.from(root.querySelectorAll("*"))) {
        const sr = el.shadowRoot;
        if (sr) found.push(...collectAllRoots(sr));
      }
      return found;
    }
    function findNextSiblingValue(root, labelText) {
      const divs = Array.from(root.querySelectorAll("div"));
      for (let i = 0; i < divs.length - 1; i++) {
        if ((divs[i].textContent?.trim() || "").toLowerCase() === labelText.toLowerCase()) {
          const val = divs[i + 1]?.textContent?.trim() || "";
          if (val) return val;
        }
      }
      return void 0;
    }
    function parseAmount(text) {
      if (!text) return void 0;
      const m = text.match(/\$([\d.,]+)/);
      if (!m) return void 0;
      return parseInt(m[1].replace(/\./g, "").replace(",", ""), 10) || void 0;
    }
    function extractDate(text) {
      if (!text) return void 0;
      const m = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      return m ? m[1] : void 0;
    }
    let billingDate;
    let billedAmount;
    let dueDate;
    let minimumPayment;
    for (const root of collectAllRoots(topRoot)) {
      if (!billingDate) billingDate = extractDate(findNextSiblingValue(root, "Fecha de facturaci\xF3n"));
      if (!billedAmount) billedAmount = parseAmount(findNextSiblingValue(root, "Monto facturado"));
      if (!dueDate) dueDate = extractDate(findNextSiblingValue(root, "Fecha de vencimiento"));
      if (!minimumPayment) minimumPayment = parseAmount(findNextSiblingValue(root, "Pago minimo"));
    }
    return { billingDate, billedAmount, dueDate, minimumPayment };
  }, "credit-card-movements");
}
async function clickCmrTab(page, debugLog) {
  const result = await page.evaluate(({ host, radioId }) => {
    const shadowEl = document.querySelector(host);
    const roots = [];
    if (shadowEl?.shadowRoot) roots.push(shadowEl.shadowRoot);
    roots.push(document);
    for (const root of roots) {
      const radio = root.querySelector(`#${radioId}`);
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event("change", { bubbles: true }));
        radio.click();
        const label = root.querySelector(`label[for="${radio.id}"]`) ?? radio.closest("label");
        if (label) label.click();
        return `radio#${radio.id}`;
      }
    }
    for (const root of roots) {
      for (const label of Array.from(root.querySelectorAll("label"))) {
        if (!label.innerText?.trim().toLowerCase().includes("facturado")) continue;
        const forId = label.getAttribute("for");
        const radio = forId ? root.querySelector(`#${forId}`) : label.querySelector("input[type='radio']");
        if (radio) {
          radio.checked = true;
          radio.dispatchEvent(new Event("change", { bubbles: true }));
          radio.click();
        }
        label.click();
        return `label: "${label.innerText.trim()}"`;
      }
    }
    return null;
  }, { host: "credit-card-movements", radioId: "invoicedMovements" });
  if (result) debugLog.push(`  CMR: Clicked facturados tab via ${result}`);
  return result !== null;
}
async function paginateCmrMovements(page, source, debugLog) {
  const all = [];
  const host = "credit-card-movements";
  for (let i = 0; i < MAX_PAGES; i++) {
    const result = await page.evaluate(
      ({ host: h, src, isBilled: isBilled2 }) => {
        const shadowEl = document.querySelector(h);
        const topRoot = shadowEl?.shadowRoot || document;
        function collectAll(root) {
          const found = root instanceof Document ? [] : [root];
          for (const el of Array.from(root.querySelectorAll("*"))) {
            const sr = el.shadowRoot;
            if (sr) found.push(...collectAll(sr));
          }
          return found;
        }
        const roots = collectAll(topRoot);
        const allTables = roots.flatMap(
          (r) => Array.from(r.querySelectorAll("table"))
        );
        function isVisible(t) {
          const r = t.getBoundingClientRect();
          return r.width > 0 || r.height > 0;
        }
        const rows = [];
        const tablesToUse = isBilled2 ? allTables.filter((t) => {
          if (!isVisible(t)) return false;
          const hdr = t.querySelector("thead, tr:first-child")?.innerText?.toLowerCase() ?? "";
          return hdr.includes("fecha de compra") || hdr.includes("monto total") || hdr.includes("cuota a pagar");
        }) : allTables.filter((t) => isVisible(t));
        const finalTables = tablesToUse.length > 0 ? tablesToUse : allTables.filter((t) => isVisible(t) && !t.closest("app-last-movements"));
        for (const table of finalTables) {
          for (const row of Array.from(table.querySelectorAll("tbody tr"))) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 4) continue;
            const texts = Array.from(cells).map((c) => c.innerText?.trim() || "");
            const dateMatch = texts[0]?.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
            const pendingImg = row.querySelector("td:first-child img[alt*='pendiente'], td:first-child .td-time-img");
            if (!dateMatch && !pendingImg && texts[0] !== "") continue;
            const date = dateMatch ? dateMatch[1].replace(/\//g, "-") : "pendiente";
            const description = texts[1] || "";
            const totalText = texts[3] || "";
            const cuotaText = texts[5] || "";
            const montoText = cuotaText || totalText;
            const isNeg = montoText.includes("-$");
            const amountMatch = montoText.match(/\$\s*([\d.,]+)/);
            let amount = 0;
            if (amountMatch) {
              const value = parseInt(amountMatch[1].replace(/\./g, "").replace(",", "."), 10) || 0;
              amount = isNeg ? value : -value;
            }
            const totalAmountMatch = totalText.match(/\$\s*([\d.,]+)/);
            const totalAmount = totalAmountMatch ? parseInt(totalAmountMatch[1].replace(/\./g, "").replace(",", "."), 10) || void 0 : void 0;
            if (description && amount !== 0) {
              rows.push({
                date,
                description,
                amount,
                balance: 0,
                source: src,
                owner: texts[2] || void 0,
                installments: texts[4] || void 0,
                totalAmount
              });
            }
          }
        }
        let firstRow = "";
        if (isBilled2) {
          outer: for (const r of roots) {
            for (const tbl of Array.from(r.querySelectorAll("table"))) {
              const hdr = tbl.querySelector("thead, tr:first-child")?.innerText?.toLowerCase() ?? "";
              if (!hdr.includes("fecha de compra")) continue;
              const cells = tbl.querySelectorAll("tbody tr:first-child td");
              if (cells.length > 0) {
                firstRow = Array.from(cells).map((c) => c.innerText?.trim()).join("|");
                break outer;
              }
            }
          }
        }
        if (!firstRow) {
          for (const r of roots) {
            const cells = r.querySelectorAll("table tbody tr:first-child td");
            if (cells.length > 0) {
              firstRow = Array.from(cells).map((c) => c.innerText?.trim()).join("|");
              break;
            }
          }
        }
        let clicked = false;
        for (const root of roots) {
          if (clicked) break;
          for (const btn of Array.from(root.querySelectorAll(".btn-pagination, button"))) {
            if (btn.disabled) continue;
            const img = btn.querySelector("img");
            const imgAlt = (img?.getAttribute("alt") || "").toLowerCase();
            const imgSrc = img?.getAttribute("src") || "";
            const label = (btn.getAttribute("aria-label") || btn.innerText || "").toLowerCase();
            const isNext = imgAlt.includes("avanzar") || imgAlt.includes("siguiente") || imgAlt.includes("next") || imgSrc.includes("right-arrow") || imgSrc.includes("arrow-right") || imgSrc.includes("next") || label.includes("siguiente") || label.includes("next") || label.includes("avanzar");
            if (isNext) {
              btn.click();
              clicked = true;
              break;
            }
          }
        }
        return { rows, firstRow, clicked };
      },
      { host, src: source, isBilled: source === MOVEMENT_SOURCE.credit_card_billed }
    );
    debugLog.push(`  [CMR pag] page ${i + 1}: ${result.rows.length} rows`);
    all.push(...result.rows);
    if (!result.clicked) break;
    const prevRow = result.firstRow;
    const isBilled = source === MOVEMENT_SOURCE.credit_card_billed;
    const changed = await page.waitForFunction(
      ({ host: h, prev, billed }) => {
        const el = document.querySelector(h);
        const topRoot = el?.shadowRoot || document;
        function collectAll(root) {
          const found = root instanceof Document ? [] : [root];
          for (const child of Array.from(root.querySelectorAll("*"))) {
            const sr = child.shadowRoot;
            if (sr) found.push(...collectAll(sr));
          }
          return found;
        }
        const roots = collectAll(topRoot);
        if (billed) {
          for (const r of roots) {
            for (const tbl of Array.from(r.querySelectorAll("table"))) {
              const hdr = tbl.querySelector("thead, tr:first-child")?.innerText?.toLowerCase() ?? "";
              if (!hdr.includes("fecha de compra")) continue;
              const cells = tbl.querySelectorAll("tbody tr:first-child td");
              if (cells.length > 0) {
                const sig = Array.from(cells).map((c) => c.innerText?.trim()).join("|");
                return sig !== prev && sig !== "";
              }
            }
          }
        }
        for (const root of roots) {
          const cells = root.querySelectorAll("table tbody tr:first-child td");
          if (cells.length > 0) {
            const sig = Array.from(cells).map((c) => c.innerText?.trim()).join("|");
            return sig !== prev && sig !== "";
          }
        }
        return false;
      },
      { host, prev: prevRow, billed: isBilled },
      { timeout: 15e3 }
    ).then(() => true, () => false);
    if (!changed) break;
    await delay(300);
  }
  return deduplicateMovements(
    all.map((m) => ({
      ...m,
      date: normalizeDate(m.date),
      owner: normalizeOwner(m.owner),
      installments: normalizeInstallments(m.installments)
    }))
  );
}
async function scrapeFalabella(options) {
  const { rut, password, saveScreenshots: doScreenshots = false, owner = "B" } = options;
  const progress = options.onProgress || (() => {
  });
  const bank = "falabella";
  if (!rut || !password) {
    return { success: false, bank, accounts: [], error: "Debes proveer RUT y clave." };
  }
  let browser;
  try {
    const session = await launchPlaywright(options);
    browser = session.browser;
    const { page, debugLog } = session;
    const loginResult = await login2(page, rut, password, debugLog, doScreenshots, progress);
    if (!loginResult.success) {
      return {
        success: false,
        bank,
        accounts: [],
        error: loginResult.error,
        screenshot: loginResult.screenshot,
        debug: debugLog.join("\n")
      };
    }
    const dashboardUrl = page.url();
    await screenshotIfEnabled(page, "04-post-login", doScreenshots, debugLog);
    const { movements: accountMovements, balance } = await scrapeAccountMovements(page, debugLog, doScreenshots, progress);
    let creditCard = null;
    if (!options.skipCreditCards) {
      await page.goto(dashboardUrl, { waitUntil: "networkidle" });
      await delay(2e3);
      ({ creditCard } = await scrapeCreditCard(page, debugLog, doScreenshots, progress, owner));
    }
    progress("Consulta de cuenta finalizada");
    await screenshotIfEnabled(page, "08-final", doScreenshots, debugLog);
    const ss = doScreenshots ? (await page.screenshot({ fullPage: true })).toString("base64") : void 0;
    try {
      await page.evaluate(() => {
        for (const el of Array.from(document.querySelectorAll("a, button, span"))) {
          const text = el.innerText?.trim().toLowerCase();
          if (text === "cerrar sesi\xF3n" || text === "cerrar sesion" || text === "salir") {
            el.click();
            return;
          }
        }
      });
      await delay(2e3);
    } catch {
    }
    return {
      success: true,
      bank,
      accounts: [{ balance, movements: deduplicateMovements(accountMovements) }],
      creditCards: creditCard ? [creditCard] : [],
      screenshot: ss,
      debug: debugLog.join("\n")
    };
  } catch (error) {
    return {
      success: false,
      bank,
      accounts: [],
      error: `Error del scraper: ${error instanceof Error ? error.message : String(error)}`
    };
  } finally {
    if (browser) await browser.close().catch(() => {
    });
  }
}
var falabella = {
  id: "falabella",
  name: "Banco Falabella",
  url: BANK_URL5,
  scrape: scrapeFalabella
};
var falabella_default = falabella;

// bank-api/vendor/upstream/src/banks/itau.ts
var LOGIN_URL4 = "https://banco.itau.cl/wps/portal/newolb/web/login";
var PORTAL_BASE = "https://banco.itau.cl/wps/myportal/newolb/web";
var TWO_FACTOR_CONFIG3 = {
  keywords: ["ita\xFA key", "aprueba", "segundo factor", "autoriza"],
  timeoutEnvVar: "ITAU_2FA_TIMEOUT_SEC"
};
async function itauLogin(page, rut, password, debugLog, doSave) {
  debugLog.push("1. Navigating to login page...");
  await page.goto(LOGIN_URL4, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(2e3);
  await doSave(page, "01-login");
  debugLog.push("2. Filling RUT...");
  const rutEl = await page.$("#loginNameID");
  if (!rutEl) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 campo de RUT (#loginNameID)", screenshot: ss };
  }
  await rutEl.click({ clickCount: 3 });
  await rutEl.type(formatRut(rut), { delay: 45 });
  debugLog.push("3. Filling password...");
  const passEl = await page.$("#pswdId");
  if (!passEl) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: "No se encontr\xF3 campo de clave (#pswdId)", screenshot: ss };
  }
  await passEl.click();
  await passEl.type(password, { delay: 45 });
  debugLog.push("4. Submitting login...");
  await doSave(page, "02-pre-submit");
  await page.evaluate(() => {
    const btn = document.getElementById("btnLoginRecaptchaV3");
    if (btn) btn.click();
  });
  try {
    await page.waitForNavigation({ timeout: 2e4 });
  } catch {
  }
  await delay(3e3);
  await doSave(page, "03-after-submit");
  const errorText = await page.evaluate(() => {
    const sels = ['[class*="error"]', '[class*="alert"]', '[role="alert"]', ".msg-error-input"];
    for (const sel of sels) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const t = el.innerText?.trim();
        if (t && t.length > 3 && t.length < 300 && el.offsetParent !== null) {
          const lower = t.toLowerCase();
          if (lower.includes("incorrecto") || lower.includes("bloqueada") || lower.includes("suspendida") || lower.includes("inv\xE1lido")) return t;
        }
      }
    }
    return null;
  });
  if (errorText) {
    const ss = await page.screenshot({ encoding: "base64" });
    return { success: false, error: `Error de login: ${errorText}`, screenshot: ss };
  }
  if (await detect2FA(page, TWO_FACTOR_CONFIG3)) {
    debugLog.push("5. 2FA detected...");
    await doSave(page, "04-2fa");
    const approved = await waitFor2FA(page, debugLog, TWO_FACTOR_CONFIG3);
    if (!approved) {
      const ss = await page.screenshot({ encoding: "base64" });
      return { success: false, error: "2FA no fue aprobado a tiempo (Ita\xFA Key)", screenshot: ss };
    }
    await delay(3e3);
  }
  debugLog.push("5. Login OK!");
  return { success: true };
}
async function extractBalance2(page, debugLog) {
  debugLog.push("6. Extracting balance...");
  await page.goto(`${PORTAL_BASE}/cuentas/cuenta-corriente/saldos`, { waitUntil: "networkidle2", timeout: 2e4 });
  await delay(2e3);
  const balance = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const match = text.match(/Saldo disponible para uso\s*\$\s*([\d.,]+)/);
    if (match) return parseInt(match[1].replace(/[^0-9]/g, ""), 10);
    return void 0;
  });
  if (balance !== void 0) debugLog.push(`  Balance: $${balance.toLocaleString("es-CL")}`);
  return balance;
}
async function extractMovements3(page, debugLog) {
  debugLog.push("7. Extracting movements...");
  await page.goto(`${PORTAL_BASE}/cuentas/cuenta-corriente/saldos-ultimo-movimiento`, { waitUntil: "networkidle2", timeout: 2e4 });
  await delay(3e3);
  const allMovements = [];
  for (let pageNum = 1; pageNum <= 10; pageNum++) {
    const pageMovements = await page.evaluate(() => {
      const results = [];
      const rows = document.querySelectorAll("table tbody tr");
      for (const row of rows) {
        const cells = Array.from(row.querySelectorAll("td"));
        if (cells.length !== 6) continue;
        const date = cells[0].innerText?.trim() || "";
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) continue;
        results.push({ date, description: cells[1].innerText?.trim() || "", cargo: cells[2].innerText?.trim() || "", abono: cells[3].innerText?.trim() || "", saldo: cells[4].innerText?.trim() || "" });
      }
      return results;
    });
    for (const m of pageMovements) {
      const cargoVal = parseChileanAmount(m.cargo);
      const abonoVal = parseChileanAmount(m.abono);
      const amount = abonoVal > 0 ? abonoVal : -cargoVal;
      if (amount === 0) continue;
      allMovements.push({ date: normalizeDate(m.date), description: m.description, amount, balance: parseChileanAmount(m.saldo), source: MOVEMENT_SOURCE.account });
    }
    debugLog.push(`  Page ${pageNum}: ${pageMovements.length} movements`);
    const hasNext = await page.evaluate(() => {
      const pageInfo = document.body?.innerText?.match(/Página (\d+) de (\d+)/);
      if (pageInfo && parseInt(pageInfo[1], 10) >= parseInt(pageInfo[2], 10)) return false;
      const nextBtn = document.querySelector('a[name="nextbtn"]');
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });
    if (!hasNext) break;
    await delay(3e3);
  }
  return allMovements;
}
async function extractCreditCardData(page, debugLog) {
  debugLog.push("8. Extracting credit card data...");
  const movements = [];
  const creditCards = [];
  await page.goto(`${PORTAL_BASE}/tarjeta-credito/resumen/deuda`, { waitUntil: "networkidle2", timeout: 2e4 });
  await delay(3e3);
  const tcInfo = await page.evaluate(() => {
    const text = document.body?.innerText || "";
    const cardMatch = text.match(/(Mastercard|Visa)\s+[\w\s]+\*{4}\s*\*{4}\s*\*{4}\s*(\d{4})/i);
    const label = cardMatch ? cardMatch[0].replace(/\*{4}\s*\*{4}\s*\*{4}\s*/, "****").replace(/\s+/g, " ").trim() : null;
    const nacSection = text.match(/Nacional[\s\S]*?(?=Internacional|Ofertas|Movimientos|$)/)?.[0] || "";
    const nacDisponible = nacSection.match(/Cupo disponible\s*\$\s*([\d.]+)/);
    const nacUtilizado = nacSection.match(/Cupo utilizado\s*(?:[\s\S]*?\$\s*([\d.]+))?/);
    const intSection = text.match(/Internacional[\s\S]*?(?=Ofertas|Movimientos|Emergencias|$)/)?.[0] || "";
    const intUsdValues = [...intSection.matchAll(/USD\$?\s*(-?[\d.,]+)/g)].map((m) => m[1]);
    const proxFactMatch = text.match(/Próxima facturación\s*(\d{2}\/\d{2}\/\d{4})/);
    const noFacturados = [];
    const tables = document.querySelectorAll("table");
    for (const table of tables) {
      const prevText = table.previousElementSibling?.innerText?.toLowerCase() || "";
      if (prevText.includes("no facturad")) {
        const rows = table.querySelectorAll("tbody tr");
        for (const row of rows) {
          const cells = Array.from(row.querySelectorAll("td"));
          if (cells.length >= 3) noFacturados.push({ date: cells[0].innerText?.trim() || "", desc: cells[1].innerText?.trim() || "", amount: cells[cells.length - 1].innerText?.trim() || "" });
        }
      }
    }
    return { label, nacDisponible: nacDisponible?.[1], nacUtilizado: nacUtilizado?.[1], intDisponible: intUsdValues[2] || null, intUtilizado: intUsdValues[1] || null, intTotal: intUsdValues[0] || null, proxFact: proxFactMatch?.[1], noFacturados };
  });
  if (tcInfo.label) {
    const nacUsed = parseChileanAmount(tcInfo.nacUtilizado || "0");
    const nacAvailable = parseChileanAmount(tcInfo.nacDisponible || "0");
    const card = { label: tcInfo.label, national: { used: nacUsed, available: nacAvailable, total: nacUsed + nacAvailable }, movements: [] };
    if (tcInfo.intDisponible) {
      const parseUsd = (s) => parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
      card.international = { used: Math.abs(parseUsd(tcInfo.intUtilizado || "0")), available: parseUsd(tcInfo.intDisponible || "0"), total: parseUsd(tcInfo.intTotal || "0"), currency: "USD" };
    }
    if (tcInfo.proxFact) card.nextBillingDate = normalizeDate(tcInfo.proxFact);
    creditCards.push(card);
    for (const m of tcInfo.noFacturados) {
      const amount = parseChileanAmount(m.amount);
      if (amount === 0) continue;
      movements.push({ date: normalizeDate(m.date), description: m.desc, amount: -amount, balance: 0, source: MOVEMENT_SOURCE.credit_card_unbilled });
    }
    debugLog.push(`  No-facturados: ${tcInfo.noFacturados.length}`);
  }
  await page.goto(`${PORTAL_BASE}/tarjeta-credito/resumen/cuenta-nacional`, { waitUntil: "networkidle2", timeout: 2e4 });
  await delay(3e3);
  const facturados = await page.evaluate(() => {
    const results = [];
    const rows = document.querySelectorAll("table tbody tr");
    for (const row of rows) {
      const cells = Array.from(row.querySelectorAll("td"));
      if (cells.length < 7) continue;
      const dateText = cells[1]?.innerText?.trim() || "";
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateText)) continue;
      results.push({ date: dateText, desc: cells[3]?.innerText?.trim() || "", amount: cells[4]?.innerText?.trim() || "", cuota: cells[6]?.innerText?.trim() || "" });
    }
    return results;
  });
  for (const m of facturados) {
    const amount = parseChileanAmount(m.amount);
    if (amount === 0) continue;
    movements.push({ date: normalizeDate(m.date), description: m.desc, amount: amount > 0 ? -amount : Math.abs(amount), balance: 0, source: MOVEMENT_SOURCE.credit_card_billed, installments: normalizeInstallments(m.cuota) });
  }
  debugLog.push(`  Facturados: ${facturados.length}`);
  return { movements, creditCards };
}
async function scrapeItau(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const bank = "itau";
  const progress = onProgress || (() => {
  });
  progress("Abriendo sitio del banco...");
  const loginResult = await itauLogin(page, rut, password, debugLog, doSave);
  if (!loginResult.success) {
    return { success: false, bank, accounts: [], error: loginResult.error, screenshot: loginResult.screenshot, debug: debugLog.join("\n") };
  }
  progress("Sesi\xF3n iniciada correctamente");
  await closePopups(page);
  progress("Extrayendo saldo...");
  const balance = await extractBalance2(page, debugLog);
  progress("Extrayendo movimientos de cuenta...");
  const accountMovements = await extractMovements3(page, debugLog);
  progress(`Cuenta: ${accountMovements.length} movimientos`);
  progress("Extrayendo datos de tarjeta de cr\xE9dito...");
  const tcResult = await extractCreditCardData(page, debugLog);
  const deduplicatedAccount = deduplicateMovements(accountMovements);
  debugLog.push(`9. Total: ${deduplicatedAccount.length} account movements`);
  progress(`Listo \u2014 ${deduplicatedAccount.length} movimientos totales`);
  await doSave(page, "05-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64" }) : void 0;
  const accounts = [{ balance, movements: deduplicatedAccount }];
  return { success: true, bank, accounts, creditCards: tcResult.creditCards.length > 0 ? tcResult.creditCards : void 0, screenshot: ss, debug: debugLog.join("\n") };
}
var itau = {
  id: "itau",
  name: "Ita\xFA",
  url: "https://banco.itau.cl",
  scrape: (options) => runScraper("itau", options, {}, scrapeItau)
};
var itau_default = itau;

// bank-api/vendor/upstream/src/actions/pagination.ts
var DEFAULT_NEXT_TEXTS = ["siguiente", "ver m\xE1s", "mostrar m\xE1s"];
async function clickNext(page, texts) {
  return await page.evaluate((txts) => {
    const candidates = Array.from(document.querySelectorAll("button, a"));
    for (const candidate of candidates) {
      const text = candidate.innerText?.trim().toLowerCase() || "";
      if (!text) continue;
      if (!txts.some((t) => text.includes(t))) continue;
      const disabled = candidate.disabled || candidate.getAttribute("aria-disabled") === "true" || candidate.classList.contains("disabled");
      if (disabled) return false;
      candidate.click();
      return true;
    }
    return false;
  }, texts);
}
async function paginateAndExtract(page, extractFn, debugLog, config) {
  const maxPages = config?.maxPages ?? 25;
  const delayMs = config?.delayMs ?? 2500;
  const texts = config?.nextTexts ?? DEFAULT_NEXT_TEXTS;
  const allMovements = [];
  for (let i = 0; i < maxPages; i++) {
    const movements = await extractFn(page);
    allMovements.push(...movements);
    const nextClicked = await clickNext(page, texts);
    if (!nextClicked) break;
    debugLog.push(`  Pagination: loaded page ${i + 2}`);
    await delay(delayMs);
  }
  return deduplicateMovements(allMovements);
}

// bank-api/vendor/upstream/src/banks/santander.ts
var BANK_URL6 = "https://banco.santander.cl/personas";
var SANTANDER_CHECKING_API_PREFIX = "https://openbanking.santander.cl/account_balances_transactions_and_withholdings_retail/v1/current-accounts/transactions";
var SANTANDER_CC_API_PREFIX = "https://api-dsk.santander.cl/perdsk/tarjetasDeCredito/consultaUltimosMovimientos";
var SANTANDER_CC_BILLED_API_PREFIX = "https://api-dsk.santander.cl/perdsk/tarjetasDeCredito/estadoCuentaNacional";
function normalizeSantanderCheckingApiMovements(captures) {
  const movements = [];
  for (const capture of captures) {
    const obj = capture;
    const list = obj?.movements;
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const digits = m.movementAmount.replace(/[^0-9]/g, "");
      const raw = parseInt(digits, 10);
      if (!raw || isNaN(raw)) continue;
      const clp = raw / 100;
      const isDebit = m.chargePaymentFlag === "D" || m.movementAmount.endsWith("-");
      const amount = isDebit ? -clp : clp;
      const description = (m.observation?.trim() || m.expandedCode?.trim() || "").trim();
      let balance = 0;
      if (m.newBalance) {
        const balDigits = m.newBalance.replace(/[^0-9]/g, "");
        balance = Math.round(parseInt(balDigits, 10) / 100);
      }
      movements.push({
        date: normalizeDate(m.transactionDate),
        description,
        amount,
        balance,
        source: MOVEMENT_SOURCE.account
      });
    }
  }
  return movements;
}
function isSaldoInicial2(description) {
  return /saldo\s+inicial/i.test(description);
}
function normalizeSantanderUnbilledApiMovements(captures) {
  const movements = [];
  for (const capture of captures) {
    const obj = capture;
    const list = obj?.DATA?.MatrizMovimientos;
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const raw = parseChileanAmount(m.Importe);
      if (!raw || isNaN(raw)) continue;
      const isDebit = m.IndicadorDebeHaber === "D";
      const amount = isDebit ? -raw : raw;
      const description = (m.Comercio?.trim() || m.Descripcion?.trim() || "").trim();
      if (isSaldoInicial2(description)) continue;
      movements.push({
        date: normalizeDate(m.Fecha),
        description,
        amount,
        balance: 0,
        source: MOVEMENT_SOURCE.credit_card_unbilled
      });
    }
  }
  return movements;
}
function normalizeSantanderBilledApiMovements(captures) {
  const movements = [];
  for (const capture of captures) {
    const path3 = capture?.DATA;
    const response = path3?.AS_TIB_WM02_CONEstCtaNacional_Response;
    const output = response?.OUTPUT;
    const list = output?.Matriz;
    if (!Array.isArray(list)) continue;
    for (const m of list) {
      const cleaned = m.MontoTxs.replace(/^0+/, "").replace(/\./g, "") || "0";
      const raw = parseInt(cleaned, 10);
      if (!raw || isNaN(raw)) continue;
      if (isSaldoInicial2(m.NombreComercio)) continue;
      const isPayment = m.NombreComercio.toLowerCase().includes("monto cancelado");
      const amount = isPayment ? raw : -raw;
      const totalCuotas = parseInt(m.TotalCuotas.replace(/^0+/, "") || "0", 10);
      const currentCuota = parseInt(m.NumeroCuotas.replace(/^0+/, "") || "0", 10);
      const installments = totalCuotas > 0 ? `${String(currentCuota).padStart(2, "0")}/${String(totalCuotas).padStart(2, "0")}` : void 0;
      movements.push({
        date: normalizeDate(m.FechaTxs),
        description: m.NombreComercio,
        amount,
        balance: 0,
        source: MOVEMENT_SOURCE.credit_card_billed,
        ...installments ? { installments } : {}
      });
    }
  }
  return movements;
}
var SIDEBAR = {
  cuentas: "#menu-uid-0410",
  movimientos: "#menu-uid-0413",
  tarjetas: "#menu-uid-0420",
  misTc: ["#menu-uid-0421", "#menu-uid-042182"],
  maxX: 300
};
var LOGIN_SELECTORS2 = {
  rutSelectors: ["#rut"],
  passwordSelectors: ["#pass"],
  rutFormat: "clean"
};
var TWO_FACTOR_CONFIG4 = {
  timeoutEnvVar: "SANTANDER_2FA_TIMEOUT_SEC",
  frameFn: async (page) => {
    const handle = await page.$("iframe#login-frame");
    return handle ? await handle.contentFrame() : null;
  }
};
async function getLoginFrame(page) {
  const handle = await page.$("iframe#login-frame");
  return handle ? await handle.contentFrame() : null;
}
async function listMovementAccounts(page) {
  return await page.evaluate(() => {
    const slides = Array.from(document.querySelectorAll("#tabs-carousel-movs .swiper-slide"));
    const out = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];
      const text = slide.innerText?.replace(/\s+/g, " ").trim() || "";
      if (!text) continue;
      const typeMatch = text.match(/Cuenta\s+(Corriente|Vista)/i);
      const numberMatch = text.match(/\d(?:[\s.]\d+){3,}/);
      const type = typeMatch ? `Cuenta ${typeMatch[1]}` : "Cuenta";
      const number = numberMatch ? numberMatch[0].replace(/\s+/g, " ").trim() : `#${i + 1}`;
      out.push({ index: i, label: `${type} ${number}`.trim() });
    }
    return out;
  });
}
async function selectMovementAccount(page, index) {
  const clicked = await page.evaluate((targetIndex) => {
    const byAria = document.querySelector(
      `#tabs-carousel-movs [aria-label='Go to slide ${targetIndex + 1}']`
    );
    if (byAria) {
      byAria.click();
      return true;
    }
    const dots = Array.from(document.querySelectorAll("#tabs-carousel-movs .swiper-pagination-bullet"));
    if (dots[targetIndex]) {
      dots[targetIndex].click();
      return true;
    }
    const slides = Array.from(document.querySelectorAll("#tabs-carousel-movs .swiper-slide"));
    if (slides[targetIndex]) {
      const slide = slides[targetIndex];
      const clickable = slide.querySelector(".container-account, .container-account-ccc, .container-image") || slide;
      clickable.click();
      return true;
    }
    return false;
  }, index);
  if (!clicked) return false;
  await delay(1200);
  const verify = async () => page.evaluate(() => {
    const slides = Array.from(document.querySelectorAll("#tabs-carousel-movs .swiper-slide"));
    return slides.findIndex((s) => s.className.includes("swiper-slide-active"));
  });
  if (await verify() === index) return true;
  await delay(1800);
  return await verify() === index;
}
async function navigateToMovements2(page, debugLog) {
  const cuentasClicked = await clickSidebarItem(
    page,
    [SIDEBAR.cuentas],
    ["cuentas"],
    SIDEBAR.maxX
  );
  if (cuentasClicked) {
    debugLog.push("  Sidebar: Cuentas");
    await delay(2e3);
  }
  const movClicked = await clickSidebarItem(
    page,
    [SIDEBAR.movimientos],
    ["movimientos"],
    SIDEBAR.maxX
  );
  if (movClicked) {
    debugLog.push("  Sidebar: Movimientos");
    await delay(4500);
    return;
  }
  const widgetSel = await clickWidget(page, [
    "#cuentas .box-product",
    "#cuentas .mat-ripple.box-product",
    "#cuentas .datos",
    "#cuentas .product-container .mat-ripple"
  ], 4500);
  if (widgetSel) {
    debugLog.push(`  Account widget: ${widgetSel}`);
    return;
  }
  const tcWidget = await clickWidget(page, [
    "#tarjetas-creditos .movement",
    "#tarjetas-creditos .menu-popup .movement",
    "#tarjetas-creditos .container-hover .movement"
  ], 4500);
  if (tcWidget) {
    debugLog.push(`  TC widget: ${tcWidget}`);
  } else {
    debugLog.push("  No direct movement entry point found from dashboard.");
  }
}
async function navigateToCreditCardSection(page, debugLog) {
  const tarjetasClicked = await clickSidebarItem(
    page,
    [SIDEBAR.tarjetas],
    ["tarjetas"],
    SIDEBAR.maxX
  );
  if (tarjetasClicked) {
    debugLog.push("  Tarjetas menu opened");
    await delay(1500);
  }
  const tcClicked = await clickSidebarItem(
    page,
    SIDEBAR.misTc,
    ["mis tarjetas de cr\xE9dito", "mis tarjetas de credito"],
    SIDEBAR.maxX
  );
  if (tcClicked) {
    debugLog.push("  Opened 'Mis Tarjetas de Credito'");
    await delay(3500);
  }
  if (page.url().toLowerCase().includes("saldos_tc")) return true;
  const widget = await clickWidget(page, [
    "#tarjetas-creditos .movement",
    "#tarjetas-creditos .container-hover .movement",
    "#tarjetas-creditos .menu-popup .movement"
  ]);
  if (widget) {
    debugLog.push("  Opened TC from dashboard widget");
  }
  return page.url().toLowerCase().includes("saldos_tc");
}
async function scrapeSantander(session, options) {
  const { rut, password, saveScreenshots: doScreenshots, onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const bank = "santander";
  const progress = onProgress || (() => {
  });
  const interceptor = await createInterceptor(page, [
    { id: "santander-checking", urlPrefix: SANTANDER_CHECKING_API_PREFIX },
    { id: "santander-credit-card-unbilled", urlPrefix: SANTANDER_CC_API_PREFIX },
    { id: "santander-credit-card-billed", urlPrefix: SANTANDER_CC_BILLED_API_PREFIX }
  ]);
  debugLog.push("1. Navigating to Santander...");
  progress("Abriendo sitio del banco...");
  await page.goto(BANK_URL6, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(2e3);
  await dismissBanners(page);
  await doSave(page, "01-homepage");
  debugLog.push("2. Opening login form...");
  const loginOpened = await page.$eval("#btnIngresar", (el) => {
    el.click();
    return true;
  }).catch(() => false) || await clickByText(page, [
    "ingresar",
    "acceso clientes",
    "banco en linea",
    "iniciar sesi\xF3n",
    "iniciar sesion"
  ]);
  if (!loginOpened) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 el bot\xF3n de ingreso.", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(3500);
  await doSave(page, "02-login");
  const loginFrame = await getLoginFrame(page);
  const ctx = loginFrame || page;
  if (loginFrame) {
    debugLog.push("  Login iframe detectado.");
  }
  try {
    await ctx.waitForSelector("#rut", { timeout: 15e3 });
    await ctx.waitForSelector("#pass", { timeout: 15e3 });
  } catch {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No cargaron los campos de login (#rut/#pass).", screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("3. Filling RUT...");
  progress("Ingresando RUT...");
  const rutOk = await fillRut(ctx, rut, LOGIN_SELECTORS2);
  if (!rutOk) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de RUT.", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(3500);
  debugLog.push("4. Filling password...");
  const passOk = await fillPassword(ctx, password, LOGIN_SELECTORS2);
  if (!passOk) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de clave.", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(700);
  debugLog.push("5. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  await clickSubmit(ctx, page, LOGIN_SELECTORS2);
  await delay(7e3);
  await doSave(page, "03-post-login");
  if (await detect2FA(page, TWO_FACTOR_CONFIG4)) {
    const approved = await waitFor2FA(page, debugLog, TWO_FACTOR_CONFIG4);
    await doSave(page, "03b-after-2fa");
    if (!approved) {
      const ss2 = await page.screenshot({ encoding: "base64" });
      return { success: false, bank, accounts: [], error: "Timeout esperando aprobaci\xF3n de 2FA.", screenshot: ss2, debug: debugLog.join("\n") };
    }
  }
  const loginError = await detectLoginError(page, await getLoginFrame(page));
  if (loginError) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: `Error del banco: ${loginError}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("6. Login OK.");
  progress("Sesi\xF3n iniciada correctamente");
  await closePopups(page);
  debugLog.push("7. Navigating to movements...");
  progress("Extrayendo movimientos de cuenta...");
  await navigateToMovements2(page, debugLog);
  await delay(4e3);
  await doSave(page, "04-movements");
  const accounts = await listMovementAccounts(page);
  if (accounts.length > 0) {
    debugLog.push(`  Accounts: ${accounts.map((a) => a.label).join(" | ")}`);
  }
  let movements = [];
  const checkingCaptures = await interceptor.waitFor("santander-checking", 1e4);
  if (checkingCaptures.length > 0) {
    debugLog.push(`  Checking API: ${checkingCaptures.length} response(s) captured`);
    const apiMovements = normalizeSantanderCheckingApiMovements(checkingCaptures);
    debugLog.push(`  Checking API movements: ${apiMovements.length}`);
    if (apiMovements.length > 0) {
      movements.push(...apiMovements);
    }
  }
  if (movements.length === 0) {
    debugLog.push("  Checking API: no data, falling back to HTML extraction");
    if (accounts.length <= 1) {
      movements = await paginateAndExtract(page, extractAccountMovements, debugLog);
    } else {
      for (const account of accounts) {
        const switched = await selectMovementAccount(page, account.index);
        if (!switched) {
          debugLog.push(`  Could not switch to ${account.label}`);
          continue;
        }
        const acctMovements = await paginateAndExtract(page, extractAccountMovements, debugLog);
        movements.push(...acctMovements);
        debugLog.push(`  ${account.label}: ${acctMovements.length} movement(s)`);
      }
    }
  }
  movements = deduplicateMovements(movements);
  debugLog.push("7b. Navigating to credit card movements...");
  progress("Extrayendo movimientos de tarjeta de cr\xE9dito...");
  const tcReady = await navigateToCreditCardSection(page, debugLog);
  if (tcReady) {
    if (await clickTcTab2(page, "movimientos por facturar")) {
      const unbilledCaptures = await interceptor.waitFor("santander-credit-card-unbilled", 1e4);
      if (unbilledCaptures.length > 0) {
        const unbilledMovements = normalizeSantanderUnbilledApiMovements(unbilledCaptures);
        movements.push(...unbilledMovements);
        debugLog.push(`  CC API (unbilled): ${unbilledMovements.length} movement(s)`);
      } else {
        debugLog.push("  CC API (unbilled): no data, falling back to HTML extraction");
        const unbilled = await extractCreditCardMovements(page, "unbilled");
        movements.push(...unbilled);
        debugLog.push(`  TC por facturar: ${unbilled.length} movement(s)`);
      }
    }
    if (await clickTcTab2(page, "movimientos facturados")) {
      const billedCaptures = await interceptor.waitFor("santander-credit-card-billed", 1e4);
      if (billedCaptures.length > 0) {
        const billedMovements = normalizeSantanderBilledApiMovements(billedCaptures);
        movements.push(...billedMovements);
        debugLog.push(`  CC API (billed): ${billedMovements.length} movement(s)`);
      } else {
        debugLog.push("  CC API (billed): no data, falling back to HTML extraction");
        const billed = await extractCreditCardMovements(page, "billed");
        movements.push(...billed);
        debugLog.push(`  TC facturados: ${billed.length} movement(s)`);
      }
    }
  } else {
    debugLog.push("  Could not open credit card section.");
  }
  movements = deduplicateMovements(movements);
  let balance;
  const withBalance = movements.find((m) => m.balance > 0);
  if (withBalance) {
    balance = withBalance.balance;
    debugLog.push(`  Balance from movements: $${balance.toLocaleString("es-CL")}`);
  }
  if (balance === void 0 || balance === 0) {
    balance = await extractBalance(page);
  }
  debugLog.push(`8. Extracted ${movements.length} movement(s)`);
  progress(`Listo \u2014 ${movements.length} movimientos totales`);
  debugLog.push(balance !== void 0 ? `9. Balance: $${balance.toLocaleString("es-CL")}` : "9. Balance not found");
  await doSave(page, "05-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64", fullPage: true }) : void 0;
  return { success: true, bank, accounts: [{ balance, movements }], screenshot: ss, debug: debugLog.join("\n") };
}
var santander = {
  id: "santander",
  name: "Banco Santander",
  url: BANK_URL6,
  scrape: (options) => runScraper("santander", options, {}, scrapeSantander)
};
var santander_default = santander;

// bank-api/vendor/upstream/src/banks/scotiabank.ts
var BANK_URL7 = "https://www.scotiabank.cl";
var LOGIN_SELECTORS3 = {
  rutSelectors: ["#inputDni", 'input[name="inputDni"]', 'input[id*="Dni"]', 'input[name*="Dni"]'],
  passwordSelectors: ["#inputPassword", 'input[name="inputPassword"]', 'input[id*="Password"]', 'input[name*="Password"]'],
  rutFormat: "dash"
};
function allDeepJs() {
  return `function allDeep(root, sel) {
    const out = Array.from(root.querySelectorAll(sel));
    for (const el of Array.from(root.querySelectorAll("*"))) {
      if (el.shadowRoot) out.push(...allDeep(el.shadowRoot, sel));
    }
    return out;
  }`;
}
async function waitForDashboardContent(page) {
  const start = Date.now();
  while (Date.now() - start < 15e3) {
    const hasContent = await page.evaluate(new Function(`${allDeepJs()}
      return allDeep(document, "a, button, span").some(el => {
        const text = el.innerText?.trim().toLowerCase() || "";
        return text === "ver cartola" || text === "cuenta corriente";
      });`));
    if (hasContent) break;
    await delay(1500);
  }
}
async function dismissScotiaTutorial(page, debugLog) {
  for (let i = 0; i < 8; i++) {
    const dismissed = await page.evaluate(new Function(`${allDeepJs()}
      for (const el of allDeep(document, "button, a, span")) {
        const text = el.innerText?.trim().toLowerCase() || "";
        if (text === "continuar" || text === "terminar" || text === "cerrar" || text === "omitir" || text === "saltar") {
          el.click(); return text;
        }
      }
      return null;`));
    if (!dismissed) break;
    debugLog.push(`  Tutorial dismissed: "${dismissed}"`);
    await delay(600);
  }
}
async function navigateToMovements3(page, debugLog) {
  await waitForDashboardContent(page);
  const clickedCartola = await page.evaluate(new Function(`${allDeepJs()}
    for (const el of allDeep(document, "a, button, span")) {
      const text = el.innerText?.trim().toLowerCase() || "";
      if (text === "ver cartola" || text === "ver saldo y movimientos") {
        el.click(); return true;
      }
    }
    return false;`));
  if (clickedCartola) {
    debugLog.push("  Clicked: Ver cartola");
    await delay(5e3);
    return;
  }
  const clickedCuentas = await page.evaluate(new Function(`${allDeepJs()}
    for (const el of allDeep(document, "a, button, li, span")) {
      if (el.innerText?.trim().toLowerCase() === "cuentas") { el.click(); return true; }
    }
    return false;`));
  if (clickedCuentas) {
    debugLog.push("  Sidebar: Cuentas");
    await delay(2500);
  }
  const clickedSaldos = await page.evaluate(new Function(`${allDeepJs()}
    for (const el of allDeep(document, "a, button, [role='tab'], li, span")) {
      const text = el.innerText?.trim().toLowerCase() || "";
      if (text.includes("saldos y") || text.includes("\xFAltimos movimientos") || text === "saldos") {
        el.click(); return true;
      }
    }
    return false;`));
  if (clickedSaldos) {
    debugLog.push("  Clicked: Saldos y \xFAltimos movimientos tab");
    await delay(5e3);
    return;
  }
  const subTargets = ["movimientos", "estado de cuenta", "ver movimientos"];
  for (const target of subTargets) {
    const clicked = await page.evaluate(new Function(`${allDeepJs()}
      var target = ${JSON.stringify(target)};
      for (const el of allDeep(document, "a, button, [role='menuitem'], li, span")) {
        const text = el.innerText?.trim().toLowerCase() || "";
        if (text.includes(target) && text.length < 60) { el.click(); return true; }
      }
      return false;`));
    if (clicked) {
      debugLog.push(`  Clicked: ${target}`);
      await delay(5e3);
      return;
    }
  }
}
async function extractMovements4(page) {
  const contexts = [page];
  for (const frame of page.frames()) {
    if (frame !== page.mainFrame()) contexts.push(frame);
  }
  const allRaw = [];
  for (const ctx of contexts) {
    try {
      const raw = await ctx.evaluate(new Function(`${allDeepJs()}
        const results = [];
        const tables = allDeep(document, "table");
        for (const table of tables) {
          const rows = Array.from(table.querySelectorAll("tr"));
          if (rows.length < 2) continue;
          let dateIndex = 0, descriptionIndex = 1, cargoIndex = -1, abonoIndex = -1, amountIndex = -1, balanceIndex = -1, hasHeader = false;
          for (const row of rows) {
            const headers = row.querySelectorAll("th");
            if (headers.length < 2) continue;
            const ht = Array.from(headers).map(h => h.innerText?.trim().toLowerCase() || "");
            if (!ht.some(h => h.includes("fecha"))) continue;
            hasHeader = true;
            dateIndex = ht.findIndex(h => h.includes("fecha"));
            descriptionIndex = ht.findIndex(h => h.includes("descrip") || h.includes("detalle") || h.includes("glosa"));
            cargoIndex = ht.findIndex(h => h.includes("cargo") || h.includes("d\xE9bito") || h.includes("debito"));
            abonoIndex = ht.findIndex(h => h.includes("abono") || h.includes("cr\xE9dito") || h.includes("credito"));
            amountIndex = ht.findIndex(h => h === "monto" || h.includes("importe"));
            balanceIndex = ht.findIndex(h => h.includes("saldo"));
            break;
          }
          if (!hasHeader) continue;
          let lastDate = "";
          for (const row of rows) {
            const cells = row.querySelectorAll("td");
            if (cells.length < 3) continue;
            const values = Array.from(cells).map(c => c.innerText?.trim() || "");
            const rawDate = values[dateIndex] || "";
            const hasDate = /^\\d{1,2}[\\/.-]\\d{1,2}([\\/.-]\\d{2,4})?$/.test(rawDate);
            const date = hasDate ? rawDate : lastDate;
            if (!date) continue;
            if (hasDate) lastDate = rawDate;
            const description = descriptionIndex >= 0 ? (values[descriptionIndex] || "") : "";
            let amount = "";
            if (cargoIndex >= 0 && values[cargoIndex]) amount = "-" + values[cargoIndex];
            else if (abonoIndex >= 0 && values[abonoIndex]) amount = values[abonoIndex];
            else if (amountIndex >= 0) amount = values[amountIndex] || "";
            const balance = balanceIndex >= 0 ? (values[balanceIndex] || "") : "";
            if (!amount) continue;
            results.push({ date, description, amount, balance });
          }
        }
        if (results.length === 0) {
          const cards = allDeep(document, "[class*='mov'], [class*='tran'], [class*='transaction'], li, article");
          for (const card of cards) {
            const text = card.innerText || "";
            const lines = text.split("\\n").map(l => l.trim()).filter(Boolean);
            if (lines.length < 3 || lines.length > 10) continue;
            const date = lines.find(l => /\\d{1,2}[\\/.-]\\d{1,2}[\\/.-]\\d{2,4}/.test(l));
            const amount = lines.find(l => /[$]\\s*[\\d.]+/.test(l));
            if (!date || !amount) continue;
            const description = lines.find(l => l !== date && l !== amount && l.length > 3) || "";
            const balance = lines.find(l => l.toLowerCase().includes("saldo") && /[$]\\s*[\\d.]+/.test(l)) || "";
            const isCargo = text.toLowerCase().includes("cargo") || text.toLowerCase().includes("d\xE9bito") || amount.includes("-");
            results.push({ date, description, amount: isCargo ? (amount.startsWith("-") ? amount : "-" + amount) : amount, balance });
          }
        }
        return results;`));
      allRaw.push(...raw);
    } catch {
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return allRaw.map((m) => {
    const amount = parseChileanAmount(m.amount);
    if (amount === 0) return null;
    return { date: normalizeDate(m.date), description: m.description, amount, balance: m.balance ? parseChileanAmount(m.balance) : 0, source: MOVEMENT_SOURCE.account };
  }).filter((m) => {
    if (!m) return false;
    const key = `${m.date}|${m.description}|${m.amount}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
async function scotiaPaginate(page, debugLog) {
  const all = [];
  for (let i = 0; i < 20; i++) {
    all.push(...await extractMovements4(page));
    const urlBefore = page.url();
    const nextClicked = await page.evaluate(new Function(`${allDeepJs()}
      const candidates = allDeep(document, "button, a, [role='button']");
      for (const btn of candidates) {
        const text = btn.innerText?.trim().toLowerCase() || "";
        if (!text.includes("siguiente") && !text.includes("ver m\xE1s") && !text.includes("mostrar m\xE1s") && text !== "\u203A" && text !== ">") continue;
        if (btn.disabled || btn.getAttribute("aria-disabled") === "true" || btn.classList.contains("disabled")) return false;
        btn.click(); return true;
      }
      return false;`));
    if (!nextClicked) break;
    await delay(3e3);
    const urlAfter = page.url();
    if (new URL(urlBefore).pathname.split("/").slice(0, 6).join("/") !== new URL(urlAfter).pathname.split("/").slice(0, 6).join("/")) {
      debugLog.push("  Pagination stopped: URL changed");
      break;
    }
    debugLog.push(`  Pagination: page ${i + 2}`);
  }
  return deduplicateMovements(all);
}
async function scrapeScotiabank(session, options) {
  const { rut, password, saveScreenshots: doScreenshots, onProgress } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const progress = onProgress || (() => {
  });
  const bank = "scotiabank";
  debugLog.push("1. Navigating to Scotiabank...");
  progress("Abriendo sitio del banco...");
  await page.goto(BANK_URL7, { waitUntil: "networkidle2", timeout: 3e4 });
  await delay(2e3);
  await dismissBanners(page);
  await doSave(page, "01-homepage");
  debugLog.push("2. Clicking login button...");
  await page.evaluate(() => {
    for (const el of Array.from(document.querySelectorAll("a, button"))) {
      const text = el.innerText?.trim().toLowerCase() || "";
      const href = el.href || "";
      if (text === "ingresar" || text === "acceso clientes" || text.includes("iniciar sesi\xF3n") || href.includes("login") || href.includes("auth")) {
        el.click();
        return;
      }
    }
  });
  await delay(4e3);
  await doSave(page, "02-login-form");
  debugLog.push("3. Filling RUT...");
  progress("Ingresando RUT...");
  if (!await fillRut(page, rut, LOGIN_SELECTORS3)) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de RUT", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(1e3);
  debugLog.push("4. Filling password...");
  let passOk = await fillPassword(page, password, LOGIN_SELECTORS3);
  if (!passOk) {
    await page.keyboard.press("Enter");
    await delay(3e3);
    passOk = await fillPassword(page, password, LOGIN_SELECTORS3);
  }
  if (!passOk) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "No se encontr\xF3 campo de clave", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(800);
  debugLog.push("5. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  await clickSubmit(page, page, LOGIN_SELECTORS3);
  await delay(8e3);
  await doSave(page, "03-after-login");
  const pageContent = (await page.content()).toLowerCase();
  if (pageContent.includes("clave din\xE1mica") || pageContent.includes("segundo factor") || pageContent.includes("c\xF3digo de verificaci\xF3n") || pageContent.includes("token")) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: "El banco pide clave din\xE1mica o 2FA.", screenshot: ss2, debug: debugLog.join("\n") };
  }
  const loginError = await detectLoginError(page);
  if (loginError) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank, accounts: [], error: `Error del banco: ${loginError}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("6. Login OK!");
  progress("Sesi\xF3n iniciada correctamente");
  await closePopups(page);
  await dismissScotiaTutorial(page, debugLog);
  debugLog.push("7. Looking for Cartola/Movimientos...");
  progress("Buscando cartola de cuenta...");
  await navigateToMovements3(page, debugLog);
  await dismissScotiaTutorial(page, debugLog);
  debugLog.push("7b. Waiting for movements to load...");
  progress("Esperando carga de movimientos...");
  const startWait = Date.now();
  while (Date.now() - startWait < 2e4) {
    const hasTable = await page.evaluate(new Function(`${allDeepJs()}
      // Check if a table with rows OR movement cards exist
      const tables = allDeep(document, "table");
      for (const t of tables) { if (t.querySelectorAll("tr").length > 1) return "table"; }
      // Check for card-style movements
      const cards = allDeep(document, "[class*='mov'], [class*='tran'], [class*='transaction']");
      if (cards.length > 0) return "cards";
      // Check if spinner is gone and there's text with amounts
      const body = document.body?.innerText || "";
      if (/\\$\\s*[\\d.]+/.test(body) && body.length > 500) return "text";
      return null;`));
    if (hasTable) {
      debugLog.push(`  Content loaded: ${hasTable}`);
      break;
    }
    await delay(2e3);
  }
  await doSave(page, "04-movements-page");
  try {
    const selectInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll("select"));
      return selects.map((sel, i) => ({
        index: i,
        name: sel.name || sel.id || `select-${i}`,
        options: Array.from(sel.querySelectorAll("option")).map((o) => ({ text: o.text.trim(), value: o.value }))
      }));
    });
    for (const sel of selectInfo) {
      for (const opt of sel.options) {
        const text = opt.text.toLowerCase();
        if (text.includes("todos") || text.includes("\xFAltimo mes") || text.includes("30 d\xEDa") || text.includes("mes anterior")) {
          await page.evaluate((selIdx, optValue) => {
            const selects = document.querySelectorAll("select");
            const select = selects[selIdx];
            if (select) {
              select.value = optValue;
              select.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }, sel.index, opt.value);
          await delay(3e3);
          break;
        }
      }
    }
  } catch {
  }
  const movements = await scotiaPaginate(page, debugLog);
  debugLog.push(`9. Extracted ${movements.length} movements (current period)`);
  progress(`Periodo actual: ${movements.length} movimientos`);
  const months = Math.min(Math.max(parseInt(process.env.SCOTIABANK_MONTHS || "3", 10) || 3, 0), 12);
  if (months > 0) {
    debugLog.push(`10. Fetching ${months} historical cartola(s)...`);
    progress(`Extrayendo cartolas hist\xF3ricas...`);
    await page.evaluate(new Function(`${allDeepJs()}
      for (const el of allDeep(document, "nav a, nav button, aside a, aside button, a, button, li, span")) {
        const text = el.innerText?.trim().toLowerCase() || "";
        if (text === "cuentas" && text.length < 15) { el.click(); return true; }
      }
      return false;`));
    debugLog.push("  Sidebar: Cuentas");
    await delay(2e3);
    await page.evaluate(new Function(`${allDeepJs()}
      for (const el of allDeep(document, "a, button, li, span")) {
        const text = el.innerText?.trim().toLowerCase() || "";
        if (text === "cuenta corriente" && text.length < 25) { el.click(); return true; }
      }
      return false;`));
    debugLog.push("  Sidebar: Cuenta Corriente");
    await delay(2e3);
    const currentUrl = page.url();
    let clickedVerCartolas = false;
    if (currentUrl.includes("tab=saldos") || currentUrl.includes("balancesmovements")) {
      const cartolasUrl = currentUrl.includes("tab=") ? currentUrl.replace(/tab=[^&]+/, "tab=cartolas") : currentUrl + (currentUrl.includes("?") ? "&" : "?") + "tab=cartolas";
      try {
        await page.goto(cartolasUrl, { waitUntil: "networkidle2", timeout: 15e3 });
        clickedVerCartolas = true;
        debugLog.push("  Navigated to Cartolas tab via URL");
      } catch {
      }
    }
    if (!clickedVerCartolas) {
      clickedVerCartolas = await page.evaluate(new Function(`${allDeepJs()}
        for (const el of allDeep(document, "a, button, li, span")) {
          const text = el.innerText?.trim().toLowerCase() || "";
          if (text === "ver cartolas" || text.includes("ver cartola")) { el.click(); return true; }
        }
        return false;`));
    }
    if (!clickedVerCartolas) {
      clickedVerCartolas = await page.evaluate(new Function(`${allDeepJs()}
        for (const el of allDeep(document, "a, button, [role='tab'], li, span")) {
          const text = el.innerText?.trim().toLowerCase() || "";
          if (text === "cartolas" && text.length < 20) { el.click(); return true; }
        }
        return false;`));
    }
    if (clickedVerCartolas) {
      debugLog.push("  On Cartolas tab");
      await delay(4e3);
      await dismissScotiaTutorial(page, debugLog);
      let clickedConsultar = await page.evaluate(new Function(`${allDeepJs()}
        for (const el of allDeep(document, "a, button, span")) {
          const text = el.innerText?.trim().toLowerCase() || "";
          if (text.includes("consultar cartola") && text.length < 40) { el.click(); return true; }
        }
        return false;`));
      if (!clickedConsultar) {
        for (const frame of page.frames()) {
          if (frame === page.mainFrame()) continue;
          try {
            clickedConsultar = await frame.evaluate(() => {
              for (const el of document.querySelectorAll("a, button, span, div")) {
                const text = el.innerText?.trim().toLowerCase() || "";
                if (text.includes("consultar cartola") && text.length < 40) {
                  el.click();
                  return true;
                }
              }
              return false;
            });
            if (clickedConsultar) {
              debugLog.push("  Found Consultar Cartolas in iframe");
              break;
            }
          } catch {
          }
        }
      }
      if (clickedConsultar) {
        debugLog.push("  Clicked: Consultar Cartolas");
        await delay(5e3);
        await doSave(page, "06-consultar-cartolas");
        const MONTH_NAMES = [
          "enero",
          "febrero",
          "marzo",
          "abril",
          "mayo",
          "junio",
          "julio",
          "agosto",
          "septiembre",
          "octubre",
          "noviembre",
          "diciembre"
        ];
        const now = /* @__PURE__ */ new Date();
        for (let m = 0; m < months; m++) {
          const target = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const targetMonth = target.getMonth();
          const targetYear = target.getFullYear();
          debugLog.push(`  Cartola: ${MONTH_NAMES[targetMonth]} ${targetYear}`);
          progress(`Cartola ${MONTH_NAMES[targetMonth]} ${targetYear}...`);
          const frames = [page.mainFrame(), ...page.frames().filter((f) => f !== page.mainFrame())];
          let submitted = false;
          for (const frame of frames) {
            try {
              const info = await frame.evaluate(() => {
                const selects = document.querySelectorAll("select");
                const inputs = document.querySelectorAll("input");
                const buttons = document.querySelectorAll("button, input[type='submit'], input[type='button'], input[type='image']");
                return { url: window.location.href, selects: selects.length, inputs: inputs.length, buttons: buttons.length };
              });
              debugLog.push(`    Frame: ${info.url.substring(0, 80)} | selects=${info.selects} inputs=${info.inputs} buttons=${info.buttons}`);
            } catch {
            }
          }
          for (const frame of frames) {
            try {
              const selectDebug = await frame.evaluate(() => {
                const selects = Array.from(document.querySelectorAll("select"));
                return selects.map((sel, i) => ({
                  index: i,
                  name: sel.name || sel.id,
                  options: Array.from(sel.options).map((o) => ({ text: o.text.trim(), value: o.value }))
                }));
              }).catch(() => []);
              if (selectDebug.length > 0) {
                if (selectDebug.length > 0) debugLog.push(`    Frame has ${selectDebug.length} selects`);
              }
              const filled = await frame.evaluate((monthIdx, year) => {
                const selects = Array.from(document.querySelectorAll("select"));
                if (selects.length < 1) return "no selects";
                const monthSelect = selects[0];
                const yearSelect = selects.length >= 2 ? selects[1] : null;
                if (!yearSelect) return "only 1 select";
                const monthValue = String(monthIdx + 1).padStart(2, "0");
                monthSelect.value = monthValue;
                monthSelect.dispatchEvent(new Event("change", { bubbles: true }));
                yearSelect.value = String(year);
                yearSelect.dispatchEvent(new Event("change", { bubbles: true }));
                return "ok";
              }, targetMonth, targetYear);
              debugLog.push(`    Fill result: ${filled}`);
              if (filled !== "ok") continue;
              await delay(500);
              const accepted = await frame.evaluate(() => {
                for (const el of document.querySelectorAll('button, input[type="submit"], input[type="button"], input[type="image"], a, img')) {
                  const text = (el.innerText?.trim() || el.value || el.alt || "").toLowerCase();
                  if (text.includes("aceptar") || text === "buscar" || text === "consultar" || text === "enviar") {
                    el.click();
                    return text;
                  }
                }
                const submit = document.querySelector('input[type="submit"], input[type="image"]');
                if (submit) {
                  submit.click();
                  return "submit-fallback";
                }
                return null;
              });
              debugLog.push(`    Accepted: ${accepted}`);
              if (accepted) {
                debugLog.push(`    Submitted: ${MONTH_NAMES[targetMonth]} ${targetYear}`);
                await delay(8e3);
                const waitStart = Date.now();
                while (Date.now() - waitStart < 15e3) {
                  const hasContent = await frame.evaluate(() => {
                    const tables = document.querySelectorAll("table");
                    for (const t of Array.from(tables)) {
                      if (t.querySelectorAll("tr").length > 2) return true;
                    }
                    return false;
                  }).catch(() => false);
                  if (hasContent) break;
                  await delay(2e3);
                }
                await doSave(page, `07-cartola-${MONTH_NAMES[targetMonth]}-${targetYear}`);
                const periodMovements = await extractMovements4(page);
                debugLog.push(`    Found: ${periodMovements.length} movements`);
                movements.push(...periodMovements);
                submitted = true;
                break;
              }
            } catch {
            }
          }
          if (!submitted) {
            debugLog.push(`    Could not submit cartola for ${MONTH_NAMES[targetMonth]} ${targetYear}`);
            break;
          }
        }
      } else {
        debugLog.push("  Could not click Consultar Cartolas");
      }
    } else {
      debugLog.push("  Could not navigate to Cartolas");
    }
  }
  const deduplicated = deduplicateMovements(movements);
  debugLog.push(`  Total: ${deduplicated.length} unique movements`);
  progress(`Listo \u2014 ${deduplicated.length} movimientos totales`);
  let balance;
  if (deduplicated.length > 0 && deduplicated[0].balance > 0) balance = deduplicated[0].balance;
  if (balance === void 0) {
    balance = await page.evaluate(() => {
      const bodyText = document.body?.innerText || "";
      const patterns = [/saldo disponible[\s\S]{0,50}\$\s*([\d.]+)/i, /saldo actual[\s\S]{0,50}\$\s*([\d.]+)/i];
      for (const pattern of patterns) {
        const match = bodyText.match(pattern);
        if (match) return parseInt(match[1].replace(/[^0-9]/g, ""), 10);
      }
      return void 0;
    });
  }
  await doSave(page, "05-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64", fullPage: true }) : void 0;
  return { success: true, bank, accounts: [{ balance: balance ?? void 0, movements: deduplicated }], screenshot: ss, debug: debugLog.join("\n") };
}
var scotiabank = {
  id: "scotiabank",
  name: "Scotiabank Chile",
  url: BANK_URL7,
  scrape: (options) => runScraper("scotiabank", options, {}, scrapeScotiabank)
};
var scotiabank_default = scotiabank;

// bank-api/vendor/upstream/src/banks/cencosud.ts
var LOGIN_URL5 = "https://www.mitarjetacencosud.cl/login";
var BANK_ID = "cencosud";
async function detectCaptcha(page) {
  return page.evaluate(() => {
    if (document.querySelector('iframe[src*="hcaptcha"], iframe[src*="recaptcha"]')) return true;
    if (document.querySelector('.h-captcha, .g-recaptcha, [id*="hcaptcha"], [class*="hcaptcha"]')) return true;
    const text = (document.body?.innerText || "").toLowerCase();
    return text.includes("select all images") || text.includes("i am not a robot");
  });
}
async function waitForCaptcha(page, debugLog, timeoutSec = 180) {
  debugLog.push(`  CAPTCHA detectado \u2014 resuelve manualmente en el navegador (${timeoutSec}s m\xE1x)...`);
  const start = Date.now();
  while ((Date.now() - start) / 1e3 < timeoutSec) {
    const still = await detectCaptcha(page);
    if (!still) {
      debugLog.push("  CAPTCHA resuelto, continuando...");
      return true;
    }
    await delay(2e3);
  }
  debugLog.push(`  Timeout esperando CAPTCHA (${timeoutSec}s).`);
  return false;
}
async function clickAndWait(page, texts, debugLog, timeout = 15e3) {
  for (const txt of texts) {
    const navPromise = page.waitForNavigation({ waitUntil: "networkidle2", timeout }).catch(() => {
    });
    const clicked = await page.evaluate((t) => {
      const els = Array.from(document.querySelectorAll("a, button, span, div, li"));
      for (const el of els) {
        const text = el.innerText?.trim().toLowerCase() || "";
        if (text === t && text.length < 60) {
          el.click();
          return true;
        }
      }
      return false;
    }, txt.toLowerCase());
    if (clicked) {
      await navPromise;
      debugLog.push(`  Clicked: "${txt}"`);
      await delay(2e3);
      return true;
    } else {
      navPromise.catch(() => {
      });
    }
  }
  return false;
}
function parseInstallments(raw) {
  if (!raw) return void 0;
  const match = raw.match(/(\d{1,2})\/(\d{1,2})/);
  if (match) return normalizeInstallments(`${match[1]}/${match[2]}`);
  return normalizeInstallments(raw);
}
async function extractOnePage(page, source) {
  await Promise.race([
    page.waitForSelector("table tr, [role='row'], [role='grid']", { timeout: 6e3 }).catch(() => {
    }),
    delay(6e3)
  ]);
  await delay(500);
  const raw = await page.evaluate((src) => {
    const DATE_RE = /\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/;
    const findAmtIdx = (headers) => {
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i].includes("monto original")) return i;
      }
      return headers.length > 0 ? headers.length - 1 : -1;
    };
    const parseAmt = (raw2) => {
      const isNeg = raw2.includes("-");
      const clean = raw2.replace(/\./g, "").replace(/[^\d]/g, "");
      const n = parseInt(clean, 10);
      return isNaN(n) || n === 0 ? null : { amount: isNeg ? n : -n, isNeg };
    };
    const movements = [];
    for (const table of Array.from(document.querySelectorAll("table"))) {
      const headerEls = table.querySelectorAll("thead th, thead td");
      const headers = Array.from(headerEls).map((h) => h.innerText?.trim().toLowerCase() || "");
      const amtIdx = findAmtIdx(headers);
      const cuotasIdx = headers.findIndex((h) => h.includes("cuota"));
      const dataRows = Array.from(table.querySelectorAll("tbody tr, tr")).filter(
        (r) => r.querySelectorAll("td").length >= 3
      );
      for (const row of dataRows) {
        const texts = Array.from(row.querySelectorAll("td")).map((c) => c.innerText?.trim() || "");
        const dateRaw = texts[0];
        const desc = texts[1] || "";
        if (!DATE_RE.test(dateRaw) || !desc.trim()) continue;
        const amtRaw = texts[amtIdx >= 0 && amtIdx < texts.length ? amtIdx : texts.length - 1] || "";
        const parsed = parseAmt(amtRaw);
        if (!parsed) continue;
        const installRaw = cuotasIdx >= 0 && cuotasIdx < texts.length ? texts[cuotasIdx] : "";
        const installments = /\d+\s*[Cc]uotas?|\d+\/\d+/.test(installRaw) ? installRaw : void 0;
        movements.push({ date: dateRaw, description: desc, amount: parsed.amount, installments, source: src });
      }
      if (movements.length > 0) return movements;
    }
    const ariaRows = Array.from(document.querySelectorAll("[role='row']")).filter(
      (r) => r.querySelectorAll("[role='cell'], [role='gridcell']").length >= 3
    );
    if (ariaRows.length > 0) {
      const headers = Array.from(document.querySelectorAll("[role='columnheader']")).map(
        (h) => h.innerText?.trim().toLowerCase() || ""
      );
      const amtIdx = findAmtIdx(headers);
      const cuotasIdx = headers.findIndex((h) => h.includes("cuota"));
      for (const row of ariaRows) {
        const texts = Array.from(row.querySelectorAll("[role='cell'], [role='gridcell']")).map(
          (c) => c.innerText?.trim() || ""
        );
        const dateRaw = texts[0];
        const desc = texts[1] || "";
        if (!DATE_RE.test(dateRaw) || !desc.trim()) continue;
        const amtRaw = texts[amtIdx >= 0 && amtIdx < texts.length ? amtIdx : texts.length - 1] || "";
        const parsed = parseAmt(amtRaw);
        if (!parsed) continue;
        const installRaw = cuotasIdx >= 0 && cuotasIdx < texts.length ? texts[cuotasIdx] : "";
        const installments = /\d+\s*[Cc]uotas?|\d+\/\d+/.test(installRaw) ? installRaw : void 0;
        movements.push({ date: dateRaw, description: desc, amount: parsed.amount, installments, source: src });
      }
      if (movements.length > 0) return movements;
    }
    const NOISE = /(ver todos|movimientos no facturados|movimientos facturados|nacionales|internacionales|fecha|operaci)/i;
    for (const el of Array.from(document.querySelectorAll("*"))) {
      const htmlEl = el;
      if (htmlEl.offsetParent === null) continue;
      const text = htmlEl.innerText?.trim() || "";
      if (text.length < 8 || text.length > 250) continue;
      const dateMatch = text.match(DATE_RE);
      if (!dateMatch) continue;
      const amtMatch = text.match(/\$\s*([\d\.]{3,})/);
      if (!amtMatch) continue;
      if (NOISE.test(text)) continue;
      const childHasBoth = Array.from(htmlEl.children).some((c) => {
        const ct = c.innerText?.trim() || "";
        return DATE_RE.test(ct) && /\$\s*[\d\.]{3,}/.test(ct);
      });
      if (childHasBoth) continue;
      const isCredit = /\+\s*\$/.test(text);
      const absAmt = parseInt(amtMatch[1].replace(/\./g, ""), 10);
      if (isNaN(absAmt) || absAmt === 0) continue;
      let desc = text.replace(dateMatch[0], "").replace(/\$[\d\.]+/g, "").replace(/\b\d+[,.]\d+%/g, "").replace(/\s+[+\-]\s*$/g, "").replace(/\s+/g, " ").trim();
      const installMatch = desc.match(/\b(\d+\s+[Cc]uotas?|[Cc]uota\s+\d+\/\d+)\b/);
      const installments = installMatch ? installMatch[0] : void 0;
      if (installments) desc = desc.replace(installments, "").replace(/\s+/g, " ").trim();
      movements.push({ date: dateMatch[1], description: desc, amount: isCredit ? absAmt : -absAmt, installments, source: src });
    }
    return movements;
  }, source);
  return raw.map((m) => {
    const inst = parseInstallments(m.installments);
    return {
      ...m,
      date: normalizeDate(m.date),
      balance: 0,
      source,
      ...inst ? { installments: inst } : {}
    };
  });
}
async function clickNextPage(page) {
  return page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, a, [role='button']"));
    for (const el of candidates) {
      const text = el.innerText?.trim() || "";
      const label = el.getAttribute("aria-label")?.toLowerCase() || "";
      const isNext = text === "\u203A" || text === ">" || text === "\u2192" || label.includes("siguiente") || label.includes("next") || el.className?.toLowerCase().includes("next");
      if (!isNext) continue;
      if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
      el.click();
      return true;
    }
    return false;
  });
}
async function extractTableMovements(page, source, debugLog) {
  const diag = await page.evaluate(() => ({
    tables: document.querySelectorAll("table").length,
    trs: document.querySelectorAll("tr").length,
    tds: document.querySelectorAll("td").length,
    ariaRows: document.querySelectorAll("[role='row']").length,
    ariaGridcells: document.querySelectorAll("[role='gridcell'], [role='cell']").length,
    ariaGrid: document.querySelectorAll("[role='grid'], [role='table']").length
  }));
  debugLog.push(`    DOM: tables=${diag.tables} tr=${diag.trs} td=${diag.tds} role=row:${diag.ariaRows} gridcell:${diag.ariaGridcells} grid:${diag.ariaGrid}`);
  const all = [];
  for (let pageNum = 1; pageNum <= 30; pageNum++) {
    const batch = await extractOnePage(page, source);
    debugLog.push(`    page ${pageNum}: ${batch.length} rows`);
    all.push(...batch);
    const hasNext = await clickNextPage(page);
    if (!hasNext) break;
    await delay(2e3);
  }
  return all;
}
async function extractDashboardBalance(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    const containers = all.filter((el) => {
      if (el.offsetParent === null) return false;
      const t = el.innerText?.toLowerCase() || "";
      return t.includes("utilizado") && t.includes("disponible") && t.includes("cupo total");
    });
    if (containers.length === 0) return null;
    const container = containers.sort(
      (a, b) => a.querySelectorAll("*").length - b.querySelectorAll("*").length
    )[0];
    const text = container.innerText || "";
    const lower = text.toLowerCase();
    const getAmtAfter = (label) => {
      const pos = lower.indexOf(label);
      if (pos < 0) return 0;
      const m = text.slice(pos).match(/\$([\d\.]+)/);
      return m ? parseInt(m[1].replace(/\./g, ""), 10) : 0;
    };
    const used = getAmtAfter("utilizado");
    const available = getAmtAfter("disponible");
    const total = getAmtAfter("cupo total");
    return used || available || total ? { used, available, total } : null;
  });
}
async function extractCardLabel(page) {
  return page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    for (const el of all) {
      const text = el.innerText?.trim() || "";
      if (/[●•\*]{2,}\s*\d{4}/.test(text) && text.length < 50 && el.children.length <= 2) {
        return text.replace(/\n/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    return "Tarjeta Cencosud";
  });
}
async function extractTabMovements(page, tabText, source, debugLog) {
  const clicked = await page.evaluate((txt) => {
    for (const el of Array.from(document.querySelectorAll("[role='tab'], button, li, span, div"))) {
      if (el.innerText?.trim().toLowerCase() === txt) {
        el.click();
        return true;
      }
    }
    return false;
  }, tabText.toLowerCase());
  if (clicked) {
    debugLog.push(`  Tab "${tabText}" selected`);
    await delay(2e3);
  }
  return extractTableMovements(page, source, debugLog);
}
async function scrapeCencosud(session, options) {
  const { rut, password, saveScreenshots: doScreenshots } = options;
  const { page, debugLog, screenshot: doSave } = session;
  const { onProgress } = options;
  const progress = onProgress || (() => {
  });
  debugLog.push("1. Navigating to Tarjeta Cencosud...");
  progress("Abriendo sitio de Tarjeta Cencosud...");
  await page.goto(LOGIN_URL5, { waitUntil: "networkidle2", timeout: 4e4 });
  await delay(2e3);
  await closePopups(page);
  await doSave(page, "01-loaded");
  debugLog.push("2. Filling RUT...");
  progress("Ingresando RUT...");
  if (!await fillRut(page, rut, { rutFormat: "clean" })) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank: BANK_ID, accounts: [], error: "No se encontr\xF3 campo de RUT", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(800);
  await doSave(page, "02-rut-filled");
  debugLog.push("3. Filling password...");
  progress("Ingresando clave...");
  if (!await fillPassword(page, password)) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank: BANK_ID, accounts: [], error: "No se encontr\xF3 campo de clave", screenshot: ss2, debug: debugLog.join("\n") };
  }
  await delay(600);
  debugLog.push("4. Submitting login...");
  progress("Iniciando sesi\xF3n...");
  const loginNavPromise = page.waitForNavigation({ waitUntil: "networkidle2", timeout: 3e4 }).catch(() => {
  });
  await clickSubmit(page, page, { submitTexts: ["ingresar", "entrar"] });
  await delay(2500);
  if (await detectCaptcha(page)) {
    if (!options.headful) {
      const ss2 = await page.screenshot({ encoding: "base64" });
      return {
        success: false,
        bank: BANK_ID,
        accounts: [],
        error: "CAPTCHA detectado en modo headless. Ejecuta nuevamente con --headful para resolverlo manualmente.",
        screenshot: ss2,
        debug: debugLog.join("\n")
      };
    }
    progress("CAPTCHA detectado \u2014 resu\xE9lvelo en el navegador...");
    const captchaTimeoutSec = parseInt(process.env.CENCOSUD_CAPTCHA_TIMEOUT || "180", 10);
    const solved = await waitForCaptcha(page, debugLog, captchaTimeoutSec);
    if (!solved) {
      const ss2 = await page.screenshot({ encoding: "base64" });
      return { success: false, bank: BANK_ID, accounts: [], error: "Timeout esperando CAPTCHA \u2014 resu\xE9lvelo en el navegador y vuelve a intentarlo", screenshot: ss2, debug: debugLog.join("\n") };
    }
    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 2e4 }).catch(() => {
    });
    await delay(2e3);
  } else {
    await loginNavPromise;
    await delay(2e3);
  }
  await doSave(page, "03-after-login");
  const loginError = await detectLoginError(page);
  if (loginError) {
    const ss2 = await page.screenshot({ encoding: "base64" });
    return { success: false, bank: BANK_ID, accounts: [], error: `Error del banco: ${loginError}`, screenshot: ss2, debug: debugLog.join("\n") };
  }
  debugLog.push("5. Login OK!");
  progress("Sesi\xF3n iniciada");
  await closePopups(page);
  await delay(1e3);
  debugLog.push("5b. Extracting dashboard balance...");
  const dashBalance = await extractDashboardBalance(page);
  if (dashBalance) {
    debugLog.push(`  Utilizado: ${dashBalance.used} | Disponible: ${dashBalance.available} | Cupo Total: ${dashBalance.total}`);
  } else {
    debugLog.push("  Balance card not found");
  }
  debugLog.push("6. Navigating to full movements page...");
  progress("Abriendo p\xE1gina de movimientos...");
  const navOk = await clickAndWait(page, ["Ver todos", "Ver todo", "Ver m\xE1s movimientos"], debugLog, 2e4);
  if (!navOk) {
    await clickAndWait(page, ["Movimientos", "Mis movimientos"], debugLog, 15e3);
  }
  await doSave(page, "04-movements-page");
  debugLog.push("7. Extracting card label...");
  const cardLabel = await extractCardLabel(page);
  debugLog.push(`  Label: ${cardLabel}`);
  debugLog.push("8. Extracting unbilled movements...");
  progress("Extrayendo movimientos no facturados...");
  const unbilledNac = await extractTabMovements(page, "nacionales", MOVEMENT_SOURCE.credit_card_unbilled, debugLog);
  debugLog.push(`  Unbilled nacionales: ${unbilledNac.length}`);
  const unbilledInt = await extractTabMovements(page, "internacionales", MOVEMENT_SOURCE.credit_card_unbilled, debugLog);
  debugLog.push(`  Unbilled internacionales: ${unbilledInt.length}`);
  debugLog.push("9. Navigating to billed movements...");
  progress("Abriendo movimientos facturados...");
  const billedNavOk = await clickAndWait(
    page,
    ["Ir a Movimientos Facturados", "Movimientos Facturados", "Facturados", "Estado de cuenta"],
    debugLog,
    2e4
  );
  let billedMovements = [];
  if (billedNavOk) {
    await doSave(page, "05-billed-page");
    billedMovements = await extractTableMovements(page, MOVEMENT_SOURCE.credit_card_billed, debugLog);
    debugLog.push(`  Billed: ${billedMovements.length}`);
  } else {
    debugLog.push("  Could not navigate to billed movements");
  }
  const allMovements = deduplicateMovements([...unbilledNac, ...unbilledInt, ...billedMovements]);
  debugLog.push(`10. Total movements: ${allMovements.length}`);
  progress(`Listo \u2014 ${allMovements.length} movimientos`);
  await doSave(page, "06-final");
  const ss = doScreenshots ? await page.screenshot({ encoding: "base64", fullPage: true }) : void 0;
  const creditCard = {
    label: cardLabel,
    ...dashBalance ? { national: dashBalance } : {},
    movements: allMovements
  };
  return {
    success: true,
    bank: BANK_ID,
    accounts: [],
    creditCards: [creditCard],
    screenshot: ss,
    debug: debugLog.join("\n")
  };
}
var cencosud = {
  id: BANK_ID,
  name: "Tarjeta Cencosud",
  url: LOGIN_URL5,
  scrape: (options) => runScraper(BANK_ID, options, {}, scrapeCencosud)
};
var cencosud_default = cencosud;

// bank-api/vendor/upstream/src/index.ts
var banks = {
  bancosecurity: bancosecurity_default,
  bchile: bchile_default,
  bci: bci_default,
  bestado: bestado_default,
  bice: bice_default,
  edwards: edwards_default,
  falabella: falabella_default,
  itau: itau_default,
  santander: santander_default,
  scotiabank: scotiabank_default,
  cencosud: cencosud_default
};
function listBanks() {
  return Object.values(banks).map((b) => ({
    id: b.id,
    name: b.name,
    url: b.url
  }));
}
function getBank(id) {
  return banks[id];
}
export {
  CARD_OWNER,
  MOVEMENT_SOURCE,
  bancosecurity_default as bancosecurity,
  banks,
  bchile_default as bchile,
  bci_default as bci,
  bestado_default as bestado,
  bice_default as bice,
  cencosud_default as cencosud,
  edwards_default as edwards,
  falabella_default as falabella,
  getBank,
  itau_default as itau,
  listBanks,
  santander_default as santander,
  scotiabank_default as scotiabank
};
