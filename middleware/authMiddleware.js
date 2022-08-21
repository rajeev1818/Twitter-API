const jwt=require("jsonwebtoken");


const authentication = async (req, res, next) => {
    let jwtToken;
    const authHeader = req.headers["authorization"];
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      res.status(401).send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "MY_SECRET_CODE", async (error, payload) => {
        if (error) {
          res.status(401).send("Invalid JWT Token");
          
        } else {
          req.username = payload.username;
          next();
        }
      });
    }
  };

module.exports=authentication