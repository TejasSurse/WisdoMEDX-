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
  res.render("home");
});
app.get("/form", (req, res) => {
  res.render("form", { price: 100 });
});

app.post("/send", upload.single("document"), async (req, res) => {
  const { fullname, phone, pages, delivery } = req.body;
  const file = req.file;

  const price = calculatePrice(Number(pages), delivery);

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
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

    // Send proper HTML response
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            background-color: #f3f4f6;
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
          }
          .container {
            background: #fff;
            padding: 2rem 3rem;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            max-width: 500px;
            text-align: center;
          }
          h1 {
            color: #16a34a;
            margin-bottom: 1rem;
          }
          p {
            margin: 0.5rem 0;
            font-size: 1rem;
            color: #333;
          }
          .price {
            font-weight: bold;
            font-size: 1.2rem;
            color: #111827;
            margin-top: 1rem;
          }
          .btn {
            display: inline-block;
            margin-top: 1.5rem;
            padding: 0.5rem 1rem;
            background-color: #3b82f6;
            color: #fff;
            text-decoration: none;
            border-radius: 6px;
            transition: background 0.3s;
          }
          .btn:hover {
            background-color: #2563eb;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Order Sent Successfully!</h1>
          <p><strong>Name:</strong> ${fullname}</p>
          <p><strong>Phone:</strong> ${phone}</p>
          <p><strong>Pages:</strong> ${pages}</p>
          <p><strong>Delivery:</strong> ${delivery}</p>
          <p class="price">Estimated Price: ₹${price}</p>
          <a href="/" class="btn">Back to Home</a>
        </div>
      </body>
      </html>
    `);

  } catch (err) {
    console.error(err);
    res.status(500).send(`
      <h2 style="text-align:center;margin-top:2rem;color:red;">Error sending e-mail. Please try again.</h2>
      <p style="text-align:center;"><a href="/" style="color:blue;">Back to Home</a></p>
    `);
  }
});




app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
