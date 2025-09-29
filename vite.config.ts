import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { promises as fs } from "node:fs";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "preset-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          console.log(`Request: ${req.method} ${req.url}`);
          
          // Save preset
          if (req.method === "POST" && req.url === "/api/presets/save") {
            console.log("Handling save preset request");
            let body = "";
            req.on("data", (chunk) => (body += chunk.toString()));
            req.on("end", async () => {
              try {
                const { name, data } = JSON.parse(body);
                const presetsDir = path.join(process.cwd(), "src", "presets");
                await fs.mkdir(presetsDir, { recursive: true });
                
                const filePath = path.join(presetsDir, `${name}.json`);
                await fs.writeFile(filePath, JSON.stringify(data, null, 2));
                
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
                res.setHeader("Access-Control-Allow-Headers", "Content-Type");
                res.end(JSON.stringify({ success: true, message: `Preset ${name} saved successfully` }));
              } catch (error) {
                console.error("Save preset error:", error);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: false, error: "Failed to save preset" }));
              }
            });
            return;
          }
          
          // List presets
          if (req.method === "GET" && req.url === "/api/presets/list") {
            console.log("Handling list presets request");
            (async () => {
              try {
                const presetsDir = path.join(process.cwd(), "src", "presets");
                const files = await fs.readdir(presetsDir);
                const presets = files
                  .filter(file => file.endsWith('.json'))
                  .map(file => file.replace('.json', ''));
                
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ presets }));
              } catch (error) {
                console.error("List presets error:", error);
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(JSON.stringify({ success: false, error: "Failed to list presets" }));
              }
            })();
            return;
          }
          
          // Handle OPTIONS requests for CORS
          if (req.method === "OPTIONS") {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.setHeader("Access-Control-Allow-Headers", "Content-Type");
            res.end();
            return;
          }
          
          next();
        });
      },
    },
  ],
  server: {
    port: 5173,
  },
});
