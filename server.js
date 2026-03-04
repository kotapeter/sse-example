const http = require("http");

const PORT = process.env.PORT || 3000;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SSE Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #1a1a2e; color: #e0e0e0; padding: 2rem; }
    h1 { color: #00d4ff; margin-bottom: 1rem; }
    #status { padding: 0.5rem 1rem; border-radius: 4px; display: inline-block; margin-bottom: 1rem; font-weight: bold; }
    .connected { background: #0a3d0a; color: #4caf50; }
    .disconnected { background: #3d0a0a; color: #f44336; }
    #duration { color: #ffab40; margin-bottom: 1rem; }
    #events { background: #16213e; border: 1px solid #0f3460; border-radius: 4px; padding: 1rem; max-height: 70vh; overflow-y: auto; }
    .event { padding: 0.3rem 0; border-bottom: 1px solid #0f3460; }
    .event-id { color: #888; }
    .event-type { color: #00d4ff; }
    .event-data { color: #e0e0e0; }
    .event-time { color: #ffab40; font-size: 0.85em; }
  </style>
</head>
<body>
  <h1>SSE Test - Sevalla</h1>
  <div id="status" class="disconnected">DISCONNECTED</div>
  <div id="duration">Duration: --</div>
  <div id="events"></div>

  <script>
    const statusEl = document.getElementById("status");
    const durationEl = document.getElementById("duration");
    const eventsEl = document.getElementById("events");
    let connectedAt = null;
    let durationTimer = null;

    function updateDuration() {
      if (!connectedAt) return;
      const sec = Math.floor((Date.now() - connectedAt) / 1000);
      const min = Math.floor(sec / 60);
      const hrs = Math.floor(min / 60);
      durationEl.textContent = "Duration: " +
        String(hrs).padStart(2, "0") + ":" +
        String(min % 60).padStart(2, "0") + ":" +
        String(sec % 60).padStart(2, "0");
    }

    function addEvent(id, type, data) {
      const div = document.createElement("div");
      div.className = "event";
      div.innerHTML =
        '<span class="event-time">' + new Date().toISOString() + '</span> ' +
        '<span class="event-id">id:' + id + '</span> ' +
        '<span class="event-type">[' + type + ']</span> ' +
        '<span class="event-data">' + data + '</span>';
      eventsEl.prepend(div);
    }

    function connect() {
      const es = new EventSource("/events");

      es.onopen = function () {
        connectedAt = Date.now();
        statusEl.textContent = "CONNECTED";
        statusEl.className = "connected";
        durationTimer = setInterval(updateDuration, 1000);
        addEvent("-", "open", "Connection established");
      };

      es.addEventListener("counter", function (e) {
        addEvent(e.lastEventId, "counter", e.data);
      });

      es.addEventListener("heartbeat", function (e) {
        addEvent(e.lastEventId, "heartbeat", e.data);
      });

      es.onerror = function () {
        statusEl.textContent = "DISCONNECTED";
        statusEl.className = "disconnected";
        clearInterval(durationTimer);
        connectedAt = null;
        addEvent("-", "error", "Connection lost — reconnecting...");
      };
    }

    connect();
  </script>
</body>
</html>`;

function handleSSE(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  let counter = 0;

  // Send a counter event every second
  const counterInterval = setInterval(() => {
    counter++;
    res.write(`id:${counter}\nevent:counter\ndata:${JSON.stringify({ count: counter, time: new Date().toISOString() })}\n\n`);
  }, 1000);

  // Send a heartbeat every 15 seconds
  const heartbeatInterval = setInterval(() => {
    res.write(`id:hb-${Date.now()}\nevent:heartbeat\ndata:${JSON.stringify({ type: "keepalive", time: new Date().toISOString() })}\n\n`);
  }, 15000);

  // Send SSE comment ping every 15s (offset from heartbeat)
  const pingInterval = setInterval(() => {
    res.write(":ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(counterInterval);
    clearInterval(heartbeatInterval);
    clearInterval(pingInterval);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === "/events") {
    handleSSE(req, res);
  } else {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  }
});

server.listen(PORT, () => {
  console.log(`SSE test server running on port ${PORT}`);
});
