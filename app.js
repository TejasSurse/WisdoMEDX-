const express = require("express");
const nodemailer = require("nodemailer");
const multer = require("multer");
const bodyParser = require("body-parser");
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Middlewares ----
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

// ---- Multer setup ----
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ---- Price calculator ----
function calculatePrice(pages, delivery) {
  let basePrice = 100; // up to 50 pages
  if (pages > 50 && pages <= 100) basePrice = 150;
  if (pages > 100) basePrice = 150 + Math.ceil((pages - 100) / 50) * 50; // optional extra

  let multiplier = 1;
  if (delivery === "immediate") multiplier += 0.5;      // +50%
  else if (delivery === "oneday") multiplier += 0.2;     // +20%

  return Math.round(basePrice * multiplier);
}

// ---- Routes ----
app.get("/", (req, res) => {
  res.render("form", { price: 100 });
});

app.post("/send", upload.single("document"), async (req, res) => {
  const { fullname, phone, pages, delivery } = req.body;
  const file = req.file;

  const price = calculatePrice(Number(pages), delivery);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",                      // or smtp config
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });

    await transporter.sendMail({
      from: `"Print Service" <${process.env.EMAIL_USER}>`,
      to: process.env.RECEIVER_EMAIL || process.env.EMAIL_USER,
      subject: "New Document Order",
      text: `Name: ${fullname}
Phone: ${phone}
Pages: ${pages}
Delivery: ${delivery}
Price: ₹${price}`,
      attachments: file
        ? [{ filename: file.originalname, content: file.buffer }]
        : [],
    });

    res.send(`<h2 style="text-align:center;margin-top:2rem;">Order sent successfully! Estimated price: ₹${price}</h2>`);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending e-mail.");
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
