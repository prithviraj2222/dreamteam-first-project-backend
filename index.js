const express = require("express");
const app = express();
const port = 3000;
const db = require("./db");
const cors = require("cors");
const nodemailer = require("nodemailer");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const ExcelJS = require("exceljs");
const { authMiddleware, adminOnly } = require("./middleware/auth");

const SECRET = "MY_SUPER_SECRET_KEY";

app.use(cors());

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
    otp,
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
});

app.post("/login", (req, res) => {
  const { email, pass } = req.body;

  const q =
    "SELECT id, role, password FROM users WHERE email = ? AND is_active = 'Y'";

  db.query(q, [email], async (err, data) => {
    if (err) return res.status(500).json(err);
    if (data.length === 0)
      return res.status(401).json({ message: "Invalid credentials" });

    const user = data[0];

    const match = await bcrypt.compare(pass, user.password);

    if (!match) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign({ id: user.id, role: user.role }, SECRET, {
      expiresIn: "1d",
    });

    res.json({
      token,
      user: { id: user.id, role: user.role },
    });
  });
});

// app.get("/users", authMiddleware, adminOnly, (req, res) => {
//   db.query(
//     `SELECT
//     users.id,
//     users.name AS user_name,
//     users.mobile,
//     users.email,
//     users.is_active,
//     cities.id AS city_id,
//     cities.name AS city_name,
//     states.id AS state_id,
//     states.name AS state_name,
//     countries.id AS country_id,
//     countries.name AS country_name
// FROM users
// INNER JOIN cities
//     ON users.city_master_id = cities.id
// INNER JOIN states
//     ON cities.state_id = states.id
// INNER JOIN countries
//     ON states.country_id = countries.id
// WHERE users.removed = 'N'
// `,
//     (err, data) => {
//       if (err) return res.status(500).json(err);
//       res.json(data);
//     },
//   );
// });

app.get("/users", authMiddleware, adminOnly, (req, res) => {
  const { countryId, stateId, cityId, active } = req.query;

  let q = `SELECT 
    users.id,
    users.name AS user_name,
    users.mobile,
    users.email,
    users.is_active,
    cities.id AS city_id,
    cities.name AS city_name,
    states.id AS state_id,
    states.name AS state_name,
    countries.id AS country_id,
    countries.name AS country_name
FROM users
INNER JOIN cities 
    ON users.city_master_id = cities.id
INNER JOIN states 
    ON cities.state_id = states.id
INNER JOIN countries 
    ON states.country_id = countries.id
WHERE users.removed = 'N' AND users.role = 'user'
`;

  const params = [];

  if (countryId) {
    q += "AND countries.id = ?";
    params.push(countryId);
  }

  if (stateId) {
    q += "AND states.id = ?";
    params.push(stateId);
  }

  if (cityId) {
    q += "AND cities.id = ?";
    params.push(cityId);
  }

  if (active) {
    q += "AND users.is_active = ?";
    params.push(active);
  }

  db.query(q, params, (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/users/export", authMiddleware, adminOnly, (req, res) => {
  const { countryId, stateId, cityId, active } = req.query;

  let q = `SELECT 
    users.id,
    users.name AS user_name,
    users.mobile,
    users.email,
    users.is_active,
    cities.id AS city_id,
    cities.name AS city_name,
    states.id AS state_id,
    states.name AS state_name,
    countries.id AS country_id,
    countries.name AS country_name
FROM users
INNER JOIN cities 
    ON users.city_master_id = cities.id
INNER JOIN states 
    ON cities.state_id = states.id
INNER JOIN countries 
    ON states.country_id = countries.id
WHERE users.removed = 'N' AND users.role = 'user'
`;

  const params = [];

  if (countryId) {
    q += "AND countries.id = ?";
    params.push(countryId);
  }

  if (stateId) {
    q += "AND states.id = ?";
    params.push(stateId);
  }

  if (cityId) {
    q += "AND cities.id = ?";
    params.push(cityId);
  }

  if (active) {
    q += "AND users.is_active = ?";
    params.push(active);
  }

  db.query(q, params, async (err, data) => {
    if (err) return res.status(500).json(err);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Users");

    sheet.columns = [
      { header: "S. No.", key: "series", width: 10 },
      { header: "Name", key: "user_name", width: 20 },
      { header: "Email", key: "email", width: 30 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Country", key: "country_name", width: 20 },
      { header: "State", key: "state_name", width: 20 },
      { header: "City", key: "city_name", width: 20 },
      { header: "Active", key: "is_active", width: 10 },
    ];

    data.forEach((user, i) => {
      sheet.addRow({
        series: i + 1,
        user_name: user.user_name,
        email: user.email,
        mobile: user.mobile,
        country_name: user.country_name,
        state_name: user.state_name,
        city_name: user.city_name,
        is_active: user.is_active === "Y" ? "Yes" : "No",
      });
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=filtered_users.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  });
});

app.get("/users-by-country", authMiddleware, adminOnly, (req, res) => {
  const q = `
    SELECT 
      countries.name AS country,
      COUNT(users.id) AS userCount
    FROM users
    INNER JOIN cities ON users.city_master_id = cities.id
    INNER JOIN states ON cities.state_id = states.id
    INNER JOIN countries ON states.country_id = countries.id
    WHERE users.removed = 'N' AND users.role = 'user'
    GROUP BY countries.id, countries.name
    ORDER BY userCount DESC
  `;

  db.query(q, (err, data) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(data);
  });
});

app.get("/user/search", (req, res) => {
  const { name } = req.query;
  const q = `SELECT 
    users.id,
    users.name AS user_name,
    users.mobile,
    users.email,
    users.is_active,
    cities.name AS city_name,
    states.name AS state_name,
    countries.name AS country_name FROM users LEFT JOIN cities ON users.city_master_id = cities.id LEFT JOIN states ON cities.state_id = states.id LEFT JOIN countries ON states.country_id = countries.id where users.removed = 'N' AND users.name LIKE ?`;
  db.query(q, [`%${name}%`], (err, data) => {
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

app.get("/users/profile/:id", authMiddleware, (req, res) => {
  const { id } = req.params;

  if (req.user.id != id && req.user.role !== "admin")
    return res.status(403).json({ message: "Forbidden" });

  const q = `SELECT 
  users.id, 
  users.name,
   users.dob, 
   users.email, 
   users.mobile, 
   users.address, 
   users.profile_image, 
   users.city_master_id AS city_id, 
   cities.name AS city_name, 
   cities.state_id, 
   states.name AS state_name, 
   states.country_id, 
   countries.name AS country_name
    FROM users 
    INNER JOIN cities 
    ON users.city_master_id = cities.id 
    INNER JOIN states 
    ON cities.state_id = states.id 
    INNER JOIN countries 
    ON states.country_id = countries.id 
    WHERE users.id = ?`;
  db.query(q, [id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.patch("/user/:id", authMiddleware, (req, res) => {
  const { id } = req.params;
  const { user } = req.body;

  if (req.user.id != id) return res.status(403).json({ message: "Forbidden" });

  const q =
    "UPDATE users SET name = ?, dob = ?, mobile = ?, address = ?, profile_image = ?, city_master_id = ? WHERE id = ?";

  db.query(
    q,
    [
      user.name,
      user.dob,
      user.mobile,
      user.address,
      user.profile_image,
      user.city_master_id,
      id,
    ],
    (err) => {
      if (err) {
        console.log("Profile photo error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      return res.json({ message: "Profile photo updated successfully" });
    },
  );
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

app.put("/user/pass/:id", async (req, res) => {
  const { id } = req.params;
  const { newPass } = req.body;

  const hashed = await bcrypt.hash(newPass, 10);
  const q = "UPDATE users SET password = ? WHERE id = ?";

  db.query(q, [hashed, id], (err) => {
    if (err) return res.status(500).json({ message: "Update failed" });
    return res.json({ message: "Password updated successfully" });
  });
});

app.put("/user/forgot-pass", async (req, res) => {
  const { newPass, email } = req.body;

  const hashed = await bcrypt.hash(newPass, 10);
  const q = "UPDATE users SET password = ? WHERE email = ?";

  db.query(q, [hashed, email], (err) => {
    if (err) return res.status(500).json({ message: "Update failed" });
    return res.json({ message: "Password updated successfully" });
  });
});

app.post("/user/verify-pass/:id", async (req, res) => {
  const { id } = req.params;
  const { oldPass } = req.body;

  const q = "SELECT password FROM users WHERE id = ?";
  db.query(q, [id], async (err, data) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (data.length === 0)
      return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(oldPass, data[0].password);
    if (!match)
      return res.status(401).json({ message: "Old password incorrect" });

    return res.json({ message: "Password verified" });
  });
});

app.put("/users/update/:id", (req, res) => {
  const { id } = req.params;
  const { name, dob, address, mobile, city_master_id } = req.body;
  const q = `UPDATE users SET name = ?,dob = ?, address = ?, mobile = ?, city_master_id = ? WHERE id = ?`;

  db.query(
    q,
    [name, dob, address, mobile, Number(city_master_id), id],
    (err, data) => {
      if (err) {
        console.log(err);
        return res.status(500).json({ error: "Database error" });
      }
      return res.status(201).json({ message: "Update" });
    },
  );
});

// app.delete("/users/:id", (req, res) => {
//   const { id } = req.params;
//   const q = `DELETE FROM users WHERE id = ?`;

//   db.query(q, [id], (err, data) => {
//     if (err) {
//       console.log(err);
//       return res.status(500).json({ error: "Database error" });
//     }
//     return res.status(201).json({ message: "Update" });
//   });
// });

app.delete("/users/:id", (req, res) => {
  const { id } = req.params;
  const q = `UPDATE users SET removed = 'Y' WHERE id = ?`;

  db.query(q, [id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.patch("/users", (req, res) => {
  const { selectedUsers } = req.body;
  const q = `UPDATE users SET removed = 'Y' WHERE id IN (?)`;

  db.query(q, [selectedUsers], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.post("/user", async (req, res) => {
  const { name, dob, address, mobile, email, pass } = req.body;
  const hashed = await bcrypt.hash(pass, 10);
  const q =
    "INSERT INTO users (name, dob, email, mobile, password, address) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(q, [name, dob, email, mobile, hashed, address], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "User created", id: data.insertId });
  });
});

//countries table api's

app.get("/country", (req, res) => {
  db.query("SELECT *FROM countries", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/country/search", (req, res) => {
  const { name } = req.query;
  const q = "SELECT *FROM countries where removed = 'N' AND name LIKE ?";
  db.query(q, [`%${name}%`], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.post("/country", (req, res) => {
  const { country } = req.body;
  const q = "INSERT INTO countries (name) VALUES (?)";
  db.query(q, [country], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res
      .status(201)
      .json({ message: "Country added", id: data.insertId });
  });
});

app.get("/country/:id", (req, res) => {
  const { id } = req.params;
  const q = "SELECT *FROM countries WHERE id = ?";
  db.query(q, [id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.put("/country/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const q = `UPDATE countries SET name = ? WHERE id = ?`;

  db.query(q, [name, id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.patch("/country/:id", (req, res) => {
  const { id } = req.params;
  const q = `UPDATE countries SET removed = 'Y' WHERE id = ?`;

  db.query(q, [id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.patch("/countries", (req, res) => {
  const { selectedCountries } = req.body;
  const q = `UPDATE countries SET removed = 'Y' WHERE id IN (?)`;

  db.query(q, [selectedCountries], (err) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

//States table api's

app.get("/states", (req, res) => {
  db.query("SELECT *FROM states", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/state/search", (req, res) => {
  const { name } = req.query;
  const q = "SELECT *FROM states where removed = 'N' AND name LIKE ?";
  db.query(q, [`%${name}%`], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.put("/state/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body.state;
  const countryId = req.body.select;

  const q = `UPDATE states SET name = ?, country_id = ? WHERE id = ?`;

  db.query(q, [name, Number(countryId), id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.post("/state", (req, res) => {
  const { countryId, stateName } = req.body;
  const q = "INSERT INTO states (name, country_id) VALUES (?, ?)";
  db.query(q, [stateName, countryId], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "State added", id: data.insertId });
  });
});

app.get("/state/:id", (req, res) => {
  const { id } = req.params;
  const q = "SELECT *FROM states WHERE id = ?";
  db.query(q, [id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/states/by-country/:countryId", (req, res) => {
  const { countryId } = req.params;
  const q =
    "SELECT id, name FROM states WHERE country_id = ? AND removed = 'N'";
  db.query(q, [countryId], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.patch("/state/:id", (req, res) => {
  const { id } = req.params;
  const q = `UPDATE states SET removed = 'Y' WHERE id = ?`;

  db.query(q, [id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.patch("/states", (req, res) => {
  const { selectedStates } = req.body;
  const q = `UPDATE states SET removed = 'Y' WHERE id IN (?)`;

  db.query(q, [selectedStates], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
  });
  return res.status(201).json({ message: "Update" });
});

//Cities table api's

app.get("/cities", (req, res) => {
  db.query("SELECT *FROM cities", (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/city/search", (req, res) => {
  const { name } = req.query;
  const q = "SELECT *FROM cities where removed = 'N' AND name LIKE ?";
  db.query(q, [`%${name}%`], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.put("/city/:id", (req, res) => {
  const { id } = req.params;
  const { name } = req.body.city;
  const stateId = req.body.select;

  const q = `UPDATE cities SET name = ?, state_id = ? WHERE id = ?`;

  db.query(q, [name, Number(stateId), id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.post("/city", (req, res) => {
  const { stateId, cityName } = req.body;
  const q = "INSERT INTO cities (name, state_id) VALUES (?, ?)";
  db.query(q, [cityName, stateId], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "City added", id: data.insertId });
  });
});

app.get("/city/:id", (req, res) => {
  const { id } = req.params;
  const q = "SELECT *FROM cities WHERE id = ?";
  db.query(q, [id], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.get("/cities/by-state/:stateId", (req, res) => {
  const { stateId } = req.params;
  const q = "SELECT id, name FROM cities WHERE state_id = ? AND removed = 'N'";
  db.query(q, [stateId], (err, data) => {
    if (err) return res.status(500).json(err);
    res.json(data);
  });
});

app.patch("/city/:id", (req, res) => {
  const { id } = req.params;
  const q = `UPDATE cities SET removed = 'Y' WHERE id = ?`;

  db.query(q, [id], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
    return res.status(201).json({ message: "Update" });
  });
});

app.patch("/cities", (req, res) => {
  const { selectedCities } = req.body;
  const q = `UPDATE cities SET removed = 'Y' WHERE id IN (?)`;

  db.query(q, [selectedCities], (err, data) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ error: "Database error" });
    }
  });
  return res.status(201).json({ message: "Update" });
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
