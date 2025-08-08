import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCategorySchema, insertExpenseSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const validatedData = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validatedData);
      res.json(category);
    } catch (error) {
      res.status(400).json({ message: "Invalid category data" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete category" });
    }
  });

  // Expenses
  app.get("/api/expenses", async (req, res) => {
    try {
      const { date, startDate, endDate } = req.query;
      
      if (date) {
        const expenses = await storage.getExpensesByDate(date as string);
        res.json(expenses);
      } else if (startDate && endDate) {
        const expenses = await storage.getExpensesByDateRange(startDate as string, endDate as string);
        res.json(expenses);
      } else {
        const expenses = await storage.getExpenses();
        res.json(expenses);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch expenses" });
    }
  });

  app.post("/api/expenses", async (req, res) => {
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

  app.delete("/api/expenses/:id", async (req, res) => {
    try {
      await storage.deleteExpense(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete expense" });
    }
  });

  // Analytics
  app.get("/api/analytics/daily-total", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const total = await storage.getDailyTotal(date as string);
      res.json({ total });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch daily total" });
    }
  });

  app.get("/api/analytics/category-totals", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const totals = await storage.getCategoryTotals(date as string);
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category totals" });
    }
  });

  app.get("/api/analytics/monthly-totals", async (req, res) => {
    try {
      const { year, month } = req.query;
      if (!year || !month) {
        return res.status(400).json({ message: "Year and month parameters required" });
      }
      const totals = await storage.getMonthlyTotals(parseInt(year as string), parseInt(month as string));
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch monthly totals" });
    }
  });

  app.get("/api/analytics/weekly-totals", async (req, res) => {
    try {
      const { date } = req.query;
      if (!date) {
        return res.status(400).json({ message: "Date parameter required" });
      }
      const totals = await storage.getWeeklyTotals(date as string);
      res.json(totals);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch weekly totals" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
