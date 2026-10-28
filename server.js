const express = require("express");
const { chromium } = require("playwright");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const TARGET_URL =
"https://fatkhurrr.github.io/lipo4Mon/index.html?id=79439077713884";

let browser = null;
let page = null;
let running = false;
let refreshTimer = null;
let lastError = null;
let lastRefresh = null;

async function startMonitor() {
if (running) return;

browser = await chromium.launch({
headless: true,
args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

page = await browser.newPage();
await page.goto(TARGET_URL, {
waitUntil: "domcontentloaded",
timeout: 60000
});

running = true;
lastError = null;

refreshTimer = setInterval(async () => {
if (!running || !page) return;

try {
  await page.reload({
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  lastRefresh = new Date().toISOString();
  lastError = null;
} catch (error) {
  lastError = error.message;
}

}, 5000);
}

async function stopMonitor() {
running = false;

if (refreshTimer) {
clearInterval(refreshTimer);
refreshTimer = null;
}

if (browser) {
await browser.close().catch(() => {});
}

browser = null;
page = null;
}

app.get("/api/status", (req, res) => {
res.json({
running,
target: TARGET_URL,
lastRefresh,
error: lastError
});
});

app.post("/api/start", async (req, res) => {
try {
await startMonitor();
res.json({ ok: true, running });
} catch (error) {
lastError = error.message;
await stopMonitor();
res.status(500).json({ ok: false, error: lastError });
}
});

app.post("/api/stop", async (req, res) => {
await stopMonitor();
res.json({ ok: true, running });
});

app.get("/", (req, res) => {
res.send("<!doctype html> <html lang="id"> <meta name="viewport" content="width=device-width,initial-scale=1"> <title>LiFePO4 Cloud Monitor</title> <body style="font-family:Arial;background:#101820;color:white;padding:24px"> <h2>LiFePO4 Cloud Monitor</h2> <p>Refresh otomatis setiap 5 detik.</p> <button onclick="control('start')">START</button> <button onclick="control('stop')">STOP</button> <pre id="status">Memuat status...</pre> <script> async function control(action) { const r = await fetch('/api/' + action, {method:'POST'}); const d = await r.json(); document.getElementById('status').textContent = JSON.stringify(d, null, 2); } async function update() { try { const r = await fetch('/api/status'); document.getElementById('status').textContent = JSON.stringify(await r.json(), null, 2); } catch(e) {} } update(); setInterval(update, 2000); </script> </body> </html>");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
console.log("LiFePO4 Cloud Monitor listening on " + PORT);
});

process.on("SIGTERM", async () => {
await stopMonitor();
process.exit(0);
});
