// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage = class {
  categories;
  expenses;
  constructor() {
    this.categories = /* @__PURE__ */ new Map();
    this.expenses = /* @__PURE__ */ new Map();
    this.initializeDefaultCategories();
  }
  async initializeDefaultCategories() {
    const defaultCategories = [
      { name: "Food", color: "#EF4444" },
      { name: "Transport", color: "#3B82F6" },
      { name: "Shopping", color: "#10B981" },
      { name: "Entertainment", color: "#F59E0B" }
    ];
    for (const cat of defaultCategories) {
      await this.createCategory(cat);
    }
  }
  async getCategories() {
    return Array.from(this.categories.values());
  }
  async createCategory(insertCategory) {
    const id = randomUUID();
    const category = {
      ...insertCategory,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.categories.set(id, category);
    return category;
  }
  async deleteCategory(id) {
    this.categories.delete(id);
  }
  async getExpenses() {
    return Array.from(this.expenses.values());
  }
  async getExpensesByDate(date2) {
    const expenses2 = Array.from(this.expenses.values()).filter(
      (expense) => expense.date === date2
    );
    return expenses2.map((expense) => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) : void 0
    }));
  }
  async getExpensesByDateRange(startDate, endDate) {
    const expenses2 = Array.from(this.expenses.values()).filter(
      (expense) => expense.date >= startDate && expense.date <= endDate
    );
    return expenses2.map((expense) => ({
      ...expense,
      category: expense.categoryId ? this.categories.get(expense.categoryId) : void 0
    }));
  }
  async createExpense(insertExpense) {
    const id = randomUUID();
    const expense = {
      ...insertExpense,
      details: insertExpense.details || null,
      categoryId: insertExpense.categoryId || null,
      id,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.expenses.set(id, expense);
    return expense;
  }
  async deleteExpense(id) {
    this.expenses.delete(id);
  }
  async getDailyTotal(date2) {
    const expenses2 = Array.from(this.expenses.values()).filter(
      (expense) => expense.date === date2
    );
    return expenses2.reduce((total, expense) => total + parseFloat(expense.amount), 0);
  }
  async getCategoryTotals(date2) {
    const expenses2 = Array.from(this.expenses.values()).filter(
      (expense) => expense.date === date2
    );
    const categoryTotals = /* @__PURE__ */ new Map();
    expenses2.forEach((expense) => {
      if (expense.categoryId) {
        const current = categoryTotals.get(expense.categoryId) || 0;
        categoryTotals.set(expense.categoryId, current + parseFloat(expense.amount));
      }
    });
    return Array.from(categoryTotals.entries()).map(([categoryId, total]) => ({
      categoryId,
      total,
      category: this.categories.get(categoryId)
    }));
  }
  async getMonthlyTotals(year, month) {
    const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
    const endDate = `${year}-${month.toString().padStart(2, "0")}-31`;
    const expenses2 = Array.from(this.expenses.values()).filter(
      (expense) => expense.date >= startDate && expense.date <= endDate
    );
    const dailyTotals = /* @__PURE__ */ new Map();
    expenses2.forEach((expense) => {
      const current = dailyTotals.get(expense.date) || 0;
      dailyTotals.set(expense.date, current + parseFloat(expense.amount));
    });
    return Array.from(dailyTotals.entries()).map(([date2, total]) => ({
      date: date2,
      total
    }));
  }
  async getWeeklyTotals(date2) {
    const currentDate = new Date(date2);
    const weeklyTotals = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(currentDate);
      day.setDate(currentDate.getDate() - i);
      const dayString = day.toISOString().split("T")[0];
      const dailyTotal = await this.getDailyTotal(dayString);
      weeklyTotals.push({
        date: dayString,
        total: dailyTotal
      });
    }
    return weeklyTotals;
  }
};
var storage = new MemStorage();

// shared/schema.ts
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, date } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  color: text("color").notNull(),
  // hex color code
  createdAt: timestamp("created_at").defaultNow()
});
var expenses = pgTable("expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  details: text("details"),
  categoryId: varchar("category_id").references(() => categories.id),
  date: date("date").notNull(),
  createdAt: timestamp("created_at").defaultNow()
});
var insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  color: true
});
var insertExpenseSchema = createInsertSchema(expenses).pick({
  name: true,
  amount: true,
  details: true,
  categoryId: true,
  date: true
});

// server/routes.ts
async function registerRoutes(app2) {
  app2.get("/api/categories", async (req, res) => {
    try {
      const categories2 = await storage.getCategories();
      res.json(categories2);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app2.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid category data" });
    }
  });
  app2.delete("/api/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });
  app2.get("/api/expenses", async (req, res) => {
    try {
      const { date: date2, startDate, endDate } = req.query;
      if (date2) {
        const expenses2 = await storage.getExpensesByDate(date2);
        res.json(expenses2);
      } else if (startDate && endDate) {
        const expenses2 = await storage.getExpensesByDateRange(startDate, endDate);
        res.json(expenses2);
      } else {
        const expenses2 = await storage.getExpenses();
        res.json(expenses2);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });
  app2.post("/api/expenses", async (req, res) => {
    try {
      console.log("Received expense data:", req.body);
      const validatedData = insertExpenseSchema.parse(req.body);
      console.log("Validated data:", validatedData);
      const expense = await storage.createExpense(validatedData);
      res.json(expense);
    } catch (error) {
      console.log("Validation error:", error);
      res.status(400).json({ message: "Invalid expense data", error: error.message });
    }
  });
  app2.delete("/api/expenses/:id", async (req, res) => {
    try {
      await storage.deleteExpense(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });
  app2.get("/api/analytics/daily-total", async (req, res) => {
    try {
      const { date: date2 } = req.query;
      if (!date2) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const total = await storage.getDailyTotal(date2);
      res.json({ total });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily total" });
    }
  });
  app2.get("/api/analytics/category-totals", async (req, res) => {
    try {
      const { date: date2 } = req.query;
      if (!date2) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const totals = await storage.getCategoryTotals(date2);
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category totals" });
    }
  });
  app2.get("/api/analytics/monthly-totals", async (req, res) => {
    try {
      const { year, month } = req.query;
      if (!year || !month) {
        return res.status(400).json({ message: "Year and month parameters required" });
      }
      const totals = await storage.getMonthlyTotals(parseInt(year), parseInt(month));
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch monthly totals" });
    }
  });
  app2.get("/api/analytics/weekly-totals", async (req, res) => {
    try {
      const { date: date2 } = req.query;
      if (!date2) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const totals = await storage.getWeeklyTotals(date2);
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly totals" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: false
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
      },
      manifest: {
        name: "Daily Expense Tracker",
        short_name: "DailySpend",
        description: "Track your daily expenses with ease.",
        theme_color: "#0ea5e9",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      }
    }),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const listenOptions = {
    port,
    host: "0.0.0.0"
  };
  if (process.env.REUSE_PORT === "true") {
    listenOptions.reusePort = true;
  }
  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
