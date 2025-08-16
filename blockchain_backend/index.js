const express = require("express");
const cors = require("cors");

const { connect } = require("./connect");
const { authMiddleware } = require("./middlewares/auth.js");

const staticRoute = require("./routes/staticRouter");
const setRewardRoute = require("./routes/setRewardRouter");

const app = express();
const PORT = 8000;

app.use(cors());

connect("mongodb://localhost:27017/wellnest")
  .then(() => console.log("mongo started"))
  .catch((err) => console.log(err));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authMiddleware);

app.use("/pay", staticRoute);
app.use("/reward", setRewardRoute);

app.listen(PORT, () => console.log(`Server started at ${PORT}`));
