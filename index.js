const express = require("express");
const app = express();
const port = 3000;
const db = require("./db");
const cors = require("cors");
const nodemailer = require("nodemailer");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const otpStore = {};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "solankiprithviraj253@gmail.com",
    pass: "czss rlxw fkbz hkzv",
  },
});

app.post("/send-otp", (req, res) => {
  const { email } = req.body;

  const otp = generateOtp();

  otpStore[email] = {
    otp
  };

  const mailOptions = {
    from: "solankiprithviraj253@gmail.com",
    to: email,
    subject: "Your OTP Code",
    text: `Your OTP is ${otp}`,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) {
      console.log("Email error:", err);
      return res.status(500).json({ error: "OTP send failed" });
    }

    console.log(`OTP sent to ${email}: ${otp}`);
    return res.json({ message: "OTP sent successfully" });
  });
});

app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  const data = otpStore[email];

  if (!data) {
    return res.status(400).json({ error: "OTP not found. Please resend." });
  }

  if (data.otp !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }

  return res.json({ message: "OTP verified successfully" });
});

app.get("/", (req, res) => {
  res.send("MySQL Connected with Node.js ✅");
  console.log(otpStore);
});

app.get("/users", (req, res) => {
  db.query("SELECT *FROM users", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/users/:id", (req, res) => {
  const { id } = req.params;
  const q = "SELECT *FROM users WHERE id = ?";
  db.query(q, [id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.put("/users/:id", (req, res) => {
  const { id } = req.params;
  const { val } = req.body;
  const q = `UPDATE users SET is_active = ? WHERE id = ?`;

  db.query(q, [val, id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.put("/users/update/:id", (req, res) => {
  const { id } = req.params;
  const { name, dob, address, mobile } = req.body;
  const q = `UPDATE users SET name = ?,dob = ?, address = ?, mobile = ? WHERE id = ?`;

  db.query(q, [name, dob, address, mobile, id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  const q = `DELETE FROM users WHERE id = ?`;

  db.query(q, [id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.post("/user", (req, res) => {
  const { name, dob, address, mobile, email, pass } = req.body;
  const q =
    "INSERT INTO users (name, dob, email, mobile, password, address) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(q, [name, dob, email, mobile, pass, address], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    // send success response so the frontend's axios call resolves
    return res.status(201).json({ message: "User created", id: data.insertId });
  });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
