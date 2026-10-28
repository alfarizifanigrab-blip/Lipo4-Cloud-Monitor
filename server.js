const express = require("express");
const { chromium } = require("playwright");

const app = express();

app.use(express.json());

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

  try {
    page = await browser.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    running = true;
    lastError = null;
    lastRefresh = new Date().toISOString();

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
  } catch (error) {
    await browser.close().catch(() => {});
    browser = null;
    page = null;
    throw error;
  }
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
    res.status(500).json({
      ok: false,
      error: lastError
    });
  }
});

app.post("/api/stop", async (req, res) => {
  await stopMonitor();
  res.json({ ok: true, running });
});

app.get("/", (req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LiFePO4 Cloud Monitor</title>
<style>
body{font-family:Arial;background:#101820;color:white;padding:24px}
button{padding:14px 24px;margin:5px;border:0;border-radius:8px;font-weight:bold}
pre{background:#202c38;padding:16px;border-radius:8px;white-space:pre-wrap;overflow-wrap:anywhere}
</style>
</head>
<body>
<h2>LiFePO4 Cloud Monitor</h2>
<p>Refresh otomatis setiap 5 detik.</p>
<button onclick="control('start')">START</button>
<button onclick="control('stop')">STOP</button>
<pre id="status">Memuat status...</pre>
<script>
async function control(action){
  const el=document.getElementById('status');
  try{
    const r=await fetch('/api/'+action,{method:'POST'});
    const d=await r.json();
    el.textContent=JSON.stringify(d,null,2);
  }catch(e){
    el.textContent='Error: '+e.message;
  }
}
async function update(){
  try{
    const r=await fetch('/api/status');
    const d=await r.json();
    document.getElementById('status').textContent=
      JSON.stringify(d,null,2);
  }catch(e){}
}
update();
setInterval(update,2000);
</script>
</body>
</html>`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("LiFePO4 Cloud Monitor listening on " + PORT);
});

process.on("SIGTERM", async () => {
  await stopMonitor();
  process.exit(0);
});
