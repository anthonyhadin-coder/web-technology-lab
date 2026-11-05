const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = 3001; // Use 3001 to avoid the macOS AirPlay port-5000 conflict.
const mongoURL = "mongodb://127.0.0.1:27017/";
const client = new MongoClient(mongoURL);

app.use(express.urlencoded({ extended: true }));

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"));
});

app.post("/server", async (req, res) => {
  try {
    const { name, password, age, mobile, email, gender, state } = req.body;
    const skills = Array.isArray(req.body.skills)
      ? req.body.skills
      : req.body.skills ? [req.body.skills] : [];

    if (!name || !password || !age || !mobile || !email || !gender || !state || skills.length === 0) {
      return res.status(400).send("All fields are mandatory. Please go back and complete the form.");
    }
    if (!/^[A-Za-z ]+$/.test(name)) return res.status(400).send("Invalid name.");
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{8,}$/.test(password)) {
      return res.status(400).send("Invalid password. Use at least 8 characters with uppercase, lowercase and a number.");
    }
    if (!Number.isInteger(Number(age)) || Number(age) < 18 || Number(age) > 100) {
      return res.status(400).send("Age must be a whole number between 18 and 100.");
    }
    if (!/^[0-9]{10}$/.test(mobile)) return res.status(400).send("Mobile number must contain exactly 10 digits.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).send("Invalid email.");
    if (!["Male", "Female"].includes(gender)) return res.status(400).send("Invalid gender.");

    const allowedStates = ["Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "Telangana", "Maharashtra", "Other"];
    if (!allowedStates.includes(state)) return res.status(400).send("Invalid state.");

    const allowedSkills = ["JavaScript", "Python", "C++", "Java"];
    if (skills.some(skill => !allowedSkills.includes(skill))) return res.status(400).send("Invalid skill selection.");

    const db = client.db("WebTechExp10");
    const collection = db.collection("registrations");

    // Store a password hash, never the original password.
    const passwordHash = await bcrypt.hash(password, 10);
    await collection.insertOne({
      name: name.trim(),
      passwordHash,
      age: Number(age),
      mobile,
      email: email.trim(),
      gender,
      state,
      skills,
      createdAt: new Date()
    });

    const savedUsers = await collection.find(
      {},
      { projection: { passwordHash: 0 } }
    ).sort({ createdAt: -1, _id: -1 }).toArray();

    const rows = savedUsers.map(user => `
      <tr>
        <td>${escapeHTML(user.name)}</td>
        <td>${escapeHTML(user.age)}</td>
        <td>${escapeHTML(user.mobile)}</td>
        <td>${escapeHTML(user.email)}</td>
        <td>${escapeHTML(user.gender)}</td>
        <td>${escapeHTML(user.state)}</td>
        <td>${escapeHTML((user.skills || []).join(", "))}</td>
      </tr>
    `).join("");

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>User Submitted Details</title>
<style>
  body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 25px; color: #1e293b; }
  .student-info { text-align: right; font-size: 12px; line-height: 1.6; }
  h1 { text-align: center; color: #1d4ed8; margin: 25px 0; }
  p { text-align: center; }
  .table-container { width: 100%; overflow-x: auto; background: white; border-radius: 8px; padding: 10px; }
  table { width: 100%; border-collapse: collapse; background: white; }
  th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; overflow-wrap: anywhere; }
  th { background: #dbeafe; color: #1e3a8a; }
  a { display: inline-block; margin-top: 20px; padding: 11px 18px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; }
</style>
</head>
<body>
  <div class="student-info"><strong>ANTHONY HADIN</strong><br>URK24CS9018</div>
  <h1>User Submitted Details</h1>
  <p>Registration saved successfully in MongoDB.</p>
  <div class="table-container">
    <table>
      <thead><tr><th>Name</th><th>Age</th><th>Mobile Number</th><th>Email</th><th>Gender</th><th>State</th><th>Skills</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
  <a href="/">Register Another User</a>
</body>
</html>`);
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).send("An error occurred while saving the registration. Check that MongoDB is running and try again.");
  }
});

async function startServer() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB Connected Successfully");
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  } catch (error) {
    console.error("Could not connect to MongoDB:", error.message);
    process.exit(1);
  }
}

startServer();
