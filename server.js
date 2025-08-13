const express = require("express");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Serve index.html from root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// --- API ROUTES ---

// 1. Detect intent from Tamil text
app.post("/intent", async (req, res) => {
  try {
    const { tamilText } = req.body;
    if (!tamilText) {
      return res.json({ success: false, error: "No Tamil text provided" });
    }

    // Call OpenAI to translate + get intent
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a Tamil-to-English translator and intent detector." },
        { role: "user", content: `Translate this to English and detect the intent: ${tamilText}` }
      ]
    });

    const intent = completion.choices[0].message.content.trim();
    res.json({ success: true, intent });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Intent detection failed" });
  }
});

// 2. Generate code based on intent
app.post("/generate-code", async (req, res) => {
  try {
    const { intent } = req.body;
    if (!intent) {
      return res.json({ success: false, error: "No intent provided" });
    }

    // Call OpenAI to generate HTML code
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You generate full HTML websites based on a request." },
        { role: "user", content: `Generate a simple HTML site for: ${intent}` }
      ]
    });

    const generatedCode = completion.choices[0].message.content;

    // Save generated site
    const outputDir = path.join(__dirname, "generated-site");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    fs.writeFileSync(path.join(outputDir, "index.html"), generatedCode);

    res.json({ success: true, files: ["index.html"] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: "Code generation failed" });
  }
});

// 3. Preview generated site
app.get("/preview/index.html", (req, res) => {
  const previewFile = path.join(__dirname, "generated-site", "index.html");
  if (fs.existsSync(previewFile)) {
    res.sendFile(previewFile);
  } else {
    res.status(404).send("No generated site found");
  }
});

// 4. Download generated site as zip
app.get("/download", (req, res) => {
  const outputDir = path.join(__dirname, "generated-site");
  if (!fs.existsSync(outputDir)) {
    return res.status(404).send("No generated site found");
  }

  const zipPath = path.join(__dirname, "site.zip");
  const output = fs.createWriteStream(zipPath);
  const archive = archiver("zip", { zlib: { level: 9 } });

  output.on("close", () => {
    res.download(zipPath, "generated-site.zip", () => {
      fs.unlinkSync(zipPath); // delete zip after download
    });
  });

  archive.pipe(output);
  archive.directory(outputDir, false);
  archive.finalize();
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});


