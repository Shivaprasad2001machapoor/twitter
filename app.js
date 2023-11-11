const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

const app = express();
app.use(express.json());

let db;

const initializeDB = async () => {
  db = await open({
    filename: "twitterClone.db",
    driver: sqlite3.Database,
  });
  await db.migrate({ force: "last" });
};

initializeDB();

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  jwt.verify(token, "nknknrrfllffl", (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Invalid JWT Token" });
    }
    req.user = user;
    next();
  });
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(request.body.password, 10);
      const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}', 
          '${name}',
          '${hashedPassword}', 
          '${gender}'
        )`;
      const dbResponse = await db.run(createUserQuery);
      const newUserId = dbResponse.lastID;
      response.send("User created successfully");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

/* app.post("/register", async (request, response) => {
  try {
    const { username, password, name, gender } = request.body;
    const selectUserQuery = "SELECT * FROM user WHERE username = ?";
    const dbUser = await db.get(selectUserQuery, [username]);

    if (dbUser === undefined) {
      if (password.length < 6) {
        response.status(400);
        response.send("Password is too short");
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const createUserQuery = `
          INSERT INTO user (name, username, password, gender)
          VALUES(?, ?, ?, ?);
        `;
        await db.run(createUserQuery, [name, username, hashedPassword, gender]);

        response.status(200);
        response.send("User created successfully");
      }
    } else {
      response.status(400);
      response.send("User already exists");
    }
  } catch (error) {
    console.error("Registration error:", error);
    response.status(500);
    response.send("Internal Server Error");
  }
}); */

app.post("/login", async (request, response) => {
  try {
    const { username, password } = request.body;
    console.log("Received request with username:", username);

    const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
    console.log("Query:", selectUserQuery);

    const dbUser = await db.get(selectUserQuery);
    console.log("User from DB:", dbUser);

    if (dbUser === undefined) {
      console.log("Invalid User");
      response.status(400);
      response.send("Invalid User");
    } else {
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {
          username: username,
        };
        const jwtToken = jwt.sign(payload, "nknknrrfllffl");
        response.send({ jwtToken });
      } else {
        console.log("Invalid Password");
        response.status(400);
        response.send("Invalid Password");
      }
    }
  } catch (error) {
    console.error("Error:", error);
    response.status(500);
    response.send("Internal Server Error");
  }
});

/* app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = "SELECT * FROM user WHERE username = ?";
  const dbUser = await db.get(selectUserQuery, [username]);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const token = jwt.sign({ user_id: dbUser.user_id }, SECRET_KEY);
      response.send({ jwtToken: token });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
}); */

app.get("/user/tweets/feed", verifyToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const getTweetsFeedQuery = `
      SELECT 
        username,
        tweet,
        date_time AS dateTime
      FROM 
        follower
      INNER JOIN tweet ON follower.following_user_id = tweet.user_id
      INNER JOIN user ON user.user_id = follower.following_user_id
      WHERE 
        follower.follower_user_id = ${user_id}
      ORDER BY
        date_time DESC
      LIMIT 4
    `;
    const tweetFeedArray = await db.all(getTweetsFeedQuery);
    response.send(tweetFeedArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/user/following", verifyToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const userFollowsQuery = `
      SELECT 
        name
      FROM 
        user
      INNER JOIN follower ON user.user_id = follower.following_user_id
      WHERE 
        follower.follower_user_id = ${user_id}
    `;
    const userFollowsArray = await db.all(userFollowsQuery);
    response.send(userFollowsArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/user/followers", verifyToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const userFollowersQuery = `
      SELECT 
        name
      FROM
        user
      INNER JOIN follower ON user.user_id = follower.follower_user_id
      WHERE 
        follower.following_user_id = ${user_id}
    `;
    const userFollowersArray = await db.all(userFollowersQuery);
    response.send(userFollowersArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/tweets/:tweetId", verifyToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;
    const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;
    const tweetsResult = await db.get(tweetsQuery);

    const userFollowersQuery = `
      SELECT 
        *
      FROM  follower
      INNER JOIN user ON user.user_id = follower.following_user_id 
      WHERE 
        follower.follower_user_id  = ${user_id}
    `;

    const userFollowers = await db.all(userFollowersQuery);

    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetsResult.user_id
      ) &&
      userFollowers[0].follower_user_id === user_id
    ) {
      const getTweetDetailsQuery = `
        SELECT
          tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
        FROM 
          tweet
        INNER JOIN like ON tweet.tweet_id = like.tweet_id
        INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE 
          tweet.tweet_id = ${tweetId} AND tweet.user_id=${userFollowers[0].user_id}
      `;
      const tweetDetails = await db.get(getTweetDetailsQuery);
      response.send(tweetDetails);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/tweets/:tweetId/likes", verifyToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;
    const getLikedUsersQuery = `
      SELECT 
        *
      FROM 
        follower
      INNER JOIN tweet ON tweet.user_id = follower.following_user_id
      INNER JOIN like ON like.tweet_id = tweet.tweet_id
      INNER JOIN user ON user.user_id = like.user_id
      WHERE 
        tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}
    `;
    const likedUsers = await db.all(getLikedUsersQuery);

    if (likedUsers.length !== 0) {
      let likes = [];
      const getNamesArray = (likedUsers) => {
        for (let item of likedUsers) {
          likes.push(item.username);
        }
      };
      getNamesArray(likedUsers);
      response.send({ likes });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/tweets/:tweetId/replies", verifyToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;
    const getRepliedUsersQuery = `
      SELECT 
        *
      FROM 
        follower
      INNER JOIN tweet ON tweet.user_id = follower.following_user_id
      INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
      INNER JOIN user ON user.user_id = reply.user_id
      WHERE 
        tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}
    `;
    const repliedUsers = await db.all(getRepliedUsersQuery);

    if (repliedUsers.length !== 0) {
      let replies = [];
      const getNamesArray = (repliedUsers) => {
        for (let item of repliedUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          };
          replies.push(object);
        }
      };
      getNamesArray(repliedUsers);
      response.send({ replies });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/user/tweets", verifyToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const getUserTweetsQuery = `
      SELECT 
        tweet,
        date_time AS dateTime
      FROM 
        tweet
      WHERE 
        user_id = ${user_id}
      ORDER BY
        date_time DESC
    `;
    const userTweets = await db.all(getUserTweetsQuery);
    response.send(userTweets);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.post("/user/tweets", verifyToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const { tweet } = request.body;
    if (!tweet || tweet.length < 1 || tweet.length > 280) {
      response.status(400);
      response.send("Bad Request: Tweet content must be 1-280 characters.");
      return;
    }
    const insertTweetQuery = `
      INSERT INTO tweet (user_id, tweet, date_time)
      VALUES (${user_id}, "${tweet}", DATETIME('now'))
    `;
    await db.run(insertTweetQuery);
    response.send("Created a Tweet");
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.delete("/tweets/:tweetId", verifyToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;

    const tweetDeleteQuery = `
      DELETE FROM tweet
      WHERE 
        tweet_id = ${tweetId} AND user_id = ${user_id}
    `;
    const result = await db.run(tweetDeleteQuery);

    if (!result) {
      response.status(404);
      response.send("Tweet not found");
    } else if (result.changes === 0) {
      response.status(401);
      response.send("Unauthorized: You can only delete your own tweets");
    } else {
      response.send("Tweet Removed");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

module.exports = app;

/* const express = require("express");
const app = express();

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");

const config = require("./config.json");

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is Running at http://localhost:3000");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
  }
};

initializeDBAndServer();

const authenticateToken = (request, response, next) => {
  const authHeader = request.headers["authorization"];
  if (!authHeader) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, config.secretKey, (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.payload = payload;
        next();
      }
    });
  }
};

app.use(express.json());

app.post("/register", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = "SELECT * FROM user WHERE username = ?";
  const dbUser = await db.get(selectUserQuery, [username]);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `
        INSERT INTO user (name, username, password, gender)
        VALUES(?, ?, ?, ?);
      `;
      await db.run(createUserQuery, [name, username, hashedPassword, gender]);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = "SELECT * FROM user WHERE username = ?";
  const dbUser = await db.get(selectUserQuery, [username]);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched) {
      const token = jwt.sign({ user_id: dbUser.user_id }, config.secretKey);
      response.send({ jwtToken: token });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/user/tweets/feed", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const getTweetsFeedQuery = `
      SELECT 
        username,
        tweet,
        date_time AS dateTime
      FROM 
        follower
      INNER JOIN tweet ON follower.following_user_id = tweet.user_id
      INNER JOIN user ON user.user_id = follower.following_user_id
      WHERE 
        follower.follower_user_id = ${user_id}
      ORDER BY
        date_time DESC
      LIMIT 4
    `;
    const tweetFeedArray = await db.all(getTweetsFeedQuery);
    response.send(tweetFeedArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/user/following", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const userFollowsQuery = `
      SELECT 
        name
      FROM 
        user
      INNER JOIN follower ON user.user_id = follower.following_user_id
      WHERE 
        follower.follower_user_id = ${user_id}
    `;
    const userFollowsArray = await db.all(userFollowsQuery);
    response.send(userFollowsArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/user/followers", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const userFollowersQuery = `
      SELECT 
        name
      FROM
        user
      INNER JOIN follower ON user.user_id = follower.follower_user_id
      WHERE 
        follower.following_user_id = ${user_id}
    `;
    const userFollowersArray = await db.all(userFollowersQuery);
    response.send(userFollowersArray);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get("/tweets/:tweetId", authenticateToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;
    const tweetsQuery = `SELECT * FROM tweet WHERE tweet_id = ${tweetId}`;
    const tweetsResult = await db.get(tweetsQuery);

    const userFollowersQuery = `
      SELECT 
        *
      FROM  follower
      INNER JOIN user ON user.user_id = follower.following_user_id 
      WHERE 
        follower.follower_user_id  = ${user_id}
    `;

    const userFollowers = await db.all(userFollowersQuery);

    if (
      userFollowers.some(
        (item) => item.following_user_id === tweetsResult.user_id
      ) &&
      userFollowers[0].follower_user_id === user_id
    ) {
      const getTweetDetailsQuery = `
        SELECT
          tweet,
          COUNT(DISTINCT(like.like_id)) AS likes,
          COUNT(DISTINCT(reply.reply_id)) AS replies,
          tweet.date_time AS dateTime
        FROM 
          tweet
        INNER JOIN like ON tweet.tweet_id = like.tweet_id
        INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
        WHERE 
          tweet.tweet_id = ${tweetId} AND tweet.user_id=${userFollowers[0].user_id}
      `;
      const tweetDetails = await db.get(getTweetDetailsQuery);
      response.send(tweetDetails);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.get(
  "/tweets/:tweetId/likes",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const { payload } = request;
      const { user_id } = payload;
      const getLikedUsersQuery = `
      SELECT 
        *
      FROM 
        follower
      INNER JOIN tweet ON tweet.user_id = follower.following_user_id
      INNER JOIN like ON like.tweet_id = tweet.tweet_id
      INNER JOIN user ON user.user_id = like.user_id
      WHERE 
        tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}
    `;
      const likedUsers = await db.all(getLikedUsersQuery);

      if (likedUsers.length !== 0) {
        let likes = [];
        const getNamesArray = (likedUsers) => {
          for (let item of likedUsers) {
            likes.push(item.username);
          }
        };
        getNamesArray(likedUsers);
        response.send({ likes });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (error) {
      response.status(500);
      response.send("Internal Server Error");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies",
  authenticateToken,
  async (request, response) => {
    try {
      const { tweetId } = request.params;
      const { payload } = request;
      const { user_id } = payload;
      const getRepliedUsersQuery = `
      SELECT 
        *
      FROM 
        follower
      INNER JOIN tweet ON tweet.user_id = follower.following_user_id
      INNER JOIN reply ON reply.tweet_id = tweet.tweet_id
      INNER JOIN user ON user.user_id = reply.user_id
      WHERE 
        tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}
    `;
      const repliedUsers = await db.all(getRepliedUsersQuery);

      if (repliedUsers.length !== 0) {
        let replies = [];
        const getNamesArray = (repliedUsers) => {
          for (let item of repliedUsers) {
            let object = {
              name: item.name,
              reply: item.reply,
            };
            replies.push(object);
          }
        };
        getNamesArray(repliedUsers);
        response.send({ replies });
      } else {
        response.status(401);
        response.send("Invalid Request");
      }
    } catch (error) {
      response.status(500);
      response.send("Internal Server Error");
    }
  }
);

app.get("/user/tweets", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const getUserTweetsQuery = `
      SELECT 
        tweet,
        date_time AS dateTime
      FROM 
        tweet
      WHERE 
        user_id = ${user_id}
      ORDER BY
        date_time DESC
    `;
    const userTweets = await db.all(getUserTweetsQuery);
    response.send(userTweets);
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.post("/user/tweets", authenticateToken, async (request, response) => {
  try {
    const { user_id } = request.payload;
    const { tweet } = request.body;
    if (!tweet || tweet.length < 1 || tweet.length > 280) {
      response.status(400);
      response.send("Bad Request: Tweet content must be 1-280 characters.");
      return;
    }
    const insertTweetQuery = `
      INSERT INTO tweet (user_id, tweet, date_time)
      VALUES (${user_id}, "${tweet}", DATETIME('now'))
    `;
    await db.run(insertTweetQuery);
    response.send("Created a Tweet");
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

app.delete("/tweets/:tweetId", authenticateToken, async (request, response) => {
  try {
    const { tweetId } = request.params;
    const { payload } = request;
    const { user_id } = payload;

    const tweetDeleteQuery = `
      DELETE FROM tweet
      WHERE 
        tweet_id = ${tweetId} AND user_id = ${user_id}
    `;
    const result = await db.run(tweetDeleteQuery);

    if (!result) {
      response.status(404);
      response.send("Tweet not found");
    } else if (result.changes === 0) {
      response.status(401);
      response.send("Unauthorized: You can only delete your own tweets");
    } else {
      response.send("Tweet Removed");
    }
  } catch (error) {
    response.status(500);
    response.send("Internal Server Error");
  }
});

module.exports = app;

/* const express = require("express");
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const jwt = require("jsonwebtoken");
const { hash, compare } = require("bcrypt");

const app = express();
app.use(express.json());

let db;

// Initialize the database
const initializeDB = async () => {
  db = await open({
    filename: "twitterClone.db",
    driver: sqlite3.Database,
  });

  await db.migrate({ force: "last" });
};

initializeDB();

const SECRET_KEY = "your-secret-key";

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(401).json({ message: "Invalid JWT Token" });
    }
    req.user = user;
    next();
  });
};

// API 1: User Registration
app.post("/register/", async (req, res) => {
  const { username, password, name, gender } = req.body;

  const userExists = await db.get(
    "SELECT * FROM user WHERE username = ?",
    username
  );

  if (userExists) {
    return res.status(400).json({ message: "User already exists" });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: "Password is too short" });
  }

  const hashedPassword = await hash(password, 10);
  await db.run(
    "INSERT INTO user (username, password, name, gender) VALUES (?, ?, ?, ?)",
    [username, hashedPassword, name, gender]
  );

  res.status(200).json({ message: "User created successfully" });
});

// API 2: User Login
app.post("/login/", async (req, res) => {
  const { username, password } = req.body;

  const user = await db.get("SELECT * FROM user WHERE username = ?", username);

  if (!user) {
    return res.status(400).json({ message: "Invalid user" });
  }

  const passwordMatch = await compare(password, user.password);

  if (!passwordMatch) {
    return res.status(400).json({ message: "Invalid password" });
  }

  // If the user provides correct credentials, issue a JWT token
  const token = jwt.sign({ username: user.username }, SECRET_KEY);

  res.status(200).json({ jwtToken: token });
});

// API 3: User Feed
app.get("/user/tweets/feed/", verifyToken, async (req, res) => {
  const user = req.user.username;

  const tweets = [
    // Example tweets
    {
      username: "SrBachchan",
      tweet: "T 3859 - do something wonderful, people may imitate it ..",
      dateTime: "2021-04-07 14:50:19",
    },
    // Add more tweets
  ];

  res.status(200).json(tweets);
});

// API 4: List of People User Follows
app.get("/user/following/", verifyToken, async (req, res) => {
  const user = req.user.username;

  const following = [{ name: "Narendra Modi" }];

  res.status(200).json(following);
});

// API 5: List of People Who Follow User
app.get("/user/followers/", verifyToken, async (req, res) => {
  const user = req.user.username;

  const followers = [
    // Example followers
    { name: "Narendra Modi" },
    // Add more followers
  ];

  res.status(200).json(followers);
});

// API 6: Fetch Tweet by ID
app.get("/tweets/:tweetId/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const tweetId = req.params.tweetId;

  // Check if the user is allowed to view the tweet (you need to implement this logic)
  const userCanViewTweet = true; // Replace with your actual implementation

  if (!userCanViewTweet) {
    return res.status(401).json({ message: "Invalid Request" });
  }

  const tweet = {
    tweet: "T 3859 - do something wonderful, people may imitate it ..",
    likes: 3,
    replies: 1,
    dateTime: "2021-04-07 14:50:19",
  };

  res.status(200).json(tweet);
});

app.get("/user/tweets/", verifyToken, async (req, res) => {
  const user = req.user.username;

  // Implement fetching all tweets of the user (you need to implement this logic)
  const userTweets = [
    {
      tweet: "Ready to don the Blue and Gold",
      likes: 3,
      replies: 4,
      dateTime: "2021-4-3 08:32:44",
    },
    // Add more tweets
  ];

  if (!userTweets) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  res.status(200).json(userTweets);
});

// API 7: List of Users Who Liked a Tweet
app.get("/tweets/:tweetId/likes/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const tweetId = req.params.tweetId;

  const likedBy = ["albert"]; // Example users who liked the tweet

  if (!user) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  const userTweets = await db.get(
    "SELECT * FROM tweets WHERE tweet_id = ?",
    tweetId
  );
  if (!userTweets || userTweets.username !== user) {
    return res.status(401).json({ message: "Invalid Request" });
  }

  // Return the list of users who liked the tweet
  res.status(200).json({ likes: likedBy });
});

// API 8: List of Replies to a Tweet
app.get("/tweets/:tweetId/replies/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const tweetId = req.params.tweetId;

  if (!user) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  const userTweets = await db.get(
    "SELECT * FROM tweets WHERE tweet_id = ?",
    tweetId
  );
  if (!userTweets || userTweets.username !== user) {
    return res.status(401).json({ message: "Invalid Request" });
  }

  const replies = [
    {
      name: "Narendra Modi",
      reply: "When you see it..",
    },
    // Add more replies
  ];

  res.status(200).json({ replies });
});

// API 9: List of User's Tweets
app.post("/user/tweets/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const { tweet } = req.body;

  if (!user) {
    return res.status(401).json({ message: "Invalid JWT Token" });
  }

  res.status(201).json({ message: "Created a Tweet" });
});

// API 10: Create a Tweet
app.post("/user/tweets/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const { tweet } = req.body;

  // Implement creating a tweet and storing it in the 'tweet' table

  res.status(201).json({ message: "Created a Tweet" });
});

// API 11: Delete a Tweet
// API 11: Delete a Tweet
app.delete("/tweets/:tweetId/", verifyToken, async (req, res) => {
  const user = req.user.username;
  const tweetId = req.params.tweetId;
  if (userIsAllowedToDeleteTweet) {
    await db.run("DELETE FROM tweets WHERE id = ?", tweetId);

    res.status(200).json({ message: "Tweet Removed" });
  } else {
    res.status(401).json({ message: "Invalid Request" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
module.exports = app;

/* const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

//Authontication

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "shivaprasadjshs", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

//API 1 TO REGISTER

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username,password, name , gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}',
          '${name}',
          '${gender}',
        )`;
    const dbResponse = await db.run(createUserQuery);
    const newUserId = dbResponse.lastID;
    response.send("User created successfully");
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//API 2 TO LOGIN

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid User");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "shivaprasadjshs");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid Password");
    }
  }
});
module.exports = app;
*/
