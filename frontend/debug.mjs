import { spawn } from "child_process";
import http from "http";
import fs from "fs";
import { WebSocket } from "ws";

const EDGE = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

const edge = spawn(EDGE, [
  "--headless=new", "--disable-gpu", "--no-sandbox",
  "--remote-debugging-port=9236", "--window-size=1440,900",
  "http://localhost:5173/",
]);
edge.stderr.on("data", () => {});

const logs = [];

async function main() {
  await new Promise((r) => setTimeout(r, 5000));

  const pagesResp = await new Promise((resolve, reject) => {
    http.get("http://localhost:9236/json", (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }).on("error", reject);
  });

  const target = pagesResp.find((p) => p.url && p.url.includes("5173"));
  if (!target) { console.log("No target"); edge.kill(); process.exit(1); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  let msgId = 0;

  function send(method, params) {
    ws.send(JSON.stringify({ id: ++msgId, method, params: params || {} }));
  }

  ws.on("open", () => {
    send("Runtime.enable");
    send("Log.enable");
    send("Page.enable");
  });

  ws.on("message", (data) => {
    const msg = JSON.parse(data.toString());

    if (msg.method === "Runtime.consoleAPICalled") {
      const args = (msg.params?.args || []).map(a => a.value ?? a.description ?? JSON.stringify(a)).join(" ");
      logs.push(`[CONSOLE ${msg.params.type}] ${args}`);
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const ex = msg.params?.exceptionDetails;
      const text = ex?.text || ex?.exception?.description || "";
      const stack = ex?.stackTrace?.callFrames?.map(f => `${f.functionName || ''}@${f.url}:${f.lineNumber}`).join("\n    ") || "";
      logs.push(`[EXCEPTION] ${text}\n    Stack: ${stack}`);
      if (ex?.exception?.className) logs.push(`    Class: ${ex.exception.className}`);
    }
    if (msg.method === "Log.entryAdded") {
      const e = msg.params?.entry;
      logs.push(`[LOG ${e?.level}] ${e?.text || e?.url || JSON.stringify(e)}`);
    }

    // After Page.enable (id 3), navigate to stock page
    if (msg.id === 3 && !msg.error) {
      setTimeout(() => {
        logs.push("--- NAVIGATING TO /stock/600519 ---");
        send("Page.navigate", { url: "http://localhost:5173/stock/600519" });
      }, 3000);
    }

    // After navigation (id 4), wait and capture screenshot
    if (msg.id === 4) {
      setTimeout(() => {
        send("Page.captureScreenshot", { format: "png" });
      }, 6000);
    }

    if (msg.id === 5 && msg.result) {
      fs.writeFileSync("C:\\Users\\34026\\项目开发2\\frontend\\debug-stock.png", Buffer.from(msg.result.data, "base64"));
      console.log("SCREENSHOT SAVED");
      console.log("--- ALL LOGS ---");
      for (const l of logs) console.log(l);
      ws.close(); edge.kill(); process.exit(0);
    }
  });

  ws.on("error", (e) => { console.error("WS:", e.message); edge.kill(); process.exit(1); });
}

main().catch((e) => { console.error(e.message); edge.kill(); process.exit(1); });
setTimeout(() => { console.log("--- TIMEOUT ---"); for (const l of logs) console.log(l); edge.kill(); process.exit(1); }, 50000);
