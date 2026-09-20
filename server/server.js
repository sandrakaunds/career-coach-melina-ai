
import process from "node:process";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing from .env");
  process.exit(1);
}

if (!process.env.SUPABASE_URL) {
  console.error("❌ SUPABASE_URL is missing from .env");
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is missing from .env");
  process.exit(1);
}

console.log("✅ GEMINI_API_KEY found");
console.log("✅ SUPABASE_URL found");
console.log("✅ SUPABASE_SERVICE_ROLE_KEY found");

const app = express();
const PORT = process.env.PORT || 5000;

const FREE_CONVERSATIONS = 3;

const PAID_PLANS = {
  INDIA: {
    price: 499,
    currency: "INR",
    conversations: 25,
  },

  INTERNATIONAL: {
    price: 12,
    currency: "USD",
    conversations: 70,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODELS = ["gemini-3.6-flash"];

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());


// ======================================
// HELPER FUNCTIONS
// ======================================

async function getVisitorFromRequest(req) {
  const visitorId = req.headers["x-visitor-id"];

  if (!visitorId) {
    return null;
  }

  const { data, error } = await supabase
    .from("visitors")
    .select("*")
    .eq("visitor_id", visitorId)
    .maybeSingle();

  if (error) {
    console.error("❌ Error loading visitor:", error);
    throw error;
  }

  return data || null;
}


function getPlanForCountry(country) {
  if (!country) {
    return PAID_PLANS.INTERNATIONAL;
  }

  const normalizedCountry = country.trim().toLowerCase();

  if (
    normalizedCountry === "india" ||
    normalizedCountry === "in"
  ) {
    return PAID_PLANS.INDIA;
  }

  return PAID_PLANS.INTERNATIONAL;
}


function getAccessInfo(visitor) {
  const freeUsed = Number(visitor.free_used || 0);
  const paidUsed = Number(visitor.paid_used || 0);
  const paidLimit = Number(visitor.paid_limit || 0);

  const freeRemaining = Math.max(
    FREE_CONVERSATIONS - freeUsed,
    0
  );

  const paidRemaining = Math.max(
    paidLimit - paidUsed,
    0
  );

  return {
    visitorId: visitor.visitor_id,

    name: visitor.name,
    email: visitor.email,
    phone: visitor.phone,
    country: visitor.country,

    freeUsed,
    freeLimit: FREE_CONVERSATIONS,
    freeRemaining,

    paidUsed,
    paidLimit,
    paidRemaining,

    paidAccess: visitor.paid_access,

    paymentRequired:
      !visitor.paid_access &&
      freeRemaining <= 0,

    paidPlan: visitor.paid_plan,
  };
}


// ======================================
// GEMINI RETRY
// ======================================

async function generateWithRetry(prompt) {
  let lastError = null;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(
          `Calling Gemini model: ${model}, attempt ${attempt}`
        );

        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        return response;
      } catch (error) {
        lastError = error;

        console.error(
          `Gemini error on ${model}, attempt ${attempt}:`,
          error?.message || error
        );

        await new Promise((resolve) =>
          setTimeout(resolve, 1000)
        );
      }
    }
  }

  throw lastError;
}


// ======================================
// HOME
// ======================================

app.get("/", (req, res) => {
  res.send("Melina AI Backend is running!");
});


// ======================================
// SUPABASE DATABASE TEST
// ======================================

app.get("/api/database-test", async (req, res) => {
  try {
    console.log("Testing Supabase connection...");

    const { data, error } = await supabase
      .from("visitors")
      .select("visitor_id")
      .limit(1);

    if (error) {
      console.error(
        "❌ Supabase database test failed:",
        error
      );

      return res.status(500).json({
        connected: false,
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
    }

    console.log(
      "✅ Supabase database test successful."
    );

    return res.json({
      connected: true,
      message:
        "Supabase database connection is working.",
      rowsFound: data?.length ?? 0,
    });
  } catch (error) {
    console.error(
      "❌ Database test exception:",
      error
    );

    return res.status(500).json({
      connected: false,
      error: error.message,
    });
  }
});


// ======================================
// REGISTER
// ======================================

app.post("/api/register", async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      country,
    } = req.body;

    if (!name || !email || !phone || !country) {
      return res.status(400).json({
        error: "Name, email, phone and country are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone.trim();
    const cleanCountry = country.trim();

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        error: "Please enter a valid email address.",
      });
    }

    const visitorId = crypto.randomUUID();

    const paidPlan =
      getPlanForCountry(cleanCountry);

    const visitor = {
      visitor_id: visitorId,

      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      country: cleanCountry,

      free_used: 0,

      paid_access: false,

      paid_used: 0,

      paid_limit: paidPlan.conversations,

      paid_plan: {
        price: paidPlan.price,
        currency: paidPlan.currency,
        conversations: paidPlan.conversations,
      },
    };

    const {
      data,
      error,
    } = await supabase
      .from("visitors")
      .insert(visitor)
      .select("*")
      .single();

    if (error) {
      console.error(
        "❌ Registration database error:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json(
      getAccessInfo(data)
    );
  } catch (error) {
    console.error(
      "❌ Registration error:",
      error
    );

    return res.status(500).json({
      error: "Registration failed.",
    });
  }
});


// ======================================
// UPDATE PROFILE
// ======================================

app.patch("/api/profile", async (req, res) => {
  try {
    const visitor =
      await getVisitorFromRequest(req);

    if (!visitor) {
      return res.status(404).json({
        error: "Visitor not found.",
      });
    }

    const {
      name,
      email,
      phone,
      country,
    } = req.body;

    const updates = {};

    if (name !== undefined) {
      updates.name = name.trim();
    }

    if (email !== undefined) {
      updates.email =
        email.trim().toLowerCase();
    }

    if (phone !== undefined) {
      updates.phone = phone.trim();
    }

    if (country !== undefined) {
      updates.country = country.trim();

      const newPlan =
        getPlanForCountry(
          updates.country
        );

      updates.paid_limit =
        newPlan.conversations;

      updates.paid_plan = {
        price: newPlan.price,
        currency: newPlan.currency,
        conversations:
          newPlan.conversations,
      };
    }

    updates.updated_at =
      new Date().toISOString();

    const {
      data,
      error,
    } = await supabase
      .from("visitors")
      .update(updates)
      .eq(
        "visitor_id",
        visitor.visitor_id
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "❌ Profile update error:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json(
      getAccessInfo(data)
    );
  } catch (error) {
    console.error(
      "❌ Profile error:",
      error
    );

    return res.status(500).json({
      error: "Profile update failed.",
    });
  }
});


// ======================================
// ACCESS
// ======================================

app.get("/api/access", async (req, res) => {
  try {
    const visitor =
      await getVisitorFromRequest(req);

    if (!visitor) {
      return res.status(404).json({
        error: "Visitor not found.",
      });
    }

    return res.json(
      getAccessInfo(visitor)
    );
  } catch (error) {
    console.error(
      "❌ Access error:",
      error
    );

    return res.status(500).json({
      error: "Unable to load access information.",
    });
  }
});


// ======================================
// CHAT
// ======================================

app.post("/api/chat", async (req, res) => {
  try {
    const visitor =
      await getVisitorFromRequest(req);

    if (!visitor) {
      return res.status(404).json({
        error: "Visitor not found.",
      });
    }

    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        error: "Message is required.",
      });
    }

    const freeUsed =
      Number(visitor.free_used || 0);

    const paidUsed =
      Number(visitor.paid_used || 0);

    const paidLimit =
      Number(visitor.paid_limit || 0);

    let usageType = null;

    if (
      !visitor.paid_access &&
      freeUsed < FREE_CONVERSATIONS
    ) {
      usageType = "free";
    } else if (
      visitor.paid_access &&
      paidUsed < paidLimit
    ) {
      usageType = "paid";
    } else {
      return res.status(402).json({
        error:
          "Your available conversations have been used.",
        ...getAccessInfo(visitor),
      });
    }

    const prompt = `
You are Melina AI, a professional career coach.

Help the user with:
- Career planning
- Resume improvement
- Interview preparation
- Job search
- Business analysis
- Data analysis
- IT careers
- Skills development
- Professional communication

Be supportive, practical, concise and professional.

User name: ${visitor.name}
Country: ${visitor.country}

User message:
${message.trim()}
`;

    const response =
      await generateWithRetry(prompt);

    const reply =
      response?.text ||
      "I'm sorry, I couldn't generate a response right now.";

    const updates = {
      updated_at:
        new Date().toISOString(),
    };

    if (usageType === "free") {
      updates.free_used =
        freeUsed + 1;
    }

    if (usageType === "paid") {
      updates.paid_used =
        paidUsed + 1;
    }

    const {
      data: updatedVisitor,
      error: updateError,
    } = await supabase
      .from("visitors")
      .update(updates)
      .eq(
        "visitor_id",
        visitor.visitor_id
      )
      .select("*")
      .single();

    if (updateError) {
      console.error(
        "❌ Usage update error:",
        updateError
      );

      return res.status(500).json({
        error:
          "Response generated, but usage could not be saved.",
        reply,
      });
    }

    return res.json({
      reply,
      ...getAccessInfo(updatedVisitor),
    });
  } catch (error) {
    console.error(
      "❌ Chat error:",
      error
    );

    return res.status(500).json({
      error:
        error?.message ||
        "Chat request failed.",
    });
  }
});


// ======================================
// DEVELOPMENT UNLOCK
// ======================================

app.post("/api/dev/unlock", async (req, res) => {
  try {
    const visitor =
      await getVisitorFromRequest(req);

    if (!visitor) {
      return res.status(404).json({
        error: "Visitor not found.",
      });
    }

    const paidPlan =
      getPlanForCountry(
        visitor.country
      );

    const {
      data,
      error,
    } = await supabase
      .from("visitors")
      .update({
        paid_access: true,
        paid_used: 0,
        paid_limit:
          paidPlan.conversations,
        paid_plan: {
          price: paidPlan.price,
          currency: paidPlan.currency,
          conversations:
            paidPlan.conversations,
        },
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "visitor_id",
        visitor.visitor_id
      )
      .select("*")
      .single();

    if (error) {
      console.error(
        "❌ Unlock error:",
        error
      );

      return res.status(500).json({
        error: error.message,
      });
    }

    return res.json(
      getAccessInfo(data)
    );
  } catch (error) {
    console.error(
      "❌ Unlock exception:",
      error
    );

    return res.status(500).json({
      error: "Unlock failed.",
    });
  }
});


// ======================================
// START SERVER
// ======================================

app.listen(PORT, () => {
  console.log("");
  console.log("======================================");
  console.log("        MELINA AI BACKEND");
  console.log("======================================");
  console.log(
    `Server running at http://localhost:${PORT}`
  );
  console.log(
    "Gemini API connection is configured."
  );
  console.log(
    "Supabase database connection is configured."
  );
  console.log(
    "Automatic Gemini retry is enabled."
  );
  console.log("");
  console.log(
    `Free conversations: ${FREE_CONVERSATIONS}`
  );
  console.log(
    "India: ₹499 → 25 conversations"
  );
  console.log(
    "International: $12 → 70 conversations"
  );
  console.log("======================================");
});


