const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const path = require("path");
const jwt = require("jsonwebtoken");




const authentication=require("./middleware/authMiddleware");


const app = express();
app.use(express.json());

let db = null;
const dbPath = path.join(__dirname, "twitterClone.db");

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};




initializeDBAndServer();





//Auth Routes

app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;
  const getUserQuery = `
    SELECT * 
    FROM user 
    WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      res.status(400);
      res.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const addUserQuery = `
            INSERT INTO 
            user (username, password, name, gender)
            VALUES ('${username}','${hashedPassword}','${name}','${gender}');`;
      await db.run(addUserQuery);
      res.send("User created successfully");
    }
  } else {
    res.status(400);
    res.send("User already exists");
  }
});

app.post("/login/", async (req, res) => {
  const { username, password } = req.body;
  const getUserQuery = `
    SELECT * 
    FROM user 
    WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    res.status(400);
    res.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    const payload = { username: username };
    if (isPasswordMatched === true) {
      const jwtToken = jwt.sign(payload, "MY_SECRET_CODE");
      res.send({ jwtToken });
    } else {
      res.status(400);
      res.send("Invalid password");
    }
  }
});

//user Routes


app.get("/user/tweets/feed/", authentication, async (req, res) => {
  const username = req.username;
  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await db.get(userQuery);

  const tweetQuery = `SELECT user.username AS username,tweet.tweet AS tweet,tweet.date_time AS dateTime FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
     INNER JOIN tweet ON follower.following_user_id=tweet.user_id 
     WHERE follower.follower_user_id=${user.user_id}
     ORDER BY tweet.date_time DESC LIMIT 4;`;
  const tweet = await db.all(tweetQuery);

  res.send(tweet);
});

app.get("/user/following/", authentication, async (req, res) => {
  const username = req.username;
  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await db.get(userQuery);
  const tweetQuery = `SELECT user.name AS name FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
    WHERE follower.follower_user_id=${user.user_id};`;

  const names = await db.all(tweetQuery);
  res.send(names);
});

app.get("/user/followers/", authentication, async (req, res) => {
  const username = req.username;
  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await db.get(userQuery);

  const tweetQuery = `SELECT user.name AS name FROM user INNER JOIN follower ON user.user_id=follower.follower_user_id WHERE follower.following_user_id=${user.user_id};`;
  const ans = await db.all(tweetQuery);
  res.send(ans);
});


app.get("/user/tweets/", authentication, async (req, res) => {
  const { username } = req;

  const userDetailsQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const userDetails = await db.get(userDetailsQuery);

  const query = `SELECT tweet.tweet,COUNT(DISTINCT like.like_id) as likes,COUNT(DISTINCT reply.reply_id) as replies,tweet.date_time as dateTime
     FROM tweet INNER JOIN reply on tweet.tweet_id = reply.tweet_id
            INNER JOIN like ON tweet.tweet_id = like.tweet_id
     WHERE 
            tweet.user_id = ${userDetails.user_id}
     GROUP BY
            tweet.tweet_id ;`;

  const allTweets = await db.all(query);
  res.send(allTweets);
});

app.post("/user/tweets/", authentication, async (req, res) => {
  const { username } = req;
  const { tweet } = req.body;
  const getUserQuery = `
    SELECT * 
    FROM user 
    WHERE username = '${username}';`;
  const dbUser = await db.get(getUserQuery);
  const addTweetQuery = `
    INSERT INTO 
      tweet (tweet)
    VALUES ('${tweet}');`;
  await db.run(addTweetQuery);
  res.send("Created a Tweet");
});


//tweet Routes

app.get("/tweets/:tweetId/", authentication, async (req, res) => {
  const username = req.username;
  const { tweetId } = req.params;
  const userQuery = `SELECT * FROM user WHERE username='${username}';`;
  const user = await db.get(userQuery);

  const tweetQuery = `SELECT user.username AS username,tweet.tweet AS tweet,tweet.date_time AS dateTime FROM user INNER JOIN follower ON user.user_id=follower.following_user_id
     INNER JOIN tweet ON follower.following_user_id=tweet.user_id 
     WHERE follower.follower_user_id=${user.user_id} AND tweet.tweet_id=${tweetId};`;

  const tweetCheck = await db.get(tweetQuery);

  if (tweetCheck === undefined) {
    res.status(401).send("Invalid Request");
  } else {
    const query = `SELECT tweet.tweet,COUNT(DISTINCT like.like_id) as likes,COUNT(DISTINCT reply.reply_id) as replies,tweet.date_time as dateTime
     FROM tweet INNER JOIN reply on tweet.tweet_id = reply.tweet_id
            INNER JOIN like ON tweet.tweet_id = like.tweet_id
     WHERE 
            tweet.tweet_id = ${tweetId}
     GROUP BY
            tweet.tweet_id ;`;
    const ans = await db.get(query);
    res.send(ans);
  }
});

app.get("/tweets/:tweetId/likes/",authentication,async (req, res) => {
    const { username } = req;
    const { tweetId } = req.params;
    const getUserQuery = `
    SELECT * 
    FROM tweet 
      INNER JOIN follower on tweet.user_id = follower.following_user_id
      INNER JOIN user on follower.follower_user_id = user.user_id
    WHERE user.username = '${username}'
      and tweet.tweet_id = ${tweetId};`;
    const dbUser = await db.get(getUserQuery);
    if (dbUser === undefined) {
      res.status(401).send("Invalid Request");
    } else {
      const getStatsQuery = `
    SELECT user.username 
    FROM like 
      INNER JOIN user on like.user_id = user.user_id
    WHERE like.tweet_id = ${tweetId};`;
      const tweet = await db.all(getStatsQuery);
      const myArray = [];
      tweet.map((eachEle) => myArray.push(eachEle.username));
      res.send({
        likes: myArray,
      });
    }
  }
);

app.get("/tweets/:tweetId/replies/", authentication, async (req, res) => {
  const username = req.username;
  const { tweetId } = req.params;
  const getUserQuery = `
    SELECT * 
    FROM tweet 
      INNER JOIN follower on tweet.user_id = follower.following_user_id
      INNER JOIN user on follower.follower_user_id = user.user_id
    WHERE user.username = '${username}'
      and tweet.tweet_id = ${tweetId};`;
  const user = await db.get(getUserQuery);

  if (user === undefined) {
    res.status(401).send("Invalid Request");
  } else {
    const query = `SELECT user.name AS name,reply.reply AS reply FROM reply INNER JOIN user ON user.user_id=reply.user_id
        WHERE reply.tweet_id=${tweetId};`;

    const ans = await db.all(query);
    res.send({ replies: ans });
  }
});



app.delete("/tweets/:tweetId/", authentication, async (req, res) => {
  const { username } = req;
  const { tweetId } = req.params;
  const getUserQuery = `
    SELECT * 
    FROM user 
    WHERE username = '${username}';`;
  const getTweetQuery = `
    SELECT * 
    FROM tweet 
    WHERE tweet_id = ${tweetId};`;
  const user = await db.get(getUserQuery);
  const tweet = await db.get(getTweetQuery);
  if (user.user_id === tweet.user_id) {
    const deleteTweetQuery = `
        DELETE 
        FROM tweet 
        WHERE tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    res.send("Tweet Removed");
  } else {
    res.status(401).send("Invalid Request");
  }
});

module.exports = db;
