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
app.use(express.static("public")); // Serve static files from "public"

// ---- Multer setup ----
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Invalid file type for ${file.fieldname}. Allowed types: PDF, DOCX, JPG, PNG`), false);
        }
    }
}).fields([
    { name: 'document', maxCount: 1 },
    { name: 'payment', maxCount: 1 }
]);

// ---- Price calculator ----
function calculatePrice(pages, delivery) {
    const pagesNum = parseInt(pages);
    let rate = 2;
    if (pagesNum > 100 && pagesNum <= 500) rate = 1.5;
    else if (pagesNum >= 1000) rate = 1;
    const basePrice = pagesNum * rate;
    let multiplier = 1;
    if (delivery === "instant") multiplier = 1.5; // Match frontend
    else if (delivery === "1-day") multiplier = 1.2; // Match frontend
    return Math.round(basePrice * multiplier);
}

// ---- Routes ----
app.get("/", (req, res) => {
    res.render("home");
});

app.get("/form", (req, res) => {
    res.render("form", { price: 100 });
});

app.post("/send", (req, res, next) => {
    upload(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).send(err.message);
        }
        next();
    });
}, async (req, res) => {
    const { fullname, phone, email, pages, delivery, price, aiCheck } = req.body;
    const documentFile = req.files['document'] ? req.files['document'][0] : null;
    const paymentFile = req.files['payment'] ? req.files['payment'][0] : null;

    // Debugging: Log received files
    console.log('Received files:', req.files);
    console.log('Document file:', documentFile ? documentFile.originalname : 'None');
    console.log('Payment file:', paymentFile ? paymentFile.originalname : 'None');
    console.log('Form data:', { fullname, phone, email, pages, delivery, price, aiCheck });

    try {
        if (!documentFile) {
            throw new Error('Document file is required');
        }
        if (!paymentFile) {
            throw new Error('Payment screenshot is required');
        }

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
        });

        // Delivery badge colors
        let deliveryColor = "#16a34a"; // default green
        if (delivery === "instant") deliveryColor = "#dc2626"; // red
        else if (delivery === "1-day") deliveryColor = "#f59e0b"; // orange

        // HTML email template
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; background:#f9fafb; padding:20px;">
                <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.1);">
                    <h2 style="color:#1e82c4; text-align:center;">📄 New Document Order</h2>
                    <p style="font-size:14px; color:#6b7280; text-align:center;">A new order has been submitted via your form</p>
                    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;"/>
                    <p><strong>Name:</strong> ${fullname}</p>
                    <p><strong>Phone:</strong> ${phone}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Pages:</strong> ${pages}</p>
                    <p><strong>Delivery:</strong> 
                        <span style="background:${deliveryColor}; color:white; padding:4px 10px; border-radius:6px; font-weight:bold; text-transform:capitalize;">
                            ${delivery}
                        </span>
                    </p>
                    <p><strong>AI-Enhanced Check:</strong> ${aiCheck ? 'Yes (+₹39)' : 'No'}</p>
                    <p style="font-size:18px; font-weight:bold; color:#111827; margin-top:20px;">
                        💰 Estimated Price: <span style="color:#1e82c4;">₹${price}</span>
                    </p>
                    <hr style="margin:20px 0; border:none; border-top:1px solid #e5e7eb;"/>
                    <p style="font-size:13px; color:#6b7280; text-align:center;">
                        This is an automated order notification email from your system.
                    </p>
                </div>
            </div>
        `;

        // Prepare attachments for both document and payment screenshot
        const attachments = [];
        if (documentFile) {
            attachments.push({ filename: documentFile.originalname, content: documentFile.buffer });
        }
        if (paymentFile) {
            attachments.push({ filename: paymentFile.originalname, content: paymentFile.buffer });
        }

        await transporter.sendMail({
            from: `"Print Service" <${process.env.EMAIL_USER}>`,
            to: process.env.RECEIVER_EMAIL || process.env.EMAIL_USER,
            subject: "📝 New Document Order Received",
            text: `Name: ${fullname}\nPhone: ${phone}\nPages: ${pages}\nDelivery: ${delivery}\nAI-Enhanced Check: ${aiCheck ? 'Yes' : 'No'}\nPrice: ₹${price}`,
            html: htmlContent,
            attachments: attachments,
        });

        // Confirmation page back to client
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
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Pages:</strong> ${pages}</p>
                    <p><strong>Delivery:</strong> ${delivery}</p>
                    <p><strong>AI-Enhanced Check:</strong> ${aiCheck ? 'Yes' : 'No'}</p>
                    <p class="price">Estimated Price: ₹${price}</p>
                    <a href="/" class="btn">Back to Home</a>
                </div>
            </body>
            </html>
        `);

    } catch (err) {
        console.error('Error in /send route:', err);
        res.status(500).send(`
            <h2 style="text-align:center;margin-top:2rem;color:red;">Error sending e-mail: ${err.message}. Please try again.</h2>
            <p style="text-align:center;"><a href="/" style="color:blue;">Back to Home</a></p>
        `);
    }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));